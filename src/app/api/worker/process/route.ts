import { NextResponse } from 'next/server'
import fs from 'node:fs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { ANALYSIS_VERSION, runAnalysis } from '@/server/analysis'
import { analysisOptionsFromEnv } from '@/server/analysis/options'
import { cloneRepo, repoDirFor } from '@/server/services/clone'
import { resolveGitHubToken } from '@/server/services/github'
import { startPullRequestCheck, completePullRequestCheck, failPullRequestAnalysis } from '@/server/services/pull-request-checks'
import { notifyAnalysisCompleted } from '@/server/services/notifications'
import { analyzeDependencies } from '@/server/analysis/dependencies'
import { dependencyAdvisoryFindings, scoreWithDependencyRisk } from '@/server/analysis/supply-chain'
import { applyPolicyPacks, POLICY_PACKS } from '@/server/analysis/policies'
import { getEffectiveProjectPolicySettings } from '@/server/services/policy'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** Serverless fallback processor, protected by an explicitly configured cron secret. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const analysis = await prisma.analysis.findFirst({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      branch: true,
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
    },
  })

  if (!analysis) return NextResponse.json({ status: 'idle', message: 'No queued analyses' })
  if (analysis.pullRequestAnalysis?.status === 'closed') {
    await prisma.analysis.updateMany({
      where: { id: analysis.id, status: 'queued' },
      data: { status: 'failed', errorMessage: 'Pull request was closed before analysis started.', completedAt: new Date() },
    })
    return NextResponse.json({ status: 'skipped', message: 'Pull request was closed before analysis started.' })
  }

  const claim = await prisma.analysis.updateMany({
    where: { id: analysis.id, status: 'queued' },
    data: { status: 'cloning', startedAt: new Date() },
  })
  if (claim.count === 0) {
    return NextResponse.json({ status: 'idle', message: 'Another processor claimed the queued analysis' })
  }

  const { project } = analysis
  const repoDir = repoDirFor(analysis.id)
  const started = Date.now()

  try {
    const { token } = await resolveGitHubToken(project.userId, project.githubAccountId)
    if (analysis.pullRequestAnalysis) await startPullRequestCheck(analysis.id)
    const { sha } = await cloneRepo({
      repoUrl: project.repoUrl,
      repoFullName: project.repoFullName,
      branch: analysis.branch,
      destination: repoDir,
      token: token ?? undefined,
      requestedCommitSha: analysis.requestedCommitSha ?? undefined,
      pullRequestNumber: analysis.pullRequestAnalysis?.number,
    })

    await prisma.analysis.updateMany({
      where: { id: analysis.id, status: 'cloning' },
      data: { status: 'analyzing', commitSha: sha },
    })

    const remainingMs = env.ANALYSIS_TIMEOUT_MS - (Date.now() - started)
    if (remainingMs <= 0) throw new Error('Analysis timed out while the repository was being cloned.')
    const report = runAnalysis(repoDir, analysisOptionsFromEnv(remainingMs))
    const [supplyChain, policySettings] = await Promise.all([
      analyzeDependencies(repoDir),
      getEffectiveProjectPolicySettings(project.id, project.workspaceId),
    ])
    const advisoryFindings = dependencyAdvisoryFindings(supplyChain.inventory, supplyChain.advisories)
    const findings = applyPolicyPacks([...report.findings, ...advisoryFindings], policySettings)
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

    const durationMs = Date.now() - started
    const json = <T,>(value: T): Prisma.InputJsonValue => value as unknown as Prisma.InputJsonValue
    await prisma.$transaction([
      prisma.analysis.update({
        where: { id: analysis.id },
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
          dependencyGraph: json(report.importGraph),
          metrics: json(report.metrics),
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
      await completePullRequestCheck(analysis.id, { findings, overallScore: scores.overall })
    }
    await notifyAnalysisCompleted(project.id, analysis.id, scores.overall, findings).catch((error) => {
      console.warn(`[cron-worker] notification generation failed for ${analysis.id}:`, error instanceof Error ? error.message : 'unknown error')
    })

    return NextResponse.json({ status: 'completed', analysisId: analysis.id, durationMs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analysis error'
    await prisma.analysis.updateMany({
      where: { id: analysis.id, status: { not: 'completed' } },
      data: { status: 'failed', errorMessage: message.slice(0, 1000), completedAt: new Date() },
    }).catch(() => {})
    if (analysis.pullRequestAnalysis) await failPullRequestAnalysis(analysis.id, message)

    return NextResponse.json(
      { status: 'failed', analysisId: analysis.id, error: message },
      { status: 500 }
    )
  } finally {
    try {
      fs.rmSync(repoDir, { recursive: true, force: true })
    } catch {}
  }
}
