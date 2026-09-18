import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkIsAdmin, getAdminMetrics, listUsersForAdmin, listWaitlistLeadsForAdmin } from '@/server/services/admin'
import { AdminView } from '@/components/dashboard/admin/admin-view'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

export const metadata = {
  title: 'Platform Administration & User Analytics — Arbor',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, githubUsername: true },
  })

  const isAdmin = checkIsAdmin(dbUser ?? undefined)

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-5">
        <div className="rounded-2xl bg-red-500/10 p-4 border border-red-500/25 text-red-400">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Administrative Access Required
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your account <code className="font-mono text-foreground">{session.user.email}</code> is not authorized to view platform metrics. Add your email to <code className="font-mono text-foreground">ADMIN_EMAILS</code> in Vercel or your local <code className="font-mono text-foreground">.env</code> to grant access.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dashboard</span>
          </Link>
        </Button>
      </div>
    )
  }

  const [metrics, users, waitlistLeads] = await Promise.all([
    getAdminMetrics(),
    listUsersForAdmin(),
    listWaitlistLeadsForAdmin(),
  ])

  return (
    <AdminView
      initialMetrics={metrics}
      initialUsers={users}
      initialWaitlistLeads={waitlistLeads}
    />
  )
}
