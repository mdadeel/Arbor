'use client'

import { useState } from 'react'
import type { AdminMetrics, AdminUserItem, AdminWaitlistLead } from '@/server/services/admin'
import {
  Activity,
  DollarSign,
  Download,
  ExternalLink,
  GitBranch,
  Github,
  KeyRound,
  Mail,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface AdminViewProps {
  initialMetrics: AdminMetrics
  initialUsers: AdminUserItem[]
  initialWaitlistLeads?: AdminWaitlistLead[]
}

export function AdminView({ initialMetrics, initialUsers, initialWaitlistLeads = [] }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'waitlist'>('users')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pro_candidate' | 'free_tier'>('all')
  const [waitlistSearch, setWaitlistSearch] = useState('')

  const filteredWaitlist = initialWaitlistLeads.filter((w) =>
    w.email.toLowerCase().includes(waitlistSearch.toLowerCase()) ||
    (w.source && w.source.toLowerCase().includes(waitlistSearch.toLowerCase()))
  )

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

  const filteredUsers = initialUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.githubUsername.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false
    if (filter === 'all') return true
    return u.subscriptionReadiness === filter
  })

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
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Platform Administration
            </h1>
            <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary font-mono text-[11px]">
              <Shield className="h-3 w-3" /> Admin Only
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time user adoption, repository tracking metrics, and subscription readiness analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2 text-xs h-9">
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-display text-foreground">
              {initialMetrics.totalUsers}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span>+{initialMetrics.usersLast7Days} in last 7 days</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Repositories
            </CardTitle>
            <GitBranch className="h-4 w-4 text-cyan-400" />
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

        <Card className="bg-card border-border shadow-sm">
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

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pro Pipeline
            </CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-display text-emerald-500">
              ${initialMetrics.estimatedPotentialMrr}
              <span className="text-xs font-normal text-muted-foreground">/mo</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              <span>{initialMetrics.proCandidatesCount} power users</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Waitlist Signups
            </CardTitle>
            <Mail className="h-4 w-4 text-[#65DCD5]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-display text-[#65DCD5]">
              {initialWaitlistLeads.length}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              <span>Pricing &amp; Pro leads</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Launch Strategy Banner */}
      <div className="rounded-2xl border border-primary/40 bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">
                Subscription Readiness &amp; Conversion Pipeline
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {proCandidateRatio}% of your active users ({initialMetrics.proCandidatesCount} developers) are connecting 3+ repositories or running frequent audits, placing them directly in the target cohort for the upcoming $15/month Pro tier.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="text-xs font-bold text-foreground font-mono">
                {initialMetrics.proCandidatesCount} of {initialMetrics.totalUsers}
              </div>
              <div className="text-[10px] text-muted-foreground">Pro Candidates</div>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.max(proCandidateRatio, 5)}%` }}
          />
        </div>
      </div>

      {/* Directory Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'users'
              ? 'bg-foreground text-background shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>User Directory ({initialUsers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('waitlist')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'waitlist'
              ? 'bg-foreground text-background shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Early Access Waitlist ({initialWaitlistLeads.length})</span>
          {initialWaitlistLeads.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              activeTab === 'waitlist'
                ? 'bg-background/20 text-background'
                : 'bg-muted text-muted-foreground'
            }`}>
              {initialWaitlistLeads.length}
            </span>
          )}
        </button>
      </div>

      {/* User Directory & Table */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground font-display">
                User Directory ({filteredUsers.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Inspect user adoption, connected GitHub handles, and repository audit activity.
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
                      ? 'bg-background text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All ({initialUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('pro_candidate')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filter === 'pro_candidate'
                      ? 'bg-background text-primary font-medium shadow-sm'
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
                      ? 'bg-background text-foreground font-medium shadow-sm'
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
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">GitHub Profile</th>
                    <th className="py-3 px-4 text-center">Repositories</th>
                    <th className="py-3 px-4 text-center">Analyses</th>
                    <th className="py-3 px-4 text-center">Multi-Account</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Subscription Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No users match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/15 transition-colors">
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
                              <div className="font-semibold text-foreground">{user.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {user.email}
                              </div>
                            </div>
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

                        <td className="py-3.5 px-4 text-center font-mono text-cyan-400 font-medium">
                          {user.analysesCount}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {user.connectedAccountsCount > 1 ? (
                            <Badge variant="outline" className="text-[10px] gap-1 border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
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
                          {user.subscriptionReadiness === 'pro_candidate' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
                              <Sparkles className="h-2.5 w-2.5" /> Pro Candidate
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                              Free Community
                            </span>
                          )}
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

      {/* Early Access Waitlist & Pre-orders Table */}
      {activeTab === 'waitlist' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground font-display">
                Early Access Waitlist ({filteredWaitlist.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Email addresses collected directly from pricing section pre-order &amp; notify-me signups.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={exportWaitlistCsv}
                className="gap-2 text-xs h-9"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Waitlist CSV</span>
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

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[550px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Origin / Campaign</th>
                    <th className="py-3 px-4">Subscribed At</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredWaitlist.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        {initialWaitlistLeads.length === 0
                          ? 'No waitlist leads recorded yet. Submissions via the pricing section will appear here in real-time.'
                          : 'No waitlist leads match your search query.'}
                      </td>
                    </tr>
                  ) : (
                    filteredWaitlist.map((lead) => (
                      <tr key={lead.id} className="hover:bg-muted/15 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-[#65DCD5]" />
                            <a
                              href={`mailto:${lead.email}`}
                              className="font-mono text-xs hover:underline hover:text-[#65DCD5]"
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
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#65DCD5]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#65DCD5] border border-[#65DCD5]/20">
                            Early Access Lead
                          </span>
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
    </div>
  )
}
