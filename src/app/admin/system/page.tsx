import { AdminView } from '@/components/dashboard/admin/admin-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'System Diagnostics & Operational Controls',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminSystemPage() {
  return (
    <AdminView
      initialTab="system"
    />
  )
}
