import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkIsAdmin, getAdminNavbarData } from '@/server/services/admin'
import { AdminNavbar } from '@/components/dashboard/admin/admin-navbar'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

export const metadata = {
  title: 'Platform Administration — Arbor',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/admin-login?callbackUrl=/admin')
  }

  const { user: dbUser, counts } = await getAdminNavbarData(session.user.id)
  const isAdmin = checkIsAdmin(dbUser ?? undefined)

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground antialiased">
        <div className="w-full max-w-md space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/25 text-red-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Administrative Access Required
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account <code className="font-mono text-foreground font-semibold">{session.user.email}</code> is not authorized to access the operator console.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Button asChild variant="outline" className="gap-2 text-xs">
              <Link href="/dashboard">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Dashboard</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      <AdminNavbar
        user={session.user}
        counts={counts}
      />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 [scrollbar-gutter:stable]">
        {children}
      </main>
    </div>
  )
}
