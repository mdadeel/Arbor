import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/server/trpc'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/server/services/project'
import { logAuditEvent } from '@/server/services/audit'
import {
  createVariable,
  deleteVariable,
  generateEnvTemplate,
  bulkUpdateStatus,
  getMatrix,
  setupEnvironments,
  updateVariableStatus,
} from '@/server/services/environment'

async function requireProject(userId: string, slug: string) {
  const project = await prisma.project.findUnique({
    where: { userId_slug: { userId, slug: slugify(slug) } },
    select: { id: true },
  })
  if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
  return project.id
}

export const environmentRouter = router({
  matrix: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return getMatrix(projectId)
    }),

  setup: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      const res = await setupEnvironments(projectId)
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId,
        action: 'environment.setup',
        entityType: 'environment',
        entityId: projectId,
      }).catch(() => {})
      return res
    }),

  updateVariable: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        variableId: z.string(),
        status: z.enum(['set', 'missing', 'different', 'unknown']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      const res = await updateVariableStatus(projectId, input.variableId, input.status)
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId,
        action: 'environment.variable_updated',
        entityType: 'env_variable',
        entityId: input.variableId,
        metadata: { status: input.status },
      }).catch(() => {})
      return res
    }),

  createVariable: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        environmentId: z.string(),
        key: z.string().min(1).max(200).regex(/^[A-Z0-9_]+$/, 'Uppercase letters, digits and underscore only.'),
        required: z.boolean().optional(),
        category: z.enum(['database', 'api_key', 'auth', 'config', 'storage', 'other']).optional(),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      const res = await createVariable(projectId, input.environmentId, input.key, {
        required: input.required,
        category: input.category,
        description: input.description,
      })
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId,
        action: 'environment.variable_created',
        entityType: 'env_variable',
        entityId: res.id,
        metadata: { key: input.key, category: input.category },
      }).catch(() => {})
      return res
    }),

  deleteVariable: protectedProcedure
    .input(z.object({ slug: z.string(), variableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      const res = await deleteVariable(projectId, input.variableId)
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId,
        action: 'environment.variable_deleted',
        entityType: 'env_variable',
        entityId: input.variableId,
      }).catch(() => {})
      return res
    }),

  generateTemplate: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return generateEnvTemplate(projectId)
    }),

  bulkUpdateStatus: protectedProcedure
    .input(z.object({
      slug: z.string(),
      variableIds: z.array(z.string()).min(1),
      status: z.enum(['set', 'missing', 'different', 'unknown']),
    }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      const res = await bulkUpdateStatus(projectId, input.variableIds, input.status)
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId,
        action: 'environment.bulk_updated',
        entityType: 'env_variable',
        entityId: projectId,
        metadata: { count: input.variableIds.length, status: input.status },
      }).catch(() => {})
      return res
    }),
})