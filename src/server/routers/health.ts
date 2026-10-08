import { z } from 'zod'
import { publicProcedure, protectedProcedure, router } from '@/server/trpc'
import { requireAccessibleProject, requireProjectEditor } from '@/server/services/project-access'
import {
  getProjectHealth,
  syncProjectHealth,
  getWorkspaceHealth,
} from '@/server/services/health'

async function requireProjectId(userId: string, slug: string, write = false) {
  const project = await requireAccessibleProject(userId, slug)
  if (write) await requireProjectEditor(userId, project)
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
      const projectId = await requireProjectId(ctx.session.user.id, input.slug)
      return getProjectHealth(ctx.session.user.id, projectId)
    }),

  sync: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProjectId(ctx.session.user.id, input.slug, true)
      return syncProjectHealth(ctx.session.user.id, projectId)
    }),

  workspace: protectedProcedure.query(async ({ ctx }) => {
    return getWorkspaceHealth(ctx.session.user.id)
  }),
})
