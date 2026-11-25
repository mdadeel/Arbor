'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from './status-badge'
import { ScoreBadge } from './score-badge'
import { Check, Eye } from 'lucide-react'

export type HistoryRun = {
  id: string
  status: string
  createdAt: string | Date
  completedAt?: string | Date | null
  branch: string
  commitSha: string | null
  overallScore: number | null
  durationMs: number | null
  errorMessage: string | null
}

interface AnalysisHistoryProps {
  analyses: HistoryRun[]
  totalCount?: number
  selectedAnalysisId?: string | null
  onSelectAnalysis?: (analysisId: string) => void
}

export function AnalysisHistory({
  analyses,
  totalCount,
  selectedAnalysisId,
  onSelectAnalysis,
}: AnalysisHistoryProps) {
  const displayTotal = totalCount ?? analyses.length
  return (
    <Card className="border-border">
      <CardHeader className="border-b border-border/80 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Recent analysis runs</CardTitle>
            <CardDescription className="text-xs">
              Showing {analyses.length} of {displayTotal} total runs.
              {onSelectAnalysis ? ' You can select completed snapshots to view their audit details.' : ''}
            </CardDescription>
          </div>
          {analyses.length < displayTotal && (
            <span className="font-mono text-[11px] text-muted-foreground">
              History capped at latest {analyses.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {analyses.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">
            No analysis runs recorded for this project yet.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Recent scans, their status, score, branch, duration, and actions
            </caption>
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                {['Requested', 'Status', 'Score', 'Branch / commit', 'Duration', 'Details', 'Action'].map(
                  (label) => (
                    <th
                      scope="col"
                      key={label}
                      className="whitespace-nowrap px-4 py-2.5 font-medium"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {analyses.map((run) => {
                const isSelected = selectedAnalysisId === run.id
                const isCompleted = run.status === 'completed'
                return (
                  <tr
                    key={run.id}
                    className={isSelected ? 'bg-primary/5 transition-colors' : 'transition-colors hover:bg-muted/30'}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-medium text-foreground">
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} showSpinner={run.status !== 'queued'} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={run.overallScore} size="sm" />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className="font-semibold text-foreground">{run.branch}</span>
                      <span className="block text-muted-foreground">
                        {run.commitSha ? run.commitSha.slice(0, 7) : 'Not started'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {run.durationMs != null ? `${Math.round(run.durationMs / 1000)}s` : '—'}
                    </td>
                    <td className="min-w-44 max-w-xs break-words px-4 py-3 text-muted-foreground">
                      {run.errorMessage ??
                        (run.status === 'queued'
                          ? 'Waiting in queue'
                          : run.status === 'cloning'
                          ? 'Preparing repository'
                          : run.status === 'analyzing'
                          ? 'Inspecting codebase'
                          : '—')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {isSelected ? (
                        <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary text-[10px]">
                          <Check className="size-3" /> Viewing
                        </Badge>
                      ) : isCompleted && onSelectAnalysis ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectAnalysis(run.id)}
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="size-3" /> View
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
