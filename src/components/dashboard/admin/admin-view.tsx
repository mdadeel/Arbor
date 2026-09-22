'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { AdminMetrics, AdminUserItem, AdminWaitlistLead } from '@/server/services/admin'
import { trpc } from '@/lib/trpc'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  GitBranch,
  Github,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  Shield,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserDetailSheet } from './user-detail-sheet'
import { UserBenefitsDialog } from './user-benefits-dialog'
import { UserAccessDialog } from './user-access-dialog'
import { AdminEmailDialog } from './admin-email-dialog'

const defaultEmptyMetrics: AdminMetrics = {
  totalUsers: 0,
  usersLast7Days: 0,
  usersLast30Days: 0,
  totalProjects: 0,
  activeProjects: 0,
  totalAnalyses: 0,
  completedAnalyses: 0,
  totalWorkspaces: 0,
  proCandidatesCount: 0,
  estimatedPotentialMrr: 0,
  totalWaitlistLeads: 0,
}

interface AdminViewProps {
  initialMetrics?: AdminMetrics
  initialUsers?: AdminUserItem[]
  initialWaitlistLeads?: AdminWaitlistLead[]
  initialTab?: 'overview' | 'users' | 'waitlist' | 'system' | 'emails'
}

export function AdminView({
  initialMetrics = defaultEmptyMetrics,
  initialUsers = [],
  initialWaitlistLeads = [],
  initialTab = 'overview',
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'waitlist' | 'system' | 'emails'>(initialTab)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash === 'users' || hash === 'waitlist' || hash === 'system' || hash === 'emails' || hash === 'overview') {
        setActiveTab(hash as any)
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])
  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers)
  const [waitlist, setWaitlist] = useState<AdminWaitlistLead[]>(initialWaitlistLeads)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pro_candidate' | 'free_tier'>('all')
  const [waitlistSearch, setWaitlistSearch] = useState('')

  // Multi-selection state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  // Modal & Drawer control states
  const [inspectUserId, setInspectUserId] = useState<string | null>(null)
  const [benefitsUser, setBenefitsUser] = useState<AdminUserItem | null>(null)
  const [accessUser, setAccessUser] = useState<AdminUserItem | null>(null)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailTargetUser, setEmailTargetUser] = useState<AdminUserItem | null>(null)
  const [emailTargetType, setEmailTargetType] = useState<'all' | 'selected' | 'individual'>('selected')

  // Feedback & Delete states
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [userToDelete, setUserToDelete] = useState<AdminUserItem | null>(null)
  const [addWaitlistOpen, setAddWaitlistOpen] = useState(false)
  const [newWaitlistEmail, setNewWaitlistEmail] = useState('')
  const [newWaitlistSource, setNewWaitlistSource] = useState('admin_manual')

  // Query past email dispatches
  const emailsQuery = trpc.admin.listEmails.useQuery(undefined, {
    enabled: activeTab === 'emails',
  })

  // tRPC mutations & queries
  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: (_, variables) => {
      setUsers((prev) => prev.filter((u) => u.id !== variables.userId))
      setUserToDelete(null)
      setFeedback({ type: 'success', message: 'User account and associated repositories successfully removed.' })
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete user account.' })
    },
  })

  const deleteWaitlistMutation = trpc.admin.deleteWaitlistLead.useMutation({
    onSuccess: (_, variables) => {
      setWaitlist((prev) => prev.filter((w) => w.id !== variables.id))
      setFeedback({ type: 'success', message: 'Waitlist lead removed.' })
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to remove waitlist lead.' })
    },
  })

  const createWaitlistMutation = trpc.admin.createWaitlistLead.useMutation({
    onSuccess: (data) => {
      setWaitlist((prev) => [data.lead, ...prev.filter((w) => w.id !== data.lead.id)])
      setAddWaitlistOpen(false)
      setNewWaitlistEmail('')
      setFeedback({ type: 'success', message: `Added ${data.lead.email} to the early access waitlist.` })
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to add waitlist lead.' })
    },
  })

  const purgeFailedMutation = trpc.admin.purgeFailedAnalyses.useMutation({
    onSuccess: (data) => {
      systemHealthQuery.refetch()
      setFeedback({ type: 'success', message: `Purged ${data.purgedCount} failed analyses from the database.` })
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to purge analyses.' })
    },
  })

  const resetStuckMutation = trpc.admin.resetStuckAnalyses.useMutation({
    onSuccess: (data) => {
      systemHealthQuery.refetch()
      setFeedback({ type: 'success', message: `Reset ${data.resetCount} timed-out analysis jobs.` })
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to reset stuck jobs.' })
    },
  })

  const systemHealthQuery = trpc.admin.getSystemHealth.useQuery(undefined, {
    enabled: activeTab === 'system',
    refetchInterval: 15000,
  })

  // Filtering
  const filteredWaitlist = waitlist.filter((w) =>
    w.email.toLowerCase().includes(waitlistSearch.toLowerCase()) ||
    (w.source && w.source.toLowerCase().includes(waitlistSearch.toLowerCase()))
  )

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.githubUsername.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false
    if (filter === 'all') return true
    return u.subscriptionReadiness === filter
  })

  // CSV Exports
  const exportWaitlistCsv = () => {
    const headers = ['ID', 'Email', 'Source', 'Joined']
    const rows = filteredWaitlist.map((w) => [
      w.id,
      w.email,
      w.source || 'pricing_pro',
      new Date(w.createdAt).toISOString(),
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `arbor-waitlist-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportCsv = () => {
    const headers = ['ID', 'Name', 'Email', 'GitHub', 'Projects', 'Analyses', 'Joined', 'Tier']
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.name}"`,
      u.email,
      u.githubUsername,
      u.projectsCount,
      u.analysesCount,
      new Date(u.createdAt).toISOString(),
      u.subscriptionReadiness,
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `arbor-users-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const proCandidateRatio =
    initialMetrics.totalUsers > 0
      ? Math.round((initialMetrics.proCandidatesCount / initialMetrics.totalUsers) * 100)
      : 0

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner / Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 p-4 rounded-xl text-xs transition-all animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-500'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground underline text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Platform Overview Hub */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Operator Console
                </h1>
                <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary font-mono text-[11px]">
                  <Shield className="h-3 w-3" /> Full Control
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Real-time platform diagnostics, user administration, waitlist pipeline, and queue controls.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setEmailTargetUser(null)
                  setEmailTargetType('all')
                  setEmailDialogOpen(true)
                }}
                className="gap-2 text-xs h-9 bg-foreground text-background hover:bg-neutral-800"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Broadcast Email</span>
              </Button>

              <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2 text-xs h-9">
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </Button>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Users
                </CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-display text-foreground">
                  {users.length}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span>+{initialMetrics.usersLast7Days} in last 7 days</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Repositories
                </CardTitle>
                <GitBranch className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-display text-foreground">
                  {initialMetrics.totalProjects}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  <span>{initialMetrics.activeProjects} active repos</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  AST Analyses
                </CardTitle>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-display text-foreground">
                  {initialMetrics.totalAnalyses}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  <span>{initialMetrics.completedAnalyses} completed</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Pro Pipeline
                </CardTitle>
                <DollarSign className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-display text-foreground">
                  ${initialMetrics.estimatedPotentialMrr}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  <span>{initialMetrics.proCandidatesCount} power users</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Waitlist Signups
                </CardTitle>
                <Mail className="h-4 w-4 text-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-display text-foreground">
                  {waitlist.length}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  <span>Pricing &amp; Pro leads</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscription Launch Strategy Banner */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">
                    Subscription Readiness &amp; Conversion Cohort
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {proCandidateRatio}% of your active users ({initialMetrics.proCandidatesCount} developers) are connecting 3+ repositories or running frequent audits, qualifying for the upcoming $15/month Pro tier.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-bold text-foreground font-mono">
                    {initialMetrics.proCandidatesCount} of {users.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Pro Candidates</div>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.max(proCandidateRatio, 5)}%` }}
              />
            </div>
          </div>

          {/* Quick Hub Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/admin/users"
              onClick={() => setActiveTab('users')}
              className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                    <Users className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {users.length} Users
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground font-display group-hover:text-primary transition-colors">
                    User Directory &amp; Access
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    Manage roles, grant Pro benefits, configure fine-grained permissions, and inspect 360° developer profiles.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-border/40 flex items-center justify-between text-xs font-medium text-primary">
                <span>Manage Users</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/admin/waitlist"
              onClick={() => setActiveTab('waitlist')}
              className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-105 transition-transform">
                    <Mail className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {waitlist.length} Leads
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground font-display group-hover:text-primary transition-colors">
                    Early Access Waitlist
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    Review pre-order leads collected from pricing page, export CSVs, and send onboarding invites.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-border/40 flex items-center justify-between text-xs font-medium text-primary">
                <span>View Waitlist</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/admin/system"
              onClick={() => setActiveTab('system')}
              className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                    <Server className="h-4 w-4" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground font-display group-hover:text-primary transition-colors">
                    System &amp; Controls
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    Real-time PostgreSQL connection latency, BullMQ task queue health, purge failed analyses, and unblock jobs.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-border/40 flex items-center justify-between text-xs font-medium text-primary">
                <span>System Health</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/admin/emails"
              onClick={() => setActiveTab('emails')}
              className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 group-hover:scale-105 transition-transform">
                    <Send className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {emailsQuery.data?.length ?? 0} Sent
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground font-display group-hover:text-primary transition-colors">
                    Emails &amp; Broadcasts
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    Dispatch direct emails to selected developers, send feature announcements, and track delivery logs.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-border/40 flex items-center justify-between text-xs font-medium text-primary">
                <span>Email Center</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>

          {/* Activity Section: Recent Users & Recent Waitlist */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Users Card */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">Recent Developer Signups</h3>
                  <p className="text-[11px] text-muted-foreground">Latest accounts created on Arbor</p>
                </div>
                <Link
                  href="/admin/users"
                  onClick={() => setActiveTab('users')}
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                >
                  <span>View all ({users.length})</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="divide-y divide-border/40 text-xs">
                {users.slice(0, 5).map((u) => (
                  <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-7 w-7 border border-border shrink-0">
                        {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
                        <AvatarFallback className="text-[10px] font-semibold">
                          {(u.name || u.email || 'U').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate font-mono">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] font-mono capitalize">
                        {u.plan || 'Free'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setInspectUserId(u.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Inspect User"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Waitlist Leads */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">Recent Early Access Leads</h3>
                  <p className="text-[11px] text-muted-foreground">Latest waitlist submissions</p>
                </div>
                <Link
                  href="/admin/waitlist"
                  onClick={() => setActiveTab('waitlist')}
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                >
                  <span>View all ({waitlist.length})</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="divide-y divide-border/40 text-xs">
                {waitlist.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No waitlist leads recorded yet.
                  </div>
                ) : (
                  waitlist.slice(0, 5).map((lead) => (
                    <div key={lead.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs text-foreground truncate">{lead.email}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
                          {lead.source || 'pricing_pro'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Directory & Table */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Sticky Batch Actions Bar */}
          {selectedUserIds.length > 0 && (
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-primary/30 bg-primary/10 text-xs animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-primary bg-background border-primary/40 text-[11px]">
                  {selectedUserIds.length} Selected
                </Badge>
                <span className="text-foreground font-semibold">
                  Developers queued for direct email or batch management.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setEmailTargetUser(null)
                    setEmailTargetType('selected')
                    setEmailDialogOpen(true)
                  }}
                  className="gap-1.5 text-xs h-8 bg-foreground text-background hover:bg-neutral-800"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Send Direct Email ({selectedUserIds.length})</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedUserIds([])}
                  className="text-xs h-8"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground font-display">
                User Directory &amp; Access Controls ({filteredUsers.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Inspect 360° developer profiles, grant custom benefits, enforce access controls, and dispatch emails.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Filter Pills */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filter === 'all'
                      ? 'bg-background text-foreground font-medium shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('pro_candidate')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filter === 'pro_candidate'
                      ? 'bg-background text-primary font-medium shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pro Candidates ({initialMetrics.proCandidatesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('free_tier')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filter === 'free_tier'
                      ? 'bg-background text-foreground font-medium shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Free Tier
                </button>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search username, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-xs bg-background"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                        onChange={() => {
                          if (selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0) {
                            setSelectedUserIds([])
                          } else {
                            setSelectedUserIds(filteredUsers.map((u) => u.id))
                          }
                        }}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                        title="Select/Deselect All"
                      />
                    </th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Plan &amp; Access</th>
                    <th className="py-3 px-4">GitHub Profile</th>
                    <th className="py-3 px-4 text-center">Repositories</th>
                    <th className="py-3 px-4 text-center">Analyses</th>
                    <th className="py-3 px-4 text-center">Multi-Account</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        No users match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id)
                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-muted/15 transition-colors ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedUserIds((prev) =>
                                  prev.includes(user.id)
                                    ? prev.filter((id) => id !== user.id)
                                    : [...prev, user.id]
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                            />
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border border-border">
                                {user.avatarUrl ? (
                                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                                ) : null}
                                <AvatarFallback className="text-[10px] bg-muted font-bold">
                                  {user.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {user.role === 'admin' && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/30 text-primary bg-primary/10">
                                      ADMIN
                                    </Badge>
                                  )}
                                  {user.status === 'suspended' && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-red-500/30 text-red-500 bg-red-500/10">
                                      SUSPENDED
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1">
                              <div>
                                {user.plan === 'pro' || user.plan === 'enterprise' || user.plan === 'lifetime' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 capitalize">
                                    <Sparkles className="h-2.5 w-2.5" /> {user.plan}
                                  </span>
                                ) : user.subscriptionReadiness === 'pro_candidate' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <Sparkles className="h-2.5 w-2.5" /> Pro Candidate
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                                    Community Free
                                  </span>
                                )}
                              </div>
                              {user.benefits?.perks && user.benefits.perks.length > 0 && (
                                <div className="text-[9px] text-muted-foreground font-mono">
                                  {user.benefits.perks.length} active perks
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <a
                              href={`https://github.com/${user.githubUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Github className="h-3 w-3" />
                              <span>@{user.githubUsername}</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </a>
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-medium text-foreground">
                            {user.projectsCount}
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-medium text-foreground">
                            {user.analysesCount}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {user.connectedAccountsCount > 1 ? (
                              <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/10">
                                <KeyRound className="h-2.5 w-2.5" />
                                {user.connectedAccountsCount} Accounts
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/70 text-[11px]">Primary</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                            {new Date(user.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Inspect 360 view */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setInspectUserId(user.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                title="Inspect developer full details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              {/* View As (Impersonate) */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  try {
                                    const res = await fetch('/api/admin/impersonate', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ userId: user.id }),
                                    })
                                    const data = await res.json()
                                    if (data.success && data.redirectUrl) {
                                      window.location.href = data.redirectUrl
                                    } else {
                                      alert(data.error || 'Failed to start impersonation')
                                    }
                                  } catch (err: any) {
                                    alert(err.message || 'Network error')
                                  }
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                title="View As this developer (impersonate)"
                              >
                                <LogIn className="h-3.5 w-3.5" />
                              </Button>

                              {/* Manage Benefits */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setBenefitsUser(user)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                title="Manage plan & benefits"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </Button>

                              {/* Access Control */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setAccessUser(user)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                title="Adjust access & permissions"
                              >
                                <Shield className="h-3.5 w-3.5" />
                              </Button>

                              {/* Direct Email */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEmailTargetUser(user)
                                  setEmailTargetType('individual')
                                  setEmailDialogOpen(true)
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                title="Send direct email"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>

                              {/* Delete */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setUserToDelete(user)}
                                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Early Access Waitlist & Leads Table */}
      {activeTab === 'waitlist' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground font-display">
                Early Access Waitlist ({filteredWaitlist.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Email addresses collected directly from pricing section pre-order &amp; direct invitations.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddWaitlistOpen(true)}
                className="gap-1.5 text-xs h-9 font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Lead</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportWaitlistCsv}
                className="gap-2 text-xs h-9 font-medium"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </Button>

              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={waitlistSearch}
                  onChange={(e) => setWaitlistSearch(e.target.value)}
                  className="pl-8 h-9 text-xs bg-background"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Origin / Campaign</th>
                    <th className="py-3 px-4">Subscribed At</th>
                    <th className="py-3 px-4">Tier Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredWaitlist.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        {waitlist.length === 0
                          ? 'No waitlist leads recorded yet. Submissions via the pricing section will appear here.'
                          : 'No waitlist leads match your search query.'}
                      </td>
                    </tr>
                  ) : (
                    filteredWaitlist.map((lead) => (
                      <tr key={lead.id} className="hover:bg-muted/15 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <a
                              href={`mailto:${lead.email}`}
                              className="font-mono text-xs hover:underline hover:text-foreground"
                            >
                              {lead.email}
                            </a>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className="font-mono text-[10px] bg-muted/50 border-border">
                            {lead.source || 'pricing_pro'}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                          {new Date(lead.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                            Early Access Lead
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deleteWaitlistMutation.isPending}
                            onClick={() => deleteWaitlistMutation.mutate({ id: lead.id })}
                            className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Delete lead"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* System & Operations Controls Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground font-display">
                System Diagnostics &amp; Operational Controls
              </h2>
              <p className="text-xs text-muted-foreground">
                Live database connectivity, AST analysis queue monitor, and maintenance controls.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => systemHealthQuery.refetch()}
              disabled={systemHealthQuery.isFetching}
              className="gap-2 text-xs h-9"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${systemHealthQuery.isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh Health</span>
            </Button>
          </div>

          {/* Health Monitor Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Database Status
                </CardTitle>
                <Database className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <div className="text-xl font-bold font-display text-foreground">
                    {systemHealthQuery.data?.dbLatencyMs !== undefined ? `${systemHealthQuery.data.dbLatencyMs}ms` : 'Checking...'}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">PostgreSQL query roundtrip</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Process Memory
                </CardTitle>
                <Cpu className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-display text-foreground">
                  {systemHealthQuery.data?.memoryUsage.heapUsedMb ? `${systemHealthQuery.data.memoryUsage.heapUsedMb} MB` : '—'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  RSS: {systemHealthQuery.data?.memoryUsage.rssMb ?? 0} MB · {systemHealthQuery.data?.nodeVersion ?? 'Node'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Analyses
                </CardTitle>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-display text-foreground">
                  {systemHealthQuery.data?.activeAnalysesCount ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {systemHealthQuery.data?.queuedAnalysesCount ?? 0} queued in BullMQ
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Failed Analyses
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-display text-foreground">
                  {systemHealthQuery.data?.failedAnalysesCount ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Eligible for cleanup</p>
              </CardContent>
            </Card>
          </div>

          {/* BullMQ Job Queue Breakdown */}
          <Card className="bg-card border-border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-foreground" />
                  <CardTitle className="text-sm font-semibold">BullMQ AST Analysis Queue Telemetry</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-mono">Redis Status:</span>
                  <Badge variant="outline" className={`text-[10px] font-mono capitalize ${
                    systemHealthQuery.data?.redisStatus === 'healthy'
                      ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      : 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                  }`}>
                    {systemHealthQuery.data?.redisStatus ?? 'healthy'}
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-xs">
                Real-time job lifecycle counters for the deterministic repository parsing engine.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-lg border border-border bg-background">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Waiting</div>
                  <div className="text-xl font-bold font-display text-foreground mt-1">
                    {systemHealthQuery.data?.queueBreakdown?.waiting ?? 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Pending execution</div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Active</div>
                  <div className="text-xl font-bold font-display text-foreground mt-1">
                    {systemHealthQuery.data?.queueBreakdown?.active ?? 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Parsing AST now</div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Completed</div>
                  <div className="text-xl font-bold font-display text-foreground mt-1">
                    {systemHealthQuery.data?.queueBreakdown?.completed ?? 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Finished runs</div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Failed</div>
                  <div className="text-xl font-bold font-display text-foreground mt-1">
                    {systemHealthQuery.data?.queueBreakdown?.failed ?? 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Timed out / errors</div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Delayed</div>
                  <div className="text-xl font-bold font-display text-foreground mt-1">
                    {systemHealthQuery.data?.queueBreakdown?.delayed ?? 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Backoff retries</div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Paused</div>
                  <div className="text-xl font-bold font-display text-foreground mt-1">
                    {systemHealthQuery.data?.queueBreakdown?.paused ?? 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Queue holds</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operational Control Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <Card className="bg-card border-border shadow-xs">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-foreground" />
                  <CardTitle className="text-sm font-semibold">Purge Failed Analyses</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Permanently deletes errored or timed-out analysis runs from the database to clear clutter and reduce table size.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={purgeFailedMutation.isPending}
                  onClick={() => purgeFailedMutation.mutate()}
                  className="gap-2 text-xs font-medium"
                >
                  {purgeFailedMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>Purge Failed Records</span>
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-xs">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-foreground" />
                  <CardTitle className="text-sm font-semibold">Reset Stuck Queue Jobs</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Marks analysis tasks that have remained stuck in &quot;queued&quot; or &quot;analyzing&quot; for &gt;15 minutes as failed, unblocking the worker queue.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resetStuckMutation.isPending}
                  onClick={() => resetStuckMutation.mutate()}
                  className="gap-2 text-xs font-medium"
                >
                  {resetStuckMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>Reset Stuck Jobs</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Emails & Broadcasts Tab */}
      {activeTab === 'emails' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground font-display">
                Admin Emails &amp; Platform Broadcasts ({emailsQuery.data?.length ?? 0})
              </h2>
              <p className="text-xs text-muted-foreground">
                History of announcements, upgrade notifications, and direct emails sent from this console.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setEmailTargetUser(null)
                setEmailTargetType('all')
                setEmailDialogOpen(true)
              }}
              className="gap-2 text-xs h-9 bg-foreground text-background hover:bg-neutral-800"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Compose Email</span>
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Target Audience</th>
                    <th className="py-3 px-4 text-center">Recipients</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {emailsQuery.isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Loading email history...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !emailsQuery.data || emailsQuery.data.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No admin emails have been dispatched yet. Click &quot;Compose Email&quot; to send your first message.
                      </td>
                    </tr>
                  ) : (
                    emailsQuery.data.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/15 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <div>
                            <div className="font-semibold text-xs text-foreground">{item.subject}</div>
                            <div className="text-[11px] text-muted-foreground line-clamp-1 font-mono">
                              {item.body.slice(0, 80)}...
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className="text-[10px] capitalize font-mono border-border bg-muted/30">
                            {item.targetType}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-medium text-foreground">
                          {item.recipientCount}
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono capitalize ${
                              item.status === 'delivered'
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : item.status === 'failed'
                                ? 'border-red-500/40 bg-red-500/10 text-red-500'
                                : 'border-primary/40 bg-primary/10 text-primary'
                            }`}
                          >
                            {item.status}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-display">Delete User Account</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Are you sure you want to permanently delete user{' '}
              <strong className="text-foreground">{userToDelete?.name}</strong> (
              <span className="font-mono text-muted-foreground">{userToDelete?.email}</span>)?
              This action cannot be undone and will cascade to all associated repositories, analyses, and environments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserToDelete(null)}
              disabled={deleteUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteUserMutation.isPending}
              onClick={() => userToDelete && deleteUserMutation.mutate({ userId: userToDelete.id })}
              className="gap-2 bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteUserMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirm Delete</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Waitlist Lead Dialog */}
      <Dialog open={addWaitlistOpen} onOpenChange={setAddWaitlistOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-display">Add Early Access Lead</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Manually record an email address into the early access waitlist directory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Email Address</label>
              <Input
                type="email"
                placeholder="founder@example.com"
                value={newWaitlistEmail}
                onChange={(e) => setNewWaitlistEmail(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Source / Campaign</label>
              <Input
                type="text"
                placeholder="admin_manual"
                value={newWaitlistSource}
                onChange={(e) => setNewWaitlistSource(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddWaitlistOpen(false)}
              disabled={createWaitlistMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newWaitlistEmail || createWaitlistMutation.isPending}
              onClick={() =>
                createWaitlistMutation.mutate({
                  email: newWaitlistEmail,
                  source: newWaitlistSource,
                })
              }
              className="gap-2"
            >
              {createWaitlistMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Save Lead</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User 360 Detail Sheet */}
      <UserDetailSheet
        userId={inspectUserId}
        open={Boolean(inspectUserId)}
        onOpenChange={(open) => !open && setInspectUserId(null)}
        onOpenBenefits={(id) => {
          const u = users.find((item) => item.id === id)
          if (u) setBenefitsUser(u)
        }}
        onOpenAccess={(id) => {
          const u = users.find((item) => item.id === id)
          if (u) setAccessUser(u)
        }}
        onOpenEmail={(id) => {
          const u = users.find((item) => item.id === id)
          if (u) {
            setEmailTargetUser(u)
            setEmailTargetType('individual')
            setEmailDialogOpen(true)
          }
        }}
      />

      {/* User Benefits Dialog */}
      <UserBenefitsDialog
        user={benefitsUser}
        open={Boolean(benefitsUser)}
        onOpenChange={(open) => !open && setBenefitsUser(null)}
        onSuccess={(updated) => {
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
          setFeedback({ type: 'success', message: `Benefits & perks successfully updated for ${updated.name}.` })
        }}
      />

      {/* User Access Controls Dialog */}
      <UserAccessDialog
        user={accessUser}
        open={Boolean(accessUser)}
        onOpenChange={(open) => !open && setAccessUser(null)}
        onSuccess={(updated) => {
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
          setFeedback({ type: 'success', message: `Access controls & role successfully updated for ${updated.name}.` })
        }}
      />

      {/* Admin Email Dialog */}
      <AdminEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        initialTargetType={emailTargetType}
        individualUser={emailTargetUser}
        selectedUsers={users.filter((u) => selectedUserIds.includes(u.id))}
        onSuccess={() => {
          emailsQuery.refetch()
          setFeedback({ type: 'success', message: 'Email dispatch successfully completed.' })
        }}
      />
    </div>
  )
}
