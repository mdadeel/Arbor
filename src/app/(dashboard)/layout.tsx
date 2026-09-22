import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { getServerCaller } from '@/server/caller'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { ImpersonationBanner } from '@/components/dashboard/impersonation-banner'
import { IMPERSONATION_COOKIE_NAME, verifyImpersonationToken } from '@/lib/impersonation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  // Check if session is currently impersonating another user
  let impersonationPayload = null
  let effectiveUser = session.user

  try {
    const cookieStore = cookies()
    const token = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value
    if (token) {
      const payload = verifyImpersonationToken(token)
      if (payload && payload.originalAdminId === session.user.id) {
        impersonationPayload = payload
        effectiveUser = {
          ...session.user,
          id: payload.targetUserId,
          name: payload.targetUserName || session.user.name,
          email: payload.targetUserEmail || session.user.email,
        }
      }
    }
  } catch {
    // Ignore outside request context
  }

  const caller = await getServerCaller()
  const projects = await caller.project.list().catch(() => [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background font-sans antialiased">
      {impersonationPayload && (
        <ImpersonationBanner
          targetName={impersonationPayload.targetUserName}
          targetEmail={impersonationPayload.targetUserEmail}
          operatorEmail={impersonationPayload.originalAdminEmail}
        />
      )}
      <div className="flex flex-1 overflow-hidden min-w-0 min-h-0">
        <Sidebar user={effectiveUser} projects={projects} className="hidden md:flex" />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 min-h-0">
          <Header projects={projects} user={effectiveUser} />
          <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8 [scrollbar-gutter:stable]">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}