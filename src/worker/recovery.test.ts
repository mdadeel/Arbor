import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queueGetJobMock, queueAddMock, failPrMock } = vi.hoisted(() => ({
  queueGetJobMock: vi.fn(),
  queueAddMock: vi.fn(),
  failPrMock: vi.fn(),
}))
vi.mock('@/server/queue', () => ({
  getAnalysisQueue: () => ({ getJob: queueGetJobMock, add: queueAddMock }),
}))
vi.mock('@/server/services/pull-request-checks', () => ({
  failPullRequestAnalysis: failPrMock,
}))

vi.mock('@/lib/env', () => ({
  env: {
    CLONE_BASE_DIR: '/tmp/arbor-clones-test',
    ANALYSIS_TIMEOUT_MS: 300_000,
  },
}))

import { recoverStaleAnalyses } from './recovery'
import { prisma } from '@/lib/prisma'
import fs from 'node:fs'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    analysis: {
      updateMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    systemAnalysis: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}))

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    rmSync: vi.fn(),
  },
}))

describe('Worker Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks stale analyses as failed and sweeps orphaned directories', async () => {
    vi.mocked(prisma.analysis.updateMany).mockResolvedValueOnce({ count: 2 })
    vi.mocked(fs.existsSync).mockReturnValueOnce(true)
    vi.mocked(fs.readdirSync).mockReturnValueOnce(['orphaned-proj-1', 'orphaned-proj-2'] as any)

    const count = await recoverStaleAnalyses()
    expect(count).toBe(2)
    expect(prisma.analysis.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['cloning', 'analyzing'] },
        }),
        data: expect.objectContaining({
          status: 'failed',
        }),
      })
    )
    expect(fs.rmSync).toHaveBeenCalledTimes(2)
  })

  it('finalizes a linked pull-request check when its analysis becomes stale', async () => {
    vi.mocked(prisma.analysis.findMany).mockResolvedValueOnce([
      { id: 'stale-pr-analysis', pullRequestAnalysis: { id: 'pr-run-1' } },
    ] as any)
    vi.mocked(prisma.analysis.updateMany).mockResolvedValueOnce({ count: 1 })

    await recoverStaleAnalyses()

    expect(failPrMock).toHaveBeenCalledWith(
      'stale-pr-analysis',
      'Analysis timed out or worker process restarted during execution'
    )
  })

  it('retries retained terminal jobs without duplicating waiting jobs', async () => {
    vi.mocked(prisma.analysis.updateMany).mockResolvedValueOnce({ count: 0 })
    vi.mocked(prisma.analysis.findMany).mockResolvedValueOnce([] as any).mockResolvedValueOnce([
      { id: 'failed-analysis' },
      { id: 'waiting-analysis' },
    ] as any)
    const failedJob = { getState: vi.fn().mockResolvedValue('failed'), remove: vi.fn().mockResolvedValue(undefined) }
    const waitingJob = { getState: vi.fn().mockResolvedValue('waiting'), remove: vi.fn() }
    queueGetJobMock.mockResolvedValueOnce(failedJob).mockResolvedValueOnce(waitingJob)
    queueAddMock.mockResolvedValueOnce({})

    await recoverStaleAnalyses()

    expect(failedJob.remove).toHaveBeenCalledOnce()
    expect(waitingJob.remove).not.toHaveBeenCalled()
    expect(queueAddMock).toHaveBeenCalledOnce()
    expect(queueAddMock).toHaveBeenCalledWith('analyze', { analysisId: 'failed-analysis' }, { jobId: 'failed-analysis' })
  })

  it('handles empty directories or non-existent clone dir gracefully', async () => {
    vi.mocked(prisma.analysis.updateMany).mockResolvedValueOnce({ count: 0 })
    vi.mocked(fs.existsSync).mockReturnValueOnce(false)

    const count = await recoverStaleAnalyses()
    expect(count).toBe(0)
    expect(fs.rmSync).not.toHaveBeenCalled()
  })
})
