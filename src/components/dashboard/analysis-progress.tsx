'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Clock3, Loader2, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/createui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { analysisAgeMs, formatAnalysisWait, QUEUED_WARNING_MS } from '@/lib/analysis-status'
import type { ProcessingHealth } from '@/server/services/analysis-dispatch'

const PROGRESS_STAGES = {
  queued: {
    label: 'Queued',
    detail: 'Your scan request is saved. Code inspection has not started yet.',
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

type AnalysisProgressProps = {
  status: string
  createdAt?: string | Date
  startedAt?: string | Date | null
  analysisId?: string
  repoFullName?: string
  branch?: string
  commitSha?: string | null
  errorMessage?: string | null
  health?: ProcessingHealth
  onRetry?: () => void
  onRefresh?: () => void
  retrying?: boolean
  refreshing?: boolean
  retryError?: string | null
  retryMessage?: string | null
  system?: boolean
}

export function AnalysisProgress({
  status,
  createdAt,
  startedAt,
  analysisId,
  repoFullName,
  branch,
  commitSha,
  errorMessage,
  health,
  onRetry,
  onRefresh,
  retrying,
  refreshing,
  retryError,
  retryMessage,
  system,
}: AnalysisProgressProps) {
  // Start without a browser clock to avoid server/client hydration differences.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(interval)
  }, [])

  if (!isAnalysisRunning(status)) return null
  const queued = status === 'queued'
  const age = now === null ? null : analysisAgeMs(createdAt, now)
  const processingAge =
    now === null || !startedAt ? null : analysisAgeMs(startedAt, now)
  const delayed = queued && age !== null && age >= QUEUED_WARNING_MS
  const deliveryUnavailable = health?.queue === 'unavailable'
  const noWorker = health?.worker === 'not-detected'
  const paused = health?.paused === true
  const stalled = queued && health?.stalled === true
  const warning = queued && (delayed || deliveryUnavailable || noWorker || paused || stalled)
  const stage = PROGRESS_STAGES[status]
  const title = queued
    ? warning
      ? 'Your scan is still waiting'
      : 'Waiting to start'
    : 'Analysis in progress'
  const stages = system
    ? ['Queued', 'Inspecting codebase', 'Report ready']
    : ['Queued', 'Preparing repository', 'Inspecting codebase', 'Report ready']
  const currentIndex = system
    ? queued
      ? 0
      : 1
    : ['queued', 'cloning', 'analyzing'].indexOf(status)
  const Icon = warning ? AlertTriangle : queued ? Clock3 : Loader2

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={title}
      className={cn(
        'rounded-xl border p-4 sm:p-5',
        warning
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-sky-500/25 bg-sky-500/[0.045]'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg border',
            warning
              ? 'border-amber-500/30 text-amber-600 dark:text-amber-300'
              : 'border-sky-500/25 text-sky-600 dark:text-sky-300'
          )}
        >
          <Icon className={cn('size-4', !queued && 'animate-spin')} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <Badge
                variant={warning ? 'warning' : 'info'}
                appearance="soft"
                size="xs"
                shape="pill"
              >
                {stage.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{stage.detail}</p>

            {(repoFullName || branch || commitSha) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                {repoFullName && (
                  <span>
                    Repo: <span className="text-foreground">{repoFullName}</span>
                  </span>
                )}
                {branch && (
                  <span>
                    Branch: <span className="text-foreground">{branch}</span>
                  </span>
                )}
                {commitSha && (
                  <span>
                    Revision:{' '}
                    <span className="text-foreground">{commitSha.slice(0, 7)}</span>
                  </span>
                )}
              </div>
            )}

            <div className="mt-1 text-xs text-muted-foreground">
              {queued ? (
                age !== null && <p>Waiting for {formatAnalysisWait(age)}.</p>
              ) : processingAge !== null ? (
                <p>
                  Actively processing for {formatAnalysisWait(processingAge)}
                  {age !== null && (
                    <span className="text-muted-foreground/80">
                      {' '}
                      (requested {formatAnalysisWait(age)} ago)
                    </span>
                  )}
                  .
                </p>
              ) : (
                age !== null && <p>Requested {formatAnalysisWait(age)} ago.</p>
              )}
            </div>
          </div>

          <ol aria-label="Analysis stages" className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {stages.map((label, index) => (
              <li
                key={label}
                aria-current={index === currentIndex ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1.5',
                  index === currentIndex
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {index < currentIndex ? (
                  <Check className="size-3.5 text-emerald-500" aria-hidden="true" />
                ) : (
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full border text-[10px]',
                      index === currentIndex && 'border-primary text-primary font-bold'
                    )}
                  >
                    {index + 1}
                  </span>
                )}
                {label}
              </li>
            ))}
          </ol>

          {queued && (
            <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
              {deliveryUnavailable ? (
                <p>
                  Queue connection unavailable. Your request is saved, but it cannot start
                  until delivery succeeds or the scheduled processor claims it. Retry delivery
                  once the queue is healthy.
                </p>
              ) : paused ? (
                <p>
                  The processing queue is paused. A deployment administrator needs to resume
                  it before jobs can be processed.
                </p>
              ) : noWorker ? (
                <p>
                  No continuous worker connection was detected. A deployment administrator
                  should check that the background worker is running and shares this app’s
                  database and Redis.
                </p>
              ) : stalled ? (
                <p>
                  No processor has started this scan. It has been waiting longer than the last
                  recorded analysis activity; a deployment administrator should check that the
                  scheduled processor is running.
                </p>
              ) : delayed ? (
                <p>
                  This scan has been waiting longer than expected. The processor may be busy or
                  unavailable. Retrying delivery will not create a duplicate scan.
                </p>
              ) : (
                <p>
                  Waiting for an available processor. Code inspection has not started yet. You
                  can safely leave this page and return later.
                </p>
              )}

              {(noWorker || delayed || stalled) && (
                <p>
                  {system
                    ? 'System scans require the background worker or a configured fallback processor.'
                    : 'Scans are processed by the scheduled background processor when the schedule runs. If this keeps waiting, a deployment administrator should check that the processor schedule is running.'}
                </p>
              )}

              {health?.worker === 'connected' && (
                <p>
                  A background worker connection was detected. (Note: connection detection
                  confirms an active worker, but does not guarantee that inspection of this
                  specific repository has begun).
                </p>
              )}

              {errorMessage && (
                <p className="break-words font-mono text-[11px] text-amber-600 dark:text-amber-400">
                  Last delivery or processing note: {errorMessage}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {queued && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={retrying}
                className="gap-1.5"
              >
                <RefreshCw className={cn('size-3.5', retrying && 'animate-spin')} />
                {retrying ? 'Checking delivery…' : 'Retry delivery'}
              </Button>
            )}

            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
                <span>{refreshing ? 'Refreshing…' : 'Refresh status'}</span>
              </Button>
            )}
          </div>

          {retryError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-300">
              {retryError}
            </p>
          )}

          {retryMessage && !retryError && (
            <p className="text-xs text-muted-foreground">{retryMessage}</p>
          )}

          {/* Expandable Technical Details */}
          <details className="group rounded-lg border border-border/70 bg-background/40 p-2.5 text-xs text-muted-foreground">
            <summary className="flex cursor-pointer items-center justify-between font-medium text-foreground hover:text-primary">
              <span>Technical diagnostics &amp; scan details</span>
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2 font-mono text-[11px]">
              {analysisId && (
                <p className="break-all">
                  <span className="text-muted-foreground/80">Scan ID:</span>{' '}
                  <span className="text-foreground">{analysisId}</span>
                </p>
              )}
              <p>
                <span className="text-muted-foreground/80">Queue connection:</span>{' '}
                <span className="text-foreground">{health?.queue ?? 'probed on demand'}</span>
              </p>
              <p>
                <span className="text-muted-foreground/80">Worker detection:</span>{' '}
                <span className="text-foreground">
                  {health?.worker === 'connected'
                    ? 'Connected (active)'
                    : health?.worker === 'not-detected'
                    ? 'None detected (connection check)'
                    : 'Unknown'}
                </span>
              </p>
              {health?.paused !== undefined && (
                <p>
                  <span className="text-muted-foreground/80">Queue paused:</span>{' '}
                  <span className="text-foreground">{health.paused ? 'Yes' : 'No'}</span>
                </p>
              )}
              {errorMessage && (
                <p className="break-words">
                  <span className="text-muted-foreground/80">Last message:</span>{' '}
                  <span className="text-foreground">{errorMessage}</span>
                </p>
              )}
              {branch && (
                <p>
                  <span className="text-muted-foreground/80">Target branch:</span>{' '}
                  <span className="text-foreground">{branch}</span>
                </p>
              )}
              {commitSha && (
                <p>
                  <span className="text-muted-foreground/80">Target commit:</span>{' '}
                  <span className="text-foreground">{commitSha}</span>
                </p>
              )}
            </div>
          </details>

          <p className="text-[11px] text-muted-foreground">
            Status refreshes automatically while active. No percentage or completion time is
            estimated.
          </p>
        </div>
      </div>
    </section>
  )
}
