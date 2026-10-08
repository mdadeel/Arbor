import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  createReportShareLink,
  listReportShareLinks,
  revokeReportShareLink,
} from '@/server/services/report-sharing'

export const shareRouter = router({
  list: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => listReportShareLinks(ctx.session.user.id, input.slug)),

  create: protectedProcedure
    .input(z.object({
      slug: z.string().min(1).max(100),
      analysisId: z.string().min(1).max(200),
      expiresInDays: z.number().int().min(1).max(30).default(7),
    }))
    .mutation(({ ctx, input }) => createReportShareLink({ ...input, userId: ctx.session.user.id })),

  revoke: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(100), id: z.string().min(1).max(200) }))
    .mutation(({ ctx, input }) => revokeReportShareLink(ctx.session.user.id, input.slug, input.id)),
})
