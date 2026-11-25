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
      bg: 'bg-black/[0.04] dark:bg-white/[0.06]',
      border: 'border-black/[0.08] dark:border-white/[0.1]',
      label: 'Not analyzed',
    }
  }
  if (score >= 80) {
    return {
      text: 'text-[#15803d] dark:text-[#30d158]',
      bg: 'bg-[#34c759]/12 dark:bg-[#30d158]/18',
      border: 'border-[#34c759]/30 dark:border-[#30d158]/35',
      label: 'Healthy',
    }
  }
  if (score >= 60) {
    return {
      text: 'text-[#b45309] dark:text-[#ff9f0a]',
      bg: 'bg-[#ff9500]/12 dark:bg-[#ff9f0a]/18',
      border: 'border-[#ff9500]/30 dark:border-[#ff9f0a]/35',
      label: 'Good',
    }
  }
  if (score >= 40) {
    return {
      text: 'text-[#c2410c] dark:text-[#ff9f0a]',
      bg: 'bg-[#ff9500]/15 dark:bg-[#ff9f0a]/20',
      border: 'border-[#ff9500]/35 dark:border-[#ff9f0a]/40',
      label: 'Warning',
    }
  }
  return {
    text: 'text-[#c91c1c] dark:text-[#ff453a]',
    bg: 'bg-[#ff3b30]/12 dark:bg-[#ff453a]/18',
    border: 'border-[#ff3b30]/30 dark:border-[#ff453a]/35',
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
          'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs text-muted-foreground tabular-nums',
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
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-mono font-semibold tabular-nums',
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
