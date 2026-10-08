// Standalone analysis worker — separate process from the Next.js app.
// Start with: npm run worker
import './bootstrap'
import fs from 'node:fs'
import { Worker as BullWorker } from 'bullmq'
import type { Prisma } from '@prisma/client'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { ANALYSIS_VERSION, AnalysisLimitError, runAnalysis } from '@/server/analysis'
import { analysisOptionsFromEnv } from '@/server/analysis/options'
import { cloneRepo, repoDirFor } from '@/server/services/clone'
import { resolveGitHubToken } from '@/server/services/github'
import { startPullRequestCheck, completePullRequestCheck, failPullRequestAnalysis } from '@/server/services/pull-request-checks'
import { processSystemAnalysis } from '@/server/services/system-group'
import { notifyAnalysisCompleted } from '@/server/services/notifications'
import { analyzeDependencies } from '@/server/analysis/dependencies'
import { dependencyAdvisoryFindings, scoreWithDependencyRisk } from '@/server/analysis/supply-chain'
import { applyPolicyPacks, POLICY_PACKS } from '@/server/analysis/policies'
import { getEffectiveProjectPolicySettings } from '@/server/services/policy'
import { enqueueDueScheduledScans } from '@/server/services/insights'
import { recoverStaleAnalyses } from './recovery'

// Recover stale jobs before they can be picked up by this process.
recoverStaleAnalyses().catch((err) => {
  console.error('[worker] startup recovery error:', err instanceof Error ? err.message : 'unknown error')
})

const permanentFailures = new Set<string>()

const worker = new BullWorker<{ analysisId: string }>(
  'analysis',
  async (job) => {
    const { analysisId } = job.data
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
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
      },
    })
    if (!analysis) throw new Error(`Analysis ${analysisId} was not found.`)
    if (analysis.pullRequestAnalysis?.status === 'closed') {
      await prisma.analysis.updateMany({
        where: { id: analysisId, status: 'queued' },
        data: { status: 'failed', completedAt: new Date(), errorMessage: 'Pull request was closed before analysis started.' },
      })
      return
    }

    // The cron route and BullMQ worker share the database. An atomic state
    // transition prevents both processors from cloning/analyzing the same job.
    const claim = await prisma.analysis.updateMany({
      where: { id: analysisId, status: 'queued' },
      data: { status: 'cloning', startedAt: new Date() },
    })
    if (claim.count === 0) return

    const project = analysis.project
    const started = Date.now()
    const repoDir = repoDirFor(analysisId)

    try {
      await job.updateProgress(10)
      const { token } = await resolveGitHubToken(project.userId, project.githubAccountId)
      if (analysis.pullRequestAnalysis) await startPullRequestCheck(analysisId)
      await job.updateProgress(25)

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
        where: { id: analysisId, status: 'cloning' },
        data: { status: 'analyzing', commitSha: sha },
      })
      await job.updateProgress(55)

      const remainingMs = env.ANALYSIS_TIMEOUT_MS - (Date.now() - started)
      if (remainingMs <= 0) {
        throw new AnalysisLimitError('Analysis timed out while the repository was being cloned.', 'ANALYSIS_TIMEOUT')
      }
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
      await job.updateProgress(85)

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
        await completePullRequestCheck(analysisId, {
          findings,
          overallScore: scores.overall,
        })
      }
      await notifyAnalysisCompleted(project.id, analysisId, scores.overall, findings).catch((error) => {
        console.warn(`[worker] notification generation failed for analysis ${analysisId}:`, error instanceof Error ? error.message : 'unknown error')
      })

      await job.updateProgress(100)
      console.log(`[worker] analysis ${analysisId} completed in ${durationMs}ms`)
    } catch (error) {
      if (error instanceof AnalysisLimitError || (error instanceof Error && error.name === 'AnalysisLimitError')) {
        permanentFailures.add(analysisId)
        await job.discard()
      }
      throw error
    } finally {
      try {
        fs.rmSync(repoDir, { recursive: true, force: true })
      } catch (error) {
        console.warn(`[worker] clone cleanup failed for analysis ${analysisId}:`, error instanceof Error ? error.message : 'unknown error')
      }
    }
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 1,
    lockDuration: Math.max(30_000, env.ANALYSIS_TIMEOUT_MS + 30_000),
  }
)

worker.on('failed', async (job, error) => {
  const analysisId = job?.data.analysisId
  if (!analysisId) return
  console.error(`[worker] analysis ${analysisId} failed: ${error.message}`)

  try {
    fs.rmSync(repoDirFor(analysisId), { recursive: true, force: true })
  } catch {}

  const isPermanent = permanentFailures.delete(analysisId)
  const attempts = job.opts.attempts ?? 1
  const canRetry = !isPermanent && job.attemptsMade < attempts
  await prisma.analysis.updateMany({
    where: { id: analysisId, status: { not: 'completed' } },
    data: canRetry
      ? { status: 'queued', errorMessage: error.message.slice(0, 1000) }
      : { status: 'failed', completedAt: new Date(), errorMessage: error.message.slice(0, 1000) },
  }).catch(() => {})

  if (canRetry) {
    await prisma.pullRequestAnalysis.updateMany({
      where: { analysisId, status: 'analyzing' },
      data: { status: 'queued', errorMessage: error.message.slice(0, 1000) },
    }).catch(() => {})
  } else {
    await failPullRequestAnalysis(analysisId, error.message)
  }
})

worker.on('error', (error) => {
  console.error('[worker] error:', error.message)
})

// System (cross-repository) analyses run on their own queue because they are
// CPU-light, database-correlation work rather than clone+parse work.
const systemWorker = new BullWorker<{ systemAnalysisId: string }>(
  'system-analysis',
  async (job) => {
    await processSystemAnalysis(job.data.systemAnalysisId)
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 2,
    lockDuration: 60_000,
  }
)

systemWorker.on('failed', (job, error) => {
  console.error(`[worker] system analysis ${job?.data.systemAnalysisId} failed: ${error.message}`)
})

systemWorker.on('error', (error) => {
  console.error('[worker] system worker error:', error.message)
})

let scheduleDispatchActive = false
const dispatchDueSchedules = async () => {
  if (scheduleDispatchActive) return
  scheduleDispatchActive = true
  try {
    const count = await enqueueDueScheduledScans()
    if (count > 0) console.log(`[worker] enqueued ${count} scheduled scan(s)`)
  } catch (error) {
    console.warn('[worker] scheduled scan dispatch failed:', error instanceof Error ? error.message : 'unknown error')
  } finally {
    scheduleDispatchActive = false
  }
}
void dispatchDueSchedules()
const scheduleDispatchInterval = setInterval(() => void dispatchDueSchedules(), 30_000)
scheduleDispatchInterval.unref()

console.log(`[worker] Arbor analysis worker running (timeout: ${env.ANALYSIS_TIMEOUT_MS}ms)`)
