import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    analysis: { findUnique: vi.fn(), findMany: vi.fn() },
    notificationPreference: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    notification: { createMany: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { notifyAnalysisCompleted, scoreRegressed, shouldNotifyFindings } from './notifications'
import type { Finding } from '@/server/analysis/types'

const policySnapshot = { schemaVersion: 1, packs: [{ packKey: 'security', version: '1.0.0', enabled: true, overrides: {} }] }
const findings: Finding[] = [
  { id: 'critical-1', category: 'security', severity: 'critical', title: 'Credential', detail: 'Found token' },
  { id: 'suppressed-1', category: 'security', severity: 'critical', title: 'Ignored', detail: 'Suppressed', policySuppressed: true },
  { id: 'info-1', category: 'accessibility', severity: 'info', title: 'Label', detail: 'Add a label' },
]

describe('analysis notifications', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('filters by threshold and excludes policy-suppressed findings', () => {
    expect(shouldNotifyFindings(findings, 'critical').map((finding) => finding.id)).toEqual(['critical-1'])
    expect(shouldNotifyFindings(findings, 'info')).toHaveLength(2)
    expect(scoreRegressed(91, 80, 10)).toBe(true)
    expect(scoreRegressed(null, 80, 1)).toBe(false)
    expect(scoreRegressed(80, 79, 1)).toBe(true)
  })

  it('creates deduplicated finding and regression notifications for enabled project members', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'project-1', name: 'Arbor', slug: 'arbor', userId: 'owner-1', workspaceId: 'workspace-1',
      workspace: { members: [{ userId: 'owner-1' }, { userId: 'member-2' }] },
    } as never)
    vi.mocked(prisma.analysis.findUnique).mockResolvedValue({ branch: 'main', analysisVersion: 1, policySnapshot } as never)
    vi.mocked(prisma.analysis.findMany).mockResolvedValue([{
      id: 'analysis-1', branch: 'main', analysisVersion: 1, policySnapshot, overallScore: 90,
    }] as never)
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([{ userId: 'owner-1', enabled: true, minimumSeverity: 'critical', scoreRegressionThreshold: 5 }] as never)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 2 } as never)

    const created = await notifyAnalysisCompleted('project-1', 'analysis-2', 80, findings)

    expect(created).toBe(4)
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(2)
    const calls: Array<{
      skipDuplicates?: boolean
      data: Array<{ dedupeKey: string; userId: string }>
    }> = (prisma.notification.createMany as any).mock.calls.map((args: any[]) => args[0])
    expect(calls.every((call) => call.skipDuplicates && call.data.length === 2)).toBe(true)
    expect(calls.map((call) => call.data.map((item) => item.dedupeKey))).toEqual([
      ['analysis:analysis-2:finding:owner-1', 'analysis:analysis-2:regression:owner-1'],
      ['analysis:analysis-2:finding:member-2', 'analysis:analysis-2:regression:member-2'],
    ])
  })

  it('does not notify a project creator who has been removed from its workspace', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'project-1', name: 'Arbor', slug: 'arbor', userId: 'former-owner', workspaceId: 'workspace-1',
      workspace: { members: [{ userId: 'current-member' }] },
    } as never)
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as never)

    await expect(notifyAnalysisCompleted('project-1', 'analysis-4', 80, findings)).resolves.toBe(1)

    expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['current-member'] } },
    })
    const createCall = (prisma.notification.createMany as any).mock.calls[0]?.[0] as
      | { data: Array<{ userId: string }> }
      | undefined
    expect(createCall?.data.every((item) => item.userId === 'current-member')).toBe(true)
  })

  it('does not report regressions against a different effective policy snapshot', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'project-1', name: 'Arbor', slug: 'arbor', userId: 'owner-1', workspaceId: null, workspace: null,
    } as never)
    vi.mocked(prisma.analysis.findUnique).mockResolvedValue({ branch: 'main', analysisVersion: 1, policySnapshot } as never)
    vi.mocked(prisma.analysis.findMany).mockResolvedValue([{
      id: 'analysis-1', branch: 'main', analysisVersion: 1,
      policySnapshot: { schemaVersion: 1, packs: [{ packKey: 'security', version: '1.0.1', enabled: true, overrides: {} }] },
      overallScore: 95,
    }] as never)
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([] as never)

    await expect(notifyAnalysisCompleted('project-1', 'analysis-2', 50, [])).resolves.toBe(0)
    expect(prisma.notification.createMany).not.toHaveBeenCalled()
  })

  it('honors a disabled recipient preference', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'project-1', name: 'Arbor', slug: 'arbor', userId: 'owner-1', workspaceId: null, workspace: null,
    } as never)
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([{ userId: 'owner-1', enabled: false }] as never)

    await expect(notifyAnalysisCompleted('project-1', 'analysis-3', 50, findings)).resolves.toBe(0)
    expect(prisma.notification.createMany).not.toHaveBeenCalled()
  })
})
