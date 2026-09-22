import { AdminView } from '@/components/dashboard/admin/admin-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Emails & Platform Broadcasts — Arbor Admin',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminEmailsPage() {
  return (
    <AdminView
      initialTab="emails"
    />
  )
}
