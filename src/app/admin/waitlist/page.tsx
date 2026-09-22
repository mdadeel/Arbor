import { listWaitlistLeadsForAdmin } from '@/server/services/admin'
import { AdminView } from '@/components/dashboard/admin/admin-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Early Access Waitlist & Leads — Arbor Admin',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminWaitlistPage() {
  const waitlistLeads = await listWaitlistLeadsForAdmin()

  return (
    <AdminView
      initialWaitlistLeads={waitlistLeads}
      initialTab="waitlist"
    />
  )
}
