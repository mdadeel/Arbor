import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

/**
 * Recovers analyses left in indeterminate states due to worker crashes or sudden terminations,
 * and purges leftover clone directories.
 */
export async function recoverStaleAnalyses(): Promise<number> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

  // 1. Mark stale analyses as failed
  const result = await prisma.analysis.updateMany({
    where: {
      status: { in: ['cloning', 'analyzing'] },
      OR: [
        { startedAt: { lt: tenMinutesAgo } },
        { startedAt: null },
      ],
    },
    data: {
      status: 'failed',
      errorMessage: 'Analysis timed out or worker process restarted during execution',
      completedAt: new Date(),
    },
  })

  if (result.count > 0) {
    console.log(`[worker:recovery] marked ${result.count} stale analyses as failed`)
  }

  // 2. Re-enqueue any pending queued analyses
  try {
    const queuedAnalyses = await prisma.analysis.findMany({
      where: { status: 'queued' },
      select: { id: true },
    })
    if (queuedAnalyses.length > 0) {
      const { getAnalysisQueue } = await import('@/server/queue')
      const queue = getAnalysisQueue()
      for (const item of queuedAnalyses) {
        await queue.add('analyze', { analysisId: item.id })
      }
      console.log(`[worker:recovery] re-enqueued ${queuedAnalyses.length} pending queued analyses`)
    }
  } catch (err: any) {
    console.warn(`[worker:recovery] warning re-enqueuing queued analyses: ${err.message}`)
  }

  // 3. Sweep orphaned clone directories
  try {
    if (fs.existsSync(env.CLONE_BASE_DIR)) {
      const entries = fs.readdirSync(env.CLONE_BASE_DIR)
      for (const entry of entries) {
        const fullPath = path.join(env.CLONE_BASE_DIR, entry)
        fs.rmSync(fullPath, { recursive: true, force: true })
      }
      if (entries.length > 0) {
        console.log(`[worker:recovery] swept ${entries.length} orphaned clone directories from ${env.CLONE_BASE_DIR}`)
      }
    }
  } catch (err: any) {
    console.warn(`[worker:recovery] warning during clone dir sweep: ${err.message}`)
  }

  return result.count
}
