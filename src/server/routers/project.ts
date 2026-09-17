import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/server/trpc'
import { prisma } from '@/lib/prisma'
import { getAnalysisQueue } from '@/server/queue'
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
    return createProject(userId, input)
  }),

  list: protectedProcedure.query(({ ctx }) => listProjects(ctx.session.user.id)),

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
      return prisma.project.update({
        where: { id: project.id },
        data: { status: 'archived' },
      })
    }),

  analyze: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await prisma.project.findUnique({
        where: { userId_slug: { userId: ctx.session.user.id, slug: slugify(input.slug) } },
        select: { id: true, defaultBranch: true },
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
      if (
        await prisma.analysis.findFirst({
          where: { projectId: project.id, status: { in: ['queued', 'cloning', 'analyzing'] } },
          select: { id: true },
        })
      ) {
        throw new TRPCError({ code: 'CONFLICT', message: 'An analysis is already running.' })
      }
      const analysis = await prisma.analysis.create({
        data: { projectId: project.id, branch: project.defaultBranch, status: 'queued' },
      })
      await getAnalysisQueue().add('analyze', { analysisId: analysis.id })
      return analysis
    }),
})
