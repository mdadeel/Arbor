import { z } from 'zod'
import { publicProcedure, protectedProcedure, router } from '@/server/trpc'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/server/services/project'
import { TRPCError } from '@trpc/server'
import {
  getProjectHealth,
  syncProjectHealth,
  getWorkspaceHealth,
} from '@/server/services/health'

async function requireProject(userId: string, slug: string) {
  const project = await prisma.project.findUnique({
    where: { userId_slug: { userId, slug: slugify(slug) } },
    select: { id: true },
  })
  if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
  return project.id
}

export const healthRouter = router({
  check: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })),

  get: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return getProjectHealth(ctx.session.user.id, projectId)
    }),

  sync: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return syncProjectHealth(ctx.session.user.id, projectId)
    }),

  workspace: protectedProcedure.query(async ({ ctx }) => {
    return getWorkspaceHealth(ctx.session.user.id)
  }),
})
