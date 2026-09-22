import { listUsersForAdmin } from '@/server/services/admin'
import { AdminView } from '@/components/dashboard/admin/admin-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'User Directory & Access Controls — Arbor Admin',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminUsersPage() {
  const users = await listUsersForAdmin()

  return (
    <AdminView
      initialUsers={users}
      initialTab="users"
    />
  )
}
