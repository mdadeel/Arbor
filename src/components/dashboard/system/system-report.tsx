'use client'

import React, { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ExternalLink,
  FileCode,
  Globe,
  Layers,
  Loader2,
  Network,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScoreBadge } from '@/components/dashboard/score-badge'
import { TechStackGroup } from '@/components/dashboard/tech-stack-badge'
import { ContractMatrix } from './contract-matrix'
import { FullstackGraph } from './fullstack-graph'
import type { SystemAnalysisReport, ContractItem, SystemGraphResult, EnvParityResult } from '@/server/services/system-analysis'

interface MemberProject {
  id: string
  name: string
  slug: string
  repoFullName: string
  defaultBranch: string
  latestScores?: unknown
  detectedStack?: unknown
}

interface MemberGroupItem {
  id: string
  role: string
  apiPrefix?: string | null
  project: MemberProject
}

interface SystemReportProps {
  group: {
    id: string
    name: string
    slug: string
    description?: string | null
    latestScore?: number | null
    systemData?: unknown
    members: MemberGroupItem[]
    analyses: Array<{
      id: string
      status: string
      overallScore?: number | null
      contractScore?: number | null
      envScore?: number | null
      frontendScore?: number | null
      backendScore?: number | null
      contractMatrix?: unknown
      envDrift?: unknown
      systemGraph?: unknown
      findings?: unknown
      durationMs?: number | null
      createdAt: string | Date
    }>
  }
}

const VALID_SYSTEM_TABS = ['overview', 'contracts', 'architecture', 'env', 'findings']

export function SystemReport({ group }: SystemReportProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeTabParam = searchParams.get('tab')
  const initialTab =
    activeTabParam && VALID_SYSTEM_TABS.includes(activeTabParam) ? activeTabParam : 'overview'
  const [tab, setTab] = useState(initialTab)

  useEffect(() => {
    const currentParam = searchParams.get('tab')
    if (currentParam && VALID_SYSTEM_TABS.includes(currentParam) && currentParam !== tab) {
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

  const latestAnalysis = group.analyses[0]

  const analyze = trpc.system.analyze.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => window.alert(e.message),
  })

  // Parsed artifacts
  const contractMatrix = (latestAnalysis?.contractMatrix as {
    total: number
    connected: number
    broken: number
    orphaned: number
    methodMismatch: number
    items: ContractItem[]
  } | null) ?? {
    total: 0,
    connected: 0,
    broken: 0,
    orphaned: 0,
    methodMismatch: 0,
    items: [],
  }

  const envDrift = (latestAnalysis?.envDrift as EnvParityResult | null) ?? {
    score: 100,
    issues: [],
  }

  const systemGraph = (latestAnalysis?.systemGraph as SystemGraphResult | null) ?? {
    nodes: [],
    edges: [],
  }

  const findings = (latestAnalysis?.findings as Array<{
    id: string
    category: string
    severity: 'critical' | 'warning' | 'info'
    title: string
    detail: string
    file?: string
    line?: number
  }> | null) ?? []

  const frontendMember = group.members.find((m) => m.role === 'frontend') ?? group.members[0]
  const backendMember = group.members.find((m) => m.role === 'backend') ?? group.members[1]

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary gap-1.5 text-xs font-mono py-1">
            <Network className="h-3.5 w-3.5" />
            <span>Fullstack System Group</span>
          </Badge>

          {latestAnalysis?.durationMs && (
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(latestAnalysis.durationMs / 1000)}s analysis duration
            </span>
          )}
        </div>

        <Button
          size="sm"
          disabled={analyze.isPending}
          onClick={() => analyze.mutate({ slug: group.slug })}
          className="h-8 gap-1.5 text-xs font-medium"
        >
          {analyze.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span>Re-analyze System</span>
        </Button>
      </div>

      {/* System Scores Matrix */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-5">
        {/* Overall System Score */}
        <div className="flex flex-col justify-between p-3.5 bg-accent/25 col-span-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>System Score</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1 font-mono">
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {latestAnalysis?.overallScore ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">/100</span>
          </div>
        </div>

        {/* Frontend Subscore */}
        <div className="flex flex-col justify-between p-3.5 bg-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
            Client Layer
          </div>
          <div className="mt-2 flex items-baseline gap-1 font-mono">
            <span className="text-2xl font-bold tracking-tight text-cyan-400">
              {latestAnalysis?.frontendScore ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">/100</span>
          </div>
        </div>

        {/* Backend Subscore */}
        <div className="flex flex-col justify-between p-3.5 bg-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
            Server Layer
          </div>
          <div className="mt-2 flex items-baseline gap-1 font-mono">
            <span className="text-2xl font-bold tracking-tight text-emerald-400">
              {latestAnalysis?.backendScore ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">/100</span>
          </div>
        </div>

        {/* API Contract Score */}
        <div className="flex flex-col justify-between p-3.5 bg-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
            API Contracts
          </div>
          <div className="mt-2 flex items-baseline gap-1 font-mono">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {latestAnalysis?.contractScore ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">/100</span>
          </div>
        </div>

        {/* Env Parity Score */}
        <div className="flex flex-col justify-between p-3.5 bg-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
            Env Parity
          </div>
          <div className="mt-2 flex items-baseline gap-1 font-mono">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {latestAnalysis?.envScore ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">/100</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <TabsList className="h-9 w-max justify-start">
            <TabsTrigger value="overview" className="text-xs gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="contracts" className="text-xs gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              API Contracts ({contractMatrix.total})
            </TabsTrigger>
            <TabsTrigger value="architecture" className="text-xs gap-1.5">
              <Boxes className="h-3.5 w-3.5" />
              Fullstack Architecture
            </TabsTrigger>
            <TabsTrigger value="env" className="text-xs gap-1.5">
              <FileCode className="h-3.5 w-3.5" />
              Environment Parity ({envDrift.issues.length})
            </TabsTrigger>
            <TabsTrigger value="findings" className="text-xs gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              System Findings ({findings.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB: Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Frontend Member Card */}
            {frontendMember && (
              <Card className="border-border">
                <CardHeader className="py-3 px-4 border-b border-border/80 flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Frontend / Client Service
                      </CardTitle>
                    </div>
                    <p className="mt-1 font-semibold text-foreground text-sm">
                      {frontendMember.project.name}
                    </p>
                  </div>
                  <ScoreBadge
                    score={
                      (frontendMember.project.latestScores as { overall?: number } | null)?.overall ??
                      ((frontendMember.project as { healthData?: { score?: number } | null }).healthData)?.score
                    }
                    size="sm"
                  />
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <p className="font-mono text-xs text-muted-foreground">
                    {frontendMember.project.repoFullName}
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5">
                    <Link href={`/projects/${frontendMember.project.slug}`}>
                      <span>View Client Audit</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Backend Member Card */}
            {backendMember && (
              <Card className="border-border">
                <CardHeader className="py-3 px-4 border-b border-border/80 flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Backend / Server Service
                      </CardTitle>
                    </div>
                    <p className="mt-1 font-semibold text-foreground text-sm">
                      {backendMember.project.name}
                    </p>
                  </div>
                  <ScoreBadge
                    score={
                      (backendMember.project.latestScores as { overall?: number } | null)?.overall ??
                      ((backendMember.project as { healthData?: { score?: number } | null }).healthData)?.score
                    }
                    size="sm"
                  />
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <p className="font-mono text-xs text-muted-foreground">
                    {backendMember.project.repoFullName}
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5">
                    <Link href={`/projects/${backendMember.project.slug}`}>
                      <span>View Server Audit</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* TAB: API Contracts */}
        <TabsContent value="contracts" className="space-y-4">
          <ContractMatrix items={contractMatrix.items} summary={contractMatrix} />
        </TabsContent>

        {/* TAB: Fullstack Architecture */}
        <TabsContent value="architecture" className="space-y-4">
          <FullstackGraph graph={systemGraph} />
        </TabsContent>

        {/* TAB: Environment Parity */}
        <TabsContent value="env" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="py-3 px-4 border-b border-border/80">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Environment & Network Parity
              </CardTitle>
              <CardDescription className="text-xs">
                Audits cross-service API connection parameters, CORS origins, and port configurations.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {envDrift.issues.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-500 py-4">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All environment configurations and CORS declarations are in harmony!</span>
                </div>
              ) : (
                envDrift.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-md border border-border/70 p-3 bg-muted/20"
                  >
                    {issue.severity === 'critical' ? (
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    ) : issue.severity === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-foreground">{issue.title}</p>
                      <p className="text-muted-foreground leading-relaxed">{issue.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Findings */}
        <TabsContent value="findings" className="space-y-4">
          {findings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No cross-repository findings or contract defects detected.
            </div>
          ) : (
            <div className="space-y-2">
              {findings.map((f) => (
                <div
                  key={f.id}
                  className="flex items-start gap-3 rounded-lg border border-border/80 bg-card/60 p-3.5 text-xs"
                >
                  {f.severity === 'critical' ? (
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  ) : f.severity === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{f.title}</span>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono py-0">
                        {f.category}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{f.detail}</p>
                    {f.file && (
                      <p className="font-mono text-[10px] text-muted-foreground/80 pt-1">
                        {f.file} {f.line ? `:${f.line}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
