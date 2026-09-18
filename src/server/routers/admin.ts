import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/server/trpc'
import {
  checkIsAdmin,
  getAdminMetrics,
  listUsersForAdmin,
  listWaitlistLeadsForAdmin,
} from '@/server/services/admin'

export const adminRouter = router({
  checkStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true, githubUsername: true },
    })

    const isAdmin = checkIsAdmin(user ?? undefined)
    return { isAdmin }
  }),

  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true, githubUsername: true },
    })

    if (!checkIsAdmin(user ?? undefined)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Administrative privileges required to view metrics',
      })
    }

    return getAdminMetrics()
  }),

  listUsers: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true, githubUsername: true },
    })

    if (!checkIsAdmin(user ?? undefined)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Administrative privileges required to access user directory',
      })
    }

    return listUsersForAdmin()
  }),

  listWaitlistLeads: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true, githubUsername: true },
    })

    if (!checkIsAdmin(user ?? undefined)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Administrative privileges required to access waitlist directory',
      })
    }

    return listWaitlistLeadsForAdmin()
  }),
})
