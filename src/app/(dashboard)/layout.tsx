import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServerCaller } from '@/server/caller'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const caller = await getServerCaller()
  const projects = await caller.project.list().catch(() => [])

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans antialiased">
      <Sidebar user={session.user} projects={projects} className="hidden md:flex" />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 min-h-0">
        <Header projects={projects} user={session.user} />
        <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8 [scrollbar-gutter:stable]">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}