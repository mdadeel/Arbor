// Standalone analysis worker — separate process from the Next.js app.
// Start with: npm run worker
//
// The processing pipeline itself lives in src/server/services/analysis-runner.ts
// (shared with the serverless cron route). This process only owns BullMQ
// concerns: jobs, progress, retries, and the periodic dispatch loop.
import './bootstrap'
import { Worker as BullWorker } from 'bullmq'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { AnalysisLimitError } from '@/server/analysis/walk'
import {
  processRepositoryAnalysis,
  classifyAnalysisError,
  formatAnalysisError,
} from '@/server/services/analysis-runner'
import { processSystemAnalysis } from '@/server/services/system-group'
import { failPullRequestAnalysis } from '@/server/services/pull-request-checks'
import { enqueueDueScheduledScans } from '@/server/services/insights'
import { recoverStaleAnalyses, recoverInterruptedAnalyses } from './recovery'
import { reconcileQueuedAnalyses } from '@/server/services/analysis-dispatch'

// Finish startup recovery before starting consumers or sweeping clone directories.
async function main() {
  await recoverStaleAnalyses()

  const permanentFailures = new Set<string>()

  const worker = new BullWorker<{ analysisId: string }>(
    'analysis',
    async (job) => {
      try {
        const outcome = await processRepositoryAnalysis(job.data.analysisId, {
          onProgress: (progress) => job.updateProgress(progress),
        })
        if (outcome.status === 'skipped') {
          console.log(`[worker] analysis ${job.data.analysisId} skipped: ${outcome.reason}`)
        }
      } catch (error) {
        // A deterministic limit (timeout, repo size, file cap) can never succeed
        // on retry — discard the job so BullMQ does not re-run it.
        if (error instanceof AnalysisLimitError || (error instanceof Error && error.name === 'AnalysisLimitError')) {
          permanentFailures.add(job.data.analysisId)
          await job.discard()
        }
        throw error
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
    const { code, message } = classifyAnalysisError(error)
    const stored = formatAnalysisError(code, message).slice(0, 1000)
    console.error(`[worker] analysis ${analysisId} failed (${code}): ${message}`)

    const isPermanent = permanentFailures.delete(analysisId)
    const attempts = job.opts.attempts ?? 1
    const canRetry = !isPermanent && job.attemptsMade < attempts
    await prisma.analysis.updateMany({
      where: { id: analysisId, status: { not: 'completed' } },
      data: canRetry
        ? { status: 'queued', errorMessage: stored }
        : { status: 'failed', completedAt: new Date(), errorMessage: stored },
    }).catch(() => {})

    if (canRetry) {
      await prisma.pullRequestAnalysis.updateMany({
        where: { analysisId, status: 'analyzing' },
        data: { status: 'queued', errorMessage: stored },
      }).catch(() => {})
    } else {
      await failPullRequestAnalysis(analysisId, stored).catch(() => {})
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

  // Retry bookkeeping for system analyses: re-queue while attempts remain, then
  // mark the row failed so it is not stranded in `analyzing` forever.
  systemWorker.on('failed', async (job, error) => {
    const systemAnalysisId = job?.data.systemAnalysisId
    if (!systemAnalysisId) return
    const { code, message } = classifyAnalysisError(error)
    const stored = formatAnalysisError(code, message).slice(0, 1000)
    console.error(`[worker] system analysis ${systemAnalysisId} failed (${code}): ${message}`)
    const attempts = job.opts.attempts ?? 1
    const canRetry = job.attemptsMade < attempts
    await prisma.systemAnalysis.updateMany({
      where: { id: systemAnalysisId, status: { not: 'completed' } },
      data: canRetry
        ? { status: 'queued', errorMessage: stored }
        : { status: 'failed', errorMessage: stored },
    }).catch(() => {})
  })

  systemWorker.on('error', (error) => {
    console.error('[worker] system worker error:', error.message)
  })

  let scheduleDispatchActive = false
  const dispatchDueSchedules = async () => {
    if (scheduleDispatchActive) return
    scheduleDispatchActive = true
    try {
      await recoverInterruptedAnalyses()
      await reconcileQueuedAnalyses()
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

}

void main().catch((error) => {
  console.error('[worker] startup failed:', error instanceof Error ? error.message : 'unknown error')
  process.exitCode = 1
})
