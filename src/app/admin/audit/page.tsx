import { listAuditLogsForAdmin } from '@/server/services/admin'
import { AdminAuditView } from '@/components/dashboard/admin/admin-audit-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Platform Audit Trail — Arbor Admin',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminAuditPage() {
  const initialLogs = await listAuditLogsForAdmin({ limit: 50 })

  return <AdminAuditView initialLogs={initialLogs} />
}
