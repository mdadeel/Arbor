import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

/**
 * Recovers analyses left in indeterminate states due to worker crashes or sudden terminations,
 * and purges leftover clone directories.
 */
export async function recoverStaleAnalyses(): Promise<number> {
  const staleAfterMs = Math.max(10 * 60 * 1000, env.ANALYSIS_TIMEOUT_MS + 60 * 1000)
  const staleBefore = new Date(Date.now() - staleAfterMs)

  // 1. Mark stale analyses as failed. Capture linked PR runs first so their
  // in-progress Check Runs can also be finalized instead of hanging forever.
  const staleWhere = {
    status: { in: ['cloning', 'analyzing'] as const },
    OR: [
      { startedAt: { lt: staleBefore } },
      { startedAt: null },
    ],
  }
  const staleCandidates = await prisma.analysis.findMany({
    where: staleWhere,
    take: 1000,
    select: { id: true, pullRequestAnalysis: { select: { id: true } } },
  })
  const recoveryMessage = 'Analysis timed out or worker process restarted during execution'
  const result = await prisma.analysis.updateMany({
    where: staleWhere,
    data: { status: 'failed', errorMessage: recoveryMessage, completedAt: new Date() },
  })

  if (result.count > 0) {
    console.log(`[worker:recovery] marked ${result.count} stale analyses as failed`)
    try {
      const { failPullRequestAnalysis } = await import('@/server/services/pull-request-checks')
      for (const candidate of staleCandidates) {
        if (!candidate.pullRequestAnalysis) continue
        await failPullRequestAnalysis(candidate.id, recoveryMessage)
      }
    } catch (error) {
      console.warn('[worker:recovery] could not finalize stale GitHub Check Runs:', error instanceof Error ? error.message : 'unknown error')
    }
  }

  // System analyses have no startedAt column; mark long-running ones failed too.
  const systemResult = await prisma.systemAnalysis.updateMany({
    where: {
      status: 'analyzing',
      updatedAt: { lt: staleBefore },
    },
    data: {
      status: 'failed',
      errorMessage: 'System analysis timed out or worker process restarted during execution',
    },
  })
  if (systemResult.count > 0) {
    console.log(`[worker:recovery] marked ${systemResult.count} stale system analyses as failed`)
  }

  // 2. Re-enqueue pending work once per analysis. Keep a stable queue id for
  // deduplication, but remove a retained terminal job before retrying recovery.
  try {
    const queuedAnalyses = await prisma.analysis.findMany({
      where: { status: 'queued' },
      select: { id: true },
    })
    if (queuedAnalyses.length > 0) {
      const { getAnalysisQueue } = await import('@/server/queue')
      const queue = getAnalysisQueue()
      let enqueued = 0
      for (const item of queuedAnalyses) {
        const existing = await queue.getJob(item.id)
        if (existing) {
          const state = await existing.getState()
          if (['waiting', 'active', 'delayed', 'paused', 'waiting-children'].includes(state)) continue
          await existing.remove()
        }
        await queue.add('analyze', { analysisId: item.id }, { jobId: item.id })
        enqueued++
      }
      if (enqueued > 0) {
        console.log(`[worker:recovery] re-enqueued ${enqueued} pending queued analyses`)
      }
    }
  } catch (err: any) {
    console.warn(`[worker:recovery] warning re-enqueuing queued analyses: ${err.message}`)
  }

  // 3. Sweep only orphaned analysis-specific clone directories. Other worker
  // processes may still be active, so never delete a directory for a live job.
  try {
    if (fs.existsSync(env.CLONE_BASE_DIR)) {
      const active = await prisma.analysis.findMany({
        where: {
          status: { in: ['cloning', 'analyzing'] },
          startedAt: { gt: staleBefore },
        },
        select: { id: true },
      })
      const activeIds = new Set(active.map((analysis) => analysis.id))
      const entries = fs.readdirSync(env.CLONE_BASE_DIR)
      let removed = 0
      for (const entry of entries) {
        if (activeIds.has(entry)) continue
        fs.rmSync(path.join(env.CLONE_BASE_DIR, entry), { recursive: true, force: true })
        removed++
      }
      if (removed > 0) {
        console.log(`[worker:recovery] swept ${removed} orphaned analysis directories from ${env.CLONE_BASE_DIR}`)
      }
    }
  } catch (err: any) {
    console.warn(`[worker:recovery] warning during clone dir sweep: ${err.message}`)
  }

  return result.count
}
