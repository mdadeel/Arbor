import { AlertCircle, AlertTriangle, Code2, ExternalLink, FileCode, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Severity = 'critical' | 'warning' | 'info'

export interface FindingData {
  id: string
  category: string
  severity: Severity
  title: string
  detail: string
  file?: string
  line?: number
  count?: number
  paths?: string[]
}

interface FindingItemProps {
  finding: FindingData
  repoUrl?: string
  commitSha?: string | null
  className?: string
}

export function FindingItem({ finding, repoUrl, commitSha, className }: FindingItemProps) {
  const isCritical = finding.severity === 'critical'
  const isWarning = finding.severity === 'warning'

  const lineRef = finding.line ? `#L${finding.line}` : ''
  const githubFileUrl = repoUrl && finding.file
    ? `${repoUrl}/blob/${commitSha || 'main'}/${finding.file}${lineRef}`
    : null
  const vscodeUrl = finding.file
    ? `vscode://file/${finding.file}${finding.line ? `:${finding.line}` : ''}`
    : null

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-border hover:bg-card/70',
        className
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isCritical ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
          </div>
        ) : isWarning ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
            <Info className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            {finding.title}
          </span>
          <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {finding.category}
          </span>
        </div>

        {finding.detail && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {finding.detail}
          </p>
        )}

        {finding.file && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[11px] text-muted-foreground/80">
            <div className="flex items-center gap-1.5 truncate">
              <FileCode className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {finding.file}
                {finding.line ? `:${finding.line}` : ''}
              </span>
            </div>

            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
              {githubFileUrl && (
                <a
                  href={githubFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  title="View line on GitHub"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  <span>GitHub</span>
                </a>
              )}
              {vscodeUrl && (
                <a
                  href={vscodeUrl}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Open in VS Code"
                >
                  <Code2 className="h-2.5 w-2.5" />
                  <span>VS Code</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
