import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    CLONE_BASE_DIR: '/tmp/arbor-clones-test',
  },
}))

import { recoverStaleAnalyses } from './recovery'
import { prisma } from '@/lib/prisma'
import fs from 'node:fs'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    analysis: {
      updateMany: vi.fn(),
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

  it('handles empty directories or non-existent clone dir gracefully', async () => {
    vi.mocked(prisma.analysis.updateMany).mockResolvedValueOnce({ count: 0 })
    vi.mocked(fs.existsSync).mockReturnValueOnce(false)

    const count = await recoverStaleAnalyses()
    expect(count).toBe(0)
    expect(fs.rmSync).not.toHaveBeenCalled()
  })
})
