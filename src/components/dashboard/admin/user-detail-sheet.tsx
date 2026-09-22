'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Eye,
  GitBranch,
  Github,
  KeyRound,
  Layers,
  Loader2,
  Mail,
  Shield,
  Sparkles,
  UserCheck,
  UserX,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScoreBadge } from '@/components/dashboard/score-badge'

interface UserDetailSheetProps {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenBenefits: (userId: string) => void
  onOpenAccess: (userId: string) => void
  onOpenEmail: (userId: string) => void
}

export function UserDetailSheet({
  userId,
  open,
  onOpenChange,
  onOpenBenefits,
  onOpenAccess,
  onOpenEmail,
}: UserDetailSheetProps) {
  const [detailTab, setDetailTab] = useState<'overview' | 'projects' | 'analyses' | 'security' | 'activity'>('overview')

  const { data: user, isLoading, error } = trpc.admin.getUserDetails.useQuery(
    { userId: userId || '' },
    {
      enabled: Boolean(open && userId),
      staleTime: 5000,
    }
  )

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar className="h-12 w-12 border-2 border-border shadow-xs">
                {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                <AvatarFallback className="text-xs font-bold bg-muted">
                  {user?.name?.slice(0, 2).toUpperCase() || 'US'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold font-display text-foreground">
                    {user?.name || 'Loading developer...'}
                  </DialogTitle>
                  {user?.role === 'admin' && (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] font-mono">
                      ADMIN
                    </Badge>
                  )}
                  {user?.status === 'suspended' ? (
                    <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-500 text-[10px]">
                      SUSPENDED
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                      ACTIVE
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{user?.email}</span>
                  <span>·</span>
                  <a
                    href={`https://github.com/${user?.githubUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                  >
                    <Github className="h-3 w-3" />
                    @{user?.githubUsername}
                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                  </a>
                </DialogDescription>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenEmail(user.id)}
                  className="gap-1.5 text-xs h-8"
                >
                  <Mail className="h-3 w-3" />
                  <span>Email</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenBenefits(user.id)}
                  className="gap-1.5 text-xs h-8"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Benefits</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenAccess(user.id)}
                  className="gap-1.5 text-xs h-8"
                >
                  <Shield className="h-3 w-3" />
                  <span>Access</span>
                </Button>
                <Button
                  size="sm"
                  variant="default"
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
                  className="gap-1.5 text-xs h-8"
                >
                  <Eye className="h-3 w-3" />
                  <span>View As</span>
                </Button>
              </div>
            )}
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={() => setDetailTab('overview')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                detailTab === 'overview'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Overview &amp; Plan
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('projects')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                detailTab === 'projects'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Repositories ({user?.projects.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('analyses')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                detailTab === 'analyses'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              AST Analyses ({user?.analyses.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('security')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                detailTab === 'security'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Security &amp; Permissions
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('activity')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                detailTab === 'activity'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Activity &amp; Audit ({user?.auditLogs?.length ?? 0})
            </button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Gathering developer activity and system metrics...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error.message || 'Failed to load user details.'}</span>
            </div>
          )}

          {user && !isLoading && (
            <>
              {/* Tab: Overview & Plan */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                      <div className="text-[11px] text-muted-foreground font-medium">Subscription Tier</div>
                      <div className="text-base font-bold text-foreground capitalize mt-0.5 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        {user.plan} Tier
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                      <div className="text-[11px] text-muted-foreground font-medium">Total Repositories</div>
                      <div className="text-base font-bold text-foreground mt-0.5">
                        {user.stats.totalProjects} Repos
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                      <div className="text-[11px] text-muted-foreground font-medium">Analyses Run</div>
                      <div className="text-base font-bold text-foreground mt-0.5">
                        {user.stats.totalAnalyses}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                      <div className="text-[11px] text-muted-foreground font-medium">Average Health</div>
                      <div className="text-base font-bold text-foreground mt-0.5">
                        {user.stats.averageOverallScore !== null ? (
                          <span className="text-emerald-500">{user.stats.averageOverallScore}/100</span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-normal">Pending</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Benefits & Perks Showcase */}
                  <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Active Benefits &amp; Entitlements
                        </h4>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenBenefits(user.id)}
                        className="text-xs h-7"
                      >
                        Edit Benefits
                      </Button>
                    </div>

                    {user.benefits?.perks && user.benefits.perks.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {user.benefits.perks.map((perk: string) => (
                          <Badge
                            key={perk}
                            variant="outline"
                            className="text-[11px] gap-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 py-0.5"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {perk.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Standard community free tier with no special administrator perks assigned.
                      </p>
                    )}

                    {user.benefits?.customNotes && (
                      <div className="p-2.5 rounded-lg bg-card border border-border/60 text-xs text-muted-foreground mt-2">
                        <span className="font-semibold text-foreground">Admin Grant Note:</span>{' '}
                        {user.benefits.customNotes}
                      </div>
                    )}

                    {user.benefits?.grantedAt && (
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Last granted: {new Date(user.benefits.grantedAt).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Account Timeline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl border border-border space-y-1.5">
                      <div className="text-muted-foreground font-medium">Joined Platform</div>
                      <div className="font-mono text-foreground">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border space-y-1.5">
                      <div className="text-muted-foreground font-medium">Last Profile Sync</div>
                      <div className="font-mono text-foreground">
                        {new Date(user.updatedAt).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Repositories */}
              {detailTab === 'projects' && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Connected GitHub repositories monitored under this user account.
                  </div>

                  {user.projects.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                      No repositories connected yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
                      {user.projects.map((project) => (
                        <div key={project.id} className="p-3.5 flex items-center justify-between hover:bg-muted/15 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground">{project.name}</span>
                              <Badge variant="outline" className="text-[10px] font-mono border-border">
                                {project.repoPrivate ? 'Private' : 'Public'}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border">
                                {project.defaultBranch}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {project.repoFullName}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-[10px] text-muted-foreground">Score</div>
                              {project.latestScores?.overall !== undefined ? (
                                <ScoreBadge score={project.latestScores.overall} size="sm" />
                              ) : (
                                <span className="text-xs text-muted-foreground font-mono">—</span>
                              )}
                            </div>

                            <a
                              href={`/projects/${project.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                              title="Open Project Workbench"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: AST Analyses */}
              {detailTab === 'analyses' && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Recent AST architectural analysis jobs executed by this user.
                  </div>

                  {user.analyses.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                      No AST analyses recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
                      {user.analyses.map((analysis) => (
                        <div key={analysis.id} className="p-3.5 flex items-center justify-between hover:bg-muted/15 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground">{analysis.projectName}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase font-mono ${
                                  analysis.status === 'completed'
                                    ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                                    : analysis.status === 'failed'
                                    ? 'border-red-500/30 text-red-500 bg-red-500/10'
                                    : 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                                }`}
                              >
                                {analysis.status}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                              <span>Branch: {analysis.branch}</span>
                              {analysis.commitSha && <span>SHA: {analysis.commitSha.slice(0, 7)}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {analysis.overallScore !== null && (
                              <ScoreBadge score={analysis.overallScore} size="sm" />
                            )}
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {new Date(analysis.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Security & Permissions */}
              {detailTab === 'security' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Access Controls &amp; Capabilities
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Fine-grained administrative permission overrides for this account.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenAccess(user.id)}
                      className="text-xs h-7"
                    >
                      Adjust Access
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                      <div className="text-muted-foreground text-[11px] font-medium">Account Role</div>
                      <div className="font-semibold text-xs text-foreground uppercase tracking-wide">
                        {user.role}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                      <div className="text-muted-foreground text-[11px] font-medium">Account Status</div>
                      <div className="font-semibold text-xs text-foreground capitalize">
                        {user.status}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                      <div className="text-muted-foreground text-[11px] font-medium">Bypass Rate Limits</div>
                      <div className="font-semibold text-xs text-foreground">
                        {user.permissions?.bypassRateLimit ? 'Enabled (No limit)' : 'Disabled (Standard 10/hr)'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                      <div className="text-muted-foreground text-[11px] font-medium">Private Repositories</div>
                      <div className="font-semibold text-xs text-foreground">
                        {user.permissions?.canAnalyzePrivate !== false ? 'Permitted' : 'Blocked'}
                      </div>
                    </div>
                  </div>

                  {/* Connected Multi-Accounts */}
                  <div className="pt-2">
                    <h5 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      Connected GitHub Credentials ({user.githubAccounts.length})
                    </h5>
                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
                      {user.githubAccounts.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground italic">
                          Only primary OAuth session identity connected.
                        </div>
                      ) : (
                        user.githubAccounts.map((account) => (
                          <div key={account.id} className="p-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium text-foreground">@{account.username}</span>
                              {account.accountName && (
                                <Badge variant="outline" className="text-[10px]">
                                  {account.accountName}
                                </Badge>
                              )}
                              {account.isDefault && (
                                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground font-mono text-[10px] uppercase">
                              {account.tokenType}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Activity & Audit */}
              {detailTab === 'activity' && (
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    Chronological audit events involving this developer account, permission edits, or project modifications.
                  </div>
                  {(!user.auditLogs || user.auditLogs.length === 0) ? (
                    <div className="p-8 text-center border border-border rounded-xl bg-card text-muted-foreground text-xs">
                      No recorded audit events for this user yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card text-xs">
                      {user.auditLogs.map((log) => (
                        <div key={log.id} className="p-3 space-y-1.5 hover:bg-muted/15 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-foreground text-xs">{log.action}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {new Date(log.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span className="font-mono uppercase bg-muted/50 px-1 py-0.5 rounded text-[10px]">
                              {log.entityType}
                            </span>
                            <span className="font-mono truncate">{log.entityId}</span>
                          </div>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded text-muted-foreground overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
