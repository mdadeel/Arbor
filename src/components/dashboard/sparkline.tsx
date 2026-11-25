export interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  label?: string
}

/**
 * Maps scores to an SVG polyline. Returns an empty string when there is not
 * enough history to draw a trend (fewer than two points).
 */
export function sparklinePoints(values: number[], width = 96, height = 26, padding = 3): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2)
      const y = height - padding - ((value - min) / range) * (height - padding * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function Sparkline({ values, width = 96, height = 26, label }: SparklineProps) {
  const points = sparklinePoints(values, width, height)
  if (!points) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const last = values[values.length - 1]
  const lastPoint = points.split(' ').at(-1)?.split(',') ?? []
  const tone = last >= 80 ? 'text-emerald-400' : last >= 60 ? 'text-amber-400' : 'text-red-400'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? `Health score trend: ${values.join(' → ')}`}
      className={tone}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lastPoint.length === 2 && (
        <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2" fill="currentColor" />
      )}
    </svg>
  )
}
