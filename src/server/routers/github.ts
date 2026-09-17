import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  listUserRepos,
  listUserAccounts,
  addGitHubAccount,
  removeGitHubAccount,
  setDefaultGitHubAccount,
  checkAccountHealth,
} from '@/server/services/github'
import { prisma } from '@/lib/prisma'

export const githubRouter = router({
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    return listUserAccounts(ctx.session.user.id)
  }),

  addAccount: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1, 'Token is required'),
        accountName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return addGitHubAccount(ctx.session.user.id, input)
    }),

  removeAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return removeGitHubAccount(ctx.session.user.id, input.accountId)
    }),

  setDefault: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return setDefaultGitHubAccount(ctx.session.user.id, input.accountId)
    }),

  checkHealth: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return checkAccountHealth(ctx.session.user.id, input.accountId)
    }),

  disconnectAll: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.gitHubAccount.deleteMany({
      where: { userId: ctx.session.user.id },
    })
    await prisma.user.update({
      where: { id: ctx.session.user.id },
      data: {
        githubAccessToken: null,
        tokenExpiresAt: null,
        tokenScope: null,
      },
    })
    return { success: true }
  }),

  listRepos: protectedProcedure
    .input(
      z
        .object({
          accountId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return listUserRepos(ctx.session.user.id, input?.accountId)
    }),

  connectUrl: protectedProcedure
    .input(z.object({ redirectTo: z.string().optional() }).optional())
    .query(() => ({ configured: true })),
})

