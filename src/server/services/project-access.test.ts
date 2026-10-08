import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    workspaceMember: { findUnique: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { requireAccessibleProject, requireProjectEditor } from './project-access'

const workspaceProject = {
  id: 'project-1',
  slug: 'demo',
  userId: 'creator-1',
  workspaceId: 'workspace-1',
  repoUrl: 'https://github.com/owner/repo',
  repoFullName: 'owner/repo',
  githubAccountId: null,
  defaultBranch: 'main',
  name: 'Demo',
  repoPrivate: true,
}

describe('project access boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes personal project access to projects with no workspace', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce({
      ...workspaceProject,
      workspaceId: null,
    } as never)

    await requireAccessibleProject('creator-1', 'demo')

    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: {
        slug: 'demo',
        OR: [
          { userId: 'creator-1', workspaceId: null },
          { workspace: { members: { some: { userId: 'creator-1' } } } },
        ],
      },
      select: {
        id: true,
        slug: true,
        userId: true,
        workspaceId: true,
        repoUrl: true,
        repoFullName: true,
        githubAccountId: true,
        defaultBranch: true,
        name: true,
        repoPrivate: true,
      },
    })
  })

  it('does not treat a former workspace member who created the project as still authorized', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(null)

    await expect(requireAccessibleProject('former-member', 'demo'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(prisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { userId: 'former-member', workspaceId: null },
          { workspace: { members: { some: { userId: 'former-member' } } } },
        ],
      }),
    }))
  })

  it('requires an editable workspace role for project mutations', async () => {
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({ id: 'member-1', role: 'viewer' } as never)

    await expect(requireProjectEditor('viewer-1', workspaceProject))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
