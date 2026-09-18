import { Loader2 } from 'lucide-react'
import { getScoreColor } from '@/components/dashboard/score-badge'
import { cn } from '@/lib/utils'

export interface AuditScores {
  overall?: number | null
  architecture?: number | null
  techDebt?: number | null
  performance?: number | null
  documentation?: number | null
  security?: number | null
  designSystem?: number | null
}

interface ScoreRowProps {
  scores: AuditScores
  running?: boolean
  className?: string
}

const SCORE_CATEGORIES = [
  { key: 'overall', label: 'Overall' },
  { key: 'architecture', label: 'Architecture' },
  { key: 'techDebt', label: 'Tech Debt' },
  { key: 'performance', label: 'Performance' },
  { key: 'documentation', label: 'Docs' },
  { key: 'security', label: 'Security' },
  { key: 'designSystem', label: 'Design System' },
] as const

export function ScoreRow({ scores, running = false, className }: ScoreRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 divide-y divide-border rounded-lg border border-border bg-card/50 sm:grid-cols-4 sm:divide-y-0 sm:divide-x lg:grid-cols-7',
        className
      )}
    >
      {SCORE_CATEGORIES.map(({ key, label }) => {
        const isPrimary = key === 'overall'
        const value = scores[key as keyof AuditScores]
        const colors = getScoreColor(value)

        return (
          <div
            key={key}
            className={cn(
              'flex flex-col justify-between p-3.5 transition-colors',
              isPrimary ? 'bg-accent/20 col-span-2 sm:col-span-1' : ''
            )}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>{label}</span>
              {value != null && (
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    value >= 80
                      ? 'bg-emerald-500'
                      : value >= 60
                      ? 'bg-amber-400'
                      : value >= 40
                      ? 'bg-orange-500'
                      : 'bg-red-500'
                  )}
                />
              )}
            </div>

            <div className="mt-2 flex items-baseline gap-1">
              {running && value == null ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <span
                  className={cn(
                    'font-mono font-bold tracking-tight',
                    isPrimary ? 'text-3xl' : 'text-2xl',
                    colors.text
                  )}
                >
                  {value ?? '—'}
                </span>
              )}
              {value != null && (
                <span className="text-xs text-muted-foreground/70 font-mono">/100</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
