import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  createBillingPortalSession,
  createTeamsCheckout,
  getWorkspaceBilling,
} from '@/server/services/billing'

export const billingRouter = router({
  status: protectedProcedure
    .input(z.object({ workspaceId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return getWorkspaceBilling(ctx.session.user.id, input.workspaceId)
    }),

  createCheckout: protectedProcedure
    .input(z.object({ workspaceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return createTeamsCheckout(ctx.session.user.id, input)
    }),

  createPortalSession: protectedProcedure
    .input(z.object({ workspaceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return createBillingPortalSession(ctx.session.user.id, input)
    }),
})
