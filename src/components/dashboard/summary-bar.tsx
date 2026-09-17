import { cn } from '@/lib/utils'

export interface SummaryCounts {
  total: number
  healthy: number
  warning: number
  error: number
  avgScore?: number
  failingBuilds?: number
  openPRs?: number
}

interface SummaryBarProps {
  counts: SummaryCounts
  className?: string
}

export function SummaryBar({ counts, className }: SummaryBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card/40 px-4 py-2.5 text-xs font-medium',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold text-foreground">
          {counts.total}
        </span>
        <span className="text-muted-foreground">Projects</span>
      </div>

      {counts.avgScore !== undefined && (
        <>
          <span className="hidden h-3.5 w-px bg-border sm:inline-block" />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Avg Health:</span>
            <span
              className={cn(
                'font-mono text-sm font-semibold',
                counts.avgScore >= 80
                  ? 'text-emerald-400'
                  : counts.avgScore >= 50
                    ? 'text-amber-400'
                    : 'text-red-400'
              )}
            >
              {counts.avgScore}/100
            </span>
          </div>
        </>
      )}

      <span className="hidden h-3.5 w-px bg-border sm:inline-block" />

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="font-mono text-sm font-semibold text-emerald-400">
          {counts.healthy}
        </span>
        <span className="text-muted-foreground">Healthy</span>
      </div>

      <span className="hidden h-3.5 w-px bg-border sm:inline-block" />

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="font-mono text-sm font-semibold text-amber-300">
          {counts.warning}
        </span>
        <span className="text-muted-foreground">Warning</span>
      </div>

      <span className="hidden h-3.5 w-px bg-border sm:inline-block" />

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="font-mono text-sm font-semibold text-red-400">
          {counts.error}
        </span>
        <span className="text-muted-foreground">Needs Attention</span>
      </div>

      {counts.failingBuilds !== undefined && counts.failingBuilds > 0 && (
        <>
          <span className="hidden h-3.5 w-px bg-border sm:inline-block" />
          <div className="flex items-center gap-1.5 text-red-400 font-semibold">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span>{counts.failingBuilds} Failing CI</span>
          </div>
        </>
      )}

      {counts.openPRs !== undefined && counts.openPRs > 0 && (
        <>
          <span className="hidden h-3.5 w-px bg-border sm:inline-block" />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{counts.openPRs}</span>
            <span>Open PRs</span>
          </div>
        </>
      )}
    </div>
  )
}
