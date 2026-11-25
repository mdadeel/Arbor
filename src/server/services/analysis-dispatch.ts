import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { getAnalysisQueue, getSystemAnalysisQueue } from '@/server/queue'

export type AnalysisKind = 'repository' | 'system'
export const QUEUE_DELIVERY_ERROR = 'Queue delivery is unavailable. Your scan is saved and will be retried automatically when the worker reconnects.'

// Never expose connection URLs or infrastructure errors to report viewers.
export async function deliverQueuedAnalysis(kind: AnalysisKind, id: string): Promise<boolean> {
  return await tryDelivery(kind, id) === 'delivered'
}

async function tryDelivery(kind: AnalysisKind, id: string): Promise<'delivered' | 'not-queued' | 'unavailable'> {
  const record = kind === 'repository'
    ? await prisma.analysis.findUnique({ where: { id }, select: { status: true } })
    : await prisma.systemAnalysis.findUnique({ where: { id }, select: { status: true } })
  if (record?.status !== 'queued') return 'not-queued'

  // DB driver: the queued row IS the queue. The serverless cron route claims
  // rows atomically, so there is nothing to deliver — just clear stale errors.
  if (env.ANALYSIS_QUEUE_DRIVER === 'db') {
    await prisma.analysis.updateMany({ where: { id, status: 'queued' as const, errorMessage: QUEUE_DELIVERY_ERROR }, data: { errorMessage: null } })
    await prisma.systemAnalysis.updateMany({ where: { id, status: 'queued' as const, errorMessage: QUEUE_DELIVERY_ERROR }, data: { errorMessage: null } })
    return 'delivered'
  }

  try {
    const queue = kind === 'repository' ? getAnalysisQueue() : getSystemAnalysisQueue()
    const existing = await queue.getJob(id)
    const state = existing ? await existing.getState() : null
    // An active BullMQ job may not yet have claimed its database record.
    // Never remove live work or bypass retry backoff.
    if (!existing || (state && ['completed', 'failed', 'unknown'].includes(state))) {
      if (existing) await existing.remove()
      if (kind === 'repository') {
        await getAnalysisQueue().add('analyze', { analysisId: id }, { jobId: id })
      } else {
        await getSystemAnalysisQueue().add('analyze-system', { systemAnalysisId: id }, { jobId: id })
      }
    }
    const clearError = { where: { id, status: 'queued' as const, errorMessage: QUEUE_DELIVERY_ERROR }, data: { errorMessage: null } }
    if (kind === 'repository') await prisma.analysis.updateMany(clearError)
    else await prisma.systemAnalysis.updateMany(clearError)
    return 'delivered'
  } catch {
    // The database is the durable pending-work record. Do not delete it or ask
    // the user to create another scan when Redis delivery fails.
    const deliveryError = { where: { id, status: 'queued' as const }, data: { errorMessage: QUEUE_DELIVERY_ERROR } }
    if (kind === 'repository') await prisma.analysis.updateMany(deliveryError)
    else await prisma.systemAnalysis.updateMany(deliveryError)
    return 'unavailable'
  }
}

export type ProcessingHealth = {
  queue: 'available' | 'unavailable'
  worker: 'connected' | 'not-detected' | 'unknown'
  paused: boolean
  // Optional so older callers/tests that only consume connectivity stay valid.
  oldestQueuedAgeMs?: number | null
  lastStartedAt?: string | null
  stalled?: boolean
}

// A connection can be healthy while nothing has actually been processed for
// days. Detect that from durable rows so the UI never reports a healthy queue
// for a scan that has been waiting since before the last completed analysis.
const STALLED_QUEUE_MS = 30 * 60_000
const NO_STALL = { oldestQueuedAgeMs: null, lastStartedAt: null, stalled: false }

async function getStallSignals(kind: AnalysisKind) {
  try {
    const oldestQueued = kind === 'repository'
      ? await prisma.analysis.findFirst({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
      : await prisma.systemAnalysis.findFirst({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
    if (!oldestQueued) return NO_STALL

    const lastStarted = kind === 'repository'
      ? (await prisma.analysis.findFirst({ where: { startedAt: { not: null } }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } }))?.startedAt
      : (await prisma.systemAnalysis.findFirst({ where: { status: { not: 'queued' } }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }))?.updatedAt

    const queuedAt = new Date(oldestQueued.createdAt).getTime()
    const ageMs = Math.max(0, Date.now() - queuedAt)
    const startedAt = lastStarted ? new Date(lastStarted).getTime() : null
    return {
      oldestQueuedAgeMs: ageMs,
      lastStartedAt: startedAt === null ? null : new Date(startedAt).toISOString(),
      stalled: ageMs >= STALLED_QUEUE_MS && (startedAt === null || startedAt < queuedAt),
    }
  } catch {
    return NO_STALL
  }
}

export async function getProcessingHealth(kind: AnalysisKind): Promise<ProcessingHealth> {
  const stall = await getStallSignals(kind)
  // With the DB driver there is no BullMQ consumer by design; the cron route
  // processes rows. Report health as unknown rather than alarming users with
  // "worker not detected" for an architecture that has no resident worker.
  if (env.ANALYSIS_QUEUE_DRIVER === 'db') {
    return { queue: 'available', worker: 'unknown', paused: false, ...stall }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const queue = kind === 'repository' ? getAnalysisQueue() : getSystemAnalysisQueue()
    const [workers, paused] = await Promise.race([
      Promise.allSettled([queue.getWorkers(), queue.isPaused()]),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Queue probe timed out')), 2_500)
      }),
    ])
    return {
      queue: paused.status === 'fulfilled' ? 'available' : 'unavailable',
      worker: workers.status === 'fulfilled' ? (workers.value.length > 0 ? 'connected' : 'not-detected') : 'unknown',
      paused: paused.status === 'fulfilled' && paused.value,
      ...stall,
    }
  } catch {
    return { queue: 'unavailable', worker: 'unknown', paused: false, ...stall }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Reconcile both durable queues; one bad job must not block unrelated work. */
export async function reconcileQueuedAnalyses(): Promise<void> {
  const [analyses, systems] = await Promise.all([
    prisma.analysis.findMany({ where: { status: 'queued' }, select: { id: true } }),
    prisma.systemAnalysis.findMany({ where: { status: 'queued' }, select: { id: true } }),
  ])
  for (const [kind, rows] of [['repository', analyses], ['system', systems]] as const) {
    for (const { id } of rows) {
      try {
        // Stop this queue on outage, rather than opening a new Redis connection
        // for every pending row. The other queue and next periodic pass still run.
        if (await tryDelivery(kind, id) === 'unavailable') break
      } catch {
        console.warn(`[worker:recovery] could not reconcile ${kind} analysis ${id}`)
      }
    }
  }
}
