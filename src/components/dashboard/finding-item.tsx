import { FindingWorkflowActions } from './finding-workflow-actions'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  Code2,
  ExternalLink,
  FileCode,
  Info,
  Lightbulb,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type Severity = 'critical' | 'warning' | 'info'

export interface FindingData {
  id: string
  category: string
  severity: Severity
  title: string
  detail: string
  explanation?: string
  impact?: string
  recommendation?: string
  confidence?: 'high' | 'medium' | 'low'
  ruleId?: string
  fingerprint?: string
  policySuppressed?: boolean
  evidence?: string[]
  file?: string
  line?: number
  count?: number
  paths?: string[]
}

interface FindingItemProps {
  finding: FindingData
  repoUrl?: string
  commitSha?: string | null
  projectSlug?: string
  analysisId?: string
  className?: string
}

const severityStyles: Record<Severity, { label: string; icon: typeof AlertCircle; style: string }> = {
  critical: {
    label: 'Critical',
    icon: AlertCircle,
    style: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  warning: {
    label: 'Review',
    icon: AlertTriangle,
    style: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  info: {
    label: 'Suggestion',
    icon: Info,
    style: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
}

export function FindingItem({ finding, repoUrl, commitSha, projectSlug, analysisId, className }: FindingItemProps) {
  const severity = severityStyles[finding.severity]
  const SeverityIcon = severity.icon
  const cleanRepoUrl = repoUrl?.replace(/\.git\/?$/, '')
  const encodedFile = finding.file?.split('/').map(encodeURIComponent).join('/')
  const githubFileUrl = cleanRepoUrl && encodedFile
    ? `${cleanRepoUrl}/blob/${encodeURIComponent(commitSha || 'main')}/${encodedFile}${finding.line ? `#L${finding.line}` : ''}`
    : null
  const vscodeUrl = finding.file
    ? `vscode://file/${finding.file.split('/').map(encodeURIComponent).join('/')}${finding.line ? `:${finding.line}` : ''}`
    : null
  const hasDetails = Boolean(finding.explanation || finding.impact || finding.recommendation || finding.evidence?.length || finding.paths?.length)

  return (
    <article
      className={cn(
        'group space-y-3 p-4 transition-colors hover:bg-muted/20 sm:p-5',
        className
      )}
      aria-label={`${severity.label} finding: ${finding.title}`}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', severity.style)}>
          <SeverityIcon className="h-4 w-4" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
              {finding.title}
            </h4>
            <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', severity.style)}>
              {severity.label}
            </span>
            <span className="rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
              {finding.category.replace(/([A-Z])/g, ' $1')}
            </span>
            {finding.policySuppressed && <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-300">Suppressed by policy</span>}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            {finding.detail}
          </p>

          {(finding.file || githubFileUrl || vscodeUrl) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {finding.file && (
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-background/60 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                  <FileCode className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="max-w-[min(60vw,28rem)] truncate">
                    {finding.file}{finding.line ? `:${finding.line}` : ''}
                  </span>
                </span>
              )}
              {githubFileUrl && (
                <a
                  href={githubFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-7 items-center gap-1 rounded-md border border-border/70 px-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                >
                  View source <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
              {vscodeUrl && (
                <a
                  href={vscodeUrl}
                  className="inline-flex min-h-7 items-center gap-1 rounded-md border border-border/70 px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Open in VS Code <Code2 className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
          )}

          {hasDetails && (
            <details className="group/details overflow-hidden rounded-lg border border-border/70 bg-background/35">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Why this matters &amp; what to do
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/details:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-3 border-t border-border/60 px-3 py-3 sm:grid-cols-2">
                {finding.explanation && (
                  <section className="space-y-1">
                    <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Why flagged</h5>
                    <p className="text-xs leading-relaxed text-foreground/85">{finding.explanation}</p>
                  </section>
                )}
                {finding.impact && (
                  <section className="space-y-1">
                    <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Potential impact</h5>
                    <p className="text-xs leading-relaxed text-foreground/85">{finding.impact}</p>
                  </section>
                )}
                {finding.recommendation && (
                  <section className="space-y-1 sm:col-span-2">
                    <h5 className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      <Wrench className="h-3 w-3" aria-hidden="true" /> Suggested next step
                    </h5>
                    <p className="text-xs leading-relaxed text-foreground/85">{finding.recommendation}</p>
                  </section>
                )}
                {finding.confidence && (
                  <p className="text-[10px] text-muted-foreground sm:col-span-2">
                    Static-scan confidence: <span className="font-medium capitalize text-foreground/80">{finding.confidence}</span>. Confirm in project context before making changes.
                  </p>
                )}
                {(finding.evidence?.length || finding.paths?.length) && (
                  <section className="space-y-1.5 sm:col-span-2">
                    <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</h5>
                    <ul className="space-y-1">
                      {[...(finding.evidence ?? []), ...(finding.paths ?? [])].slice(0, 8).map((item, index) => (
                        <li key={`${item}-${index}`} className="break-all rounded bg-muted/45 px-2 py-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </details>
          )}

          {projectSlug && <FindingWorkflowActions finding={finding} slug={projectSlug} analysisId={analysisId} />}

          {finding.count != null && !finding.file && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              {finding.count.toLocaleString()} occurrence{finding.count === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
