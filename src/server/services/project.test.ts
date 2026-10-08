import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    analysis: { findFirst: vi.fn(), findMany: vi.fn() },
    workspaceMember: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { appCache } from './admin-cache'
import { createProject, listProjects, getProjectBySlug } from './project'

describe('project workspace assignment authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    appCache.clearPrefix('projects:')
    appCache.clearPrefix('project:')
  })

  const projectInput = {
    name: 'Repository',
    repoFullName: 'owner/repo',
    repoUrl: 'https://github.com/owner/repo.git',
    defaultBranch: 'main',
    repoPrivate: false,
    workspaceId: 'other-workspace',
  }

  it('rejects attaching a project to a workspace without membership', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([] as any)
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null as any)

    await expect(createProject('user-1', projectInput)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(prisma.project.create).not.toHaveBeenCalled()
  })

  it('allows an editor role to create a workspace project', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([] as any)
    vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({ id: 'member-1', role: 'member' } as any)
    vi.mocked(prisma.project.create).mockResolvedValueOnce({ id: 'project-1', ...projectInput } as any)

    const project = await createProject('user-1', projectInput)

    expect(project.id).toBe('project-1')
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', workspaceId: 'other-workspace' }),
    })
  })

  it('only lists personal projects and current workspace projects', async () => {
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([] as any)
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([] as any)

    await listProjects('former-member')

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: 'active',
        OR: [{ userId: 'former-member', workspaceId: null }],
      },
      include: expect.objectContaining({
        analyses: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { status: true, createdAt: true },
        },
      }),
    }))
  })

  it('filters cached workspace projects against fresh membership records', async () => {
    const workspaceProject = { id: 'shared', userId: 'former-member', workspaceId: 'workspace-1' }
    const personalProject = { id: 'personal', userId: 'former-member', workspaceId: null }
    appCache.set('projects:former-member:all', [workspaceProject, personalProject], 10_000)
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([] as any)

    await expect(listProjects('former-member')).resolves.toEqual([personalProject])
    expect(prisma.project.findMany).not.toHaveBeenCalled()
  })

  it('bypasses cached project detail when an analysis status changes', async () => {
    const cached = {
      id: 'project-1',
      analyses: [{ id: 'analysis-1', status: 'queued' }],
      latestCompletedAnalysis: null,
    }
    const freshProject = {
      id: 'project-1', slug: 'demo', name: 'Demo', repoFullName: 'owner/repo',
      defaultBranch: 'main', repoPrivate: false, repoUrl: 'https://github.com/owner/repo',
      description: null, latestScores: null, detectedStack: null, lastAnalyzedAt: null,
    }
    const freshAnalysis = {
      id: 'analysis-1', status: 'analyzing', branch: 'main', commitSha: null,
      overallScore: null, durationMs: null, errorMessage: null, createdAt: new Date(),
    }
    appCache.set('project:user-1:demo', cached, 10_000)
    vi.mocked(prisma.project.findFirst)
      .mockResolvedValueOnce({ id: 'project-1' } as any)
      .mockResolvedValueOnce(freshProject as any)
    vi.mocked(prisma.analysis.findFirst)
      .mockResolvedValueOnce({ id: 'analysis-1', status: 'analyzing' } as any)
      .mockResolvedValueOnce(null as any)
    vi.mocked(prisma.analysis.findMany).mockResolvedValueOnce([freshAnalysis] as any)

    const project = await getProjectBySlug('user-1', 'demo')

    expect(project?.analyses[0]?.status).toBe('analyzing')
    expect(prisma.project.findFirst).toHaveBeenCalledTimes(2)
  })

  it('rechecks current membership before returning a cached project detail', async () => {
    appCache.set('project:former-member:demo', { id: 'cached-sensitive-project' }, 10_000)
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(null as any)

    await expect(getProjectBySlug('former-member', 'demo')).resolves.toBeNull()
    expect(prisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: 'demo',
        OR: [
          { userId: 'former-member', workspaceId: null },
          { workspace: { members: { some: { userId: 'former-member' } } } },
        ],
      }),
      select: { id: true },
    }))
  })
})
