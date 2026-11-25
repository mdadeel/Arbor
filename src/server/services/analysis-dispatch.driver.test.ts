import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => {
  const queue = () => ({ getJob: vi.fn(), add: vi.fn(), getWorkers: vi.fn(), isPaused: vi.fn() })
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() })
  return { repositoryQueue: queue(), systemQueue: queue(), analysis: model(), systemAnalysis: model() }
})
vi.mock('@/lib/env', () => ({ env: { ANALYSIS_QUEUE_DRIVER: 'db' } }))
vi.mock('@/server/queue', () => ({ getAnalysisQueue: () => m.repositoryQueue, getSystemAnalysisQueue: () => m.systemQueue }))
vi.mock('@/lib/prisma', () => ({ prisma: { analysis: m.analysis, systemAnalysis: m.systemAnalysis } }))

import { deliverQueuedAnalysis, getProcessingHealth } from './analysis-dispatch'

describe('ANALYSIS_QUEUE_DRIVER=db (serverless deployments)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.analysis.findUnique.mockResolvedValue({ status: 'queued' })
    m.analysis.findFirst.mockResolvedValue(null)
    m.analysis.updateMany.mockResolvedValue({ count: 1 })
    m.systemAnalysis.findUnique.mockResolvedValue({ status: 'queued' })
    m.systemAnalysis.findFirst.mockResolvedValue(null)
    m.systemAnalysis.updateMany.mockResolvedValue({ count: 1 })
  })

  it('treats the DB row as the queue and never touches Redis', async () => {
    await expect(deliverQueuedAnalysis('repository', 'a1')).resolves.toBe(true)
    expect(m.repositoryQueue.getJob).not.toHaveBeenCalled()
    expect(m.repositoryQueue.add).not.toHaveBeenCalled()
    expect(m.systemQueue.add).not.toHaveBeenCalled()
  })

  it('reports processing health without a resident-worker probe', async () => {
    await expect(getProcessingHealth('repository')).resolves.toEqual({
      queue: 'available',
      worker: 'unknown',
      paused: false,
      oldestQueuedAgeMs: null,
      lastStartedAt: null,
      stalled: false,
    })
    expect(m.repositoryQueue.getWorkers).not.toHaveBeenCalled()
  })

  it('skips delivery entirely for rows that are not queued', async () => {
    m.analysis.findUnique.mockResolvedValue({ status: 'cloning' })
    await expect(deliverQueuedAnalysis('repository', 'a1')).resolves.toBe(false)
    expect(m.analysis.updateMany).not.toHaveBeenCalled()
  })
})
