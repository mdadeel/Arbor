import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  checkIsAdmin,
  checkUserPermission,
  createWaitlistLeadForAdmin,
  deleteUserForAdmin,
  deleteWaitlistLeadForAdmin,
  getAdminMetrics,
  getSystemHealthForAdmin,
  getUserDetailsForAdmin,
  listAdminEmailsForAdmin,
  listAuditLogsForAdmin,
  listUsersForAdmin,
  listWaitlistLeadsForAdmin,
  listWorkspacesForAdmin,
  PLATFORM_PERMISSIONS,
  PlatformPermission,
  purgeFailedAnalysesForAdmin,
  resetStuckAnalysesForAdmin,
  sendAdminEmail,
  updateUserAccessControlsForAdmin,
  updateUserBenefitsForAdmin,
} from '@/server/services/admin'

import { adminCache, TTL_ADMIN_USER_VERIFY } from '@/server/services/admin-cache'

async function ensureAdmin(
  ctx: { prisma: any; session: { user: { id: string }; isImpersonating?: boolean } },
  requiredPermission?: PlatformPermission
) {
  if (ctx.session?.isImpersonating) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Administrative operations are barred while impersonating a user.',
    })
  }

  const cacheKey = `admin:user-full:${ctx.session.user.id}`
  let user = adminCache.get<{ email: string | null; githubUsername: string | null; role: string; permissions: any }>(cacheKey)

  if (!user) {
    user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true, githubUsername: true, role: true, permissions: true },
    })
    if (user) {
      adminCache.set(cacheKey, user, TTL_ADMIN_USER_VERIFY)
    }
  }

  if (!checkIsAdmin(user ?? undefined)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Administrative privileges required',
    })
  }

  if (requiredPermission && !checkUserPermission(user, requiredPermission)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Permission denied: ${requiredPermission} required`,
    })
  }

  return user
}

export const adminRouter = router({
  checkStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true, githubUsername: true, role: true },
    })

    const isAdmin = checkIsAdmin(user ?? undefined)
    return { isAdmin, role: user?.role || 'user' }
  }),

  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    await ensureAdmin(ctx)
    return getAdminMetrics()
  }),

  listUsers: protectedProcedure.query(async ({ ctx }) => {
    await ensureAdmin(ctx, PLATFORM_PERMISSIONS.USERS_READ)
    return listUsersForAdmin()
  }),

  getUserDetails: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureAdmin(ctx, PLATFORM_PERMISSIONS.USERS_READ)
      return getUserDetailsForAdmin(input.userId)
    }),

  updateUserAccess: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.string().optional(),
        status: z.string().optional(),
        permissions: z
          .object({
            bypassRateLimit: z.boolean().optional(),
            canAnalyzePrivate: z.boolean().optional(),
            unlimitedProjects: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx, PLATFORM_PERMISSIONS.USERS_MANAGE)
      return updateUserAccessControlsForAdmin(input.userId, ctx.session.user.id, {
        role: input.role,
        status: input.status,
        permissions: input.permissions,
      })
    }),

  updateUserBenefits: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        plan: z.string(),
        perks: z.array(z.string()),
        customNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx, PLATFORM_PERMISSIONS.BENEFITS_MANAGE)
      return updateUserBenefitsForAdmin(input.userId, ctx.session.user.id, {
        plan: input.plan,
        perks: input.perks,
        customNotes: input.customNotes,
      })
    }),

  sendEmail: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(['all', 'selected', 'individual']),
        userIds: z.array(z.string()).optional(),
        subject: z.string().min(1, 'Subject is required'),
        body: z.string().min(1, 'Body is required'),
        template: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx, PLATFORM_PERMISSIONS.EMAILS_BROADCAST)
      return sendAdminEmail(input, ctx.session.user.id)
    }),

  listEmails: protectedProcedure.query(async ({ ctx }) => {
    await ensureAdmin(ctx)
    return listAdminEmailsForAdmin()
  }),

  listWaitlistLeads: protectedProcedure.query(async ({ ctx }) => {
    await ensureAdmin(ctx)
    return listWaitlistLeadsForAdmin()
  }),

  listAuditLogs: protectedProcedure
    .input(
      z
        .object({
          action: z.string().optional(),
          entityType: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      await ensureAdmin(ctx, PLATFORM_PERMISSIONS.AUDIT_READ)
      return listAuditLogsForAdmin(input)
    }),

  listWorkspaces: protectedProcedure.query(async ({ ctx }) => {
    await ensureAdmin(ctx, PLATFORM_PERMISSIONS.WORKSPACES_READ)
    return listWorkspacesForAdmin()
  }),

  getSystemHealth: protectedProcedure.query(async ({ ctx }) => {
    await ensureAdmin(ctx)
    return getSystemHealthForAdmin()
  }),

  deleteUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx, PLATFORM_PERMISSIONS.USERS_MANAGE)
      return deleteUserForAdmin(input.userId, ctx.session.user.id)
    }),

  deleteWaitlistLead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx, PLATFORM_PERMISSIONS.USERS_MANAGE)
      return deleteWaitlistLeadForAdmin(input.id)
    }),

  createWaitlistLead: protectedProcedure
    .input(
      z.object({
        email: z.string().email('Please enter a valid email address'),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAdmin(ctx, PLATFORM_PERMISSIONS.USERS_MANAGE)
      return createWaitlistLeadForAdmin(input.email, input.source)
    }),

  purgeFailedAnalyses: protectedProcedure.mutation(async ({ ctx }) => {
    await ensureAdmin(ctx, PLATFORM_PERMISSIONS.SYSTEM_MANAGE)
    return purgeFailedAnalysesForAdmin()
  }),

  resetStuckAnalyses: protectedProcedure.mutation(async ({ ctx }) => {
    await ensureAdmin(ctx, PLATFORM_PERMISSIONS.SYSTEM_MANAGE)
    return resetStuckAnalysesForAdmin()
  }),
})


