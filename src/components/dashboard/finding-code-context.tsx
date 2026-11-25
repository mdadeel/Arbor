'use client'

import { useState } from 'react'
import { ChevronDown, Code2, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

interface FindingCodeContextProps {
  slug: string
  analysisId: string
  fingerprint: string
  file: string
  line: number
}

/**
 * Loads a bounded excerpt from the analysed commit only when the user opens it.
 * The server never stores the excerpt; this component is presentation only.
 */
export function FindingCodeContext({ slug, analysisId, fingerprint, file, line }: FindingCodeContextProps) {
  const [open, setOpen] = useState(false)
  const context = trpc.project.findingContext.useQuery(
    { slug, analysisId, fingerprint },
    { enabled: open, retry: false, staleTime: 5 * 60 * 1000 }
  )

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-border/70 px-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
      >
        <Code2 className="h-3 w-3" aria-hidden="true" />
        <span>{open ? 'Hide code context' : 'View code context'}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-background/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <p className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
              {file}:{line}
            </p>
            {context.data && (
              <p className="text-[10px] text-muted-foreground">
                Lines {context.data.startLine}–{context.data.endLine} of {context.data.totalLines}
                {context.data.truncated ? ' · excerpt' : ''}
              </p>
            )}
          </div>

          {context.isLoading && (
            <p className="flex items-center gap-2 px-3 py-4 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Loading source from GitHub…
            </p>
          )}

          {context.error && (
            <p role="alert" className="px-3 py-4 text-[11px] text-amber-300">
              {context.error.message}
            </p>
          )}

          {context.data && (
            <div className="max-h-80 overflow-auto py-1">
              <ol aria-label="Source code excerpt">
                {context.data.lines.map((entry) => (
                  <li
                    key={entry.number}
                    className={cn(
                      'grid grid-cols-[3.25rem_1fr] gap-3 px-3 py-px font-mono text-[11px] leading-relaxed',
                      entry.focus ? 'bg-amber-500/10 text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <span className={cn('select-none text-right tabular-nums', entry.focus ? 'text-amber-400' : 'text-label-tertiary')}>
                      {entry.number}
                    </span>
                    <code className="whitespace-pre-wrap break-all">{entry.text || ' '}</code>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
