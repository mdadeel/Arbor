import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  createPatchSuggestion,
  listPatchSuggestions,
  setPatchSuggestionStatus,
} from '@/server/services/patch-suggestions'

export const patchSuggestionRouter = router({
  list: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => listPatchSuggestions(ctx.session.user.id, input.slug)),

  create: protectedProcedure
    .input(z.object({
      slug: z.string().min(1).max(100),
      analysisId: z.string().min(1).max(200),
      findingFingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
    }))
    .mutation(({ ctx, input }) => createPatchSuggestion({ ...input, userId: ctx.session.user.id })),

  setStatus: protectedProcedure
    .input(z.object({
      slug: z.string().min(1).max(100),
      id: z.string().min(1).max(200),
      status: z.enum(['accepted', 'dismissed']),
    }))
    .mutation(({ ctx, input }) => setPatchSuggestionStatus({ ...input, userId: ctx.session.user.id })),
})
