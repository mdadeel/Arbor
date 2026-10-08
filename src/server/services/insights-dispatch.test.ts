import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queueAdd, consumeAnalysisQuota, tx } = vi.hoisted(() => ({
  queueAdd: vi.fn(),
  consumeAnalysisQuota: vi.fn(),
  tx: {
    scanSchedule: { updateMany: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn() },
    analysis: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    scanSchedule: { findMany: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn() },
    analysis: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  },
}))
vi.mock('@/server/queue', () => ({ getAnalysisQueue: () => ({ add: queueAdd }) }))
vi.mock('./quotas', () => ({ consumeAnalysisQuota }))

import { prisma } from '@/lib/prisma'
import { enqueueDueScheduledScans } from './insights'

const dueSchedule = {
  id: 'schedule-1', projectId: 'project-1', cadence: 'daily', branch: 'main',
  nextRunAt: new Date('2026-10-07T00:00:00Z'),
}

describe('recoverable scheduled scan dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.scanSchedule.findMany).mockResolvedValue([dueSchedule] as never)
    tx.scanSchedule.updateMany.mockResolvedValue({ count: 1 })
    tx.project.findUnique.mockResolvedValue({ id: 'project-1', status: 'active', userId: 'owner-1' })
    tx.analysis.findFirst.mockResolvedValue(null)
    tx.analysis.create.mockResolvedValue({ id: 'analysis-1' })
    consumeAnalysisQuota.mockResolvedValue(undefined)
    queueAdd.mockResolvedValue({})
  })

  it('atomically claims a due schedule, consumes the shared user quota, and enqueues one job', async () => {
    const now = new Date('2026-10-08T00:00:00Z')
    await expect(enqueueDueScheduledScans(now)).resolves.toBe(1)

    expect(tx.scanSchedule.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'schedule-1', enabled: true, nextRunAt: { lte: now } },
    }))
    expect(consumeAnalysisQuota).toHaveBeenCalledWith('owner-1')
    expect(tx.analysis.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { projectId: 'project-1', branch: 'main', status: 'queued' },
    }))
    expect(queueAdd).toHaveBeenCalledWith('analyze', { analysisId: 'analysis-1' }, { jobId: 'analysis-1' })
  })

  it('does not spend quota or create an analysis when another worker won the claim', async () => {
    tx.scanSchedule.updateMany.mockResolvedValueOnce({ count: 0 })
    await expect(enqueueDueScheduledScans()).resolves.toBe(0)
    expect(consumeAnalysisQuota).not.toHaveBeenCalled()
    expect(tx.analysis.create).not.toHaveBeenCalled()
    expect(queueAdd).not.toHaveBeenCalled()
  })

  it('skips overlapping scans and records the last dispatch explanation', async () => {
    tx.analysis.findFirst.mockResolvedValueOnce({ id: 'already-running' })
    await expect(enqueueDueScheduledScans()).resolves.toBe(0)
    expect(consumeAnalysisQuota).not.toHaveBeenCalled()
    expect(tx.scanSchedule.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'schedule-1' },
      data: { lastError: 'Skipped because another analysis was already active.' },
    }))
    expect(queueAdd).not.toHaveBeenCalled()
  })
})
