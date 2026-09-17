import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  createWorkspace,
  listUserWorkspaces,
  getWorkspace,
  inviteMember,
  acceptInvitation,
  removeMember,
} from '@/server/services/workspace'

export const workspaceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listUserWorkspaces(ctx.session.user.id)
  }),

  get: protectedProcedure
    .input(z.object({ workspaceIdOrSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      return getWorkspace(ctx.session.user.id, input.workspaceIdOrSlug)
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50),
        slug: z.string().min(2).max(50).optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createWorkspace(ctx.session.user.id, input)
    }),

  invite: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email(),
        role: z.enum(['admin', 'member', 'viewer']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return inviteMember(ctx.session.user.id, input)
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return acceptInvitation(ctx.session.user.id, input.token)
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        targetUserId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return removeMember(ctx.session.user.id, input)
    }),
})
