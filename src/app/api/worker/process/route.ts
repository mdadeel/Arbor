import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { recoverInterruptedAnalyses } from '@/worker/recovery'
import { processSystemAnalysis } from '@/server/services/system-group'
import {
  classifyAnalysisError,
  pickNextQueuedAnalysis,
  processRepositoryAnalysis,
} from '@/server/services/analysis-runner'
import { reconcileQueuedAnalyses } from '@/server/services/analysis-dispatch'
import { enqueueDueScheduledScans } from '@/server/services/insights'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Serverless fallback processor, protected by an explicitly configured cron
 * secret. This is the primary analysis processor on serverless deployments
 * (Vercel), driven by a frequent scheduler; the DB row with status `queued`
 * is the durable queue and claims are atomic, so overlapping invocations are
 * safe. Throughput is time-budget driven with a hard job cap.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Reserve runtime for persistence/cleanup. Each analysis is claimed
  // atomically, so overlapping invocations never double-process.
  const deadline = Date.now() + 240_000
  // Recovery, schedule dispatch and reconciliation are maintenance passes: a
  // failure in one must not prevent queued work from being processed. Log only
  // the error class — raw infra messages can contain connection details.
  await recoverInterruptedAnalyses().catch((error) => {
    console.warn('[cron-worker] recovery failed:', error instanceof Error ? error.name : 'unknown')
  })
  await enqueueDueScheduledScans().catch((error) => {
    console.warn('[cron-worker] schedule dispatch failed:', error instanceof Error ? error.name : 'unknown')
  })
  // Repair rows stranded without a BullMQ job (e.g. Redis blips) even when no
  // resident worker reconcile loop is running.
  await reconcileQueuedAnalyses().catch((error) => {
    console.warn('[cron-worker] queue reconciliation failed:', error instanceof Error ? error.name : 'unknown')
  })

  const results: Array<{ kind: 'repository' | 'system'; status: string; analysisId?: string }> = []
  while (results.length < 12 && Date.now() < deadline - 60_000) {
    let foundWork = false
    const system = await prisma.systemAnalysis.findFirst({
      where: {
        OR: [
          { status: 'queued' },
          // Reclaim rows abandoned by a crashed processor after the lease.
          { status: 'analyzing', updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
        ],
      },
      orderBy: { createdAt: 'asc' }, select: { id: true },
    })
    if (system) {
      foundWork = true
      try {
        await processSystemAnalysis(system.id)
        results.push({ kind: 'system', status: 'processed', analysisId: system.id })
      } catch (error) {
        const { message } = classifyAnalysisError(error)
        console.error(`[cron-worker] system analysis ${system.id} failed: ${message}`)
        results.push({ kind: 'system', status: 'failed', analysisId: system.id })
      }
    }
    if (results.length >= 12 || Date.now() >= deadline - 60_000) break
    foundWork = (await processNextRepositoryAnalysis(deadline, results)) || foundWork
    if (!foundWork) break
  }
  return NextResponse.json({ status: results.length ? 'processed' : 'idle', results })
}

async function processNextRepositoryAnalysis(
  deadline: number,
  results: Array<{ kind: 'repository' | 'system'; status: string; analysisId?: string }>
): Promise<boolean> {
  const analysis = await pickNextQueuedAnalysis()
  if (!analysis) return false
  if (analysis.pullRequestAnalysis?.status === 'closed') {
    // Let the runner record the skip so both processors behave identically.
    const outcome = await processRepositoryAnalysis(analysis.id, { deadlineMs: deadline })
    results.push({
      kind: 'repository',
      status: outcome.status === 'skipped' ? 'skipped' : outcome.status,
      analysisId: analysis.id,
    })
    return true
  }

  try {
    const outcome = await processRepositoryAnalysis(analysis.id, { deadlineMs: deadline })
    if (outcome.status === 'contended') return true // claimed elsewhere; try the next row
    results.push({ kind: 'repository', status: outcome.status, analysisId: analysis.id })
  } catch (error) {
    const { code, message } = classifyAnalysisError(error)
    console.error(`[cron-worker] analysis ${analysis.id} failed (${code}): ${message}`)
    results.push({ kind: 'repository', status: 'failed', analysisId: analysis.id })
  }
  return true
}
