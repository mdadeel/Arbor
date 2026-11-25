import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/server/trpc'
import { ProjectGroupRole } from '@prisma/client'
import {
  listGroups,
  getGroupBySlug,
  createGroup,
  deleteGroup,
  enqueueSystemAnalysis,
} from '@/server/services/system-group'
import { consumeAnalysisQuota } from '@/server/services/quotas'
import { logAuditEvent } from '@/server/services/audit'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { deliverQueuedAnalysis, getProcessingHealth, QUEUE_DELIVERY_ERROR } from '@/server/services/analysis-dispatch'
import { requireWorkspaceMembership, WORKSPACE_PROJECT_ROLES } from '@/server/services/authorization'

const memberInputSchema = z.object({
  projectId: z.string(),
  role: z.nativeEnum(ProjectGroupRole),
  apiPrefix: z.string().optional(),
})

const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  workspaceId: z.string().optional(),
  members: z.array(memberInputSchema).min(2, 'At least 2 member projects are required (e.g. Frontend and Server)').max(25),
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

  processingHealth: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const group = await getGroupBySlug(ctx.session.user.id, input.slug)
      if (!group) throw new TRPCError({ code: 'NOT_FOUND', message: 'System group not found' })
      let canRetry = group.userId === ctx.session.user.id
      if (group.workspaceId) {
        try {
          await requireWorkspaceMembership(ctx.session.user.id, group.workspaceId, WORKSPACE_PROJECT_ROLES)
          canRetry = true
        } catch (error) {
          if (!(error instanceof TRPCError) || error.code !== 'FORBIDDEN') throw error
          canRetry = false
        }
      }
      return { ...await getProcessingHealth('system'), canRetry }
    }),

  retryQueued: protectedProcedure
    .input(z.object({ slug: z.string(), analysisId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await getGroupBySlug(ctx.session.user.id, input.slug)
      if (!group) throw new TRPCError({ code: 'NOT_FOUND', message: 'System group not found' })
      if (group.workspaceId) {
        await requireWorkspaceMembership(ctx.session.user.id, group.workspaceId, WORKSPACE_PROJECT_ROLES)
      } else if (group.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      const analysis = await prisma.systemAnalysis.findFirst({
        where: { id: input.analysisId, groupId: group.id, status: 'queued' },
        select: { id: true },
      })
      if (!analysis) throw new TRPCError({ code: 'CONFLICT', message: 'This scan is no longer queued. Refresh to see its current status.' })
      const { allowed } = await checkRateLimit(`rate:analysis-repair:${ctx.session.user.id}`, 6, 60)
      if (!allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Please wait a minute before retrying delivery again.' })
      if (!await deliverQueuedAnalysis('system', analysis.id)) {
        throw new TRPCError({ code: 'SERVICE_UNAVAILABLE', message: QUEUE_DELIVERY_ERROR })
      }
      return { analysisId: analysis.id }
    }),

  analyze: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await getGroupBySlug(ctx.session.user.id, input.slug)
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'System group not found' })
      }

      if (group.workspaceId) {
        await requireWorkspaceMembership(ctx.session.user.id, group.workspaceId, WORKSPACE_PROJECT_ROLES)
      } else if (group.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const pending = await prisma.systemAnalysis.findFirst({
        where: { groupId: group.id, status: { in: ['queued', 'analyzing'] } },
        select: { id: true },
      })
      if (pending) {
        await deliverQueuedAnalysis('system', pending.id)
        return pending
      }

      // System scans consume the shared analysis budget and run asynchronously.
      await consumeAnalysisQuota(ctx.session.user.id, { workspaceId: group.workspaceId })
      const analysis = await enqueueSystemAnalysis(group.id)

      logAuditEvent({
        userId: ctx.session.user.id,
        action: 'system_group.analyzed',
        entityType: 'system_group',
        entityId: group.id,
        metadata: { slug: group.slug, analysisId: analysis.id },
      }).catch(() => {})

      return analysis
    }),
})
