import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/server/trpc'
import { prisma } from '@/lib/prisma'
import { getAnalysisQueue } from '@/server/queue'
import { checkRateLimit } from '@/lib/redis'
import { logAuditEvent } from '@/server/services/audit'
import { getProjectCommits } from '@/server/services/commits'
import {
  createProject,
  getProjectBySlug,
  listProjects,
  slugify,
} from '@/server/services/project'

const repoInput = {
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  repoFullName: z.string().min(3).max(200),
  repoUrl: z.string().url(),
  defaultBranch: z.string().min(1).max(100),
  repoPrivate: z.boolean(),
  workspaceId: z.string().optional(),
}

export const projectRouter = router({
  create: protectedProcedure.input(z.object(repoInput)).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id
    const existing = await prisma.project.findUnique({
      where: { userId_repoFullName: { userId, repoFullName: input.repoFullName } },
    })
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This repository has already been added.',
      })
    }
    const project = await createProject(userId, input)
    logAuditEvent({
      userId,
      projectId: project.id,
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      metadata: { name: project.name, repoFullName: project.repoFullName },
    }).catch(() => {})
    return project
  }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().optional() }).optional())
    .query(({ ctx, input }) => listProjects(ctx.session.user.id, input?.workspaceId)),

  recentAnalyses: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: ctx.session.user.id },
      select: { workspaceId: true },
    })
    const wsIds = memberships.map((m) => m.workspaceId)

    return prisma.analysis.findMany({
      where: {
        project: {
          OR: [
            { userId: ctx.session.user.id },
            ...(wsIds.length > 0 ? [{ workspaceId: { in: wsIds } }] : []),
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        project: { select: { name: true, slug: true, repoFullName: true } },
      },
    })
  }),

  bySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectBySlug(ctx.session.user.id, slugify(input.slug))
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
      return project
    }),

  update: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(500).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { slug, ...data } = input
      const project = await prisma.project.findUnique({
        where: { userId_slug: { userId: ctx.session.user.id, slug } },
        select: { id: true },
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
      return prisma.project.update({ where: { id: project.id }, data })
    }),

  archive: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await prisma.project.findUnique({
        where: { userId_slug: { userId: ctx.session.user.id, slug: input.slug } },
        select: { id: true },
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
      const updated = await prisma.project.update({
        where: { id: project.id },
        data: { status: 'archived' },
      })
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId: project.id,
        action: 'project.archived',
        entityType: 'project',
        entityId: project.id,
      }).catch(() => {})
      return updated
    }),

  analyze: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await prisma.project.findUnique({
        where: { userId_slug: { userId: ctx.session.user.id, slug: slugify(input.slug) } },
        select: { id: true, defaultBranch: true },
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

      // Rate limit: max 10 analyses per hour per user
      const rateLimitKey = `rate:analyze:${ctx.session.user.id}`
      const { allowed } = await checkRateLimit(rateLimitKey, 10, 3600)
      if (!allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded: maximum 10 analyses per hour. Please wait before triggering another analysis.',
        })
      }

      const existingRunning = await prisma.analysis.findFirst({
        where: { projectId: project.id, status: { in: ['queued', 'cloning', 'analyzing'] } },
        select: { id: true, createdAt: true },
      })
      if (existingRunning) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
        if (existingRunning.createdAt < tenMinutesAgo) {
          await prisma.analysis.update({
            where: { id: existingRunning.id },
            data: {
              status: 'failed',
              errorMessage: 'Analysis timed out in queue. No worker was active to process the job.',
              completedAt: new Date(),
            },
          })
        } else {
          throw new TRPCError({ code: 'CONFLICT', message: 'An analysis is already running.' })
        }
      }
      const analysis = await prisma.analysis.create({
        data: { projectId: project.id, branch: project.defaultBranch, status: 'queued' },
      })
      await getAnalysisQueue().add('analyze', { analysisId: analysis.id })

      logAuditEvent({
        userId: ctx.session.user.id,
        projectId: project.id,
        action: 'analysis.triggered',
        entityType: 'analysis',
        entityId: analysis.id,
        metadata: { branch: project.defaultBranch },
      }).catch(() => {})

      return analysis
    }),

  commits: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        branch: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getProjectCommits(ctx.session.user.id, slugify(input.slug), input.branch)
    }),
})

