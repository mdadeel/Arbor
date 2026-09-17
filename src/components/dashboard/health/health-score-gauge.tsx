'use client'

import React from 'react'

interface HealthScoreGaugeProps {
  score: number
  status: 'healthy' | 'good' | 'warning' | 'critical'
  size?: 'sm' | 'md' | 'lg'
}

const STATUS_CONFIG = {
  healthy: {
    label: 'Healthy',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    strokeColor: '#10b981',
  },
  good: {
    label: 'Good',
    textClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/30',
    strokeColor: '#eab308',
  },
  warning: {
    label: 'Warning',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    strokeColor: '#f59e0b',
  },
  critical: {
    label: 'Critical',
    textClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    strokeColor: '#ef4444',
  },
}

export function HealthScoreGauge({
  score,
  status,
  size = 'md',
}: HealthScoreGaugeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.healthy
  const clampedScore = Math.max(0, Math.min(100, score))

  const radius = size === 'sm' ? 24 : size === 'lg' ? 44 : 34
  const strokeWidth = size === 'sm' ? 4 : size === 'lg' ? 6 : 5
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference
  const svgSize = (radius + strokeWidth) * 2

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center shrink-0">
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-muted/30"
          />
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke={config.strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span
          className={`absolute font-mono font-bold ${
            size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-sm'
          } ${config.textClass}`}
        >
          {clampedScore}
        </span>
      </div>

      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${config.bgClass} ${config.textClass} ${config.borderClass}`}
          >
            {config.label}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground block">
          GitHub & Quality Index
        </span>
      </div>
    </div>
  )
}
