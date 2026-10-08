import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fingerprintFinding } from '@/server/analysis/finding-fingerprint'

const { tx } = vi.hoisted(() => ({
  tx: {
    findingTriage: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    findingTriageEvent: { create: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    findingTriage: { findMany: vi.fn(), findFirst: vi.fn() },
    findingTriageEvent: { findMany: vi.fn() },
    workspaceMember: { findUnique: vi.fn() },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  },
}))
vi.mock('./project-access', () => ({
  requireAccessibleProject: vi.fn(),
  requireProjectEditor: vi.fn(),
}))
vi.mock('./audit', () => ({ logAuditEvent: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { requireAccessibleProject, requireProjectEditor } from './project-access'
import { logAuditEvent } from './audit'
import { getFindingTriageHistory, updateFindingTriage } from './finding-triage'

const project = {
  id: 'project-1', slug: 'demo', userId: 'user-1', workspaceId: null,
  repoUrl: 'https://github.com/owner/repo', repoFullName: 'owner/repo', githubAccountId: null,
  defaultBranch: 'main', name: 'Demo', repoPrivate: false,
}

describe('persistent finding triage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAccessibleProject).mockResolvedValue(project)
    vi.mocked(requireProjectEditor).mockResolvedValue(undefined)
  })

  it('persists the stable fingerprint, status event, note, and audit entry transactionally', async () => {
    tx.findingTriage.findUnique.mockResolvedValue(null)
    tx.findingTriage.upsert.mockResolvedValue({ id: 'triage-1', status: 'accepted_risk' })
    tx.findingTriageEvent.create.mockResolvedValue({ id: 'event-1' })
    const finding = { id: 'finding-instance-3', ruleId: 'a11y-button-name', file: 'src/Button.tsx', title: 'Button has no accessible name' }

    const result = await updateFindingTriage({
      userId: 'user-1', slug: 'demo', finding, status: 'accepted_risk', note: 'Confirmed by product owner.',
    })

    const fingerprint = fingerprintFinding(finding)
    expect(result).toMatchObject({ id: 'triage-1', status: 'accepted_risk' })
    expect(tx.findingTriage.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_fingerprint: { projectId: 'project-1', fingerprint } },
      create: expect.objectContaining({
        projectId: 'project-1', fingerprint, ruleId: 'a11y-button-name',
        status: 'accepted_risk', note: 'Confirmed by product owner.', updatedById: 'user-1',
      }),
    }))
    expect(tx.findingTriageEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      triageId: 'triage-1', actorId: 'user-1', fromStatus: null, toStatus: 'accepted_risk',
    }) })
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'finding.triaged', entityId: 'triage-1', metadata: expect.objectContaining({ status: 'accepted_risk', fingerprint }),
    }))
  })

  it('returns an empty history for an unknown finding and denies updates to viewers', async () => {
    vi.mocked(requireProjectEditor).mockRejectedValueOnce({ code: 'FORBIDDEN' })
    await expect(updateFindingTriage({
      userId: 'viewer-1', slug: 'demo', finding: { id: 'f1', title: 'Issue' }, status: 'resolved',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(tx.findingTriage.upsert).not.toHaveBeenCalled()

    vi.mocked(prisma.findingTriage.findFirst).mockResolvedValue(null as never)
    await expect(getFindingTriageHistory('user-1', 'demo', 'a'.repeat(64))).resolves.toEqual([])
  })
})
