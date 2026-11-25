import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const { repositoryQueue, systemQueue, analysis, systemAnalysis } = vi.hoisted(() => {
  const queue = () => ({ getJob: vi.fn(), add: vi.fn(), getWorkers: vi.fn(), isPaused: vi.fn() })
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() })
  return { repositoryQueue: queue(), systemQueue: queue(), analysis: model(), systemAnalysis: model() }
})
vi.mock('@/lib/env', () => ({ env: { ANALYSIS_QUEUE_DRIVER: 'bullmq' } }))
vi.mock('@/server/queue', () => ({ getAnalysisQueue: () => repositoryQueue, getSystemAnalysisQueue: () => systemQueue }))
vi.mock('@/lib/prisma', () => ({ prisma: { analysis, systemAnalysis } }))

import { deliverQueuedAnalysis, getProcessingHealth, reconcileQueuedAnalyses, QUEUE_DELIVERY_ERROR } from './analysis-dispatch'

describe('durable analysis delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    for (const model of [analysis, systemAnalysis]) {
      model.findUnique.mockResolvedValue({ status: 'queued' })
      model.findFirst.mockResolvedValue(null)
      model.findMany.mockResolvedValue([])
      model.updateMany.mockResolvedValue({ count: 1 })
    }
    for (const queue of [repositoryQueue, systemQueue]) {
      queue.getJob.mockResolvedValue(null)
      queue.add.mockResolvedValue({})
      queue.getWorkers.mockResolvedValue([])
      queue.isPaused.mockResolvedValue(false)
    }
  })
  afterEach(() => { vi.useRealTimers() })

  it.each(['repository', 'system'] as const)('delivers a missing %s job with its stable id', async (kind) => {
    await expect(deliverQueuedAnalysis(kind, 'scan-1')).resolves.toBe(true)
    const queue = kind === 'repository' ? repositoryQueue : systemQueue
    expect(queue.add).toHaveBeenCalledWith(kind === 'repository' ? 'analyze' : 'analyze-system',
      kind === 'repository' ? { analysisId: 'scan-1' } : { systemAnalysisId: 'scan-1' }, { jobId: 'scan-1' })
  })

  it.each(['waiting', 'active', 'delayed', 'paused', 'waiting-children'])('does not remove or duplicate a %s job', async (state) => {
    const job = { getState: vi.fn().mockResolvedValue(state), remove: vi.fn() }
    repositoryQueue.getJob.mockResolvedValue(job)
    await expect(deliverQueuedAnalysis('repository', 'scan-1')).resolves.toBe(true)
    expect(job.remove).not.toHaveBeenCalled()
    expect(repositoryQueue.add).not.toHaveBeenCalled()
    expect(analysis.updateMany).toHaveBeenCalledWith({
      where: { id: 'scan-1', status: 'queued', errorMessage: QUEUE_DELIVERY_ERROR }, data: { errorMessage: null },
    })
  })

  it.each(['completed', 'failed'])('removes a retained %s job before redelivering queued work', async (state) => {
    const job = { getState: vi.fn().mockResolvedValue(state), remove: vi.fn() }
    systemQueue.getJob.mockResolvedValue(job)
    await deliverQueuedAnalysis('system', 'scan-1')
    expect(job.remove).toHaveBeenCalledOnce()
    expect(systemQueue.add).toHaveBeenCalledOnce()
    expect(job.remove.mock.invocationCallOrder[0]).toBeLessThan(systemQueue.add.mock.invocationCallOrder[0])
  })

  it.each(['cloning', 'analyzing', 'completed', 'failed'])('does not dispatch a database record that is %s', async (status) => {
    analysis.findUnique.mockResolvedValue({ status })
    await expect(deliverQueuedAnalysis('repository', 'scan-1')).resolves.toBe(false)
    expect(repositoryQueue.getJob).not.toHaveBeenCalled()
    expect(analysis.updateMany).not.toHaveBeenCalled()
  })

  it('preserves queued work and records a sanitized delivery explanation when Redis fails', async () => {
    repositoryQueue.add.mockRejectedValue(new Error('redis://user:secret@internal:6379'))
    await expect(deliverQueuedAnalysis('repository', 'scan-1')).resolves.toBe(false)
    expect(analysis.updateMany).toHaveBeenCalledWith({
      where: { id: 'scan-1', status: 'queued' }, data: { errorMessage: QUEUE_DELIVERY_ERROR },
    })
    expect(JSON.stringify(analysis.updateMany.mock.calls)).not.toContain('secret@internal')
  })

  it('does not let an unavailable repository queue block system recovery', async () => {
    analysis.findMany.mockResolvedValue([{ id: 'bad' }, { id: 'good' }])
    systemAnalysis.findMany.mockResolvedValue([{ id: 'system' }])
    repositoryQueue.getJob.mockRejectedValueOnce(new Error('temporarily unavailable'))
    await reconcileQueuedAnalyses()
    expect(repositoryQueue.add).not.toHaveBeenCalled()
    expect(repositoryQueue.getJob).toHaveBeenCalledTimes(1)
    expect(systemQueue.add).toHaveBeenCalledWith('analyze-system', { systemAnalysisId: 'system' }, { jobId: 'system' })
  })

  it('continues reconciliation when a row has already been claimed by another processor', async () => {
    analysis.findMany.mockResolvedValue([{ id: 'claimed' }, { id: 'queued' }])
    analysis.findUnique.mockResolvedValueOnce({ status: 'analyzing' })
    await reconcileQueuedAnalyses()
    expect(repositoryQueue.add).toHaveBeenCalledWith('analyze', { analysisId: 'queued' }, { jobId: 'queued' })
  })

  it('distinguishes no connected worker from a paused queue', async () => {
    await expect(getProcessingHealth('repository')).resolves.toEqual({
      queue: 'available', worker: 'not-detected', paused: false,
      oldestQueuedAgeMs: null, lastStartedAt: null, stalled: false,
    })
    systemQueue.isPaused.mockResolvedValue(true)
    systemQueue.getWorkers.mockResolvedValue([{ id: 'worker' }])
    await expect(getProcessingHealth('system')).resolves.toEqual({
      queue: 'available', worker: 'connected', paused: true,
      oldestQueuedAgeMs: null, lastStartedAt: null, stalled: false,
    })
  })

  it('does not call Redis unavailable merely because worker inspection is unsupported', async () => {
    repositoryQueue.getWorkers.mockRejectedValue(new Error('CLIENT command not permitted'))
    await expect(getProcessingHealth('repository')).resolves.toEqual({
      queue: 'available', worker: 'unknown', paused: false,
      oldestQueuedAgeMs: null, lastStartedAt: null, stalled: false,
    })
  })

  it('bounds a health probe against an unresponsive queue', async () => {
    vi.useFakeTimers()
    repositoryQueue.isPaused.mockReturnValue(new Promise(() => {}))
    const result = getProcessingHealth('repository')
    await vi.advanceTimersByTimeAsync(2_500)
    await expect(result).resolves.toEqual({
      queue: 'unavailable', worker: 'unknown', paused: false,
      oldestQueuedAgeMs: null, lastStartedAt: null, stalled: false,
    })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports a queue as stalled when an old scan predates all processing activity', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T12:00:00Z'))
    analysis.findFirst
      .mockResolvedValueOnce({ createdAt: new Date('2026-10-08T09:10:19Z') })
      .mockResolvedValueOnce({ startedAt: new Date('2026-10-05T03:44:16Z') })
    const health = await getProcessingHealth('repository')
    expect(health.queue).toBe('available')
    expect(health.stalled).toBe(true)
    expect(health.oldestQueuedAgeMs).toBeGreaterThan(48 * 24 * 60 * 60_000)
    expect(health.lastStartedAt).toBe('2026-10-05T03:44:16.000Z')
  })

  it('does not call a queue stalled when processing started after the waiting row', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T12:00:00Z'))
    analysis.findFirst
      .mockResolvedValueOnce({ createdAt: new Date('2026-10-08T09:10:19Z') })
      .mockResolvedValueOnce({ startedAt: new Date('2026-11-20T08:00:00Z') })
    await expect(getProcessingHealth('repository')).resolves.toMatchObject({ stalled: false })
  })
})
