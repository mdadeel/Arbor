'use client'

import { useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  GitCompare,
  Minus,
  PlusCircle,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  buildGitHubCompareHref,
  type ScanDiffFindingItem,
  type ScanDiffSummary,
} from '@/lib/scan-diff'

export interface BaselineOption {
  id: string
  createdAt: Date | string
  commitSha: string | null
  overallScore: number | null
}

function formatSigned(value: number | null | undefined, suffix = ''): string {
  if (value == null) return '—'
  if (value > 0) return `+${value}${suffix}`
  return `${value}${suffix}`
}

function formatShortDate(isoOrDate: Date | string): string {
  const parsed = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(parsed.getTime())) return String(isoOrDate)
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildGitHubFindingHref(
  repoUrl: string | undefined,
  commitSha: string | null | undefined,
  file: string | null,
  line: number | null
): string | null {
  if (!repoUrl || !repoUrl.startsWith('https://github.com/') || !file) return null
  const cleanBase = repoUrl.replace(/\.git$/, '').replace(/\/+$/, '')
  const ref = commitSha && /^[a-f0-9]{7,64}$/i.test(commitSha) ? commitSha : 'HEAD'
  const encodedPath = file
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  const lineHash = line && line > 0 ? `#L${line}` : ''
  return `${cleanBase}/blob/${encodeURIComponent(ref)}/${encodedPath}${lineHash}`
}

function scoreDeltaTone(delta: number | null): string {
  if (delta == null || delta === 0) return 'text-muted-foreground'
  return delta > 0 ? 'text-emerald-400' : 'text-red-400'
}

function metricDeltaTone(key: string, delta: number): string {
  if (delta === 0) return 'text-muted-foreground'
  // Lower circular dependency loops and high-risk hotspots are improvements.
  if (key === 'circularDeps' || key === 'highRiskHotspots') {
    return delta < 0 ? 'text-emerald-400' : 'text-amber-300'
  }
  return 'text-foreground'
}

type DiffFilter = 'all' | 'introduced' | 'resolved'

export interface ScanDiffCardProps {
  scanDiff: ScanDiffSummary | null | undefined
  repoUrl?: string
  baselineOptions?: BaselineOption[]
  selectedBaselineId?: string
  onSelectBaseline?: (analysisId: string) => void
  onOpenInsights?: () => void
  compact?: boolean
}

export function ScanDiffCard({
  scanDiff,
  repoUrl,
  baselineOptions,
  selectedBaselineId,
  onSelectBaseline,
  onOpenInsights,
  compact = false,
}: ScanDiffCardProps) {
  const [filter, setFilter] = useState<DiffFilter>('all')
  const [expanded, setExpanded] = useState(false)

  if (!scanDiff) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground">No previous comparable scan yet</p>
          <p>
            Run a second scan on the same branch and policy version to see score deltas, newly
            introduced findings, and resolved issues.
          </p>
        </CardContent>
      </Card>
    )
  }

  const overallScoreObj = scanDiff.scores.find((s) => s.key === 'overall')
  const pillarDeltas = scanDiff.scores.filter((s) => s.key !== 'overall')
  const compareHref = buildGitHubCompareHref(
    repoUrl,
    scanDiff.previous.commitSha,
    scanDiff.latest.commitSha
  )

  const taggedItems: { kind: 'introduced' | 'resolved'; item: ScanDiffFindingItem }[] = []
  if (filter === 'all' || filter === 'introduced') {
    for (const item of scanDiff.introducedFindings) {
      taggedItems.push({ kind: 'introduced', item })
    }
  }
  if (filter === 'all' || filter === 'resolved') {
    for (const item of scanDiff.resolvedFindings) {
      taggedItems.push({ kind: 'resolved', item })
    }
  }

  const defaultRowLimit = compact ? 5 : 10
  const visibleItems = expanded ? taggedItems : taggedItems.slice(0, defaultRowLimit)
  const hasMoreRows = taggedItems.length > defaultRowLimit

  const prevLabel = scanDiff.previous.commitSha
    ? scanDiff.previous.commitSha.slice(0, 7)
    : formatShortDate(scanDiff.previous.createdAt)
  const latestLabel = scanDiff.latest.commitSha
    ? scanDiff.latest.commitSha.slice(0, 7)
    : formatShortDate(scanDiff.latest.createdAt)

  return (
    <Card className="border-border" aria-label="Scan diff since previous scan">
      <CardHeader className="py-3 px-4 border-b border-border/80 flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GitCompare className="h-3.5 w-3.5 text-primary" />
            <span>What Changed Since Previous Scan</span>
          </CardTitle>
          <CardDescription className="text-xs flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-foreground">{prevLabel}</span>
            <span className="text-muted-foreground">
              ({formatShortDate(scanDiff.previous.createdAt)})
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-foreground">{latestLabel}</span>
            <span className="text-muted-foreground">
              ({formatShortDate(scanDiff.latest.createdAt)})
            </span>
            <span>
              on branch <code className="font-mono text-foreground">{scanDiff.latest.branch}</code>
            </span>
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scanDiff.sameCommit && scanDiff.latest.commitSha && (
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
              Same commit ({scanDiff.latest.commitSha.slice(0, 7)})
            </Badge>
          )}

          {compareHref && (
            <a
              href={compareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background/60 px-2.5 text-[11px] font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <span>Compare commits</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          )}

          {baselineOptions && baselineOptions.length > 1 && onSelectBaseline && (
            <select
              aria-label="Compare latest scan against"
              value={selectedBaselineId ?? scanDiff.previous.id}
              onChange={(e) => onSelectBaseline(e.target.value)}
              className="h-7 rounded-md border border-border bg-background px-2 font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {baselineOptions.map((opt, idx) => (
                <option key={opt.id} value={opt.id}>
                  {idx === 0 ? 'Previous: ' : 'Baseline: '}
                  {opt.commitSha ? opt.commitSha.slice(0, 7) : 'scan'} ·{' '}
                  {formatShortDate(opt.createdAt)} (score {opt.overallScore ?? '—'})
                </option>
              ))}
            </select>
          )}

          {onOpenInsights && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenInsights}
              className="h-7 text-xs gap-1 cursor-pointer"
            >
              <span>Trends</span>
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-border/70">
        {/* Top KPI Delta Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/70">
          <div className="p-3.5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Overall Score
            </p>
            <div className="flex items-baseline gap-2 font-mono">
              <span
                className={cn(
                  'text-lg font-bold',
                  scoreDeltaTone(overallScoreObj?.delta ?? null)
                )}
              >
                {formatSigned(overallScoreObj?.delta, ' pts')}
              </span>
              <span className="text-xs text-muted-foreground">
                {overallScoreObj?.previous ?? '—'} &rarr; {overallScoreObj?.latest ?? '—'}
              </span>
            </div>
          </div>

          <div className="p-3.5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Resolved Findings
            </p>
            <div className="flex items-baseline gap-2 font-mono">
              <span
                className={cn(
                  'text-lg font-bold',
                  scanDiff.counts.resolvedCount > 0
                    ? 'text-emerald-400'
                    : 'text-muted-foreground'
                )}
              >
                {scanDiff.counts.resolvedCount}
              </span>
              <span className="text-xs text-muted-foreground">fixed since baseline</span>
            </div>
          </div>

          <div className="p-3.5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              New Findings
            </p>
            <div className="flex items-baseline gap-2 font-mono">
              <span
                className={cn(
                  'text-lg font-bold',
                  scanDiff.counts.introducedCount > 0 ? 'text-amber-300' : 'text-emerald-400'
                )}
              >
                {scanDiff.counts.introducedCount > 0
                  ? `+${scanDiff.counts.introducedCount}`
                  : '0'}
              </span>
              <span className="text-xs text-muted-foreground">
                {scanDiff.counts.criticalDelta !== 0
                  ? `critical ${formatSigned(scanDiff.counts.criticalDelta)}`
                  : 'newly introduced'}
              </span>
            </div>
          </div>

          <div className="p-3.5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Persisting
            </p>
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-lg font-bold text-foreground">
                {scanDiff.counts.persistingCount}
              </span>
              <span className="text-xs text-muted-foreground">
                net {formatSigned(scanDiff.counts.netDelta)} ({scanDiff.counts.previousTotal} &rarr;{' '}
                {scanDiff.counts.latestTotal})
              </span>
            </div>
          </div>
        </div>

        {/* Pillar & Codebase Metric Deltas */}
        <div className="px-4 py-2.5 bg-muted/15 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            Pillar deltas:
          </span>
          {pillarDeltas.map((pillar) => (
            <span
              key={pillar.key}
              className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/70 px-2 py-0.5 font-mono text-[10px]"
              title={`${pillar.label}: ${pillar.previous ?? '—'} → ${pillar.latest ?? '—'}`}
            >
              <span className="font-sans text-muted-foreground">{pillar.label}</span>
              <span className={cn('font-semibold', scoreDeltaTone(pillar.delta))}>
                {formatSigned(pillar.delta)}
              </span>
            </span>
          ))}

          {scanDiff.metrics.map((metric) => (
            <span
              key={metric.key}
              className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/35 px-2 py-0.5 font-mono text-[10px]"
              title={`${metric.label}: ${metric.previous.toLocaleString()} → ${metric.latest.toLocaleString()}`}
            >
              <span className="font-sans text-muted-foreground">{metric.label}</span>
              <span className={cn('font-semibold', metricDeltaTone(metric.key, metric.delta))}>
                {formatSigned(metric.delta)}
              </span>
            </span>
          ))}
        </div>

        {/* Introduced & Resolved Findings List */}
        <div>
          <div className="px-4 py-2.5 border-b border-border/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" role="group" aria-label="Filter scan diff findings">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                  filter === 'all'
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border/70 text-muted-foreground hover:text-foreground'
                )}
              >
                All changes ({scanDiff.counts.introducedCount + scanDiff.counts.resolvedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('introduced')}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                  filter === 'introduced'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-border/70 text-muted-foreground hover:text-foreground'
                )}
              >
                New ({scanDiff.counts.introducedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('resolved')}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                  filter === 'resolved'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-border/70 text-muted-foreground hover:text-foreground'
                )}
              >
                Resolved ({scanDiff.counts.resolvedCount})
              </button>
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Minus className="h-3.5 w-3.5" />
              <span>
                {filter === 'introduced'
                  ? 'No new findings were introduced in the latest scan.'
                  : filter === 'resolved'
                    ? 'No prior findings were resolved in the latest scan.'
                    : 'No visible findings were introduced or resolved between these two scans.'}
              </span>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {visibleItems.map(({ kind, item }) => {
                const targetSha =
                  kind === 'introduced'
                    ? scanDiff.latest.commitSha
                    : scanDiff.previous.commitSha
                const fileHref = buildGitHubFindingHref(repoUrl, targetSha, item.file, item.line)
                const locationLabel = item.file
                  ? `${item.file}${item.line ? `:${item.line}` : ''}`
                  : null

                return (
                  <div
                    key={`${kind}-${item.key}`}
                    className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/25 transition-colors text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {kind === 'introduced' ? (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-amber-300">
                            <PlusCircle className="h-3 w-3" />
                            New
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Resolved
                          </span>
                        )}

                        <span
                          className={cn(
                            'rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase',
                            item.severity === 'critical'
                              ? 'border-red-500/40 bg-red-500/10 text-red-300'
                              : item.severity === 'warning'
                                ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
                                : 'border-sky-500/35 bg-sky-500/10 text-sky-300'
                          )}
                        >
                          {item.severity}
                        </span>

                        <span className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                          {item.category}
                        </span>

                        <span className="font-semibold text-foreground">{item.title}</span>
                      </div>

                      {item.detail && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.detail}</p>
                      )}

                      {locationLabel && (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {fileHref ? (
                            <a
                              href={fileHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                            >
                              <span>{locationLabel}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <span>{locationLabel}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {hasMoreRows && (
                <div className="px-4 py-2.5 text-center bg-muted/10">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded((prev) => !prev)}
                    className="h-7 text-xs cursor-pointer"
                  >
                    {expanded
                      ? 'Show fewer changes'
                      : `Show all ${taggedItems.length} finding changes`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export interface OverviewScanDiffProps {
  slug: string
  repoUrl?: string
  onOpenInsights?: () => void
}

export function OverviewScanDiff({ slug, repoUrl, onOpenInsights }: OverviewScanDiffProps) {
  const trend = trpc.insights.trends.useQuery({ slug })
  if (trend.isLoading || trend.error || !trend.data?.scanDiff) return null

  return (
    <ScanDiffCard
      scanDiff={trend.data.scanDiff}
      repoUrl={repoUrl}
      onOpenInsights={onOpenInsights}
      compact
    />
  )
}
