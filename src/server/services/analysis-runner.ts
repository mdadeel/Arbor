// Shared repository-analysis pipeline used by BOTH processors:
// the BullMQ worker (self-hosted) and the serverless cron route (Vercel).
// Processor-specific concerns stay outside: BullMQ jobs/progress in the worker,
// HTTP responses in the route. This module owns claiming, cloning, analyzing,
// persistence and failure classification so the two paths cannot diverge again.
import fs from 'node:fs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { ANALYSIS_VERSION, runAnalysis } from '@/server/analysis'
import { AnalysisLimitError } from '@/server/analysis/walk'
import { analysisOptionsFromEnv } from '@/server/analysis/options'
import { cloneRepo, repoDirFor } from '@/server/services/clone'
import { resolveGitHubToken } from '@/server/services/github'
import {
  startPullRequestCheck,
  completePullRequestCheck,
  failPullRequestAnalysis,
} from '@/server/services/pull-request-checks'
import { notifyAnalysisCompleted } from '@/server/services/notifications'
import { analyzeDependencies } from '@/server/analysis/dependencies'
import { analyzeHotspots } from '@/server/analysis/hotspots'
import { analyzeOwnership } from '@/server/analysis/ownership'
import { dependencyAdvisoryFindings, scoreWithDependencyRisk } from '@/server/analysis/supply-chain'
import { applyPolicyPacks, POLICY_PACKS } from '@/server/analysis/policies'
import { getEffectiveProjectPolicySettings } from '@/server/services/policy'

export type AnalysisErrorCode =
  | 'ANALYSIS_TIMEOUT'
  | 'ANALYSIS_LIMIT'
  | 'REPOSITORY_TOO_LARGE'
  | 'REPO_NOT_FOUND'
  | 'GITHUB_AUTH'
  | 'GITHUB_RATE_LIMIT'
  | 'ANALYSIS_INTERNAL'

export type AnalysisRunOutcome =
  | { status: 'completed'; analysisId: string; durationMs: number }
  /** PR closed before the run; row marked failed. */
  | { status: 'skipped'; analysisId: string; reason: string }
  /** Another processor claimed the row between selection and claim. */
  | { status: 'contended' }
// Failures are recorded by this module and then rethrown, so the BullMQ
// worker's `failed` handler keeps control of retry semantics.

const ANALYZE_SELECT = {
  id: true,
  projectId: true,
  branch: true,
  status: true,
  requestedCommitSha: true,
  pullRequestAnalysis: { select: { number: true, status: true } },
  project: {
    select: {
      id: true,
      userId: true,
      workspaceId: true,
      githubAccountId: true,
      repoUrl: true,
      repoFullName: true,
    },
  },
} satisfies Prisma.AnalysisSelect

/** Next queued repository analysis, oldest first (cron route work picker). */
export async function pickNextQueuedAnalysis() {
  return prisma.analysis.findFirst({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
    select: ANALYZE_SELECT,
  })
}

/**
 * Map a thrown error to a stable machine code for storage and UI guidance.
 * Structured codes (`CODE: message`) are matched exactly by
 * `getFailureExplanation`; the string patterns are a fallback for legacy rows.
 */
export function classifyAnalysisError(error: unknown): { code: AnalysisErrorCode; message: string } {
  const message = error instanceof Error ? error.message : 'Unknown analysis error'
  if (error instanceof AnalysisLimitError || (error instanceof Error && error.name === 'AnalysisLimitError')) {
    const code = (error as AnalysisLimitError).code
    if (code === 'REPOSITORY_TOO_LARGE') return { code, message }
    if (code === 'ANALYSIS_LIMIT') return { code, message }
    return { code: 'ANALYSIS_TIMEOUT', message }
  }
  if (/\b404\b|not found/i.test(message) && /repositor|branch|repo\b/i.test(message)) {
    return { code: 'REPO_NOT_FOUND', message }
  }
  if (/\b401\b|bad credentials|unauthorized|authentication/i.test(message)) {
    return { code: 'GITHUB_AUTH', message }
  }
  if (/\b403\b|rate limit/i.test(message)) {
    return { code: 'GITHUB_RATE_LIMIT', message }
  }
  if (/timed? ?out/i.test(message)) {
    return { code: 'ANALYSIS_TIMEOUT', message }
  }
  return { code: 'ANALYSIS_INTERNAL', message }
}

export function formatAnalysisError(code: AnalysisErrorCode, message: string): string {
  return message.startsWith(`${code}:`) ? message : `${code}: ${message}`
}

/**
 * Claim and process one repository analysis. `deadlineMs` is an optional wall
 * clock cap (serverless invocation budget); the per-analysis timeout
 * (`ANALYSIS_TIMEOUT_MS`) always applies on top of it.
 */
export async function processRepositoryAnalysis(
  analysisId: string,
  options: { deadlineMs?: number; onProgress?: (progress: number) => Promise<void> } = {}
): Promise<AnalysisRunOutcome> {
  const { deadlineMs, onProgress } = options
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: ANALYZE_SELECT,
  })
  if (!analysis) {
    throw new Error(`Analysis ${analysisId} was not found.`)
  }
  if (analysis.pullRequestAnalysis?.status === 'closed') {
    const reason = 'Pull request was closed before analysis started.'
    await prisma.analysis.updateMany({
      where: { id: analysisId, status: 'queued' },
      data: { status: 'failed', errorMessage: reason, completedAt: new Date() },
    })
    return { status: 'skipped', analysisId, reason }
  }

  // The cron route and BullMQ worker share the database. An atomic state
  // transition prevents both processors from cloning/analyzing the same job.
  const claim = await prisma.analysis.updateMany({
    where: { id: analysisId, status: 'queued' },
    data: { status: 'cloning', startedAt: new Date(), errorMessage: null, completedAt: null },
  })
  if (claim.count === 0) return { status: 'contended' }

  const project = analysis.project
  const started = Date.now()
  const repoDir = repoDirFor(analysisId)

  try {
    await onProgress?.(10)
    let token: string | null = null
    try {
      token = (await resolveGitHubToken(project.userId, project.githubAccountId)).token
    } catch (error) {
      // A stored token that fails to decrypt almost always means this
      // processor's ENCRYPTION_SECRET differs from the app that stored it.
      // Public repositories remain analyzable anonymously, so warn and continue.
      console.warn(
        `[analysis-runner] Could not decrypt the stored GitHub token for project ${project.id} (check ENCRYPTION_SECRET on this processor):`,
        error instanceof Error ? error.message : 'unknown error'
      )
    }
    if (analysis.pullRequestAnalysis) await startPullRequestCheck(analysisId)
    await onProgress?.(25)

    const { sha, gitChurn } = await cloneRepo({
      repoUrl: project.repoUrl,
      repoFullName: project.repoFullName,
      branch: analysis.branch,
      destination: repoDir,
      token: token ?? undefined,
      requestedCommitSha: analysis.requestedCommitSha ?? undefined,
      pullRequestNumber: analysis.pullRequestAnalysis?.number,
    })

    await prisma.analysis.updateMany({
      where: { id: analysisId, status: 'cloning' },
      data: { status: 'analyzing', commitSha: sha },
    })
    await onProgress?.(55)

    const budgetMs = Math.min(
      env.ANALYSIS_TIMEOUT_MS - (Date.now() - started),
      deadlineMs ? deadlineMs - Date.now() : Number.POSITIVE_INFINITY
    )
    if (budgetMs <= 0) {
      throw new AnalysisLimitError('Analysis timed out while the repository was being cloned.', 'ANALYSIS_TIMEOUT')
    }
    const report = runAnalysis(repoDir, analysisOptionsFromEnv(budgetMs))
    const [supplyChain, policySettings, hotspots, ownership] = await Promise.all([
      analyzeDependencies(repoDir),
      getEffectiveProjectPolicySettings(project.id, project.workspaceId),
      analyzeHotspots(repoDir, report.metrics.fileComplexities ?? [], gitChurn),
      analyzeOwnership(repoDir, report.structure, gitChurn),
    ])
    const persistedMetrics = {
      ...report.metrics,
      fileComplexities: (report.metrics.fileComplexities ?? []).slice(0, 50),
      hotspots,
      ownership,
    }
    const advisoryFindings = dependencyAdvisoryFindings(supplyChain.inventory, supplyChain.advisories)
    const findings = applyPolicyPacks([...report.findings, ...advisoryFindings], policySettings)
    const visibleFindings = findings.filter((finding) => !finding.policySuppressed)
    const scores = scoreWithDependencyRisk(report.scores, findings)
    const settingsByPack = new Map<string, (typeof policySettings)[number]>()
    for (const setting of policySettings) settingsByPack.set(setting.packKey, setting)
    const policySnapshot = {
      schemaVersion: 1,
      packs: POLICY_PACKS.map((pack) => {
        const setting = settingsByPack.get(pack.key)
        return {
          packKey: pack.key,
          version: setting?.version ?? pack.version,
          enabled: setting?.enabled ?? true,
          overrides: setting?.overrides ?? {},
        }
      }),
    }
    await onProgress?.(85)

    const durationMs = Date.now() - started
    const json = <T,>(value: T): Prisma.InputJsonValue => value as unknown as Prisma.InputJsonValue
    await prisma.$transaction([
      prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'completed',
          analysisVersion: ANALYSIS_VERSION,
          durationMs,
          completedAt: new Date(),
          overallScore: scores.overall,
          architectureScore: scores.architecture,
          techDebtScore: scores.techDebt,
          performanceScore: scores.performance,
          documentationScore: scores.documentation,
          securityScore: scores.security,
          designSystemScore: scores.designSystem,
          techStack: json(report.techStack),
          structure: json(report.structure),
          findings: json(findings),
          findingsCount: visibleFindings.length,
          criticalFindingsCount: visibleFindings.filter((finding) => finding.severity === 'critical').length,
          dependencyGraph: json(report.importGraph),
          metrics: json(persistedMetrics),
          designSystem: json(report.designSystem),
          dependencyInventory: json(supplyChain.inventory),
          dependencyAdvisories: json(supplyChain.advisories),
          sbom: json(supplyChain.sbom),
          policySnapshot: json(policySnapshot),
        },
      }),
      prisma.project.update({
        where: { id: project.id },
        data: {
          detectedStack: json(report.techStack),
          latestScores: json(scores),
          lastAnalyzedAt: new Date(),
        },
      }),
    ])

    if (analysis.pullRequestAnalysis) {
      await completePullRequestCheck(analysisId, {
        findings,
        overallScore: scores.overall,
      })
    }
    await notifyAnalysisCompleted(project.id, analysisId, scores.overall, findings).catch((error) => {
      console.warn(`[analysis-runner] notification generation failed for ${analysisId}:`, error instanceof Error ? error.message : 'unknown error')
    })

    await onProgress?.(100)
    return { status: 'completed', analysisId, durationMs }
  } catch (error) {
    // Record the failure with a structured code, then rethrow so the BullMQ
    // worker keeps its retry semantics (the `failed` handler decides between
    // re-queueing and a permanent failure). The cron route catches this throw.
    const { code, message } = classifyAnalysisError(error)
    const stored = formatAnalysisError(code, message)
    await prisma.analysis.updateMany({
      where: { id: analysisId, status: { not: 'completed' } },
      data: { status: 'failed', errorMessage: stored.slice(0, 1000), completedAt: new Date() },
    }).catch(() => {})
    if (analysis.pullRequestAnalysis) {
      await failPullRequestAnalysis(analysisId, stored).catch(() => {})
    }
    throw error
  } finally {
    try {
      fs.rmSync(repoDir, { recursive: true, force: true })
    } catch (error) {
      console.warn(`[analysis-runner] clone cleanup failed for ${analysisId}:`, error instanceof Error ? error.message : 'unknown error')
    }
  }
}
