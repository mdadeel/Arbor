import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { slugify } from './project'
import { requireWorkspaceMembership, WORKSPACE_PROJECT_ROLES } from './authorization'

export type AccessibleProject = {
  id: string
  slug: string
  userId: string
  workspaceId: string | null
  repoUrl: string
  repoFullName: string
  githubAccountId: string | null
  defaultBranch: string
  name: string
  repoPrivate: boolean
}

export async function requireAccessibleProject(userId: string, slug: string): Promise<AccessibleProject> {
  const project = await prisma.project.findFirst({
    where: {
      slug: slugify(slug),
      OR: [
        { userId, workspaceId: null },
        { workspace: { members: { some: { userId } } } },
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
  if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' })
  return project as AccessibleProject
}

export async function requireProjectEditor(userId: string, project: AccessibleProject): Promise<void> {
  if (project.workspaceId) {
    await requireWorkspaceMembership(userId, project.workspaceId, WORKSPACE_PROJECT_ROLES)
  } else if (project.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Project edit access is required.' })
  }
}
