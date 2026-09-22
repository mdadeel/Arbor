import { getAdminMetrics, listUsersForAdmin, listWaitlistLeadsForAdmin } from '@/server/services/admin'
import { AdminView } from '@/components/dashboard/admin/admin-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Platform Overview — Arbor Admin',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminPage() {
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
      initialTab="overview"
    />
  )
}
