'use client'

import { useRouter } from 'next/navigation'
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
  Sparkles,
  Globe,
  BookOpen,
  Activity,
  GitCommit,
} from 'lucide-react'
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
  analyses: AnalysisRow[]
}

const RUNNING_STATUSES = ['queued', 'cloning', 'analyzing']

export function ProjectReport({ slug, project }: { slug: string; project: ProjectRow }) {
  const router = useRouter()
  const [tab, setTab] = useState('overview')

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

  const completed = useMemo(
    () => project.analyses.find((a) => a.status === 'completed'),
    [project.analyses]
  )

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
              Arbor clones the repository shallowly, parses your files using an AST engine, detects frameworks, imports, and debt, and scores your architecture in under 30 seconds.
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
          {/* Reusable Horizontal Score Row */}
          <ScoreRow scores={scores} running={isRunning} />

          {/* Workbench Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
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
                <TabsTrigger value="history" className="text-xs gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  History ({project.analyses.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB: Overview */}
            <TabsContent value="overview" className="space-y-4">
              {/* Tech stack badges */}
              {stackItems.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="py-3 px-4 border-b border-border/80">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Detected Tech Stack
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <TechStackGroup items={stackItems} />
                  </CardContent>
                </Card>
              )}

              {/* Codebase statistics */}
              <Card className="border-border">
                <CardHeader className="py-3 px-4 border-b border-border/80">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Codebase Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[11px]">Files</span>
                      <p className="mt-1 font-semibold text-foreground">{stat('files', 0)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[11px]">LOC</span>
                      <p className="mt-1 font-semibold text-foreground">{stat('loc', 0)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[11px]">Components</span>
                      <p className="mt-1 font-semibold text-foreground">{stat('components', 0)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[11px]">Hooks</span>
                      <p className="mt-1 font-semibold text-foreground">{stat('hooks', 0)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[11px]">Client Components</span>
                      <p className="mt-1 font-semibold text-foreground">{stat('clientComponents', 0)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[11px]">Server Components</span>
                      <p className="mt-1 font-semibold text-foreground">{stat('serverComponents', 0)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[11px]">Any Types</span>
                      <p className="mt-1 font-semibold text-foreground">{stat('anyTypes', 0)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[11px]">Console Logs</span>
                      <p className="mt-1 font-semibold text-foreground">{stat('consoleLogs', 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Design System metrics if present */}
              {designSystem && designSystem.componentFiles > 0 && (
                <Card className="border-border">
                  <CardHeader className="py-3 px-4 border-b border-border/80">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Design System Audit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                      <div className="rounded-md border border-border/60 p-2.5">
                        <span className="text-muted-foreground text-[11px]">Component Files</span>
                        <p className="mt-1 font-semibold text-foreground">{designSystem.componentFiles}</p>
                      </div>
                      <div className="rounded-md border border-border/60 p-2.5">
                        <span className="text-muted-foreground text-[11px]">Tokens</span>
                        <p className="mt-1 font-semibold text-foreground">{designSystem.tokenType ?? 'none'}</p>
                      </div>
                      <div className="rounded-md border border-border/60 p-2.5">
                        <span className="text-muted-foreground text-[11px]">Hardcoded Colors</span>
                        <p className="mt-1 font-semibold text-foreground">{designSystem.hardcodedColors}</p>
                      </div>
                      <div className="rounded-md border border-border/60 p-2.5">
                        <span className="text-muted-foreground text-[11px]">Variant Components</span>
                        <p className="mt-1 font-semibold text-foreground">{designSystem.variantComponents}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Structure Tree */}
              {structure && (
                <Card className="border-border">
                  <CardHeader className="py-3 px-4 border-b border-border/80">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Repository Structure
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