import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/createui/badge'

const PROGRESS_STAGES = {
  queued: {
    label: 'Queued',
    detail: 'Waiting for an available worker to pick up this scan.',
  },
  cloning: {
    label: 'Preparing repository',
    detail: 'Fetching the selected revision and preparing a temporary working copy.',
  },
  analyzing: {
    label: 'Inspecting codebase',
    detail: 'Mapping files and dependencies, then evaluating repository health signals.',
  },
} as const

export type RunningAnalysisStatus = keyof typeof PROGRESS_STAGES

export function isAnalysisRunning(status: string | null | undefined): status is RunningAnalysisStatus {
  return status === 'queued' || status === 'cloning' || status === 'analyzing'
}

export function AnalysisProgress({ status }: { status: string }) {
  if (!isAnalysisRunning(status)) return null
  const stage = PROGRESS_STAGES[status]

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={`Analysis in progress: ${stage.label}`}
      className="rounded-xl border border-sky-500/25 bg-sky-500/[0.045] p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Analysis in progress</h2>
            <Badge variant="info" appearance="soft" size="xs" shape="pill">{stage.label}</Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stage.detail}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sky-500/10" aria-hidden="true">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-sky-400/80" />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">This view refreshes automatically while the scan is active. No percentage or completion time is estimated.</p>
        </div>
      </div>
    </section>
  )
}
