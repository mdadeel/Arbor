import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/server/trpc'
import { ProjectGroupRole } from '@prisma/client'
import {
  listGroups,
  getGroupBySlug,
  createGroup,
  deleteGroup,
  runSystemAnalysis,
} from '@/server/services/system-group'
import { logAuditEvent } from '@/server/services/audit'

const memberInputSchema = z.object({
  projectId: z.string(),
  role: z.nativeEnum(ProjectGroupRole),
  apiPrefix: z.string().optional(),
})

const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  workspaceId: z.string().optional(),
  members: z.array(memberInputSchema).min(2, 'At least 2 member projects are required (e.g. Frontend and Server)'),
})

export const systemRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().optional() }).optional())
    .query(({ ctx, input }) => listGroups(ctx.session.user.id, input?.workspaceId)),

  bySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const group = await getGroupBySlug(ctx.session.user.id, input.slug)
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'System group not found' })
      }
      return group
    }),

  create: protectedProcedure
    .input(createGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const group = await createGroup(ctx.session.user.id, input)

      logAuditEvent({
        userId: ctx.session.user.id,
        action: 'system_group.created',
        entityType: 'system_group',
        entityId: group.id,
        metadata: { name: group.name, memberCount: input.members.length },
      }).catch(() => {})

      return group
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteGroup(ctx.session.user.id, input.id)

      logAuditEvent({
        userId: ctx.session.user.id,
        action: 'system_group.deleted',
        entityType: 'system_group',
        entityId: input.id,
        metadata: { name: deleted.name },
      }).catch(() => {})

      return deleted
    }),

  analyze: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await getGroupBySlug(ctx.session.user.id, input.slug)
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'System group not found' })
      }

      const analysis = await runSystemAnalysis(group.id)

      logAuditEvent({
        userId: ctx.session.user.id,
        action: 'system_group.analyzed',
        entityType: 'system_group',
        entityId: group.id,
        metadata: { slug: group.slug, score: analysis.overallScore },
      }).catch(() => {})

      return analysis
    }),
})
