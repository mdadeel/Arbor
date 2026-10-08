import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { policyPackSetting: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() } } }))
vi.mock('./project-access', () => ({ requireAccessibleProject: vi.fn(), requireProjectEditor: vi.fn() }))
vi.mock('./authorization', () => ({ requireWorkspaceMembership: vi.fn() }))
vi.mock('./audit', () => ({ logAuditEvent: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { requireAccessibleProject, requireProjectEditor } from './project-access'
import { requireWorkspaceMembership } from './authorization'
import { logAuditEvent } from './audit'
import { getProjectPolicyState, updatePolicyPack } from './policy'

const project = {
  id: 'project-1', slug: 'demo', userId: 'owner-1', workspaceId: 'workspace-1',
  repoUrl: 'https://github.com/owner/repo', repoFullName: 'owner/repo', githubAccountId: null,
  defaultBranch: 'main', name: 'Demo', repoPrivate: false,
}

describe('versioned policy settings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAccessibleProject).mockResolvedValue(project)
    vi.mocked(requireProjectEditor).mockResolvedValue(undefined)
    vi.mocked(requireWorkspaceMembership).mockResolvedValue({ id: 'member-1', role: 'owner' } as never)
  })

  it('prefers project overrides while retaining workspace policy visibility', async () => {
    vi.mocked(prisma.policyPackSetting.findMany).mockResolvedValue([
      { id: 'workspace-security', workspaceId: 'workspace-1', projectId: null, packKey: 'security', version: '1.0.3', enabled: true, overrides: { 'secret-token': { severity: 'warning' } } },
      { id: 'project-security', workspaceId: null, projectId: 'project-1', packKey: 'security', version: '1.0.5', enabled: false, overrides: {} },
    ] as never)

    const state = await getProjectPolicyState('owner-1', 'demo')
    const security = state.find((pack) => pack.key === 'security')
    const maintainability = state.find((pack) => pack.key === 'maintainability')
    expect(security).toMatchObject({ workspaceAvailable: true, effective: { version: '1.0.5', enabled: false } })
    expect(security?.workspaceSetting).toMatchObject({ version: '1.0.3' })
    expect(maintainability?.effective).toMatchObject({ version: '1.0.0', enabled: true })
  })

  it('increments project policy versions and records an audit event', async () => {
    vi.mocked(prisma.policyPackSetting.findFirst).mockResolvedValue({ id: 'setting-1', version: '2.4.9' } as never)
    vi.mocked(prisma.policyPackSetting.update).mockResolvedValue({ id: 'setting-1', version: '2.4.10', packKey: 'security' } as never)

    const updated = await updatePolicyPack({
      userId: 'owner-1', slug: 'demo', packKey: 'security', scope: 'project', enabled: true,
      overrides: { 'secret-github-token': { enabled: false } },
    })

    expect(updated.version).toBe('2.4.10')
    expect(prisma.policyPackSetting.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'setting-1' },
      data: expect.objectContaining({ version: '2.4.10', projectId: 'project-1', workspaceId: null }),
    }))
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'policy_pack.updated', metadata: expect.objectContaining({ packKey: 'security', version: '2.4.10', scope: 'project' }),
    }))
  })

  it('requires workspace owner/admin rights for workspace-wide policy changes', async () => {
    vi.mocked(requireWorkspaceMembership).mockRejectedValueOnce({ code: 'FORBIDDEN' })
    await expect(updatePolicyPack({
      userId: 'member-1', slug: 'demo', packKey: 'security', scope: 'workspace', enabled: true, overrides: {},
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(prisma.policyPackSetting.create).not.toHaveBeenCalled()
  })
})
