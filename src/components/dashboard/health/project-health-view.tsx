'use client'

import React from 'react'
import {
  Activity,
  RefreshCw,
  GitPullRequest,
  CircleDot,
  GitCommit,
  Users,
  CheckCircle2,
  AlertTriangle,
  Play,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { HealthScoreGauge } from './health-score-gauge'
import { HealthFactorCard } from './health-factor-card'
import { WorkflowRunsList } from './workflow-runs-list'

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'No commits yet'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Unknown'
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return 'Just now'
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays === 0) {
    if (diffHours === 0) {
      if (diffMins < 2) return 'Just now'
      return `${diffMins}m ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

interface ProjectHealthViewProps {
  slug: string
}

export function ProjectHealthView({ slug }: ProjectHealthViewProps) {
  const healthQuery = trpc.health.get.useQuery({ slug })
  const syncMutation = trpc.health.sync.useMutation({
    onSuccess: () => healthQuery.refetch(),
  })

  const health = healthQuery.data

  if (healthQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border/60 p-8 text-xs text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" />
        Syncing repository health metrics from GitHub...
      </div>
    )
  }

  if (!health) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-xs text-muted-foreground">No health data available.</p>
        <Button
          size="sm"
          className="mt-3 text-xs gap-1.5"
          onClick={() => syncMutation.mutate({ slug })}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`h-3 w-3 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Sync from GitHub
        </Button>
      </div>
    )
  }

  const { repository, workflows, factors, score, status, lastSyncAt } = health
  const lastSyncStr = new Date(lastSyncAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="space-y-6">
      {/* Top Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Repository Health & CI/CD Status
            </h3>
            <p className="text-xs text-muted-foreground">
              Live GitHub repository metrics, workflow pipeline statuses, and actionable health factors.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground font-mono">
            Synced: {lastSyncStr}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => syncMutation.mutate({ slug })}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-3 w-3 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync GitHub'}
          </Button>
        </div>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Health Score Gauge Card */}
        <Card className="border-border">
          <CardHeader className="py-3 px-4 border-b border-border/70">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overall Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <HealthScoreGauge score={score} status={status} size="md" />
          </CardContent>
        </Card>

        {/* Pull Requests Card */}
        <Card className="border-border">
          <CardHeader className="py-3 px-4 border-b border-border/70 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pull Requests
            </CardTitle>
            <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {repository.openPRs}
              </span>
              <span className="text-xs text-muted-foreground">open</span>
            </div>
            <div className="flex items-center gap-2">
              {repository.stalePRs > 0 ? (
                <Badge variant="destructive" className="text-[10px] gap-1 font-mono">
                  <AlertTriangle className="h-3 w-3" />
                  {repository.stalePRs} stale (&gt;7d)
                </Badge>
              ) : (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  All PRs fresh
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Open Issues Card */}
        <Card className="border-border">
          <CardHeader className="py-3 px-4 border-b border-border/70 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Issues
            </CardTitle>
            <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {repository.openIssues}
              </span>
              <span className="text-xs text-muted-foreground">open issues</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {repository.openIssues <= 10
                ? 'Healthy issue backlog queue'
                : 'Backlog accumulation needs triage'}
            </p>
          </CardContent>
        </Card>

        {/* Commits & Activity Card */}
        <Card className="border-border">
          <CardHeader className="py-3 px-4 border-b border-border/70 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Commit Activity
            </CardTitle>
            <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {repository.commitFrequency}
              </span>
              <span className="text-xs text-muted-foreground">in 30 days</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground">
                Latest:{' '}
                <span
                  className="font-medium text-foreground"
                  title={repository.lastCommitDate ? new Date(repository.lastCommitDate).toLocaleString() : undefined}
                >
                  {formatRelativeTime(repository.lastCommitDate)}
                </span>
              </p>
              {repository.lastCommitAuthor && (
                <p
                  className="text-[11px] text-muted-foreground truncate"
                  title={repository.lastCommitMessage ? `${repository.lastCommitAuthor}: ${repository.lastCommitMessage}` : repository.lastCommitAuthor}
                >
                  by <span className="font-medium text-foreground">{repository.lastCommitAuthor}</span>
                  {repository.lastCommitMessage && (
                    <span className="text-muted-foreground"> · &ldquo;{repository.lastCommitMessage}&rdquo;</span>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Factors Breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Health Factors & Action Items ({factors.length})
        </h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {factors.map((factor, idx) => (
            <HealthFactorCard key={`${factor.name}-${idx}`} factor={factor} />
          ))}
        </div>
      </div>

      {/* CI/CD Workflow Runs & Top Contributors */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: CI/CD Pipeline Runs */}
        <div className="space-y-3 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent CI/CD Workflow Runs
            </h4>
            <span className="text-xs text-muted-foreground font-mono">{workflows.length} runs</span>
          </div>
          <WorkflowRunsList runs={workflows} />
        </div>

        {/* Right: Top Contributors */}
        <div className="space-y-3 lg:col-span-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Top Contributors
          </div>
          <div className="rounded-lg border border-border bg-card divide-y divide-border/60">
            {repository.contributors.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground italic">
                No contributor statistics available.
              </div>
            ) : (
              repository.contributors.map((contrib) => (
                <div key={contrib.login} className="flex items-center justify-between p-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={contrib.avatarUrl} alt={contrib.login} />
                      <AvatarFallback className="text-[10px]">
                        {contrib.login.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-mono text-xs font-medium text-foreground">
                      {contrib.login}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {contrib.contributions} commits
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
