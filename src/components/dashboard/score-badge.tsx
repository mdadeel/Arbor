import { cn } from '@/lib/utils'

export type ScoreBadgeSize = 'sm' | 'md' | 'lg'

interface ScoreBadgeProps {
  score?: number | null
  size?: ScoreBadgeSize
  showOutOf?: boolean
  className?: string
}

export function getScoreColor(score?: number | null): {
  text: string
  bg: string
  border: string
  label: string
} {
  if (score == null) {
    return {
      text: 'text-muted-foreground',
      bg: 'bg-muted/40',
      border: 'border-border',
      label: 'Not analyzed',
    }
  }
  if (score >= 80) {
    return {
      text: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      label: 'Healthy',
    }
  }
  if (score >= 60) {
    return {
      text: 'text-amber-400',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/20',
      label: 'Good',
    }
  }
  if (score >= 40) {
    return {
      text: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      label: 'Warning',
    }
  }
  return {
    text: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    label: 'Critical',
  }
}

export function ScoreBadge({
  score,
  size = 'md',
  showOutOf = false,
  className,
}: ScoreBadgeProps) {
  const colors = getScoreColor(score)

  if (score == null) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs text-muted-foreground',
          colors.bg,
          colors.border,
          className
        )}
      >
        —
      </span>
    )
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.2',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border font-mono font-medium',
        sizeClasses[size],
        colors.text,
        colors.bg,
        colors.border,
        className
      )}
    >
      <span>{score}</span>
      {showOutOf && <span className="text-[10px] text-muted-foreground">/100</span>}
    </span>
  )
}
