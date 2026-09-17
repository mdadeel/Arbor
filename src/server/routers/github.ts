import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { listUserRepos } from '@/server/services/github'

export const githubRouter = router({
  listRepos: protectedProcedure.query(async ({ ctx }) => {
    return listUserRepos(ctx.session.user.id)
  }),

  connectUrl: protectedProcedure
    .input(z.object({ redirectTo: z.string().optional() }).optional())
    .query(() => ({ configured: true })),
})
