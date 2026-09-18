import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'

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

  return prisma.project.create({
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
}

export async function listProjects(userId: string, workspaceId?: string) {
  if (workspaceId) {
    const isMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!isMember) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this workspace' })
    }
    return prisma.project.findMany({
      where: { workspaceId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { analyses: true } } },
    })
  }

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
  return Array.from(new Map(projects.map((p) => [p.id, p])).values())
}

export async function getProjectBySlug(userId: string, slug: string) {
  return prisma.project.findFirst({
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
}
