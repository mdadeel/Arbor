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
  { key: 'overall', label: 'Overall', hint: 'Weighted blend of the static category scores' },
  { key: 'architecture', label: 'Architecture', hint: 'Entry points, folder shape, file size & import cycles' },
  { key: 'techDebt', label: 'Tech Debt', hint: 'Static cycles, type escapes, exports & dependency hints' },
  { key: 'performance', label: 'Performance', hint: 'Client-component ratio and image source patterns; not a runtime trace' },
  { key: 'documentation', label: 'Docs', hint: 'README presence, comments and JSDoc markers' },
  { key: 'security', label: 'Security', hint: 'Secret-like patterns and environment documentation; not a full audit' },
  { key: 'designSystem', label: 'Design System', hint: 'Detected tokens, component variants and hardcoded colors' },
] as const

function getScoreTier(val: number | null | undefined): { label: string; dot: string; bar: string } {
  if (val == null) return { label: 'Pending', dot: 'bg-muted-foreground', bar: 'bg-muted-foreground/30' }
  if (val >= 85) return { label: 'Optimal', dot: 'bg-emerald-400', bar: 'bg-emerald-400' }
  if (val >= 70) return { label: 'Good', dot: 'bg-emerald-500/80', bar: 'bg-emerald-500/80' }
  if (val >= 50) return { label: 'Moderate', dot: 'bg-amber-400', bar: 'bg-amber-400' }
  return { label: 'Needs Work', dot: 'bg-red-500', bar: 'bg-red-500' }
}

export function ScoreRow({ scores, running = false, className }: ScoreRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-7',
        className
      )}
    >
      {SCORE_CATEGORIES.map(({ key, label, hint }) => {
        const isPrimary = key === 'overall'
        const value = scores[key as keyof AuditScores]
        const colors = getScoreColor(value)
        const tier = getScoreTier(value)

        return (
          <div
            key={key}
            className={cn(
              'group relative flex flex-col justify-between p-3.5 transition-colors bg-card hover:bg-muted/40',
              isPrimary ? 'bg-accent/20 hover:bg-accent/35 col-span-2 sm:col-span-2 lg:col-span-1' : ''
            )}
            title={hint}
          >
            <div>
              <div className="flex items-center justify-between gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <span className={cn(isPrimary ? 'font-semibold text-foreground' : '')}>{label}</span>
                {value != null && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border border-border/80 px-1.5 py-0.2 text-[9px] font-mono capitalize tracking-normal text-muted-foreground',
                      tier.label === 'Optimal' ? 'text-emerald-400 border-emerald-500/30' : '',
                      tier.label === 'Needs Work' ? 'text-red-400 border-red-500/30' : ''
                    )}
                  >
                    <span className={cn('h-1 w-1 rounded-full', tier.dot)} />
                    {tier.label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground/75 leading-tight line-clamp-1">
                {hint}
              </p>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-1">
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

              {/* High-contrast hairline progress meter */}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/70">
                <div
                  className={cn('h-full transition-all duration-500', tier.bar)}
                  style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
