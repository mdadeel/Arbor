'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  Clock3,
  Code2,
  Copy,
  Download,
  FileCode,
  FileText,
  History,
  Layers,
  Loader2,
  Play,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Activity,
  Link2,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  generateMarkdownReport,
  generateJsonReport,
  downloadFile,
} from '@/lib/export-report'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
} from '@/components/ui/tabs'
import GraphCanvas from '@/components/dashboard/architecture/graph-canvas'
import { buildModuleGraph, collectFileLineCounts } from '@/components/dashboard/architecture/module-graph'
import { EnvironmentMatrix } from '@/components/dashboard/environment-matrix'
import { ApiExplorer } from '@/components/dashboard/api-explorer'
import { DocHub } from '@/components/dashboard/docs/doc-hub'
import { ProjectHealthView } from '@/components/dashboard/health/project-health-view'
import { CommitTimeline } from '@/components/dashboard/commits/commit-timeline'
import { ScoreRow, AuditScores } from '@/components/dashboard/score-row'
import { ScoreBadge } from '@/components/dashboard/score-badge'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { AnalysisProgress, isAnalysisRunning } from '@/components/dashboard/analysis-progress'
import { AnalysisHistory } from '@/components/dashboard/analysis-history'
import { AnalysisReportNavigation } from '@/components/dashboard/analysis-report-navigation'
import { AnalysisFirstRun } from '@/components/dashboard/analysis-first-run'
import { AnalysisFailureView } from '@/components/dashboard/analysis-failure-view'
import { TechStackGroup } from '@/components/dashboard/tech-stack-badge'
import { FindingItem, FindingData } from '@/components/dashboard/finding-item'
import { PolicyControls } from '@/components/dashboard/policy-controls'
import { PullRequestChecksView, ScheduleControls, ShareReportControl, SupplyChainView, TrendView } from '@/components/dashboard/analysis-tools'
import { HotspotTable } from '@/components/dashboard/hotspot-table'
import { OwnershipMapCard } from '@/components/dashboard/ownership-map'
import { OverviewScanDiff } from '@/components/dashboard/scan-diff-card'
import { buildRecommendedActions } from '@/lib/recommended-actions'
import {
  PrintableProjectReport,
  type PrintReportContext,
} from '@/components/dashboard/printable-project-report'

type StructureNode = {
  name: string
  type: 'dir' | 'file'
  lines?: number
  children?: StructureNode[]
}

type TechStack = {
  framework?: string | null
  languages?: string[]
  packageManager?: string | null
  databases?: string[]
  testing?: string[]
  ui?: string[]
}

type AnalysisRow = {
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
  techStack: TechStack | null
  structure: Record<string, unknown> | null
  findings: FindingData[] | null
  metrics: Record<string, unknown> | null
  dependencyGraph?: { nodes: string[]; edges: [string, string][] } | null
  designSystem?: unknown
  durationMs: number | null
  errorMessage: string | null
  createdAt: string
}

type AnalysisSummary = Pick<
  AnalysisRow,
  'id' | 'status' | 'branch' | 'commitSha' | 'overallScore' | 'durationMs' | 'errorMessage' | 'createdAt'
> & {
  startedAt?: string | Date | null
  completedAt?: string | Date | null
}

type ProjectRow = {
  id: string
  slug: string
  name: string
  repoFullName: string
  defaultBranch: string
  repoPrivate: boolean
  repoUrl: string
  description: string | null
  latestScores: AuditScores | null
  detectedStack: TechStack | null
  lastAnalyzedAt: string | null
  analyses: AnalysisSummary[]
  latestCompletedAnalysis: AnalysisRow | null
  analysesCount?: number
}

const VALID_TABS = [
  'overview',
  'architecture',
  'findings',
  'environment',
  'api',
  'docs',
  'health',
  'commits',
  'insights',
  'dependencies',
  'policies',
  'pull-requests',
  'history',
]

export type ProjectReportRow = ProjectRow

export function ProjectReport({
  slug,
  project,
  mode = 'interactive',
  printContext,
}: {
  slug: string
  project: ProjectRow
  mode?: 'interactive' | 'print'
  printContext?: PrintReportContext
}) {
  if (mode === 'print') {
    return <PrintableProjectReport project={project} printContext={printContext} />
  }
  return <InteractiveProjectReport slug={slug} project={project} />
}

function InteractiveProjectReport({ slug, project }: { slug: string; project: ProjectRow }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeTabParam = searchParams.get('tab')
  const initialTab = activeTabParam && VALID_TABS.includes(activeTabParam) ? activeTabParam : 'overview'
  const [tab, setTab] = useState(initialTab)

  // Keep state in sync with URL if user navigates back/forward
  useEffect(() => {
    const currentParam = searchParams.get('tab')
    if (currentParam && VALID_TABS.includes(currentParam) && currentParam !== tab) {
      setTab(currentParam)
    } else if (!currentParam && tab !== 'overview') {
      setTab('overview')
    }
  }, [searchParams, tab])

  const handleTabChange = (newTab: string) => {
    setTab(newTab)
    const params = new URLSearchParams(window.location.search)
    if (newTab === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', newTab)
    }
    const query = params.toString()
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`
    window.history.replaceState(null, '', newUrl)
  }

  const latest = project.analyses[0]
  const isRunning = isAnalysisRunning(latest?.status)

  const analyze = trpc.project.analyze.useMutation({
    onSuccess: () => router.refresh(),
  })

  const processingHealth = trpc.project.processingHealth.useQuery({ slug }, {
    enabled: isRunning, refetchInterval: isRunning ? 15_000 : false, retry: false,
  })
  const retryQueued = trpc.project.retryQueued.useMutation({
    onSuccess: () => { router.refresh(); void processingHealth.refetch() },
  })

  // Keep the server-rendered latest status fresh while analysis runs. A repeating
  // interval is required: status can remain queued/analyzing for several polls.
  useEffect(() => {
    if (!isRunning) return
    const interval = window.setInterval(() => router.refresh(), 5000)
    return () => window.clearInterval(interval)
  }, [isRunning, router])

  const initialAnalysisId = searchParams.get('analysisId')
  const [historicalAnalysisId, setHistoricalAnalysisId] = useState<string | null>(initialAnalysisId)

  const historicalQuery = trpc.project.analysisReport.useQuery(
    { slug, analysisId: historicalAnalysisId! },
    { enabled: Boolean(historicalAnalysisId), retry: false }
  )

  const handleSelectHistorical = (analysisId: string | null) => {
    setHistoricalAnalysisId(analysisId)
    const params = new URLSearchParams(window.location.search)
    if (analysisId) {
      params.set('analysisId', analysisId)
    } else {
      params.delete('analysisId')
    }
    const query = params.toString()
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`
    window.history.replaceState(null, '', newUrl)
  }

  const completed = project.latestCompletedAnalysis
  const isViewingHistorical = Boolean(historicalAnalysisId && historicalQuery.data)
  const activeReport = (isViewingHistorical ? (historicalQuery.data as unknown as AnalysisRow) : completed) ?? null

  const [copied, setCopied] = useState(false)

  const handleExportMarkdown = () => {
    if (!activeReport) return
    const md = generateMarkdownReport(project, activeReport)
    const filename = `${project.slug}-analysis-${new Date(activeReport.createdAt).toISOString().slice(0, 10)}.md`
    downloadFile(filename, md, 'text/markdown')
  }

  const handleExportJson = () => {
    if (!activeReport) return
    const json = generateJsonReport(project, activeReport)
    const filename = `${project.slug}-analysis-${new Date(activeReport.createdAt).toISOString().slice(0, 10)}.json`
    downloadFile(filename, json, 'application/json')
  }

  const handleExportSarif = () => {
    if (!activeReport) return
    window.location.assign(
      `/api/projects/${encodeURIComponent(project.slug)}/analyses/${encodeURIComponent(activeReport.id)}/sarif`
    )
  }

  const handleCopyMarkdown = async () => {
    if (!activeReport) return
    const md = generateMarkdownReport(project, activeReport)
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [copiedBadge, setCopiedBadge] = useState(false)

  const handleCopyBadgeMarkdown = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    const badgeMd = `[![Arbor Architecture](${origin}/api/badge/${project.id})](${origin}/projects/${project.slug})`
    await navigator.clipboard.writeText(badgeMd)
    setCopiedBadge(true)
    setTimeout(() => setCopiedBadge(false), 2000)
  }

  const scores: AuditScores = activeReport
    ? {
        overall: activeReport.overallScore,
        architecture: activeReport.architectureScore,
        techDebt: activeReport.techDebtScore,
        performance: activeReport.performanceScore,
        documentation: activeReport.documentationScore,
        security: activeReport.securityScore,
        designSystem: activeReport.designSystemScore,
      }
    : (project.latestScores ?? {})

  const stack = activeReport?.techStack ?? project.detectedStack ?? null
  const metrics = activeReport?.metrics ?? null
  const coverage = metrics?.coverage as {
    filesIncluded?: number
    discoveredFilesAtLeast?: number
    sourceFiles?: number
    parsedFiles?: number
    parseFailedFiles?: number
    skippedLargeFiles?: number
    unsupportedSourceFiles?: number
    unreadableSourceFiles?: number
    partial?: boolean
    repoBytes?: number
  } | undefined
  const structure = activeReport?.structure ?? null
  const findings = useMemo(() => (Array.isArray(activeReport?.findings) ? (activeReport.findings as FindingData[]) : []), [activeReport?.findings])

  // Finding filter state
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [findingSearch, setFindingSearch] = useState<string>('')

  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    for (const f of findings) {
      if (f.category) set.add(f.category)
    }
    return Array.from(set).sort()
  }, [findings])

  const activeFindings = useMemo(() => findings.filter((f) => !f.policySuppressed), [findings])
  const suppressedFindings = useMemo(() => findings.filter((f) => f.policySuppressed), [findings])

  const filteredFindings = useMemo(() => {
    return activeFindings.filter((f) => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false
      if (findingSearch.trim()) {
        const q = findingSearch.toLowerCase()
        const matchTitle = f.title?.toLowerCase().includes(q)
        const matchDetail = f.detail?.toLowerCase().includes(q)
        const matchFile = f.file?.toLowerCase().includes(q)
        const matchRec = f.recommendation?.toLowerCase().includes(q)
        if (!matchTitle && !matchDetail && !matchFile && !matchRec) return false
      }
      return true
    })
  }, [activeFindings, severityFilter, categoryFilter, findingSearch])

  const graphCycles = useMemo(
    () => (activeReport?.metrics?.circularDeps as string[][] | undefined) ?? [],
    [activeReport?.metrics?.circularDeps]
  )

  const structureLineCounts = useMemo(
    () => collectFileLineCounts((structure?.tree as StructureNode[] | undefined) ?? []),
    [structure]
  )

  const moduleGraph = useMemo(() => {
    const g = activeReport?.dependencyGraph
    if (!g || !Array.isArray(g.nodes)) return null
    return buildModuleGraph({ nodes: g.nodes, edges: g.edges ?? [] }, graphCycles, structureLineCounts)
  }, [activeReport?.dependencyGraph, graphCycles, structureLineCounts])

  const designSystem = activeReport?.designSystem as
    | {
        componentFiles: number
        components: number
        componentDirs: string[]
        tokenFiles: string[]
        tokenType: string | null
        hardcodedColors: number
        variantComponents: number
      }
    | null
    | undefined

  const stat = (k: string, fallback?: number) =>
    (metrics?.[k] as number) ?? fallback

  // Group findings by severity
  const criticalFindings = useMemo(
    () => activeFindings.filter((f) => f.severity === 'critical'),
    [activeFindings]
  )
  const warningFindings = useMemo(
    () => activeFindings.filter((f) => f.severity === 'warning'),
    [activeFindings]
  )
  const infoFindings = useMemo(
    () => activeFindings.filter((f) => f.severity === 'info'),
    [activeFindings]
  )
  const recommendedActions = useMemo(
    () =>
      buildRecommendedActions(findings, {
        dependencyGraph: activeReport?.dependencyGraph ?? null,
        limit: 5,
      }),
    [findings, activeReport?.dependencyGraph]
  )

  const stackItems = [
    stack?.framework,
    stack?.packageManager,
    ...(stack?.languages ?? []),
    ...(stack?.databases ?? []),
    ...(stack?.testing ?? []),
    ...(stack?.ui ?? []),
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex items-center gap-3">
          <StatusBadge
            showSpinner={latest?.status !== 'queued'}
            status={isRunning ? latest?.status ?? 'running' : latest?.status ?? 'no-analysis'}
          />
          {activeReport?.durationMs && (
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(activeReport.durationMs / 1000)}s duration
            </span>
          )}
          {activeReport?.commitSha && (
            <span className="font-mono text-xs text-muted-foreground">
              commit: {activeReport.commitSha.slice(0, 7)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeReport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium cursor-pointer">
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Report</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleExportMarkdown} className="gap-2.5 text-xs cursor-pointer py-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Markdown Report (.md)</span>
                    <span className="text-[10px] text-muted-foreground">Formatted summary &amp; findings</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJson} className="gap-2.5 text-xs cursor-pointer py-2">
                  <FileCode className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Raw Payload (.json)</span>
                    <span className="text-[10px] text-muted-foreground">Complete AST audit data</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportSarif} className="gap-2.5 text-xs cursor-pointer py-2">
                  <Shield className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">SARIF 2.1.0 (.sarif)</span>
                    <span className="text-[10px] text-muted-foreground">GitHub Code Scanning / Security tab</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCopyMarkdown} className="gap-2.5 text-xs cursor-pointer py-1.5">
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium">{copied ? 'Copied to Clipboard!' : 'Copy Markdown'}</span>
                </DropdownMenuItem>
                {!project.repoPrivate && (
                  <DropdownMenuItem onClick={handleCopyBadgeMarkdown} className="gap-2.5 text-xs cursor-pointer py-1.5">
                    {copiedBadge ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium">{copiedBadge ? 'Badge Markdown Copied!' : 'Copy README Badge'}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            size="sm"
            disabled={isRunning || analyze.isPending}
            onClick={() => analyze.mutate({ slug })}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
          >
            {(isRunning && latest?.status !== 'queued') || analyze.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>
              {isRunning
                ? latest?.status === 'queued'
                  ? 'Waiting to start'
                  : 'Analysis running…'
                : analyze.isPending
                ? 'Starting analysis…'
                : latest
                ? 'Re-analyze'
                : 'Run First Analysis'}
            </span>
          </Button>
        </div>
      </div>

      {/* Historical Report Snapshot Banner */}
      {isViewingHistorical && activeReport && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3.5 text-xs">
          <div className="flex items-center gap-2.5">
            <History className="h-4 w-4 text-primary shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Viewing historical analysis snapshot</span>
              <span className="text-muted-foreground ml-2">
                Recorded {new Date(activeReport.createdAt).toLocaleString()}
                {activeReport.commitSha ? ` (commit: ${activeReport.commitSha.slice(0, 7)})` : ''}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectHistorical(null)}
            className="h-7 text-xs font-medium cursor-pointer"
          >
            Return to latest report
          </Button>
        </div>
      )}

      {analyze.error && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-300">
          {analyze.error.message}
        </p>
      )}

      {/* Live Running Analysis View */}
      {isRunning && latest && (
        <AnalysisProgress
          key={latest.id}
          status={latest.status}
          createdAt={latest.createdAt}
          startedAt={latest.startedAt}
          analysisId={latest.id}
          repoFullName={project.repoFullName}
          branch={latest.branch ?? project.defaultBranch}
          commitSha={latest.commitSha}
          errorMessage={latest.errorMessage}
          health={processingHealth.data}
          onRetry={processingHealth.data?.canRetry ? () => retryQueued.mutate({ slug, analysisId: latest.id }) : undefined}
          onRefresh={() => {
            router.refresh()
            void processingHealth.refetch()
          }}
          retrying={retryQueued.isPending}
          refreshing={processingHealth.isFetching}
          retryError={retryQueued.error?.message}
          retryMessage={
            retryQueued.isSuccess
              ? 'Delivery checked. This scan will start when a processor is available; no duplicate scan was created.'
              : null
          }
        />
      )}

      {/* Failed Latest Analysis View */}
      {latest?.status === 'failed' && (
        <AnalysisFailureView
          errorMessage={latest.errorMessage}
          analysisId={latest.id}
          branch={latest.branch ?? project.defaultBranch}
          commitSha={latest.commitSha}
          failedAt={latest.completedAt ?? latest.createdAt}
          hasPreviousReport={Boolean(completed)}
          onRetryNewAnalysis={() => analyze.mutate({ slug })}
          onViewPreviousReport={completed ? () => handleSelectHistorical(null) : undefined}
          isRetrying={analyze.isPending}
        />
      )}

      {/* First-Run Experience */}
      {!activeReport && !isRunning && latest?.status !== 'failed' && (
        <AnalysisFirstRun
          repoFullName={project.repoFullName}
          defaultBranch={project.defaultBranch}
          repoPrivate={project.repoPrivate}
          onStartAnalysis={() => analyze.mutate({ slug })}
          isStarting={analyze.isPending}
          startError={analyze.error?.message}
        />
      )}

      {/* Analysis History if no active report */}
      {!activeReport && latest && (
        <AnalysisHistory
          analyses={project.analyses}
          totalCount={project.analysesCount}
          onSelectAnalysis={handleSelectHistorical}
        />
      )}

      {activeReport && (
        <div className="space-y-6">
          {isRunning && (
            <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              Showing the last completed report from {new Date(activeReport.createdAt).toLocaleString()}. A newer scan is still waiting.
            </p>
          )}
          {/* Scan coverage explains what the static analyzer actually inspected. */}
          {coverage && (
            <section className={cn(
              'rounded-xl border p-4 sm:p-5',
              coverage.partial
                ? 'border-amber-500/25 bg-amber-500/[0.04]'
                : 'border-emerald-500/20 bg-emerald-500/[0.025]'
            )} aria-label="Analysis scan coverage">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                  coverage.partial
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                )}>
                  {coverage.partial ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{coverage.partial ? 'Partial scan coverage' : 'Scan coverage'}</h2>
                    <span className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      coverage.partial
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    )}>
                      {coverage.partial ? 'Review limits' : 'Within limits'}
                    </span>
                  </div>
                  <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                    Arbor inspects source statically; it does not execute the application, run tests, or prove that code is safe. {coverage.partial ? 'Some repository content was skipped, so scores describe only the inspected portion.' : 'The configured file and size budgets were not reached.'}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Files parsed</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-foreground">{coverage.parsedFiles ?? 0}<span className="text-muted-foreground"> / {coverage.sourceFiles ?? 0}</span></p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Repository files</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-foreground">{coverage.filesIncluded ?? 0}{coverage.discoveredFilesAtLeast != null && coverage.discoveredFilesAtLeast > (coverage.filesIncluded ?? 0) ? <span className="text-muted-foreground">+ scanned limit</span> : null}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Skipped large files</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-foreground">{coverage.skippedLargeFiles ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Indexed size</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-foreground">{((coverage.repoBytes ?? 0) / (1024 * 1024)).toFixed(1)} MiB</p>
                    </div>
                  </div>
                  {coverage.partial && (
                    <p className="mt-3 text-[11px] leading-relaxed text-amber-200/90">
                      Check the “Partial analysis — review scan coverage” finding for exact parser/file limits and skipped-content details.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Reusable Horizontal Score Row */}
          <ScoreRow scores={scores} running={isRunning} />
          <details className="rounded-lg border border-border/70 bg-card/35 px-3 py-2.5">
            <summary className="cursor-pointer text-xs font-medium text-foreground">How to read these scores</summary>
            <p className="mt-2 max-w-4xl text-xs leading-relaxed text-muted-foreground">
              Scores are deterministic static heuristics based on the source patterns listed in Findings. They are useful for comparing trends within a repository, not as a security certification or a substitute for tests, a production build, runtime profiling, or human review. Performance and security scores cover only the signals Arbor currently measures.
            </p>
          </details>

          {/* Workbench Tabs */}
          <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
            <AnalysisReportNavigation tab={tab} onValueChange={handleTabChange} findingsCount={findings.length} historyCount={project.analyses.length} />

            {/* TAB: Overview */}
            <TabsContent value="overview" className="space-y-6">
              {/* Executive Summary Card (What was inspected, risks, next steps, coverage/reliability) */}
              <Card className="border-border bg-card/60">
                <CardHeader className="py-3 px-4 border-b border-border/80 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Executive Analysis Summary
                    </CardTitle>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {activeReport?.commitSha ? `rev: ${activeReport.commitSha.slice(0, 7)}` : 'latest'} · {new Date(activeReport?.createdAt ?? Date.now()).toLocaleDateString()}
                  </span>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Quadrant 1: What was inspected */}
                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <FileCode className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>What was inspected</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Repository <strong className="text-foreground">{project.repoFullName}</strong> on branch <strong className="font-mono text-foreground">{activeReport?.branch ?? project.defaultBranch}</strong>.
                      Parsed <strong className="font-mono text-foreground">{coverage?.parsedFiles ?? stat('files', 0)}</strong> files across <strong className="font-mono text-foreground">{stat('loc', 0).toLocaleString()}</strong> lines of code ({stack?.framework ?? 'JavaScript/TypeScript'}{stack?.languages?.length ? `, ${stack.languages.slice(0, 3).join(', ')}` : ''}).
                    </p>
                  </div>

                  {/* Quadrant 2: Important Risks */}
                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", criticalFindings.length > 0 ? "text-red-400" : "text-amber-400")} />
                      <span>Most important static risks</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {criticalFindings.length > 0 ? (
                        <>
                          <span className="text-red-400 font-semibold">{criticalFindings.length} critical finding(s)</span> flagged in static rules (e.g., {criticalFindings[0].title}). {warningFindings.length} warnings.
                        </>
                      ) : graphCycles.length > 0 ? (
                        <>
                          No critical security defects. <span className="text-amber-400 font-semibold">{graphCycles.length} circular import cycle(s)</span> couple architectural boundaries.
                        </>
                      ) : warningFindings.length > 0 ? (
                        <>
                          No critical findings detected. <span className="text-amber-400 font-semibold">{warningFindings.length} architectural warning(s)</span> identified for cleanup.
                        </>
                      ) : (
                        <span>No critical static issues or circular import loops detected in inspected code.</span>
                      )}
                    </p>
                  </div>

                  {/* Quadrant 3: What to do first */}
                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>What to fix first</span>
                    </div>
                    {recommendedActions.length > 0 ? (
                      <div className="text-muted-foreground leading-relaxed">
                        <p className="font-medium text-foreground">{recommendedActions[0].title}</p>
                        <p className="text-[11px] truncate font-mono text-muted-foreground">{recommendedActions[0].location}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/90">{recommendedActions[0].remediation}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground leading-relaxed">
                        Maintain current architecture standards and type discipline. Review automated PR checks to catch regressions early.
                      </p>
                    )}
                  </div>

                  {/* Quadrant 4: Coverage & reliability */}
                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                      <span>Report scope &amp; limitations</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {coverage?.partial
                        ? 'Partial scan: size or file budgets were reached, so unparsed files are excluded from scores.'
                        : 'Complete AST analysis within configured budgets.'}
                      {' '}Scores represent heuristic static checks—they do not verify live runtime behavior, simulate database load, or guarantee complete absence of defects.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Executive Architecture Health Snapshot */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="border-border lg:col-span-1">
                  <CardHeader className="py-3 px-4 border-b border-border/80">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Architecture Grade</span>
                      <span className="font-mono text-[11px] text-muted-foreground">Composite</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 flex flex-col justify-between space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-muted/40 font-mono text-3xl font-extrabold tracking-tight text-foreground shadow-sm">
                        {(scores.overall ?? 0) >= 90
                          ? 'A+'
                          : (scores.overall ?? 0) >= 80
                          ? 'A'
                          : (scores.overall ?? 0) >= 70
                          ? 'B'
                          : (scores.overall ?? 0) >= 55
                          ? 'C'
                          : 'D'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-foreground">
                            {(scores.overall ?? 0) >= 85
                              ? 'Strong Static Architecture'
                              : (scores.overall ?? 0) >= 70
                              ? 'Sound Architecture'
                              : (scores.overall ?? 0) >= 55
                              ? 'Technical Debt Warning'
                              : 'High Architectural Risk'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                          Overall Score: {scores.overall ?? '—'}/100
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span>Critical Findings:</span>
                        <span className={cn('font-mono font-semibold', criticalFindings.length > 0 ? 'text-red-400' : 'text-emerald-400')}>
                          {criticalFindings.length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Warnings:</span>
                        <span className={cn('font-mono font-semibold', warningFindings.length > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                          {warningFindings.length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Circular Import Loops:</span>
                        <span className={cn('font-mono font-semibold', graphCycles.length > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                          {graphCycles.length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Key Strengths & Attention Areas */}
                <Card className="border-border lg:col-span-2">
                  <CardHeader className="py-3 px-4 border-b border-border/80">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Executive Architectural Posture
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Architectural Strengths
                      </span>
                      <ul className="space-y-1.5 text-muted-foreground">
                        {graphCycles.length === 0 && (
                          <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400">✓</span>
                            <span>Strict acyclic dependency graph with 0 cyclic import loops</span>
                          </li>
                        )}
                        {stat('anyTypes', 0) <= 5 && (
                          <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400">✓</span>
                            <span>Strong type discipline with minimal escape hatches</span>
                          </li>
                        )}
                        {designSystem?.tokenType && (
                          <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400">✓</span>
                            <span>Configured design token architecture ({designSystem.tokenType})</span>
                          </li>
                        )}
                        {(completed?.metrics?.unusedDeps as string[] | undefined)?.length === 0 && (
                          <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400">✓</span>
                            <span>Zero unused package dependencies detected</span>
                          </li>
                        )}
                        <li className="flex items-start gap-1.5">
                          <span className="text-emerald-400">✓</span>
                          <span>Isolated modular component tree structure</span>
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Focus & Remediation Areas
                      </span>
                      <ul className="space-y-1.5 text-muted-foreground">
                        {criticalFindings.length > 0 ? (
                          <li className="flex items-start gap-1.5 text-red-400">
                            <span>!</span>
                            <span>{criticalFindings.length} critical vulnerability/pattern(s) flagged</span>
                          </li>
                        ) : graphCycles.length > 0 ? (
                          <li className="flex items-start gap-1.5 text-amber-300">
                            <span>!</span>
                            <span>{graphCycles.length} circular import cycle(s) coupling module boundaries</span>
                          </li>
                        ) : null}
                        {(completed?.metrics?.deadExports as string[] | undefined)?.length ? (
                          <li className="flex items-start gap-1.5">
                            <span>•</span>
                            <span>{(completed?.metrics?.deadExports as string[]).length} unused exported symbol(s) candidate for tree-shaking</span>
                          </li>
                        ) : null}
                        {(completed?.metrics?.unusedDeps as string[] | undefined)?.length ? (
                          <li className="flex items-start gap-1.5">
                            <span>•</span>
                            <span>{(completed?.metrics?.unusedDeps as string[]).length} unused dependencies in package.json</span>
                          </li>
                        ) : null}
                        {stat('consoleLogs', 0) > 0 && (
                          <li className="flex items-start gap-1.5">
                            <span>•</span>
                            <span>{stat('consoleLogs', 0)} debug console.log call(s) left in source</span>
                          </li>
                        )}
                        {designSystem && designSystem.hardcodedColors > 0 && (
                          <li className="flex items-start gap-1.5">
                            <span>•</span>
                            <span>{designSystem.hardcodedColors} hardcoded color literals bypassing design tokens</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Scan Diff Since Previous Scan (uses existing comparable trend data) */}
              {project.analyses.filter((a) => a.status === 'completed').length >= 2 && (
                <OverviewScanDiff
                  slug={slug}
                  repoUrl={project.repoUrl}
                  onOpenInsights={() => handleTabChange('insights')}
                />
              )}

              {/* Recommended Actions (Top 5 by Severity & Blast Radius) */}
              {recommendedActions.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="py-3 px-4 border-b border-border/80 flex flex-row items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Recommended actions
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Top {recommendedActions.length} findings ranked deterministically by severity and blast radius · Effort: S (&lt;2h), M (0.5–2d), L (3d+)
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTabChange('findings')}
                      className="h-7 text-xs gap-1 cursor-pointer shrink-0"
                    >
                      <span>View All ({findings.length})</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border/60">
                    {recommendedActions.map((action) => (
                      <div
                        key={`${action.rank}-${action.findingId}-${action.location}`}
                        className="p-3.5 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border/80 bg-muted/40 font-mono text-[10px] font-bold text-foreground">
                            {action.rank}
                          </span>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full shrink-0',
                                  action.severity === 'critical'
                                    ? 'bg-red-500'
                                    : action.severity === 'warning'
                                      ? 'bg-amber-400'
                                      : 'bg-sky-400'
                                )}
                              />
                              <span className="text-xs font-semibold text-label-primary">{action.title}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/70 text-label-secondary uppercase">
                                {action.category}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-label-secondary">
                                {action.blastRadiusLabel}
                              </span>
                            </div>
                            <p className="text-xs text-label-secondary">{action.remediation}</p>
                            <p className="text-[11px] font-mono text-label-tertiary">{action.location}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            title="Rough remediation effort estimate (S/M/L)"
                            className={cn(
                              'inline-flex h-6 min-w-6 items-center justify-center rounded border px-1.5 font-mono text-[11px] font-bold',
                              action.effort === 'L'
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                                : action.effort === 'M'
                                  ? 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            )}
                          >
                            {action.effort}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTabChange('findings')}
                            className="h-7 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            Inspect
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Ranked Code Hotspots (Git Log Churn × AST Complexity) */}
              <HotspotTable
                rawHotspots={completed?.metrics?.hotspots}
                repoUrl={project.repoUrl}
                commitSha={completed?.commitSha}
              />

              {/* Ownership Map & Top-Level Directory Bus Factor */}
              <OwnershipMapCard
                rawOwnership={completed?.metrics?.ownership}
                repoUrl={project.repoUrl}
                commitSha={completed?.commitSha}
              />

              {/* Categorized Tech Stack */}
              {stackItems.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="py-3 px-4 border-b border-border/80">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Detected Tech Stack & Tooling
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <TechStackGroup items={stackItems} />
                  </CardContent>
                </Card>
              )}

              {/* Structured 4-Pillar Codebase Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Scale & Structure */}
                <Card className="border-border">
                  <CardHeader className="py-2.5 px-3.5 border-b border-border/80">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-label-secondary flex items-center justify-between">
                      <span>Scale & Density</span>
                      <FileCode className="h-3.5 w-3.5 text-label-tertiary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Source Files</span>
                      <span className="font-semibold text-foreground">{stat('files', 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Lines of Code</span>
                      <span className="font-semibold text-foreground">{stat('loc', 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Avg File Lines</span>
                      <span className="font-semibold text-foreground">{(structure?.avgFileLines as number | undefined) ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Top-level Dirs</span>
                      <span className="font-semibold text-foreground">{(structure?.topLevelDirs as string[] | undefined)?.length ?? 0}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Component Architecture */}
                <Card className="border-border">
                  <CardHeader className="py-2.5 px-3.5 border-b border-border/80">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-label-secondary flex items-center justify-between">
                      <span>Component Arch</span>
                      <Layers className="h-3.5 w-3.5 text-label-tertiary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Total Components</span>
                      <span className="font-semibold text-foreground">{stat('components', 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Server Components</span>
                      <span className="font-semibold text-foreground">{stat('serverComponents', 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Client Components</span>
                      <span className="font-semibold text-foreground">{stat('clientComponents', 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Custom Hooks</span>
                      <span className="font-semibold text-foreground">{stat('hooks', 0)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Code Hygiene & Debt */}
                <Card className="border-border">
                  <CardHeader className="py-2.5 px-3.5 border-b border-border/80">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-label-secondary flex items-center justify-between">
                      <span>Hygiene & Debt</span>
                      <AlertTriangle className="h-3.5 w-3.5 text-label-tertiary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Any Types</span>
                      <span className={cn('font-semibold', stat('anyTypes', 0) > 10 ? 'text-amber-400' : 'text-foreground')}>
                        {stat('anyTypes', 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Console Logs</span>
                      <span className={cn('font-semibold', stat('consoleLogs', 0) > 5 ? 'text-amber-400' : 'text-foreground')}>
                        {stat('consoleLogs', 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">TODO Markers</span>
                      <span className="font-semibold text-foreground">{stat('todos', 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Dead Exports</span>
                      <span className="font-semibold text-foreground">
                        {Array.isArray(completed?.metrics?.deadExports) ? completed.metrics.deadExports.length : 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Design System & Tokens */}
                <Card className="border-border">
                  <CardHeader className="py-2.5 px-3.5 border-b border-border/80">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-label-secondary flex items-center justify-between">
                      <span>Design System</span>
                      <Boxes className="h-3.5 w-3.5 text-label-tertiary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Component Files</span>
                      <span className="font-semibold text-foreground">{designSystem?.componentFiles ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Design Tokens</span>
                      <span className="font-semibold text-foreground">{designSystem?.tokenType ?? 'None'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Hardcoded Colors</span>
                      <span className={cn('font-semibold', (designSystem?.hardcodedColors ?? 0) > 0 ? 'text-amber-400' : 'text-foreground')}>
                        {designSystem?.hardcodedColors ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px] font-sans">Variant Adoption</span>
                      <span className="font-semibold text-foreground">
                        {designSystem && designSystem.componentFiles > 0
                          ? `${Math.round((designSystem.variantComponents / designSystem.componentFiles) * 100)}%`
                          : '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Repository Structure */}
              {structure && (
                <Card className="border-border">
                  <CardHeader className="py-3 px-4 border-b border-border/80">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Repository Tree & Directory Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-xs">
                    <div className="flex flex-wrap gap-4 text-muted-foreground pb-2">
                      <span>
                        Top-level directories:{' '}
                        <strong className="text-foreground font-mono">
                          {(structure.topLevelDirs as string[] | undefined)?.slice(0, 8).join(', ') ?? '—'}
                        </strong>
                      </span>
                      <span>
                        Average file length:{' '}
                        <strong className="text-foreground font-mono">
                          {(structure.avgFileLines as number | undefined) ?? '—'} lines
                        </strong>
                      </span>
                    </div>

                    <StructureTree nodes={(structure.tree as StructureNode[] | undefined) ?? []} />
                  </CardContent>
                </Card>
              )}

              {/* Circular Dependencies warning */}
              {graphCycles.length > 0 && (
                <Card className="border-amber-500/40 bg-amber-500/5">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      {graphCycles.length} Circular Import Cycle(s) Detected
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-1 font-mono text-xs text-amber-300">
                    {graphCycles.slice(0, 5).map((c, i) => (
                      <p key={i} className="truncate">
                        {c.join(' → ')}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB: Architecture (React Flow) */}
            <TabsContent value="architecture" className="space-y-4">
              {moduleGraph ? (
                <Card className="border-border">
                  <CardHeader className="py-3 px-4 border-b border-border/80">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Module Architecture Visualizer
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Dependency graph derived from static AST imports grouped by architectural boundaries.
                    </CardDescription>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span>Nodes: Modules &amp; directories sized by file count</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3 bg-muted-foreground/60" />
                        <span>Arrows: Static import dependencies</span>
                      </span>
                      {graphCycles.length > 0 && (
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <span className="h-0.5 w-3 bg-amber-400" />
                          <span>Highlighted: Circular import cycle</span>
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <GraphCanvas graph={moduleGraph} />
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center text-xs text-muted-foreground">
                    No import graph data available for this analysis.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB: Findings */}
            <TabsContent value="findings" className="space-y-4">
              {findings.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-2">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                    <p className="text-sm font-semibold text-foreground">No findings detected</p>
                    <p className="max-w-md mx-auto">
                      Inspected files satisfied all current static rules. No critical vulnerabilities, circular imports, or hygiene violations were found in this revision.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Filter Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Severity Filters */}
                      <div className="flex items-center rounded-md border border-border bg-background/60 p-0.5 text-xs">
                        <Button
                          variant={severityFilter === 'all' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setSeverityFilter('all')}
                          className="h-7 text-xs font-medium px-2.5"
                        >
                          All ({activeFindings.length})
                        </Button>
                        <Button
                          variant={severityFilter === 'critical' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setSeverityFilter('critical')}
                          className={cn('h-7 text-xs font-medium px-2.5 gap-1', criticalFindings.length > 0 && 'text-red-400')}
                        >
                          Critical ({criticalFindings.length})
                        </Button>
                        <Button
                          variant={severityFilter === 'warning' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setSeverityFilter('warning')}
                          className={cn('h-7 text-xs font-medium px-2.5 gap-1', warningFindings.length > 0 && 'text-amber-400')}
                        >
                          Warnings ({warningFindings.length})
                        </Button>
                        <Button
                          variant={severityFilter === 'info' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setSeverityFilter('info')}
                          className="h-7 text-xs font-medium px-2.5"
                        >
                          Info ({infoFindings.length})
                        </Button>
                      </div>

                      {/* Category Filter */}
                      {availableCategories.length > 0 && (
                        <select
                          value={categoryFilter}
                          aria-label="Filter findings by category"
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="all">All Categories</option>
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Search and Reset */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search title, file, or rule…"
                          value={findingSearch}
                          onChange={(e) => setFindingSearch(e.target.value)}
                          className="h-8 w-48 pl-8 text-xs sm:w-64"
                        />
                      </div>
                      {(severityFilter !== 'all' || categoryFilter !== 'all' || findingSearch.trim() !== '') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSeverityFilter('all')
                            setCategoryFilter('all')
                            setFindingSearch('')
                          }}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Filtered Empty State */}
                  {filteredFindings.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-3">
                        <Search className="h-6 w-6 mx-auto text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">No findings match active filters</p>
                        <p className="max-w-md mx-auto">
                          None of the {activeFindings.length} findings matched your severity, category, or search criteria.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSeverityFilter('all')
                            setCategoryFilter('all')
                            setFindingSearch('')
                          }}
                        >
                          Clear filters
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-6">
                      {/* Critical Findings */}
                      {filteredFindings.some((f) => f.severity === 'critical') && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            Critical Findings ({filteredFindings.filter((f) => f.severity === 'critical').length})
                          </h3>
                          <div className="divide-y divide-border/60 rounded-md border border-border/80 bg-card">
                            {filteredFindings
                              .filter((f) => f.severity === 'critical')
                              .map((f, idx) => (
                                <FindingItem
                                  key={`${f.id}-${f.file ?? ''}-${f.line ?? ''}-${idx}`}
                                  finding={f}
                                  repoUrl={project.repoUrl}
                                  commitSha={activeReport?.commitSha}
                                  projectSlug={slug}
                                  analysisId={activeReport?.id}
                                />
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Warning Findings */}
                      {filteredFindings.some((f) => f.severity === 'warning') && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            Warnings ({filteredFindings.filter((f) => f.severity === 'warning').length})
                          </h3>
                          <div className="divide-y divide-border/60 rounded-md border border-border/80 bg-card">
                            {filteredFindings
                              .filter((f) => f.severity === 'warning')
                              .map((f, idx) => (
                                <FindingItem
                                  key={`${f.id}-${f.file ?? ''}-${f.line ?? ''}-${idx}`}
                                  finding={f}
                                  repoUrl={project.repoUrl}
                                  commitSha={activeReport?.commitSha}
                                  projectSlug={slug}
                                  analysisId={activeReport?.id}
                                />
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Info Findings */}
                      {filteredFindings.some((f) => f.severity === 'info') && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-sky-400" />
                            Suggestions &amp; Info ({filteredFindings.filter((f) => f.severity === 'info').length})
                          </h3>
                          <div className="divide-y divide-border/60 rounded-md border border-border/80 bg-card">
                            {filteredFindings
                              .filter((f) => f.severity === 'info')
                              .map((f, idx) => (
                                <FindingItem
                                  key={`${f.id}-${f.file ?? ''}-${f.line ?? ''}-${idx}`}
                                  finding={f}
                                  repoUrl={project.repoUrl}
                                  commitSha={activeReport?.commitSha}
                                  projectSlug={slug}
                                  analysisId={activeReport?.id}
                                />
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Policy-Suppressed Findings Collapsible */}
                  {suppressedFindings.length > 0 && (
                    <details className="group rounded-lg border border-border/80 bg-muted/20 p-3.5 text-xs text-muted-foreground">
                      <summary className="flex cursor-pointer items-center justify-between font-medium text-foreground hover:text-primary">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          <span>Policy-Suppressed Findings ({suppressedFindings.length})</span>
                        </div>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          Excluded by workspace policy rules
                        </span>
                      </summary>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        These findings were identified during static analysis but marked suppressed according to your team&apos;s active policy rules. They are preserved for audit visibility.
                      </p>
                      <div className="mt-3 divide-y divide-border/60 rounded-md border border-border/80 bg-card">
                        {suppressedFindings.map((f, idx) => (
                          <FindingItem
                            key={`suppressed-${f.id}-${f.file ?? ''}-${f.line ?? ''}-${idx}`}
                            finding={f}
                            repoUrl={project.repoUrl}
                            commitSha={activeReport?.commitSha}
                            projectSlug={slug}
                            analysisId={activeReport?.id}
                          />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB: Environment */}
            <TabsContent value="environment" className="space-y-4">
              <EnvironmentMatrix slug={slug} />
            </TabsContent>

            {/* TAB: API Explorer */}
            <TabsContent value="api" className="space-y-4">
              <ApiExplorer slug={slug} />
            </TabsContent>

            {/* TAB: Docs */}
            <TabsContent value="docs" className="space-y-4">
              <DocHub slug={slug} />
            </TabsContent>

            {/* TAB: Health */}
            <TabsContent value="health" className="space-y-4">
              <ProjectHealthView slug={slug} />
            </TabsContent>

            {/* TAB: Commits & Activity */}
            <TabsContent value="commits" className="space-y-4">
              <CommitTimeline slug={slug} />
            </TabsContent>

            {/* TAB: Insights, sharing, and recoverable scheduled scans */}
            <TabsContent value="insights" className="space-y-4">
              <TrendView slug={slug} repoUrl={project.repoUrl} />
              <div className="grid gap-4 xl:grid-cols-2">
                <ScheduleControls slug={slug} defaultBranch={project.defaultBranch} />
                {activeReport ? (
                  <ShareReportControl slug={slug} analysisId={activeReport.id} />
                ) : (
                  <Card className="border-dashed"><CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-muted-foreground"><Link2 className="h-5 w-5 text-primary/70" /><p className="font-medium text-foreground">Complete a scan to share a report</p><p>Read-only links are pinned to a completed analysis snapshot.</p></CardContent></Card>
                )}
              </div>
            </TabsContent>

            {/* TAB: Dependency inventory and CycloneDX SBOM */}
            <TabsContent value="dependencies" className="space-y-4">
              <SupplyChainView slug={slug} />
            </TabsContent>

            {/* TAB: Versioned policy packs */}
            <TabsContent value="policies" className="space-y-4">
              <PolicyControls slug={slug} />
            </TabsContent>

            {/* TAB: GitHub pull-request health checks */}
            <TabsContent value="pull-requests" className="space-y-4">
              <PullRequestChecksView slug={slug} />
            </TabsContent>

            {/* TAB: History */}
            <TabsContent value="history" className="space-y-4">
              <AnalysisHistory
                analyses={project.analyses}
                totalCount={project.analysesCount}
                selectedAnalysisId={activeReport?.id}
                onSelectAnalysis={handleSelectHistorical}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

function StructureTree({ nodes }: { nodes: StructureNode[] }) {
  return (
    <ul className="mt-3 space-y-0.5 font-mono text-xs">
      {nodes.map((n) =>
        n.type === 'dir' ? (
          <li key={n.name}>
            <details>
              <summary className="cursor-pointer list-none marker:hidden py-0.5 hover:text-foreground">
                <span className="text-muted-foreground">▸</span>{' '}
                <span className="font-semibold text-foreground/90">{n.name}/</span>
              </summary>
              <div className="ml-3 border-l border-border pl-3">
                <StructureTree nodes={n.children ?? []} />
              </div>
            </details>
          </li>
        ) : (
          <li key={n.name} className="flex justify-between gap-4 py-0.5 text-muted-foreground hover:text-foreground">
            <span>{n.name}</span>
            {n.lines != null && <span>{n.lines} ln</span>}
          </li>
        )
      )}
    </ul>
  )
}