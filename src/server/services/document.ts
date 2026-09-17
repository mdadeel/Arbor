import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import type { DocCategory } from '@prisma/client'

export const DOC_CATEGORIES: DocCategory[] = [
  'guide',
  'architecture',
  'api',
  'runbook',
  'adr',
  'onboarding',
  'general',
]

export type CreateDocInput = {
  title: string
  content: string
  category?: DocCategory
  parentId?: string | null
  sortOrder?: number
  reviewDate?: Date | null
}

export type UpdateDocInput = {
  title?: string
  content?: string
  category?: DocCategory
  parentId?: string | null
  sortOrder?: number
  changeNote?: string
  reviewDate?: Date | null
}

export type DocTreeNode = {
  id: string
  title: string
  slug: string
  category: DocCategory
  sortOrder: number
  version: number
  isStale: boolean
  updatedAt: Date
  children: DocTreeNode[]
}

export function slugifyDoc(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\./g, '-')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createDocument(projectId: string, input: CreateDocInput) {
  const baseSlug = slugifyDoc(input.title) || 'untitled-doc'
  let slug = baseSlug
  let counter = 1

  // Handle slug uniqueness within project
  while (true) {
    const existing = await prisma.document.findFirst({
      where: { projectId, slug },
      select: { id: true },
    })
    if (!existing) break
    counter++
    slug = `${baseSlug}-${counter}`
  }

  const category = input.category ?? 'general'
  const doc = await prisma.document.create({
    data: {
      projectId,
      title: input.title,
      slug,
      content: input.content,
      category,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
      version: 1,
      reviewDate: input.reviewDate ?? null,
    },
  })

  // Snapshot initial version
  await prisma.docVersion.create({
    data: {
      documentId: doc.id,
      version: 1,
      title: doc.title,
      content: doc.content,
      changeNote: 'Initial version',
    },
  })

  return doc
}

export async function updateDocument(projectId: string, docId: string, input: UpdateDocInput) {
  const existing = await prisma.document.findFirst({
    where: { id: docId, projectId },
  })
  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
  }

  const nextVersion = existing.version + 1
  const updated = await prisma.document.update({
    where: { id: docId },
    data: {
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      category: input.category ?? existing.category,
      parentId: input.parentId !== undefined ? input.parentId : existing.parentId,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      reviewDate: input.reviewDate !== undefined ? input.reviewDate : existing.reviewDate,
      version: nextVersion,
      isStale: false, // Reset staleness flag upon update
      staleReason: null,
    },
  })

  // Record version history snapshot
  await prisma.docVersion.create({
    data: {
      documentId: docId,
      version: nextVersion,
      title: updated.title,
      content: updated.content,
      changeNote: input.changeNote || 'Updated document',
    },
  })

  return updated
}

export async function getDocument(projectId: string, docIdOrSlug: string) {
  return prisma.document.findFirst({
    where: {
      projectId,
      OR: [{ id: docIdOrSlug }, { slug: docIdOrSlug }],
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
      parent: {
        select: { id: true, title: true, slug: true },
      },
      children: {
        select: { id: true, title: true, slug: true, category: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}

export async function deleteDocument(projectId: string, docId: string) {
  const existing = await prisma.document.findFirst({
    where: { id: docId, projectId },
  })
  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
  }
  return prisma.document.delete({
    where: { id: docId },
  })
}

export async function restoreDocVersion(projectId: string, docId: string, version: number) {
  const existing = await prisma.document.findFirst({
    where: { id: docId, projectId },
  })
  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
  }

  const target = await prisma.docVersion.findUnique({
    where: {
      documentId_version: {
        documentId: docId,
        version,
      },
    },
  })
  if (!target) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Version ${version} not found` })
  }

  const nextVersion = existing.version + 1
  const restored = await prisma.document.update({
    where: { id: docId },
    data: {
      title: target.title,
      content: target.content,
      version: nextVersion,
      isStale: false,
    },
  })

  await prisma.docVersion.create({
    data: {
      documentId: docId,
      version: nextVersion,
      title: target.title,
      content: target.content,
      changeNote: `Restored from version ${version}`,
    },
  })

  return restored
}

export async function getDocTree(projectId: string): Promise<Record<DocCategory, DocTreeNode[]>> {
  const docs = await prisma.document.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      parentId: true,
      sortOrder: true,
      version: true,
      isStale: true,
      updatedAt: true,
    },
  })

  const nodeMap = new Map<string, DocTreeNode>()
  for (const doc of docs) {
    nodeMap.set(doc.id, {
      id: doc.id,
      title: doc.title,
      slug: doc.slug,
      category: doc.category,
      sortOrder: doc.sortOrder,
      version: doc.version,
      isStale: doc.isStale,
      updatedAt: doc.updatedAt,
      children: [],
    })
  }

  const categoryBuckets: Record<DocCategory, DocTreeNode[]> = {
    guide: [],
    architecture: [],
    api: [],
    runbook: [],
    adr: [],
    onboarding: [],
    general: [],
  }

  for (const doc of docs) {
    const node = nodeMap.get(doc.id)!
    if (doc.parentId && nodeMap.has(doc.parentId)) {
      nodeMap.get(doc.parentId)!.children.push(node)
    } else {
      categoryBuckets[doc.category].push(node)
    }
  }

  return categoryBuckets
}

export async function checkStaleness(projectId: string): Promise<string[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const potentiallyStale = await prisma.document.findMany({
    where: {
      projectId,
      isStale: false,
      OR: [
        { updatedAt: { lt: ninetyDaysAgo } },
        { reviewDate: { lt: now } },
      ],
    },
    select: { id: true },
  })

  const staleIds = potentiallyStale.map((d: { id: string }) => d.id)
  if (staleIds.length > 0) {
    await prisma.document.updateMany({
      where: { id: { in: staleIds } },
      data: { isStale: true },
    })
  }

  return staleIds
}
