import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import { appCache, TTL_PROJECTS_LIST, TTL_PROJECT_DETAIL } from './admin-cache'

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'project'
}

async function uniqueSlug(userId: string, base: string): Promise<string> {
  const existing = await prisma.project.findMany({
    where: { userId, slug: { startsWith: base } },
    select: { slug: true },
  })
  if (!existing.some((p) => p.slug === base)) return base
  let n = 2
  while (existing.some((p) => p.slug === `${base}-${n}`)) n++
  return `${base}-${n}`
}

export type CreateProjectInput = {
  name: string
  description?: string
  repoFullName: string
  repoUrl: string
  defaultBranch: string
  repoPrivate: boolean
  workspaceId?: string
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const slug = await uniqueSlug(userId, slugify(input.name))

  // If workspaceId is not explicitly provided, associate with user's first workspace if any exists
  let workspaceId = input.workspaceId
  if (!workspaceId) {
    const firstMembership = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    })
    if (firstMembership) {
      workspaceId = firstMembership.workspaceId
    }
  }

  const created = await prisma.project.create({
    data: {
      userId,
      workspaceId,
      slug,
      name: input.name,
      description: input.description,
      repoFullName: input.repoFullName,
      repoUrl: input.repoUrl,
      defaultBranch: input.defaultBranch,
      repoPrivate: input.repoPrivate,
    },
  })

  appCache.clearPrefix(`projects:${userId}`)
  return created
}

export async function listProjects(userId: string, workspaceId?: string) {
  const cacheKey = `projects:${userId}:${workspaceId || 'all'}`
  const cached = appCache.get<any[]>(cacheKey)
  if (cached) return cached

  let result: any[]

  if (workspaceId) {
    const isMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!isMember) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this workspace' })
    }
    result = await prisma.project.findMany({
      where: { workspaceId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { analyses: true } } },
    })
  } else {
    // Find all workspace IDs the user belongs to
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    })
    const userWorkspaceIds = memberships.map((m) => m.workspaceId)

    const projects = await prisma.project.findMany({
      where: {
        status: 'active',
        OR: [
          { userId },
          ...(userWorkspaceIds.length > 0 ? [{ workspaceId: { in: userWorkspaceIds } }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { analyses: true } } },
    })

    // Deduplicate in case a project matched multiple workspace / ownership clauses
    result = Array.from(new Map(projects.map((p) => [p.id, p])).values())
  }

  appCache.set(cacheKey, result, TTL_PROJECTS_LIST)
  return result
}

export async function getProjectBySlug(userId: string, slug: string) {
  const cacheKey = `project:${userId}:${slug}`
  const cached = appCache.get<any>(cacheKey)
  if (cached) return cached

  const project = await prisma.project.findFirst({
    where: {
      slug,
      OR: [
        { userId },
        {
          workspace: {
            members: { some: { userId } },
          },
        },
      ],
    },
    include: {
      analyses: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })

  if (project) {
    appCache.set(cacheKey, project, TTL_PROJECT_DETAIL)
  }

  return project
}
