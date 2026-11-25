'use client'

import { AlertCircle, AlertTriangle, CheckCircle2, GitBranch, Lock, Play, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface AnalysisFirstRunProps {
  repoFullName: string
  defaultBranch: string
  repoPrivate: boolean
  onStartAnalysis: () => void
  isStarting: boolean
  startError?: string | null
}

const INSPECTED_ITEMS = [
  {
    title: 'AST & Component Architecture',
    desc: 'Analyzes components, custom hooks, file tree structure, and framework paradigms.',
  },
  {
    title: 'Import Graph & Circular Cycles',
    desc: 'Maps cross-module dependencies to flag circular imports and bloated bundles.',
  },
  {
    title: 'Code Hygiene & Debt Hotspots',
    desc: 'Correlates git churn with complexity to pinpoint fragile code and loose typing.',
  },
  {
    title: 'Static Security & Secret Leaks',
    desc: 'Scans for hardcoded API keys, unvalidated environment variables, and risky patterns.',
  },
  {
    title: 'Supply Chain & Known Advisories',
    desc: 'Resolves direct and transitive dependencies against public vulnerability advisories.',
  },
  {
    title: 'Design System & Styling Tokens',
    desc: 'Audits design token configuration, variant adoption, and hardcoded color usage.',
  },
]

const LIMITATIONS = [
  {
    title: 'Dynamic runtime behavior',
    desc: 'Static AST scanning evaluates code as written. It does not execute tests or simulate live browser interactions.',
  },
  {
    title: 'Production infrastructure & load',
    desc: 'Database queries, network latencies, memory leaks under load, and hosting environment states are not observed.',
  },
  {
    title: 'Unpublished or proprietary vulnerabilities',
    desc: 'Only packages with published CVE advisories can be matched. High scores reflect sound static structure, not an absolute security guarantee.',
  },
]

export function AnalysisFirstRun({
  repoFullName,
  defaultBranch,
  repoPrivate,
  onStartAnalysis,
  isStarting,
  startError,
}: AnalysisFirstRunProps) {
  return (
    <div className="space-y-6">
      <Card className="border-border bg-card/60">
        <CardHeader className="border-b border-border/80 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-display text-lg font-semibold tracking-tight">
                  Initial Codebase Audit
                </CardTitle>
                <Badge variant="outline" className="gap-1 font-mono text-xs">
                  <GitBranch className="size-3" />
                  {defaultBranch}
                </Badge>
                {repoPrivate ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Lock className="size-3" /> Private
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Public
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Repository: <span className="font-mono text-foreground">{repoFullName}</span>
              </CardDescription>
            </div>

            <Button
              size="default"
              onClick={onStartAnalysis}
              disabled={isStarting}
              className="gap-2 self-start font-medium sm:self-center"
            >
              {isStarting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Starting initial scan…</span>
                </>
              ) : (
                <>
                  <Play className="size-4 fill-current" />
                  <span>Start Initial Analysis</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-6">
          {startError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-semibold text-red-300">Could not start analysis</p>
                <p className="mt-0.5">{startError}</p>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* What Arbor Inspects */}
            <div className="space-y-3 rounded-lg border border-border/70 bg-background/50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  What Arbor Inspects
                </h3>
              </div>
              <ul className="space-y-3 text-xs">
                {INSPECTED_ITEMS.map((item) => (
                  <li key={item.title} className="space-y-0.5">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* What Static Analysis Cannot Verify */}
            <div className="space-y-3 rounded-lg border border-border/70 bg-background/50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Static Analysis Boundaries
                </h3>
              </div>
              <ul className="space-y-3 text-xs">
                {LIMITATIONS.map((item) => (
                  <li key={item.title} className="space-y-0.5">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                <p className="font-medium text-foreground">Prerequisites &amp; Access:</p>
                <p className="mt-0.5">
                  Arbor shallow-clones the configured branch into an ephemeral working directory.
                  {repoPrivate
                    ? ' Private access uses your connected GitHub credentials; no source code is permanently stored.'
                    : ' Public repositories require no additional authentication.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

