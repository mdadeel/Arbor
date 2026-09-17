import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AnalysisStatus = 'queued' | 'cloning' | 'analyzing' | 'completed' | 'failed' | string
export type FindingSeverity = 'critical' | 'warning' | 'info'

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
  showSpinner?: boolean
}

export function StatusBadge({
  status,
  label,
  className,
  showSpinner = true,
}: StatusBadgeProps) {
  const isRunning = ['queued', 'cloning', 'analyzing'].includes(status)
  const isSuccess = ['completed', 'active', 'healthy', 'set'].includes(status)
  const isWarning = ['warning', 'different', 'archived'].includes(status)
  const isError = ['failed', 'critical', 'missing', 'error'].includes(status)

  const styles = isRunning
    ? 'border-sky-500/30 bg-sky-500/10 text-sky-400'
    : isSuccess
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
    : isWarning
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
    : isError
    ? 'border-red-500/30 bg-red-500/10 text-red-400'
    : 'border-border bg-muted/50 text-muted-foreground'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize tracking-wide',
        styles,
        className
      )}
    >
      {isRunning && showSpinner && (
        <Loader2 className="h-3 w-3 animate-spin text-current" />
      )}
      {!isRunning && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isSuccess
              ? 'bg-emerald-400'
              : isWarning
              ? 'bg-amber-400'
              : isError
              ? 'bg-red-400'
              : 'bg-muted-foreground'
          )}
        />
      )}
      <span>{label ?? status}</span>
    </span>
  )
}
