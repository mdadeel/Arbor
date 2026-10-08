import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  getProjectScanSchedule,
  getProjectTrend,
  updateProjectScanSchedule,
} from '@/server/services/insights'

export const insightsRouter = router({
  trends: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => getProjectTrend(ctx.session.user.id, input.slug)),

  schedule: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => getProjectScanSchedule(ctx.session.user.id, input.slug)),

  updateSchedule: protectedProcedure
    .input(z.object({
      slug: z.string().min(1).max(100),
      enabled: z.boolean(),
      cadence: z.enum(['daily', 'weekly']),
      branch: z.string().min(1).max(255).optional(),
    }))
    .mutation(({ ctx, input }) => updateProjectScanSchedule({ ...input, userId: ctx.session.user.id })),
})
