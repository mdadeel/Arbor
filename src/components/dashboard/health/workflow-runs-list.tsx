'use client'

import React from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowUpRight,
  GitBranch,
  PlayCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { WorkflowRun } from '@/server/services/health'

export function WorkflowRunsList({ runs }: { runs: WorkflowRun[] }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No CI/CD workflow runs detected on this repository.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border/60 overflow-hidden">
      {runs.map((run) => {
        const isSuccess = run.conclusion === 'success'
        const isFailure = run.conclusion === 'failure'
        const isRunning = run.status === 'in_progress' || run.status === 'queued'

        const durationSeconds = run.durationMs ? Math.round(run.durationMs / 1000) : null
        const dateStr = new Date(run.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <div
            key={run.id}
            className="flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/20"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="shrink-0">
                {isSuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : isFailure ? (
                  <XCircle className="h-4 w-4 text-red-400" />
                ) : isRunning ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground truncate">
                    {run.name}
                  </span>
                  <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 gap-1">
                    <GitBranch className="h-2.5 w-2.5" />
                    {run.branch}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  <span>{run.commitSha}</span>
                  <span>•</span>
                  <span>by {run.author}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {durationSeconds != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                  <Clock className="h-3 w-3" />
                  {durationSeconds}s
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">{dateStr}</span>
              {run.htmlUrl && (
                <a
                  href={run.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  title="View on GitHub Actions"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
