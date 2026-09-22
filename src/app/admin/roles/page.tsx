import { AdminRolesView } from '@/components/dashboard/admin/admin-roles-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Roles & Unified Access Control Matrix — Arbor Admin',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminRolesPage() {
  return <AdminRolesView />
}
