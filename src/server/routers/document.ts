import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/server/trpc'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/server/services/project'
import { logAuditEvent } from '@/server/services/audit'
import {
  createDocument,
  updateDocument,
  getDocument,
  deleteDocument,
  restoreDocVersion,
  getDocTree,
  checkStaleness,
} from '@/server/services/document'

const docCategoryEnum = z.enum([
  'guide',
  'architecture',
  'api',
  'runbook',
  'adr',
  'onboarding',
  'general',
])

async function requireProject(userId: string, slug: string) {
  const project = await prisma.project.findUnique({
    where: { userId_slug: { userId, slug: slugify(slug) } },
    select: { id: true },
  })
  if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
  return project.id
}

export const documentRouter = router({
  tree: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return getDocTree(projectId)
    }),

  get: protectedProcedure
    .input(z.object({ slug: z.string(), docId: z.string() }))
    .query(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return getDocument(projectId, input.docId)
    }),

  create: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        title: z.string().min(1).max(200),
        content: z.string(),
        category: docCategoryEnum.default('general'),
        parentId: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        reviewDate: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      const doc = await createDocument(projectId, {
        title: input.title,
        content: input.content,
        category: input.category,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : null,
      })
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId,
        action: 'document.created',
        entityType: 'document',
        entityId: doc.id,
        metadata: { title: doc.title, category: doc.category },
      }).catch(() => {})
      return doc
    }),

  update: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        docId: z.string(),
        title: z.string().min(1).max(200).optional(),
        content: z.string().optional(),
        category: docCategoryEnum.optional(),
        parentId: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        changeNote: z.string().max(200).optional(),
        reviewDate: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      const doc = await updateDocument(projectId, input.docId, {
        title: input.title,
        content: input.content,
        category: input.category,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
        changeNote: input.changeNote,
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : input.reviewDate === null ? null : undefined,
      })
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId,
        action: 'document.updated',
        entityType: 'document',
        entityId: doc.id,
        metadata: { title: doc.title, version: doc.version },
      }).catch(() => {})
      return doc
    }),

  delete: protectedProcedure
    .input(z.object({ slug: z.string(), docId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      const res = await deleteDocument(projectId, input.docId)
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId,
        action: 'document.deleted',
        entityType: 'document',
        entityId: input.docId,
      }).catch(() => {})
      return res
    }),

  restore: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        docId: z.string(),
        version: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      const doc = await restoreDocVersion(projectId, input.docId, input.version)
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId,
        action: 'document.restored',
        entityType: 'document',
        entityId: doc.id,
        metadata: { version: input.version },
      }).catch(() => {})
      return doc
    }),

  checkStaleness: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return checkStaleness(projectId)
    }),
})
