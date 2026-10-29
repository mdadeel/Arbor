'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, ShieldAlert, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  BusFactorRisk,
  DirectoryOwnerShare,
  DirectoryOwnershipEntry,
  OwnershipReport,
} from '@/server/analysis/types'

function parseRisk(value: unknown): BusFactorRisk {
  if (value === 'high' || value === 'medium' || value === 'low' || value === 'unknown') {
    return value
  }
  return 'unknown'
}

export function parseOwnershipReport(raw: unknown): OwnershipReport | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (!Array.isArray(record.directories)) return null

  const directories: DirectoryOwnershipEntry[] = []
  for (const item of record.directories) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.directory !== 'string' || !row.directory) continue

    const owners: DirectoryOwnerShare[] = []
    if (Array.isArray(row.owners)) {
      for (const rawOwner of row.owners) {
        if (!rawOwner || typeof rawOwner !== 'object') continue
        const o = rawOwner as Record<string, unknown>
        if (typeof o.codeowner !== 'string' || !o.codeowner) continue
        owners.push({
          codeowner: o.codeowner,
          displayName: typeof o.displayName === 'string' ? o.displayName : o.codeowner,
          email: typeof o.email === 'string' ? o.email : '',
          commits: typeof o.commits === 'number' ? o.commits : 0,
          linesChanged: typeof o.linesChanged === 'number' ? o.linesChanged : 0,
          sharePercent: typeof o.sharePercent === 'number' ? o.sharePercent : 0,
          lastCommitAt: typeof o.lastCommitAt === 'string' ? o.lastCommitAt : null,
        })
      }
    }

    const suggestedOwners = Array.isArray(row.suggestedOwners)
      ? row.suggestedOwners.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : []

    directories.push({
      directory: row.directory,
      pattern: typeof row.pattern === 'string' ? row.pattern : `/${row.directory}/`,
      fileCount: typeof row.fileCount === 'number' ? row.fileCount : 0,
      commits: typeof row.commits === 'number' ? row.commits : 0,
      linesChanged: typeof row.linesChanged === 'number' ? row.linesChanged : 0,
      contributorCount: typeof row.contributorCount === 'number' ? row.contributorCount : 0,
      busFactor: typeof row.busFactor === 'number' ? row.busFactor : 0,
      risk: parseRisk(row.risk),
      owners,
      suggestedOwners,
    })
  }

  const defaultOwners = Array.isArray(record.defaultOwners)
    ? record.defaultOwners.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : []

  return {
    commitsAnalyzed: typeof record.commitsAnalyzed === 'number' ? record.commitsAnalyzed : 0,
    windowDays: typeof record.windowDays === 'number' ? record.windowDays : 180,
    totalContributors: typeof record.totalContributors === 'number' ? record.totalContributors : 0,
    overallBusFactor: typeof record.overallBusFactor === 'number' ? record.overallBusFactor : 0,
    overallRisk: parseRisk(record.overallRisk),
    existingCodeownersPath:
      typeof record.existingCodeownersPath === 'string' ? record.existingCodeownersPath : null,
    defaultOwners,
    directories,
    suggestedCodeowners:
      typeof record.suggestedCodeowners === 'string' ? record.suggestedCodeowners : '',
  }
}

function buildGitHubTreeHref(
  repoUrl: string | undefined,
  commitSha: string | null | undefined,
  directory: string
): string | null {
  if (!repoUrl || !repoUrl.startsWith('https://github.com/')) return null
  if (directory === '(root)' || !directory) return null
  const cleanBase = repoUrl.replace(/\.git$/, '').replace(/\/+$/, '')
  const ref = commitSha && /^[a-f0-9]{7,64}$/i.test(commitSha) ? commitSha : 'HEAD'
  return `${cleanBase}/tree/${encodeURIComponent(ref)}/${encodeURIComponent(directory)}`
}

function riskBadgeStyle(risk: BusFactorRisk): { className: string; label: string } {
  switch (risk) {
    case 'high':
      return {
        className: 'border-red-500/40 bg-red-500/10 text-red-300',
        label: 'Single owner',
      }
    case 'medium':
      return {
        className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
        label: 'Moderate',
      }
    case 'low':
      return {
        className: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
        label: 'Distributed',
      }
    default:
      return {
        className: 'border-border/70 bg-muted/40 text-muted-foreground',
        label: 'No recent commits',
      }
  }
}

export interface OwnershipMapProps {
  rawOwnership: unknown
  repoUrl?: string
  commitSha?: string | null
}

export function OwnershipMapCard({ rawOwnership, repoUrl, commitSha }: OwnershipMapProps) {
  const [copied, setCopied] = useState(false)
  const report = parseOwnershipReport(rawOwnership)
  if (!report) return null

  const windowLabel =
    report.windowDays > 0 ? `last ${report.windowDays}d` : 'recent commit history'
  const overallBadge = riskBadgeStyle(report.overallRisk)

  const handleCopyCodeowners = async () => {
    if (!report.suggestedCodeowners || typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }
    try {
      await navigator.clipboard.writeText(report.suggestedCodeowners)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may be blocked in restricted browser contexts
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="py-3 px-4 border-b border-border/80 flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>Ownership Map &amp; Directory Bus Factor</span>
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Minimum contributors accounting for &ge;50% of commit activity per top-level directory (
            {report.commitsAnalyzed} non-merge commits · {report.totalContributors} human{' '}
            {report.totalContributors === 1 ? 'contributor' : 'contributors'} in {windowLabel}).
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn('font-mono text-[10px]', overallBadge.className)}>
            {report.overallBusFactor > 0
              ? `Repo bus factor: ${report.overallBusFactor}`
              : 'Bus factor: n/a'}
          </Badge>
          {report.existingCodeownersPath ? (
            <Badge
              variant="outline"
              className="border-emerald-500/35 bg-emerald-500/10 font-mono text-[10px] text-emerald-300"
            >
              Found {report.existingCodeownersPath}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-500/35 bg-amber-500/10 font-mono text-[10px] text-amber-300"
            >
              Missing CODEOWNERS
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-border/70">
        {report.directories.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No top-level directories were discovered in this repository snapshot.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-xs"
              aria-label="Top-level directory bus factor and ownership"
            >
              <thead>
                <tr className="border-b border-border/70 bg-muted/25 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-3">Directory</th>
                  <th className="py-2.5 px-3">Bus Factor</th>
                  <th className="py-2.5 px-3">Contributor Share</th>
                  <th className="py-2.5 px-3">Suggested Owners</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {report.directories.map((entry) => {
                  const treeHref = buildGitHubTreeHref(repoUrl, commitSha, entry.directory)
                  const riskStyle = riskBadgeStyle(entry.risk)

                  return (
                    <tr key={entry.directory} className="hover:bg-muted/25 transition-colors">
                      <td className="py-2.5 pl-4 pr-3 font-mono text-[11px] text-foreground">
                        <div className="flex items-center gap-1.5">
                          {treeHref ? (
                            <a
                              href={treeHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold hover:text-primary hover:underline"
                            >
                              <span>{entry.pattern}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                            </a>
                          ) : (
                            <span className="font-semibold">{entry.pattern}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            ({entry.fileCount} {entry.fileCount === 1 ? 'file' : 'files'})
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-foreground">
                            {entry.risk === 'high' && (
                              <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                            )}
                            {entry.busFactor > 0 ? entry.busFactor : '—'}
                          </span>
                          <span
                            className={cn(
                              'rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase',
                              riskStyle.className
                            )}
                          >
                            {riskStyle.label}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-[11px] text-foreground">
                        {entry.owners.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {entry.owners.slice(0, 3).map((owner) => (
                              <span
                                key={owner.codeowner}
                                className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/35 px-1.5 py-0.5 font-mono text-[10px]"
                                title={`${owner.displayName} · ${owner.commits} commits · ±${owner.linesChanged} lines`}
                              >
                                <span className="text-foreground">{owner.codeowner}</span>
                                <span className="text-muted-foreground">{owner.sharePercent}%</span>
                              </span>
                            ))}
                            {entry.contributorCount > 3 && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                +{entry.contributorCount - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {entry.suggestedOwners.length > 0 ? (
                          <span className="text-foreground">
                            {entry.suggestedOwners.join(' ')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Inherits *</span>
                        )}
                      </td>

                      <td className="py-2.5 pl-3 pr-4 text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {entry.commits > 0 ? (
                          <>
                            <span className="font-semibold text-foreground">{entry.commits}</span>{' '}
                            {entry.commits === 1 ? 'commit' : 'commits'} · &plusmn;
                            {entry.linesChanged.toLocaleString()}
                          </>
                        ) : (
                          '0 commits'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {report.suggestedCodeowners && (
          <div className="p-4 space-y-2.5 bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-foreground">
                  Suggested <code className="font-mono text-[11px]">.github/CODEOWNERS</code>
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Generated deterministically from human commit history (automated bots excluded).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyCodeowners}
                className="h-7 gap-1.5 text-xs cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy CODEOWNERS</span>
                  </>
                )}
              </Button>
            </div>
            <pre
              aria-label="Suggested CODEOWNERS file"
              className="overflow-x-auto rounded-lg border border-border/80 bg-background/80 p-3 font-mono text-[11px] leading-relaxed text-foreground"
            >
              <code>{report.suggestedCodeowners}</code>
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
