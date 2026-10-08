import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/queue', () => ({
  getSystemAnalysisQueue: () => ({ add: vi.fn() }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    projectGroup: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    workspaceMember: { findUnique: vi.fn() },
    project: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { createGroup, getGroupBySlug, listGroups } from './system-group'

describe('project-group authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not list another workspace group without membership', async () => {
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null as any)

    await expect(listGroups('user-1', 'workspace-secret-id'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(prisma.projectGroup.findMany).not.toHaveBeenCalled()
  })

  it('does not create a workspace group for a non-member', async () => {
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null as any)

    await expect(createGroup('user-1', {
      name: 'Services',
      workspaceId: 'workspace-secret-id',
      members: [
        { projectId: 'project-1', role: 'frontend' as any },
        { projectId: 'project-2', role: 'backend' as any },
      ],
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(prisma.projectGroup.create).not.toHaveBeenCalled()
  })

  it('does not link projects the caller cannot access', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([] as any)

    await expect(createGroup('user-1', {
      name: 'Services',
      members: [
        { projectId: 'foreign-project-1', role: 'frontend' as any },
        { projectId: 'foreign-project-2', role: 'backend' as any },
      ],
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(prisma.projectGroup.create).not.toHaveBeenCalled()
  })

  it('hides a personal group if a member project is no longer accessible', async () => {
    vi.mocked(prisma.projectGroup.findMany).mockResolvedValueOnce([{
      id: 'group-1',
      members: [{ project: { id: 'workspace-project' } }],
    }] as any)
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([] as any)

    await expect(listGroups('former-member')).resolves.toEqual([])
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['workspace-project'] },
        OR: [
          { userId: 'former-member', workspaceId: null },
          { workspace: { members: { some: { userId: 'former-member' } } } },
        ],
      }),
    }))
  })

  it('does not return historical system-analysis data for an inaccessible member project', async () => {
    vi.mocked(prisma.projectGroup.findFirst).mockResolvedValueOnce({
      id: 'group-1',
      members: [{ projectId: 'workspace-project' }],
      analyses: [{ id: 'analysis-with-private-data' }],
    } as any)
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([] as any)

    await expect(getGroupBySlug('former-member', 'services')).resolves.toBeNull()
  })

  it('does not return historical results for a group with no accessible projects', async () => {
    vi.mocked(prisma.projectGroup.findFirst).mockResolvedValueOnce({
      id: 'group-1',
      members: [],
      analyses: [{ id: 'analysis-with-private-data' }],
    } as any)

    await expect(getGroupBySlug('group-owner', 'services')).resolves.toBeNull()
    expect(prisma.project.findMany).not.toHaveBeenCalled()
  })
})
