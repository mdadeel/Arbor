'use client'

import React, { useState, useMemo } from 'react'
import {
  GitCommit,
  GitBranch,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Filter,
  Sparkles,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ContributorSummaryBar } from './contributor-summary-bar'
import type { CommitItem, CommitCategory } from '@/server/services/commits'

const CATEGORY_COLORS: Record<CommitCategory, string> = {
  feat: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20',
  fix: 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20',
  refactor: 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20',
  perf: 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20',
  docs: 'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-500/20',
  test: 'bg-yellow-500/10 text-yellow-500 dark:text-yellow-400 border-yellow-500/20',
  chore: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
  style: 'bg-pink-500/10 text-pink-500 dark:text-pink-400 border-pink-500/20',
  ci: 'bg-orange-500/10 text-orange-500 dark:text-orange-400 border-orange-500/20',
  build: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20',
  other: 'bg-muted text-muted-foreground border-border',
}

const DOT_COLORS: Record<CommitCategory, string> = {
  feat: 'bg-emerald-500 ring-emerald-500/30',
  fix: 'bg-amber-500 ring-amber-500/30',
  refactor: 'bg-blue-500 ring-blue-500/30',
  perf: 'bg-purple-500 ring-purple-500/30',
  docs: 'bg-cyan-500 ring-cyan-500/30',
  test: 'bg-yellow-500 ring-yellow-500/30',
  chore: 'bg-slate-400 ring-slate-400/30',
  style: 'bg-pink-500 ring-pink-500/30',
  ci: 'bg-orange-500 ring-orange-500/30',
  build: 'bg-indigo-500 ring-indigo-500/30',
  other: 'bg-muted-foreground ring-muted-foreground/30',
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'recently'
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return 'just now'
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays === 0) {
    if (diffHours === 0) {
      if (diffMins < 2) return 'just now'
      return `${diffMins}m ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Earlier'
  const now = new Date()

  // Reset hours to compare calendar days
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const commitDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - commitDay.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This Week'
  if (diffDays < 14) return 'Last Week'
  if (diffDays < 30) return 'Earlier This Month'
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

interface CommitTimelineProps {
  slug: string
}

export function CommitTimeline({ slug }: CommitTimelineProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set())

  const commitsQuery = trpc.project.commits.useQuery({ slug })

  const toggleExpand = (sha: string) => {
    setExpandedCommits((prev) => {
      const next = new Set(prev)
      if (next.has(sha)) next.delete(sha)
      else next.add(sha)
      return next
    })
  }

  // Filtered commits
  const filteredCommits = useMemo(() => {
    if (!commitsQuery.data?.commits) return []
    return commitsQuery.data.commits.filter((c) => {
      // Author filter
      if (selectedAuthor) {
        const authorMatch =
          c.author.login === selectedAuthor || c.author.name === selectedAuthor
        if (!authorMatch) return false
      }

      // Category filter
      if (selectedCategory !== 'all' && c.category !== selectedCategory) {
        return false
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const textMatch =
          c.message.toLowerCase().includes(query) ||
          c.shortSha.toLowerCase().includes(query) ||
          c.author.name.toLowerCase().includes(query) ||
          (c.author.login && c.author.login.toLowerCase().includes(query)) ||
          (c.body && c.body.toLowerCase().includes(query))
        if (!textMatch) return false
      }

      return true
    })
  }, [commitsQuery.data?.commits, selectedAuthor, selectedCategory, searchQuery])

  // Group commits by date bucket
  const groupedCommits = useMemo(() => {
    const groups: { label: string; commits: CommitItem[] }[] = []
    let currentGroup: { label: string; commits: CommitItem[] } | null = null

    for (const c of filteredCommits) {
      const label = getDateGroupLabel(c.date)
      if (!currentGroup || currentGroup.label !== label) {
        currentGroup = { label, commits: [] }
        groups.push(currentGroup)
      }
      currentGroup.commits.push(c)
    }
    return groups
  }, [filteredCommits])

  if (commitsQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border/60 p-8 text-xs text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" />
        Fetching commits and activity timeline from GitHub...
      </div>
    )
  }

  if (commitsQuery.isError) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-xs text-red-400 space-y-2">
        <p className="font-semibold">Failed to load commits history</p>
        <p className="font-mono">{commitsQuery.error.message}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => commitsQuery.refetch()}
          className="mt-2 text-xs"
        >
          Retry
        </Button>
      </div>
    )
  }

  const { contributors = [], summary = '', defaultBranch = 'main' } = commitsQuery.data || {}

  return (
    <div className="space-y-6">
      {/* Executive Summary Card */}
      <Card className="border-border bg-gradient-to-r from-card to-muted/20">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 font-mono text-[11px] py-0">
                <GitBranch className="h-3 w-3" />
                {defaultBranch}
              </Badge>
              <Badge variant="secondary" className="gap-1 text-[11px] py-0">
                <GitCommit className="h-3 w-3" />
                {commitsQuery.data?.commits.length || 0} commits
              </Badge>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed">
              {summary}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => commitsQuery.refetch()}
            disabled={commitsQuery.isFetching}
            className="text-xs gap-1.5 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${commitsQuery.isFetching ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </Button>
        </CardContent>
      </Card>

      {/* Contributor Impact Bar ("Who Did What") */}
      <ContributorSummaryBar
        contributors={contributors}
        selectedAuthor={selectedAuthor}
        onSelectAuthor={setSelectedAuthor}
      />

      {/* Timeline Controls & Filter Bar */}
      <Card className="border-border">
        <CardContent className="p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search commit messages, authors, SHAs..."
              className="h-8 pl-8 text-xs bg-muted/30 border-border/80"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 text-xs w-[140px]">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="feat">Features (feat)</SelectItem>
                <SelectItem value="fix">Fixes (fix)</SelectItem>
                <SelectItem value="refactor">Refactor</SelectItem>
                <SelectItem value="perf">Performance</SelectItem>
                <SelectItem value="docs">Docs</SelectItem>
                <SelectItem value="test">Tests</SelectItem>
                <SelectItem value="chore">Chores</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || selectedCategory !== 'all' || selectedAuthor) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('all')
                  setSelectedAuthor(null)
                }}
                className="h-8 text-xs px-2.5 text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timeline Stream */}
      {filteredCommits.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <GitCommit className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="font-medium text-foreground text-sm">No commits match your filters.</p>
            <p>Try resetting the search query or author filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedCommits.map((group) => (
            <div key={group.label} className="space-y-3">
              {/* Date Group Header */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{group.label}</span>
                </div>
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[11px] text-muted-foreground font-mono">
                  {group.commits.length} commit{group.commits.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Vertical Timeline Track */}
              <div className="relative pl-6 space-y-3 border-l border-border/80 ml-2.5">
                {group.commits.map((commit) => {
                  const categoryBadge = CATEGORY_COLORS[commit.category] || CATEGORY_COLORS.other
                  const dotColor = DOT_COLORS[commit.category] || DOT_COLORS.other
                  const isExpanded = expandedCommits.has(commit.sha)
                  const hasBody = Boolean(commit.body)

                  return (
                    <div key={commit.sha} className="relative group">
                      {/* Timeline Dot */}
                      <span
                        className={`absolute -left-[31px] top-3.5 h-2.5 w-2.5 rounded-full ring-4 ${dotColor} transition-transform group-hover:scale-125`}
                      />

                      <Card className="border-border hover:border-border/90 hover:bg-muted/20 transition-colors">
                        <CardContent className="p-3 sm:p-3.5 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            {/* Message & Category */}
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium py-0 px-1.5 uppercase tracking-wider shrink-0 mt-0.5 ${categoryBadge}`}
                              >
                                {commit.category}
                              </Badge>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-semibold text-foreground break-words">
                                    {commit.message}
                                  </p>
                                  {hasBody && (
                                    <button
                                      onClick={() => toggleExpand(commit.sha)}
                                      className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                                      aria-label="Toggle commit details"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3" />
                                      )}
                                    </button>
                                  )}
                                </div>

                                {hasBody && isExpanded && (
                                  <pre className="mt-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap bg-muted/40 p-2 rounded border border-border/60 max-h-40 overflow-y-auto">
                                    {commit.body}
                                  </pre>
                                )}
                              </div>
                            </div>

                            {/* Git Link & SHA */}
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={commit.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              >
                                <span>{commit.shortSha}</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          </div>

                          {/* Footer: Author info & Relative timestamp */}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-4 w-4 rounded-full shrink-0">
                                <AvatarImage src={commit.author.avatarUrl} alt={commit.author.name} />
                                <AvatarFallback className="text-[8px]">
                                  {commit.author.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-foreground truncate">
                                {commit.author.name}
                              </span>
                              {commit.author.login && (
                                <span className="font-mono text-muted-foreground/80 hidden sm:inline">
                                  @{commit.author.login}
                                </span>
                              )}
                            </div>

                            <span className="font-mono shrink-0">
                              {formatRelativeTime(commit.date)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
