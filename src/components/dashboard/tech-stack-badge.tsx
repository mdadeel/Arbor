import { cn } from '@/lib/utils'

interface TechStackBadgeProps {
  name: string
  category?: 'framework' | 'language' | 'database' | 'tool' | 'ui'
  className?: string
}

export function TechStackBadge({ name, className }: TechStackBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border border-border/60 bg-muted/60 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground/90 transition-colors hover:border-border hover:bg-muted',
        className
      )}
    >
      {name}
    </span>
  )
}

export function TechStackGroup({
  items,
  className,
}: {
  items: (string | null | undefined)[]
  className?: string
}) {
  const filtered = items.filter((item): item is string => Boolean(item))
  if (filtered.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {filtered.map((item) => (
        <TechStackBadge key={item} name={item} />
      ))}
    </div>
  )
}
