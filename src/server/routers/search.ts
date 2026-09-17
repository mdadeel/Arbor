import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { globalSearch } from '@/server/services/search'

export const searchRouter = router({
  query: protectedProcedure
    .input(
      z.object({
        q: z.string().max(100).default(''),
      })
    )
    .query(async ({ ctx, input }) => {
      return globalSearch(ctx.session.user.id, input.q)
    }),
})
