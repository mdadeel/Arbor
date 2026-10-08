import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: { findUnique: vi.fn() },
    project: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { requireProjectIdsAccessible, requireWorkspaceMembership } from './authorization'

describe('workspace authorization helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a workspace membership and enforces allowed roles', async () => {
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({ id: 'member-1', role: 'viewer' } as any)

    await expect(requireWorkspaceMembership('user-1', 'workspace-1', ['owner', 'admin']))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: 'workspace-1', userId: 'user-1' } },
      select: { id: true, role: true },
    })
  })

  it('rejects project groups containing projects outside the caller access scope', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([{ id: 'owned-project' }] as any)

    await expect(requireProjectIdsAccessible('user-1', ['owned-project', 'foreign-project']))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['owned-project', 'foreign-project'] },
        OR: [
          { userId: 'user-1', workspaceId: null },
          { workspace: { members: { some: { userId: 'user-1' } } } },
        ],
      },
      select: { id: true },
    })
  })

  it('rejects duplicate project IDs in a group request', async () => {
    await expect(requireProjectIdsAccessible('user-1', ['project-1', 'project-1']))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(prisma.project.findMany).not.toHaveBeenCalled()
  })
})
