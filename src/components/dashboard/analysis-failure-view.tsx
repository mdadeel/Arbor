'use client'

import Link from 'next/link'
import { AlertCircle, ChevronDown, ExternalLink, Play, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getFailureExplanation } from '@/lib/analysis-status'

interface AnalysisFailureViewProps {
  errorMessage: string | null | undefined
  analysisId: string
  branch?: string
  commitSha?: string | null
  failedAt?: string | Date | null
  hasPreviousReport: boolean
  onRetryNewAnalysis: () => void
  onViewPreviousReport?: () => void
  isRetrying: boolean
}

export function AnalysisFailureView({
  errorMessage,
  analysisId,
  branch,
  commitSha,
  failedAt,
  hasPreviousReport,
  onRetryNewAnalysis,
  onViewPreviousReport,
  isRetrying,
}: AnalysisFailureViewProps) {
  const explanation = getFailureExplanation(errorMessage)

  return (
    <Card className="border-red-500/30 bg-red-500/[0.035]">
      <CardHeader className="border-b border-red-500/20 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-500">
            <AlertCircle className="size-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Analysis could not complete
            </CardTitle>
            <p className="text-xs text-muted-foreground">{explanation.summary}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5 text-xs">
        <div className="rounded-lg border border-border/80 bg-background/50 p-3 leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Why this happened &amp; next step:</p>
          <p className="mt-1">{explanation.guidance}</p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            size="sm"
            onClick={onRetryNewAnalysis}
            disabled={isRetrying}
            className="gap-1.5"
          >
            <RefreshCw className={isRetrying ? 'size-3.5 animate-spin' : 'size-3.5'} />
            <span>{isRetrying ? 'Starting new analysis…' : 'Start a new analysis'}</span>
          </Button>

          {explanation.actionType === 'settings' && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/settings">
                <span>Manage GitHub Integrations</span>
                <ExternalLink className="size-3" />
              </Link>
            </Button>
          )}

          {hasPreviousReport && onViewPreviousReport && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onViewPreviousReport}
              className="gap-1.5"
            >
              <span>View last completed report</span>
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Note: Starting a new analysis initiates a fresh scan request. This is distinct from
          retrying queue delivery on a waiting request, which does not consume another quota or
          re-clone until claimed.
        </p>

        {/* Expandable Technical Details */}
        <details className="group rounded-lg border border-border/70 bg-background/40 p-2.5 text-xs text-muted-foreground">
          <summary className="flex cursor-pointer items-center justify-between font-medium text-foreground hover:text-primary">
            <span>Technical error details</span>
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2 font-mono text-[11px]">
            <p>
              <span className="text-muted-foreground/80">Scan ID:</span>{' '}
              <span className="break-all text-foreground">{analysisId}</span>
            </p>
            {branch && (
              <p>
                <span className="text-muted-foreground/80">Branch:</span>{' '}
                <span className="text-foreground">{branch}</span>
              </p>
            )}
            {commitSha && (
              <p>
                <span className="text-muted-foreground/80">Commit:</span>{' '}
                <span className="text-foreground">{commitSha}</span>
              </p>
            )}
            {failedAt && (
              <p>
                <span className="text-muted-foreground/80">Failed at:</span>{' '}
                <span className="text-foreground">
                  {new Date(failedAt).toLocaleString()}
                </span>
              </p>
            )}
            <p className="break-words">
              <span className="text-muted-foreground/80">Raw message:</span>{' '}
              <span className="text-red-400">
                {errorMessage || 'No detailed technical message was emitted.'}
              </span>
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

