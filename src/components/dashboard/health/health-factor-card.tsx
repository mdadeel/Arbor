'use client'

import React from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, Lightbulb } from 'lucide-react'
import type { HealthFactor } from '@/server/services/health'

export function HealthFactorCard({ factor }: { factor: HealthFactor }) {
  const isPositive = factor.impact === 'positive'
  const isNegative = factor.impact === 'negative'

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isPositive
          ? 'border-border/80 bg-card hover:border-emerald-500/30'
          : isNegative
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-border/80 bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : isNegative ? (
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-semibold text-foreground">{factor.name}</span>
        </div>

        <span
          className={`font-mono text-[11px] font-bold ${
            isPositive
              ? 'text-emerald-400'
              : isNegative
              ? 'text-red-400'
              : 'text-muted-foreground'
          }`}
        >
          {factor.score}/100
        </span>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed pl-6">
        {factor.detail}
      </p>

      {factor.recommendation && (
        <div className="mt-2 flex items-start gap-1.5 rounded bg-muted/40 p-2 text-[11px] text-muted-foreground border border-border/50 ml-6">
          <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>{factor.recommendation}</span>
        </div>
      )}
    </div>
  )
}
