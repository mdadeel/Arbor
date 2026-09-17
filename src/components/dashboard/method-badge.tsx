import React from 'react'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function MethodBadge({ method }: { method: string }) {
  const upper = method.toUpperCase()
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${
        METHOD_COLORS[upper] ?? 'bg-muted text-muted-foreground border-border'
      }`}
    >
      {upper}
    </span>
  )
}
