'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Check,
  Code2,
  Copy,
  Download,
  FileCode,
  FileText,
  History,
  Layers,
  Loader2,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  Globe,
  BookOpen,
  Activity,
  GitCommit,
  TrendingUp,
  PackageSearch,
  SlidersHorizontal,
  Link2,
  GitPullRequest,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
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
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import GraphCanvas from '@/components/dashboard/architecture/graph-canvas'
import { buildModuleGraph } from '@/components/dashboard/architecture/module-graph'
import { EnvironmentMatrix } from '@/components/dashboard/environment-matrix'
import { ApiExplorer } from '@/components/dashboard/api-explorer'
import { DocHub } from '@/components/dashboard/docs/doc-hub'
import { ProjectHealthView } from '@/components/dashboard/health/project-health-view'
import { CommitTimeline } from '@/components/dashboard/commits/commit-timeline'
import { ScoreRow, AuditScores } from '@/components/dashboard/score-row'
import { ScoreBadge } from '@/components/dashboard/score-badge'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { TechStackGroup } from '@/components/dashboard/tech-stack-badge'
import { FindingItem, FindingData } from '@/components/dashboard/finding-item'
import { PolicyControls } from '@/components/dashboard/policy-controls'
import { PullRequestChecksView, ScheduleControls, ShareReportControl, SupplyChainView, TrendView } from '@/components/dashboard/analysis-tools'

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
>

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
}

const RUNNING_STATUSES = ['queued', 'cloning', 'analyzing']

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

export function ProjectReport({ slug, project }: { slug: string; project: ProjectRow }) {
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
  const isRunning = latest ? RUNNING_STATUSES.includes(latest.status) : false

  const analyze = trpc.project.analyze.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => window.alert(e.message),
  })

  // Poll while analysis is actively in flight
  useEffect(() => {
    if (!isRunning) return
    const interval = window.setTimeout(() => router.refresh(), 2500)
    return () => window.clearTimeout(interval)
  }, [isRunning, router, latest?.status])

  const completed = project.latestCompletedAnalysis

  const [copied, setCopied] = useState(false)

  const handleExportMarkdown = () => {
    if (!completed) return
    const md = generateMarkdownReport(project, completed)
    const filename = `${project.slug}-analysis-${new Date(completed.createdAt).toISOString().slice(0, 10)}.md`
    downloadFile(filename, md, 'text/markdown')
  }

  const handleExportJson = () => {
    if (!completed) return
    const json = generateJsonReport(project, completed)
    const filename = `${project.slug}-analysis-${new Date(completed.createdAt).toISOString().slice(0, 10)}.json`
    downloadFile(filename, json, 'application/json')
  }

  const handleCopyMarkdown = async () => {
    if (!completed) return
    const md = generateMarkdownReport(project, completed)
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [copiedBadge, setCopiedBadge] = useState(false)

  const handleCopyBadgeMarkdown = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    const badgeMd = `[![Arbor Architecture](${origin}/api/badge/${project.slug})](${origin}/projects/${project.slug})`
    await navigator.clipboard.writeText(badgeMd)
    setCopiedBadge(true)
    setTimeout(() => setCopiedBadge(false), 2000)
  }

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

  const stack = completed?.techStack ?? project.detectedStack ?? null
  const metrics = completed?.metrics ?? null
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
  const structure = completed?.structure ?? null
  const findings = completed?.findings ?? []

  const graphCycles = useMemo(
    () => (completed?.metrics?.circularDeps as string[][] | undefined) ?? [],
    [completed?.metrics?.circularDeps]
  )

  const moduleGraph = useMemo(() => {
    const g = completed?.dependencyGraph
    if (!g || !Array.isArray(g.nodes)) return null
    return buildModuleGraph({ nodes: g.nodes, edges: g.edges ?? [] }, graphCycles)
  }, [completed?.dependencyGraph, graphCycles])

  const designSystem = completed?.designSystem as
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
  const criticalFindings = findings.filter((f) => f.severity === 'critical')
  const warningFindings = findings.filter((f) => f.severity === 'warning')
  const infoFindings = findings.filter((f) => f.severity === 'info')

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
            status={isRunning ? latest?.status ?? 'running' : latest?.status ?? 'no-analysis'}
          />
          {completed?.durationMs && (
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(completed.durationMs / 1000)}s duration
            </span>
          )}
          {completed?.commitSha && (
            <span className="font-mono text-xs text-muted-foreground">
              commit: {completed.commitSha.slice(0, 7)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {completed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Report</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleExportMarkdown} className="gap-2.5 text-xs cursor-pointer py-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Markdown Report (.md)</span>
                    <span className="text-[10px] text-muted-foreground">Formatted summary & findings</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJson} className="gap-2.5 text-xs cursor-pointer py-2">
                  <FileCode className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">Raw Payload (.json)</span>
                    <span className="text-[10px] text-muted-foreground">Complete AST audit data</span>
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
                <DropdownMenuItem onClick={handleCopyBadgeMarkdown} className="gap-2.5 text-xs cursor-pointer py-1.5">
                  {copiedBadge ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium">{copiedBadge ? 'Badge Markdown Copied!' : 'Copy README Badge'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            size="sm"
            disabled={isRunning || analyze.isPending}
            onClick={() => analyze.mutate({ slug })}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            {isRunning || analyze.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>{latest ? 'Re-analyze' : 'Run First Analysis'}</span>
          </Button>
        </div>
      </div>

      {latest?.status === 'failed' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-400">
          <p className="font-semibold">Analysis Failed</p>
          <p className="mt-1 font-mono">{latest.errorMessage ?? 'An error occurred during analysis.'}</p>
        </div>
      )}

      {!completed && !isRunning && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground text-sm">No analysis completed yet.</p>
            <p className="max-w-md mx-auto">
              Arbor shallow-clones the repository, then uses AST and rule-based checks to map its structure, dependencies, and health. Processing time varies with repository size and conditions.
            </p>
            <div className="pt-2">
              <Button
                size="sm"
                onClick={() => analyze.mutate({ slug })}
                disabled={analyze.isPending}
                className="gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start Analysis</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(completed || isRunning) && (
        <div className="space-y-6">
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
            <div className="overflow-x-auto pb-1 scrollbar-none">
              <TabsList className="h-9 w-max justify-start">
                <TabsTrigger value="overview" className="text-xs gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="architecture" className="text-xs gap-1.5">
                  <Boxes className="h-3.5 w-3.5" />
                  Architecture
                </TabsTrigger>
                <TabsTrigger value="findings" className="text-xs gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Findings ({findings.length})
                </TabsTrigger>
                <TabsTrigger value="environment" className="text-xs gap-1.5">
                  <FileCode className="h-3.5 w-3.5" />
                  Environment
                </TabsTrigger>
                <TabsTrigger value="api" className="text-xs gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  API
                </TabsTrigger>
                <TabsTrigger value="docs" className="text-xs gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Docs
                </TabsTrigger>
                <TabsTrigger value="health" className="text-xs gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Health
                </TabsTrigger>
                <TabsTrigger value="commits" className="text-xs gap-1.5">
                  <GitCommit className="h-3.5 w-3.5" />
                  Commits
                </TabsTrigger>
                <TabsTrigger value="insights" className="text-xs gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Insights
                </TabsTrigger>
                <TabsTrigger value="dependencies" className="text-xs gap-1.5">
                  <PackageSearch className="h-3.5 w-3.5" />
                  Dependencies
                </TabsTrigger>
                <TabsTrigger value="policies" className="text-xs gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Policies
                </TabsTrigger>
                <TabsTrigger value="pull-requests" className="text-xs gap-1.5">
                  <GitPullRequest className="h-3.5 w-3.5" />
                  Pull requests
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  History ({project.analyses.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB: Overview */}
            <TabsContent value="overview" className="space-y-6">
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
                              ? 'Production Grade'
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

              {/* Priority Action Items */}
              {findings.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="py-3 px-4 border-b border-border/80 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Top Actionable Recommendations
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        High-priority architectural findings requiring engineering attention
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTabChange('findings')}
                      className="h-7 text-xs gap-1 cursor-pointer"
                    >
                      <span>View All ({findings.length})</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border/60">
                    {[...criticalFindings, ...warningFindings].slice(0, 3).map((f) => (
                      <div key={f.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className={cn(
                              'mt-0.5 h-2 w-2 rounded-full shrink-0',
                              f.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'
                            )}
                          />
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground truncate">{f.title}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-border/70 text-muted-foreground uppercase">
                                {f.category}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{f.detail}</p>
                            {f.file && (
                              <p className="text-[11px] font-mono text-muted-foreground/80">{f.file}{f.line ? `:${f.line}` : ''}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTabChange('findings')}
                          className="h-7 text-[11px] shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Inspect
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

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
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Scale & Density</span>
                      <FileCode className="h-3.5 w-3.5 text-muted-foreground/70" />
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
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Component Arch</span>
                      <Layers className="h-3.5 w-3.5 text-muted-foreground/70" />
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
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Hygiene & Debt</span>
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground/70" />
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
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Design System</span>
                      <Boxes className="h-3.5 w-3.5 text-muted-foreground/70" />
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
                  <CardContent className="py-12 text-center text-xs text-muted-foreground">
                    No findings detected. Clean repository!
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {criticalFindings.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Critical ({criticalFindings.length})
                      </h3>
                      <div className="divide-y divide-border/60 rounded-md border border-border/80 bg-card">
                        {criticalFindings.map((f) => (
                          <FindingItem
                            key={f.id}
                            finding={f}
                            repoUrl={project.repoUrl}
                            commitSha={completed?.commitSha}
                            projectSlug={slug}
                            analysisId={completed?.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {warningFindings.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Warnings ({warningFindings.length})
                      </h3>
                      <div className="divide-y divide-border/60 rounded-md border border-border/80 bg-card">
                        {warningFindings.map((f) => (
                          <FindingItem
                            key={f.id}
                            finding={f}
                            repoUrl={project.repoUrl}
                            commitSha={completed?.commitSha}
                            projectSlug={slug}
                            analysisId={completed?.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {infoFindings.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-sky-400" />
                        Info ({infoFindings.length})
                      </h3>
                      <div className="divide-y divide-border/60 rounded-md border border-border/80 bg-card">
                        {infoFindings.map((f) => (
                          <FindingItem
                            key={f.id}
                            finding={f}
                            repoUrl={project.repoUrl}
                            commitSha={completed?.commitSha}
                            projectSlug={slug}
                            analysisId={completed?.id}
                          />
                        ))}
                      </div>
                    </div>
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
              <TrendView slug={slug} />
              <div className="grid gap-4 xl:grid-cols-2">
                <ScheduleControls slug={slug} defaultBranch={project.defaultBranch} />
                {completed ? (
                  <ShareReportControl slug={slug} analysisId={completed.id} />
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
              <Card className="border-border">
                <CardHeader className="py-3 px-4 border-b border-border/80">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Historical Analysis Runs
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2.5 px-4 font-medium">Timestamp</th>
                        <th className="py-2.5 px-4 font-medium">Status</th>
                        <th className="py-2.5 px-4 font-medium">Score</th>
                        <th className="py-2.5 px-4 font-medium">Branch</th>
                        <th className="py-2.5 px-4 font-medium">Commit</th>
                        <th className="py-2.5 px-4 font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono">
                      {project.analyses.map((a) => (
                        <tr key={a.id} className="transition-colors hover:bg-muted/40">
                          <td className="py-2.5 px-4 font-sans text-foreground">
                            {new Date(a.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4">
                            <StatusBadge status={a.status} showSpinner={false} />
                          </td>
                          <td className="py-2.5 px-4">
                            <ScoreBadge score={a.overallScore} size="sm" />
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">{a.branch}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {a.commitSha?.slice(0, 7) ?? '—'}
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {a.durationMs ? `${Math.round(a.durationMs / 1000)}s` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
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