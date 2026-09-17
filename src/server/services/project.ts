import { prisma } from '@/lib/prisma'

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
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const slug = await uniqueSlug(userId, slugify(input.name))
  return prisma.project.create({
    data: {
      userId,
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

export async function listProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId, status: 'active' },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { analyses: true } } },
  })
}

export async function getProjectBySlug(userId: string, slug: string) {
  return prisma.project.findUnique({
    where: { userId_slug: { userId, slug } },
    include: {
      analyses: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })
}
