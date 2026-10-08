import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import { appCache, TTL_PROJECTS_LIST, TTL_PROJECT_DETAIL } from './admin-cache'
import {
  canEditWorkspaceProjects,
  requireWorkspaceMembership,
  WORKSPACE_PROJECT_ROLES,
  type WorkspaceRoleName,
} from './authorization'

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

  // Preserve the default workspace convenience only when the user's role may add projects.
  // An explicit workspace selection is always checked server-side.
  let workspaceId = input.workspaceId
  if (!workspaceId) {
    const firstMembership = await prisma.workspaceMember.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true, role: true },
    })
    if (firstMembership && canEditWorkspaceProjects(firstMembership.role as WorkspaceRoleName)) {
      workspaceId = firstMembership.workspaceId
    }
  }
  if (workspaceId) {
    await requireWorkspaceMembership(userId, workspaceId, WORKSPACE_PROJECT_ROLES)
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
  let userWorkspaceIds: string[] = []

  if (workspaceId) {
    const isMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!isMember) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this workspace' })
    }
  } else {
    // Re-read current memberships before consulting cache so a removed member
    // cannot retain access to cached workspace project records.
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    })
    userWorkspaceIds = memberships.map((membership) => membership.workspaceId)
  }

  const cached = appCache.get<any[]>(cacheKey)
  if (cached) {
    if (workspaceId) return cached
    const accessibleWorkspaceIds = new Set(userWorkspaceIds)
    return cached.filter((project) => project.workspaceId
      ? accessibleWorkspaceIds.has(project.workspaceId)
      : project.userId === userId)
  }

  let result: any[]
  if (workspaceId) {
    result = await prisma.project.findMany({
      where: { workspaceId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { analyses: true } } },
    })
  } else {
    const projects = await prisma.project.findMany({
      where: {
        status: 'active',
        OR: [
          { userId, workspaceId: null },
          ...(userWorkspaceIds.length > 0 ? [{ workspaceId: { in: userWorkspaceIds } }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { analyses: true } } },
    })

    result = Array.from(new Map(projects.map((project) => [project.id, project])).values())
  }

  appCache.set(cacheKey, result, TTL_PROJECTS_LIST)
  return result
}

export async function getProjectBySlug(userId: string, slug: string) {
  const cacheKey = `project:${userId}:${slug}`
  const access = await prisma.project.findFirst({
    where: {
      slug,
      OR: [
        { userId, workspaceId: null },
        { workspace: { members: { some: { userId } } } },
      ],
    },
    select: { id: true },
  })
  if (!access) return null

  const cached = appCache.get<any>(cacheKey)
  if (cached) return cached

  const project = await prisma.project.findFirst({
    where: {
      id: access.id,
      OR: [
        { userId, workspaceId: null },
        { workspace: { members: { some: { userId } } } },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      repoFullName: true,
      defaultBranch: true,
      repoPrivate: true,
      repoUrl: true,
      description: true,
      latestScores: true,
      detectedStack: true,
      lastAnalyzedAt: true,
    },
  })
  if (!project) return null

  const [analyses, latestCompletedAnalysis] = await Promise.all([
    prisma.analysis.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        branch: true,
        commitSha: true,
        overallScore: true,
        durationMs: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.analysis.findFirst({
      where: { projectId: project.id, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        branch: true,
        commitSha: true,
        overallScore: true,
        architectureScore: true,
        techDebtScore: true,
        performanceScore: true,
        documentationScore: true,
        securityScore: true,
        designSystemScore: true,
        techStack: true,
        structure: true,
        findings: true,
        metrics: true,
        dependencyGraph: true,
        designSystem: true,
        durationMs: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
  ])

  const result = { ...project, analyses, latestCompletedAnalysis }
  appCache.set(cacheKey, result, TTL_PROJECT_DETAIL)
  return result
}
