import { AlertCircle, AlertTriangle, FileCode, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Severity = 'critical' | 'warning' | 'info'

export interface FindingData {
  id: string
  category: string
  severity: Severity
  title: string
  detail: string
  file?: string
  line?: number
  count?: number
  paths?: string[]
}

interface FindingItemProps {
  finding: FindingData
  className?: string
}

export function FindingItem({ finding, className }: FindingItemProps) {
  const isCritical = finding.severity === 'critical'
  const isWarning = finding.severity === 'warning'

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-border hover:bg-card/70',
        className
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isCritical ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
          </div>
        ) : isWarning ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
            <Info className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            {finding.title}
          </span>
          <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {finding.category}
          </span>
        </div>

        {finding.detail && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {finding.detail}
          </p>
        )}

        {finding.file && (
          <div className="flex items-center gap-1.5 pt-0.5 font-mono text-[11px] text-muted-foreground/80">
            <FileCode className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {finding.file}
              {finding.line ? `:${finding.line}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
