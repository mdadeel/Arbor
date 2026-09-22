import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  IMPERSONATION_COOKIE_NAME,
  verifyImpersonationToken,
} from '@/lib/impersonation'
import { logAuditEvent } from '@/server/services/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value

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
        }).catch(() => {})
      }
    }

    const url = new URL(req.url)
    const destination = url.searchParams.get('redirect') || '/admin/users'
    const response = NextResponse.redirect(new URL(destination, req.url))

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
  } catch (err) {
    console.error('[Admin:Impersonate:Exit] Error:', err)
    return NextResponse.redirect(new URL('/admin/users', req.url))
  }
}
