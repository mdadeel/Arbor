import { listWorkspacesForAdmin } from '@/server/services/admin'
import { AdminWorkspacesView } from '@/components/dashboard/admin/admin-workspaces-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Collaborative Workspaces — Arbor Admin',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminWorkspacesPage() {
  const initialWorkspaces = await listWorkspacesForAdmin()

  return <AdminWorkspacesView initialWorkspaces={initialWorkspaces} />
}
