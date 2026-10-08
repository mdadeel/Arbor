import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { IMPERSONATION_COOKIE_NAME, verifyImpersonationToken } from '@/lib/impersonation'
import { checkUserPermission, PLATFORM_PERMISSIONS } from '@/server/services/admin'

export async function createTRPCContext() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { session: null, prisma }

  // Revalidate account state on every request so suspensions and role changes
  // take effect without waiting for a long-lived JWT to expire.
  const operator = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      status: true,
      role: true,
      email: true,
      githubUsername: true,
      permissions: true,
    },
  })
  if (!operator || operator.status !== 'active') return { session: null, prisma }

  const ordinarySession = {
    ...session,
    isImpersonating: false as boolean,
    impersonatedBy: undefined as string | undefined,
  }

  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value
    if (token) {
      const payload = verifyImpersonationToken(token)
      if (
        payload &&
        payload.originalAdminId === operator.id &&
        checkUserPermission(operator, PLATFORM_PERMISSIONS.USERS_IMPERSONATE)
      ) {
        const target = await prisma.user.findUnique({
          where: { id: payload.targetUserId },
          select: { id: true, name: true, email: true, status: true },
        })
        if (target?.status === 'active') {
          return {
            session: {
              ...session,
              user: {
                ...session.user,
                id: target.id,
                name: payload.targetUserName || target.name || session.user.name,
                email: payload.targetUserEmail || target.email || session.user.email,
              },
              isImpersonating: true,
              impersonatedBy: operator.id,
            },
            prisma,
          }
        }
      }
    }
  } catch {
    // The cookie API can be unavailable outside a request context (e.g. tests).
    // A bad/stale impersonation cookie never changes the authenticated identity.
  }

  return { session: ordinarySession, prisma }
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
