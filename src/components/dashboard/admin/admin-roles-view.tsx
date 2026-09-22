'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Lock,
  Minus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Building2,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PermissionRow {
  domain: string
  action: string
  description: string
  user: boolean
  moderator: boolean
  admin: boolean
  superAdmin: boolean
}

const PLATFORM_MATRIX: PermissionRow[] = [
  // User Management
  { domain: 'Users', action: 'platform:users:read', description: 'View user directory, profiles, and connected accounts', user: false, moderator: true, admin: true, superAdmin: true },
  { domain: 'Users', action: 'platform:users:write', description: 'Update plan perks, rate limit bypass, and user status', user: false, moderator: false, admin: true, superAdmin: true },
  { domain: 'Users', action: 'platform:users:impersonate', description: 'Start "View As" read-only session as developer', user: false, moderator: false, admin: true, superAdmin: true },
  { domain: 'Users', action: 'platform:users:delete', description: 'Permanently delete user accounts and data', user: false, moderator: false, admin: true, superAdmin: true },

  // Workspace Governance
  { domain: 'Workspaces', action: 'platform:workspaces:read', description: 'Inspect collaborative teams, slugs, and rosters', user: false, moderator: true, admin: true, superAdmin: true },
  { domain: 'Workspaces', action: 'platform:workspaces:write', description: 'Modify workspace name, settings, and tier', user: false, moderator: false, admin: true, superAdmin: true },
  { domain: 'Workspaces', action: 'platform:workspaces:suspend', description: 'Emergency freeze workspace and active AST scans', user: false, moderator: false, admin: true, superAdmin: true },

  // Waitlist
  { domain: 'Waitlist', action: 'platform:waitlist:read', description: 'View developer early access signups and queue', user: false, moderator: true, admin: true, superAdmin: true },
  { domain: 'Waitlist', action: 'platform:waitlist:manage', description: 'Approve waitlist leads and invite to beta', user: false, moderator: true, admin: true, superAdmin: true },

  // Outreach
  { domain: 'Outreach', action: 'platform:emails:read', description: 'View broadcast history and delivery logs', user: false, moderator: true, admin: true, superAdmin: true },
  { domain: 'Outreach', action: 'platform:emails:compose', description: 'Draft segmented developer announcements', user: false, moderator: false, admin: true, superAdmin: true },
  { domain: 'Outreach', action: 'platform:emails:send', description: 'Dispatch bulk email blasts with variable tags', user: false, moderator: false, admin: true, superAdmin: true },

  // Audit Logs
  { domain: 'Audit', action: 'platform:audit:read', description: 'Inspect tamper-evident chronological event ledger', user: false, moderator: true, admin: true, superAdmin: true },
  { domain: 'Audit', action: 'platform:audit:export', description: 'Export compliance audit logs to CSV/JSON', user: false, moderator: false, admin: true, superAdmin: true },

  // System & Telemetry
  { domain: 'System', action: 'platform:telemetry:read', description: 'Live database latency, memory, and BullMQ queues', user: false, moderator: true, admin: true, superAdmin: true },
  { domain: 'System', action: 'platform:queues:manage', description: 'Pause/resume AST analysis queues and reset jobs', user: false, moderator: false, admin: true, superAdmin: true },
  { domain: 'System', action: 'platform:roles:manage', description: 'Elevate users to admin/moderator and change matrix', user: false, moderator: false, admin: false, superAdmin: true },
]

export function AdminRolesView() {
  const [activeDomain, setActiveDomain] = useState<string>('all')

  const domains = ['all', 'Users', 'Workspaces', 'Waitlist', 'Outreach', 'Audit', 'System']

  const filteredMatrix = activeDomain === 'all'
    ? PLATFORM_MATRIX
    : PLATFORM_MATRIX.filter((item) => item.domain === activeDomain)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground font-display flex items-center gap-2">
            <Shield className="h-4 w-4 text-foreground" />
            Roles &amp; Unified Access Control Matrix
          </h2>
          <p className="text-xs text-muted-foreground">
            Authoritative permission registry, role inheritance hierarchy, and self-protection policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-mono border-border bg-card">
            Model: RBAC v2
          </Badge>
          <Badge variant="outline" className="text-[11px] font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
            Guards Active
          </Badge>
        </div>
      </div>

      {/* Role Summary Hierarchy Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Standard User
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-base font-bold text-foreground">Developer Account</div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Access restricted to personal workspaces and repositories. Zero platform operational privileges.</p>
            <div className="text-[11px] font-mono text-muted-foreground/70">platform:*: denied</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Moderator
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-base font-bold text-foreground">Support &amp; Community</div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Read-only user inspection, waitlist review/approval, and platform audit trail analysis.</p>
            <div className="text-[11px] font-mono text-foreground font-medium">Read-Only Operations</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Platform Admin
              </CardTitle>
              <Shield className="h-4 w-4 text-foreground" />
            </div>
            <div className="text-base font-bold text-foreground">Operations Lead</div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Full user management, impersonation (&quot;View As&quot;), workspace controls, and email campaigns.</p>
            <div className="text-[11px] font-mono text-foreground font-medium">Read + Write Governance</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Super Admin
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-foreground" />
            </div>
            <div className="text-base font-bold text-foreground">Platform Founder</div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Root operational authority. Manages platform roles, security overrides, and emergency break-glass.</p>
            <div className="text-[11px] font-mono text-foreground font-semibold">Root Operational Access</div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {domains.map((domain) => (
          <button
            key={domain}
            type="button"
            onClick={() => setActiveDomain(domain)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeDomain === domain
                ? 'bg-foreground text-background font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {domain === 'all' ? 'All Permissions (17)' : domain}
          </button>
        ))}
      </div>

      {/* Permissions Matrix Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-medium">
                <th className="py-3 px-4 w-72">Permission &amp; Action</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-center w-28">User</th>
                <th className="py-3 px-4 text-center w-28">Moderator</th>
                <th className="py-3 px-4 text-center w-28">Admin</th>
                <th className="py-3 px-4 text-center w-28">Super Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMatrix.map((item) => (
                <tr key={item.action} className="hover:bg-muted/15 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/50 border border-border">
                        {item.domain}
                      </span>
                      <span>{item.action}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">
                    {item.description}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.user ? (
                      <CheckCircle2 className="h-4 w-4 text-foreground mx-auto" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.moderator ? (
                      <CheckCircle2 className="h-4 w-4 text-foreground mx-auto" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.admin ? (
                      <CheckCircle2 className="h-4 w-4 text-foreground mx-auto" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      Root
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Self-Protection & Guardrails Card */}
      <Card className="bg-card border-border shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-foreground" />
            <CardTitle className="text-sm font-semibold">Active Self-Protection Guards &amp; Security Constraints</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Guaranteed operational invariants enforced deterministically at the service layer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-0 text-xs">
          <div className="p-3 rounded-lg border border-border bg-background space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
              Anti-Self-Demotion
            </div>
            <p className="text-muted-foreground text-[11px]">
              An administrator cannot revoke administrative privileges or suspend their own active account.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-border bg-background space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
              Last-Standing Admin Protection
            </div>
            <p className="text-muted-foreground text-[11px]">
              The platform rejects any mutation that would delete or demote the last remaining administrator.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-border bg-background space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
              Impersonation Isolation
            </div>
            <p className="text-muted-foreground text-[11px]">
              Sessions running under &quot;View As&quot; are barred from calling any administrative endpoints.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
