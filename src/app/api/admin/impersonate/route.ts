import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkIsAdmin } from '@/server/services/admin'
import { logAuditEvent } from '@/server/services/audit'
import {
  createImpersonationToken,
  IMPERSONATION_COOKIE_NAME,
  IMPERSONATION_MAX_AGE_SECONDS,
  verifyImpersonationToken,
} from '@/lib/impersonation'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const caller = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, githubUsername: true, role: true },
    })

    if (!checkIsAdmin(caller ?? undefined)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const targetUserId = body.userId
    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'Missing valid userId' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    const token = createImpersonationToken({
      originalAdminId: caller!.id,
      originalAdminEmail: caller!.email ?? undefined,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name ?? undefined,
      targetUserEmail: targetUser.email ?? undefined,
      expiresAt: Date.now() + IMPERSONATION_MAX_AGE_SECONDS * 1000,
    })

    await logAuditEvent({
      userId: caller!.id,
      action: 'admin.impersonate_start',
      entityType: 'user',
      entityId: targetUser.id,
      metadata: {
        operatorEmail: caller!.email,
        targetEmail: targetUser.email,
        targetRole: targetUser.role,
      },
    })

    const response = NextResponse.json({
      success: true,
      message: `Impersonation started for ${targetUser.email || targetUser.name}`,
      redirectUrl: '/dashboard',
    })

    response.cookies.set({
      name: IMPERSONATION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
    })

    return response
  } catch (err: any) {
    console.error('[Admin:Impersonate] Error starting impersonation:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${IMPERSONATION_COOKIE_NAME}=([^;]*)`))
    const token = match ? decodeURIComponent(match[1]) : null

    if (token) {
      const payload = verifyImpersonationToken(token)
      if (payload) {
        await logAuditEvent({
          userId: payload.originalAdminId,
          action: 'admin.impersonate_stop',
          entityType: 'user',
          entityId: payload.targetUserId,
          metadata: {
            operatorEmail: payload.originalAdminEmail,
            targetEmail: payload.targetUserEmail,
          },
        })
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Impersonation ended',
      redirectUrl: '/admin/users',
    })

    response.cookies.set({
      name: IMPERSONATION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })

    return response
  } catch (err: any) {
    console.error('[Admin:Impersonate] Error stopping impersonation:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
