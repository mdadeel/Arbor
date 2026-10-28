import { Logo } from '@/components/ui/logo'
import { buildRecommendedActions } from '@/lib/recommended-actions'
import type { AuditScores } from '@/components/dashboard/score-row'
import type { FindingData } from '@/components/dashboard/finding-item'
import type {
  SharedDependencyRisk,
  SharedPolicySummary,
} from '@/server/services/report-sharing'
import {
  PrintableDependencyRiskSection,
  PrintableFindingsSection,
} from './printable-report-sections'

export type PrintReportContext = {
  clientName?: string | null
  sharedUntil?: string | Date
  policy?: SharedPolicySummary
  dependencyRisk?: SharedDependencyRisk | null
}

type PrintTechStack = {
  framework?: string | null
  languages?: string[]
  packageManager?: string | null
  databases?: string[]
  testing?: string[]
  ui?: string[]
}

export type PrintableAnalysisInput = {
  id: string
  status: string
  branch: string
  commitSha: string | null
  overallScore: number | null
  architectureScore: number | null
  techDebtScore: number | null
  performanceScore: number | null
  documentationScore: number | null
  securityScore: number | null
  designSystemScore: number | null
  techStack: PrintTechStack | null
  structure: Record<string, unknown> | null
  findings: FindingData[] | null
  metrics: Record<string, unknown> | null
  dependencyGraph?: { nodes: string[]; edges: [string, string][] } | null
  designSystem?: unknown
  durationMs: number | null
  createdAt: string
}

export type PrintableProjectInput = {
  name: string
  slug: string
  repoFullName: string
  defaultBranch: string
  latestScores: AuditScores | null
  detectedStack: PrintTechStack | null
  latestCompletedAnalysis: PrintableAnalysisInput | null
}

type HugeFileEntry = {
  file?: string
  path?: string
  lines?: number
}

type DirSummaryEntry = {
  path?: string
  name?: string
  files?: number
  fileCount?: number
}

export function computeCompositeGrade(overall: number | null | undefined): {
  grade: string
  posture: string
} {
  const value = overall ?? 0
  const grade =
    value >= 90 ? 'A+' : value >= 80 ? 'A' : value >= 70 ? 'B' : value >= 55 ? 'C' : 'D'
  const posture =
    value >= 85
      ? 'Production Grade'
      : value >= 70
        ? 'Sound Architecture'
        : value >= 55
          ? 'Technical Debt Warning'
          : 'High Architectural Risk'
  return { grade, posture }
}

function formatUtcTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`
}

function formatScanDateShort(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString().slice(0, 10)
}

function scoreToneClass(score: number | null | undefined): string {
  if (score == null) return 'audit-tone-neutral'
  if (score >= 80) return 'audit-tone-good'
  if (score >= 60) return 'audit-tone-warn'
  return 'audit-tone-bad'
}

export function PrintableProjectReport({
  project,
  printContext,
}: {
  project: PrintableProjectInput
  printContext?: PrintReportContext
}) {
  const completed = project.latestCompletedAnalysis
  const scores: AuditScores = completed
    ? {
        overall: completed.overallScore,
        architecture: completed.architectureScore,
        techDebt: completed.techDebtScore,
        performance: completed.performanceScore,
        documentation: completed.documentationScore,
        security: completed.securityScore,
        designSystem: completed.designSystemScore,
      }
    : (project.latestScores ?? {})

  const { grade, posture } = computeCompositeGrade(scores.overall)
  const stack = completed?.techStack ?? project.detectedStack ?? null
  const metrics = completed?.metrics ?? null
  const structure = completed?.structure ?? null
  const allFindings = completed?.findings ?? []
  const activeFindings = allFindings.filter((f) => !f.policySuppressed)
  const suppressedCount = allFindings.length - activeFindings.length

  const criticalFindings = activeFindings.filter((f) => f.severity === 'critical')
  const warningFindings = activeFindings.filter((f) => f.severity === 'warning')
  const infoFindings = activeFindings.filter((f) => f.severity === 'info')

  const recommendedActions = buildRecommendedActions(activeFindings, {
    dependencyGraph: completed?.dependencyGraph ?? null,
    limit: 5,
  })

  const coverage = metrics?.coverage as
    | {
        filesIncluded?: number
        discoveredFilesAtLeast?: number
        sourceFiles?: number
        parsedFiles?: number
        skippedLargeFiles?: number
        partial?: boolean
        repoBytes?: number
      }
    | undefined

  const graphCycles = (metrics?.circularDeps as string[][] | undefined) ?? []
  const designSystem = completed?.designSystem as
    | {
        componentFiles?: number
        components?: number
        tokenType?: string | null
        hardcodedColors?: number
        variantComponents?: number
      }
    | null
    | undefined

  const stat = (key: string, fallback = 0): number => {
    const val = metrics?.[key]
    return typeof val === 'number' ? val : fallback
  }

  const unusedDeps = Array.isArray(metrics?.unusedDeps) ? (metrics.unusedDeps as string[]) : []
  const deadExports = Array.isArray(metrics?.deadExports) ? (metrics.deadExports as string[]) : []
  const hugeFiles: HugeFileEntry[] = Array.isArray(structure?.hugeFiles)
    ? (structure.hugeFiles as HugeFileEntry[]).slice(0, 6)
    : []
  const topDirs: DirSummaryEntry[] = Array.isArray(structure?.dirs)
    ? (structure.dirs as DirSummaryEntry[]).slice(0, 6)
    : []

  const stackItems = [
    stack?.framework,
    stack?.packageManager,
    ...(stack?.languages ?? []),
    ...(stack?.databases ?? []),
    ...(stack?.testing ?? []),
    ...(stack?.ui ?? []),
  ].filter((item): item is string => Boolean(item))

  const commitSha = completed?.commitSha ?? null
  const shortCommit = commitSha ? commitSha.slice(0, 12) : 'unpinned'
  const scanTimestamp = completed?.createdAt ? formatUtcTimestamp(completed.createdAt) : 'Unknown'
  const scanDateShort = completed?.createdAt ? formatScanDateShort(completed.createdAt) : 'Unknown'
  const policySummary =
    printContext?.policy?.summary ?? 'security@1.0.0, maintainability@1.0.0, accessibility@1.0.0'
  const dependencyRisk = printContext?.dependencyRisk ?? null

  const dimensionRows: Array<{ label: string; score: number | null | undefined; description: string }> = [
    {
      label: 'Architecture',
      score: scores.architecture,
      description: 'Module boundaries, file density, and cyclic import discipline',
    },
    {
      label: 'Maintainability & Debt',
      score: scores.techDebt,
      description: 'Type safety, dead exports, unused dependencies, and debug hygiene',
    },
    {
      label: 'Performance Signals',
      score: scores.performance,
      description: 'Server/client component balance and media/asset patterns',
    },
    {
      label: 'Documentation & Env',
      score: scores.documentation,
      description: 'README completeness, inline documentation, and .env templates',
    },
    {
      label: 'Security & Supply Chain',
      score: scores.security,
      description: 'Secret pattern checks and known dependency advisory exposure',
    },
    {
      label: 'Design System',
      score: scores.designSystem,
      description: 'Semantic token adoption, variant consistency, and color hygiene',
    },
  ]

  return (
    <div className="audit-print-root">
      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 1 — COVER PAGE
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="audit-cover-page" aria-label="Audit Report Cover Page">
        <div className="audit-cover-top">
          <div className="audit-brand-bar">
            <Logo size="md" showWordmark />
            <span className="audit-doc-classification">Static Architecture &amp; Security Audit</span>
          </div>

          <div className="audit-cover-hero">
            <p className="audit-eyebrow">Consultant Technical Due Diligence Report</p>
            <h1 className="audit-repo-title">{project.repoFullName || project.name}</h1>
            {project.repoFullName && project.name && project.repoFullName !== project.name && (
              <p className="audit-project-subtitle">Project: {project.name}</p>
            )}

            {printContext?.clientName && (
              <div className="audit-prepared-for" data-testid="prepared-for-banner">
                <span className="audit-prepared-label">Prepared for</span>
                <span className="audit-prepared-client">{printContext.clientName}</span>
              </div>
            )}
          </div>

          <div className="audit-meta-grid">
            <div className="audit-meta-cell">
              <span className="audit-meta-label">Repository</span>
              <span className="audit-meta-value audit-mono">{project.repoFullName || project.name}</span>
            </div>
            <div className="audit-meta-cell">
              <span className="audit-meta-label">Branch</span>
              <span className="audit-meta-value audit-mono">{completed?.branch ?? project.defaultBranch}</span>
            </div>
            <div className="audit-meta-cell audit-meta-span-2">
              <span className="audit-meta-label">Pinned Commit SHA</span>
              <span className="audit-meta-value audit-mono">{commitSha ?? 'Not recorded'}</span>
            </div>
            <div className="audit-meta-cell">
              <span className="audit-meta-label">Scan Date</span>
              <span className="audit-meta-value audit-mono">{scanTimestamp}</span>
            </div>
            <div className="audit-meta-cell">
              <span className="audit-meta-label">Snapshot Share Expiry</span>
              <span className="audit-meta-value audit-mono">
                {printContext?.sharedUntil ? formatUtcTimestamp(printContext.sharedUntil) : 'Internal'}
              </span>
            </div>
            <div className="audit-meta-cell audit-meta-span-2">
              <span className="audit-meta-label">Effective Policy Version</span>
              <span className="audit-meta-value audit-mono">{policySummary}</span>
            </div>
          </div>

          <div className="audit-cover-scorecard audit-avoid-break">
            <div className="audit-grade-summary">
              <div className="audit-grade-badge">{grade}</div>
              <div>
                <p className="audit-posture-title">{posture}</p>
                <p className="audit-posture-score audit-mono">
                  Composite Score: <strong>{scores.overall ?? '—'}</strong> / 100
                </p>
                <p className="audit-posture-counts">
                  <strong>{criticalFindings.length}</strong> critical ·{' '}
                  <strong>{warningFindings.length}</strong> warnings ·{' '}
                  <strong>{infoFindings.length}</strong> info
                  {suppressedCount > 0 ? ` · ${suppressedCount} policy-suppressed` : ''}
                </p>
              </div>
            </div>

            <table className="audit-table audit-score-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Dimension</th>
                  <th style={{ width: '54%' }}>Measured Signal Scope</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {dimensionRows.map((row) => (
                  <tr key={row.label}>
                    <td className="audit-cell-strong">{row.label}</td>
                    <td className="audit-cell-muted">{row.description}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`audit-score-pill audit-mono ${scoreToneClass(row.score)}`}>
                        {row.score ?? '—'}/100
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="audit-cover-disclaimer">
          <strong>Methodology &amp; Snapshot Integrity:</strong> Arbor evaluates source ASTs, module import
          graphs, lockfiles, and deterministic policy rules statically without executing repository code.
          Scores and findings apply strictly to commit <span className="audit-mono">{shortCommit}</span>{' '}
          scanned on <span className="audit-mono">{scanDateShort}</span>; verify against current{' '}
          <span className="audit-mono">HEAD</span> before release sign-off.
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — RECOMMENDED ACTIONS (TOP 5 BY SEVERITY & BLAST RADIUS)
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="audit-section" aria-label="Recommended Actions">
        <div className="audit-section-header">
          <div>
            <span className="audit-section-num">Section 01</span>
            <h2 className="audit-section-title">Recommended Actions</h2>
          </div>
          <span className="audit-effort-legend audit-mono">
            Effort: S (&lt;2h) · M (0.5–2d) · L (3d+)
          </span>
        </div>
        <p className="audit-section-lead">
          Top {recommendedActions.length} highest-leverage remediations derived deterministically from
          finding severity, module import fan-in, and repository blast radius.
        </p>

        {recommendedActions.length === 0 ? (
          <div className="audit-empty-box">No active findings require remediation in this snapshot.</div>
        ) : (
          <table className="audit-table audit-actions-table">
            <thead>
              <tr>
                <th style={{ width: '6%' }}>#</th>
                <th style={{ width: '34%' }}>Finding &amp; Blast Radius</th>
                <th style={{ width: '48%' }}>Recommended Remediation</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Effort</th>
              </tr>
            </thead>
            <tbody>
              {recommendedActions.map((action) => (
                <tr key={`${action.rank}-${action.findingId}-${action.location}`}>
                  <td className="audit-mono audit-cell-strong">{action.rank}</td>
                  <td>
                    <div className="audit-action-finding">
                      <span className={`audit-sev-pill audit-sev-${action.severity}`}>
                        {action.severity}
                      </span>
                      <span className="audit-cell-strong">{action.title}</span>
                    </div>
                    <div className="audit-action-meta audit-mono">{action.location}</div>
                    <div className="audit-action-blast">{action.blastRadiusLabel}</div>
                  </td>
                  <td className="audit-remediation-cell">{action.remediation}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`audit-effort-badge audit-effort-${action.effort.toLowerCase()} audit-mono`}>
                      {action.effort}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — ARCHITECTURE SUMMARY & CODEBASE METRICS
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="audit-section" aria-label="Architecture Summary">
        <div className="audit-section-header">
          <div>
            <span className="audit-section-num">Section 02</span>
            <h2 className="audit-section-title">Architecture Summary &amp; Codebase Posture</h2>
          </div>
          {coverage && (
            <span className="audit-coverage-pill audit-mono">
              {coverage.partial ? 'Partial Scan Coverage' : 'Full Budget Coverage'} ·{' '}
              {coverage.parsedFiles ?? 0}/{coverage.sourceFiles ?? 0} files parsed
            </span>
          )}
        </div>

        <div className="audit-two-col audit-avoid-break">
          <div className="audit-panel">
            <h3 className="audit-panel-title audit-tone-good">Architectural Strengths</h3>
            <ul className="audit-bullet-list">
              {graphCycles.length === 0 && (
                <li>Acyclic module graph with 0 circular import loops detected.</li>
              )}
              {stat('anyTypes', 0) <= 5 && (
                <li>Strong static type discipline with minimal explicit any usage.</li>
              )}
              {designSystem?.tokenType && (
                <li>Centralized design token system detected ({designSystem.tokenType}).</li>
              )}
              {unusedDeps.length === 0 && (
                <li>Manifest dependencies align cleanly with static module imports.</li>
              )}
              <li>
                Modular source layout spanning {stat('files', 0)} source files and{' '}
                {stat('loc', 0).toLocaleString()} lines of code.
              </li>
            </ul>
          </div>

          <div className="audit-panel">
            <h3 className="audit-panel-title audit-tone-warn">Focus &amp; Risk Areas</h3>
            <ul className="audit-bullet-list">
              {criticalFindings.length > 0 && (
                <li>
                  {criticalFindings.length} critical security/credential signal(s) require immediate triage.
                </li>
              )}
              {graphCycles.length > 0 && (
                <li>
                  {graphCycles.length} circular dependency chain(s) coupling module boundaries.
                </li>
              )}
              {stat('anyTypes', 0) > 5 && (
                <li>{stat('anyTypes', 0)} explicit any annotations weakening static type guarantees.</li>
              )}
              {unusedDeps.length > 0 && (
                <li>{unusedDeps.length} potentially unused package(s) declared in manifest.</li>
              )}
              {deadExports.length > 0 && (
                <li>{deadExports.length} exported symbol(s) without internal static importers.</li>
              )}
              {(designSystem?.hardcodedColors ?? 0) > 0 && (
                <li>
                  {designSystem?.hardcodedColors} hardcoded color literal(s) bypassing semantic tokens.
                </li>
              )}
              {criticalFindings.length === 0 &&
                graphCycles.length === 0 &&
                stat('anyTypes', 0) <= 5 &&
                unusedDeps.length === 0 && (
                  <li>No major structural bottlenecks flagged at current scan thresholds.</li>
                )}
            </ul>
          </div>
        </div>

        {stackItems.length > 0 && (
          <div className="audit-stack-bar audit-avoid-break">
            <span className="audit-meta-label">Detected Stack:</span>
            <div className="audit-tag-list">
              {stackItems.map((item) => (
                <span key={item} className="audit-tag audit-mono">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        <table className="audit-table audit-metrics-table audit-avoid-break">
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Scale &amp; Density</th>
              <th style={{ width: '25%' }}>Component Architecture</th>
              <th style={{ width: '25%' }}>Hygiene &amp; Debt</th>
              <th style={{ width: '25%' }}>Graph &amp; Design System</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="audit-kv">
                  <span>Source Files</span>
                  <strong className="audit-mono">{stat('files', 0)}</strong>
                </div>
                <div className="audit-kv">
                  <span>Lines of Code</span>
                  <strong className="audit-mono">{stat('loc', 0).toLocaleString()}</strong>
                </div>
                <div className="audit-kv">
                  <span>Avg File Lines</span>
                  <strong className="audit-mono">
                    {typeof structure?.avgFileLines === 'number' ? structure.avgFileLines : '—'}
                  </strong>
                </div>
                <div className="audit-kv">
                  <span>Indexed Size</span>
                  <strong className="audit-mono">
                    {coverage?.repoBytes != null
                      ? `${(coverage.repoBytes / (1024 * 1024)).toFixed(1)} MiB`
                      : '—'}
                  </strong>
                </div>
              </td>
              <td>
                <div className="audit-kv">
                  <span>Total Components</span>
                  <strong className="audit-mono">{stat('components', 0)}</strong>
                </div>
                <div className="audit-kv">
                  <span>Server Components</span>
                  <strong className="audit-mono">{stat('serverComponents', 0)}</strong>
                </div>
                <div className="audit-kv">
                  <span>Client Components</span>
                  <strong className="audit-mono">{stat('clientComponents', 0)}</strong>
                </div>
                <div className="audit-kv">
                  <span>Custom Hooks</span>
                  <strong className="audit-mono">{stat('hooks', 0)}</strong>
                </div>
              </td>
              <td>
                <div className="audit-kv">
                  <span>Explicit any</span>
                  <strong className="audit-mono">{stat('anyTypes', 0)}</strong>
                </div>
                <div className="audit-kv">
                  <span>Console Logs</span>
                  <strong className="audit-mono">{stat('consoleLogs', 0)}</strong>
                </div>
                <div className="audit-kv">
                  <span>Unused Deps</span>
                  <strong className="audit-mono">{unusedDeps.length}</strong>
                </div>
                <div className="audit-kv">
                  <span>Dead Exports</span>
                  <strong className="audit-mono">{deadExports.length}</strong>
                </div>
              </td>
              <td>
                <div className="audit-kv">
                  <span>Graph Modules</span>
                  <strong className="audit-mono">
                    {completed?.dependencyGraph?.nodes?.length ?? 0}
                  </strong>
                </div>
                <div className="audit-kv">
                  <span>Import Edges</span>
                  <strong className="audit-mono">
                    {completed?.dependencyGraph?.edges?.length ?? 0}
                  </strong>
                </div>
                <div className="audit-kv">
                  <span>Circular Loops</span>
                  <strong className="audit-mono">{graphCycles.length}</strong>
                </div>
                <div className="audit-kv">
                  <span>Hardcoded Colors</span>
                  <strong className="audit-mono">{designSystem?.hardcodedColors ?? 0}</strong>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {(topDirs.length > 0 || hugeFiles.length > 0) && (
          <div className="audit-two-col audit-avoid-break">
            {topDirs.length > 0 && (
              <div>
                <h3 className="audit-subtable-title">Directory File Distribution</h3>
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th style={{ width: '74%' }}>Directory</th>
                      <th style={{ width: '26%', textAlign: 'right' }}>Files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDirs.map((dir, idx) => {
                      const dirName = dir.path ?? dir.name ?? `dir-${idx + 1}`
                      const dirFiles = dir.files ?? dir.fileCount ?? 0
                      return (
                        <tr key={`${dirName}-${idx}`}>
                          <td className="audit-mono">{dirName}</td>
                          <td className="audit-mono" style={{ textAlign: 'right' }}>
                            {dirFiles.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {hugeFiles.length > 0 && (
              <div>
                <h3 className="audit-subtable-title">Largest Source Modules (&gt;300 LOC)</h3>
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th style={{ width: '76%' }}>Module Path</th>
                      <th style={{ width: '24%', textAlign: 'right' }}>Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hugeFiles.map((hf, idx) => {
                      const modPath = hf.file ?? hf.path ?? `module-${idx + 1}`
                      const modLines = typeof hf.lines === 'number' ? hf.lines : 0
                      return (
                        <tr key={`${modPath}-${idx}`}>
                          <td className="audit-mono">{modPath}</td>
                          <td className="audit-mono" style={{ textAlign: 'right' }}>
                            {modLines.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <PrintableFindingsSection
        activeFindings={activeFindings}
        criticalFindings={criticalFindings}
        warningFindings={warningFindings}
        infoFindings={infoFindings}
      />

      <PrintableDependencyRiskSection dependencyRisk={dependencyRisk} />

      <footer className="audit-browser-print-footer" aria-hidden="true">
        <span>
          Arbor · {project.repoFullName || project.name} · commit {shortCommit} (
          {completed?.branch ?? project.defaultBranch}) · {scanDateShort} — stale if HEAD advances
        </span>
      </footer>
    </div>
  )
}
