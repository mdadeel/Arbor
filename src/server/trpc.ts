import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { cookies } from 'next/headers'
import { IMPERSONATION_COOKIE_NAME, verifyImpersonationToken } from '@/lib/impersonation'

export async function createTRPCContext() {
  const session = await getServerSession(authOptions)

  if (session?.user?.id) {
    try {
      const cookieStore = cookies()
      const token = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value
      if (token) {
        const payload = verifyImpersonationToken(token)
        if (payload && payload.originalAdminId === session.user.id) {
          return {
            session: {
              ...session,
              user: {
                ...session.user,
                id: payload.targetUserId,
                name: payload.targetUserName || session.user.name,
                email: payload.targetUserEmail || session.user.email,
              },
              isImpersonating: true,
              impersonatedBy: payload.originalAdminId,
            },
            prisma,
          }
        }
      }
    } catch {
      // Ignore if called outside Next.js request context (e.g. unit tests)
    }
  }

  return {
    session: session
      ? {
          ...session,
          isImpersonating: false as boolean,
          impersonatedBy: undefined as string | undefined,
        }
      : null,
    prisma,
  }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: { ...ctx.session.user, id: ctx.session.user.id } },
    },
  })
})
