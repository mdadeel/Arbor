import { ExternalLink, Flame } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { HotspotEntry, HotspotReport, HotspotRisk } from '@/server/analysis/types'

export function parseHotspotReport(raw: unknown): HotspotReport | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (!Array.isArray(record.entries)) return null

  const entries: HotspotEntry[] = []
  for (const item of record.entries) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.file !== 'string' || !row.file) continue

    const risk: HotspotRisk =
      row.risk === 'high' || row.risk === 'medium' || row.risk === 'low'
        ? row.risk
        : 'low'

    entries.push({
      rank: typeof row.rank === 'number' ? row.rank : entries.length + 1,
      file: row.file,
      hotspotScore: typeof row.hotspotScore === 'number' ? row.hotspotScore : 0,
      risk,
      commits: typeof row.commits === 'number' ? row.commits : 0,
      linesChanged: typeof row.linesChanged === 'number' ? row.linesChanged : 0,
      distinctAuthors: typeof row.distinctAuthors === 'number' ? row.distinctAuthors : 0,
      lastModifiedAt: typeof row.lastModifiedAt === 'string' ? row.lastModifiedAt : null,
      cyclomaticComplexity:
        typeof row.cyclomaticComplexity === 'number' ? row.cyclomaticComplexity : 1,
      functionCount: typeof row.functionCount === 'number' ? row.functionCount : 0,
      loc: typeof row.loc === 'number' ? row.loc : 0,
    })
  }

  return {
    commitsAnalyzed: typeof record.commitsAnalyzed === 'number' ? record.commitsAnalyzed : 0,
    windowDays: typeof record.windowDays === 'number' ? record.windowDays : 180,
    filesWithChurn: typeof record.filesWithChurn === 'number' ? record.filesWithChurn : 0,
    highRiskCount: typeof record.highRiskCount === 'number' ? record.highRiskCount : 0,
    entries,
  }
}

function buildGitHubFileHref(
  repoUrl: string | undefined,
  commitSha: string | null | undefined,
  filePath: string
): string | null {
  if (!repoUrl || !repoUrl.startsWith('https://github.com/')) return null
  const cleanBase = repoUrl.replace(/\.git$/, '').replace(/\/+$/, '')
  const ref = commitSha && /^[a-f0-9]{7,64}$/i.test(commitSha) ? commitSha : 'HEAD'
  const encodedPath = filePath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  return `${cleanBase}/blob/${encodeURIComponent(ref)}/${encodedPath}`
}

export interface HotspotTableProps {
  rawHotspots: unknown
  repoUrl?: string
  commitSha?: string | null
}

export function HotspotTable({ rawHotspots, repoUrl, commitSha }: HotspotTableProps) {
  const report = parseHotspotReport(rawHotspots)
  if (!report) return null

  const windowLabel =
    report.windowDays > 0 ? `last ${report.windowDays}d` : 'recent commit history'

  return (
    <Card className="border-border">
      <CardHeader className="py-3 px-4 border-b border-border/80 flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-primary" />
            <span>Code Hotspots (Git Churn × AST Complexity)</span>
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Source files ranked by commit churn ({report.commitsAnalyzed} non-merge commits in{' '}
            {windowLabel}) crossed with per-file Babel AST cyclomatic complexity.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-mono text-[10px]">
            {report.filesWithChurn} active files
          </Badge>
          {report.highRiskCount > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 font-mono text-[10px] text-amber-300"
            >
              {report.highRiskCount} high-friction
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {report.entries.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No multi-commit source churn was recorded for AST-analyzed files in this snapshot.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Ranked code hotspots">
              <thead>
                <tr className="border-b border-border/70 bg-muted/25 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-2 w-10">#</th>
                  <th className="py-2.5 px-3">File</th>
                  <th className="py-2.5 px-3">Hotspot Score</th>
                  <th className="py-2.5 px-3">Git Churn</th>
                  <th className="py-2.5 px-3">AST Complexity</th>
                  <th className="py-2.5 px-3">Authors</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">Last Touched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {report.entries.map((entry) => {
                  const href = buildGitHubFileHref(repoUrl, commitSha, entry.file)
                  return (
                    <tr
                      key={entry.file}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2.5 pl-4 pr-2 font-mono text-[11px] font-semibold text-muted-foreground">
                        {entry.rank}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-foreground max-w-[320px] truncate">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                            title={entry.file}
                          >
                            <span className="truncate">{entry.file}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </a>
                        ) : (
                          <span title={entry.file}>{entry.file}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                entry.risk === 'high'
                                  ? 'bg-red-400'
                                  : entry.risk === 'medium'
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-400'
                              )}
                              style={{ width: `${Math.max(4, Math.min(100, entry.hotspotScore))}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-semibold text-foreground w-7">
                            {entry.hotspotScore}
                          </span>
                          <span
                            className={cn(
                              'rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase',
                              entry.risk === 'high'
                                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                                : entry.risk === 'medium'
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            )}
                          >
                            {entry.risk}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-foreground">
                        <span>{entry.commits} commits</span>
                        <span className="text-muted-foreground">
                          {' '}
                          · ±{entry.linesChanged.toLocaleString()} lines
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-foreground">
                        <span>CC {entry.cyclomaticComplexity}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          · {entry.functionCount} fn · {entry.loc} LOC
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {entry.distinctAuthors}
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-right font-mono text-[11px] text-muted-foreground">
                        {entry.lastModifiedAt ? entry.lastModifiedAt.slice(0, 10) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
