import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queueAdd, getAnalysisQueue, consumeAnalysisQuota, tx } = vi.hoisted(() => ({
  queueAdd: vi.fn(),
  getAnalysisQueue: vi.fn(),
  consumeAnalysisQuota: vi.fn(),
  tx: {
    scanSchedule: { updateMany: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn() },
    analysis: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/env', () => ({ env: { ANALYSIS_QUEUE_DRIVER: 'db' } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    scanSchedule: { findMany: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn() },
    analysis: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  },
}))
vi.mock('@/server/queue', () => ({ getAnalysisQueue }))
vi.mock('./quotas', () => ({ consumeAnalysisQuota }))

import { prisma } from '@/lib/prisma'
import { enqueueDueScheduledScans } from './insights'

describe('scheduled scans with ANALYSIS_QUEUE_DRIVER=db', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.scanSchedule.findMany).mockResolvedValue([{
      id: 'schedule-1', projectId: 'project-1', cadence: 'daily', branch: 'main',
      nextRunAt: new Date('2026-10-07T00:00:00Z'),
    }] as never)
    tx.scanSchedule.updateMany.mockResolvedValue({ count: 1 })
    tx.project.findUnique.mockResolvedValue({ id: 'project-1', status: 'active', userId: 'owner-1' })
    tx.analysis.findFirst.mockResolvedValue(null)
    tx.analysis.create.mockResolvedValue({ id: 'analysis-1' })
    consumeAnalysisQuota.mockResolvedValue(undefined)
    getAnalysisQueue.mockReturnValue({ add: queueAdd })
  })

  it('persists the queued row without constructing a BullMQ producer', async () => {
    await expect(enqueueDueScheduledScans()).resolves.toBe(1)
    expect(tx.analysis.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { projectId: 'project-1', branch: 'main', status: 'queued' },
    }))
    expect(getAnalysisQueue).not.toHaveBeenCalled()
    expect(queueAdd).not.toHaveBeenCalled()
  })
})
