'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

type Severity = 'info' | 'warning' | 'critical'
type Finding = {
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
type Scores = { overall?: number; architecture?: number; techDebt?: number; performance?: number; documentation?: number; security?: number }
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
  techStack: TechStack | null
  structure: Record<string, unknown> | null
  findings: Finding[] | null
  metrics: Record<string, unknown> | null
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
  latestScores: Scores | null
  detectedStack: TechStack | null
  lastAnalyzedAt: string | null
  analyses: AnalysisRow[]
}

const RUNNING = ['queued', 'cloning', 'analyzing']

function scoreColor(n?: number | null): string {
  if (n == null) return 'text-muted-foreground'
  if (n >= 80) return 'text-emerald-500'
  if (n >= 50) return 'text-amber-500'
  return 'text-red-500'
}

function sevClass(s: Severity): string {
  if (s === 'critical') return 'bg-red-500/15 text-red-500'
  if (s === 'warning') return 'bg-amber-500/15 text-amber-500'
  return 'bg-sky-500/15 text-sky-500'
}

export function ProjectReport({ slug, project }: { slug: string; project: ProjectRow }) {
  const router = useRouter()
  const [tab, setTab] = useState('overview')

  const latest = project.analyses[0]
  const running = latest ? RUNNING.includes(latest.status) : false

  const analyze = trpc.project.analyze.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => window.alert(e.message),
  })

  // poll the server component while an analysis is in flight
  useEffect(() => {
    if (!running) return
    const t = window.setTimeout(() => router.refresh(), 2500)
    return () => window.clearTimeout(t)
  }, [running, router, latest?.status])

  const completed = useMemo(
    () => project.analyses.find((a) => a.status === 'completed'),
    [project.analyses]
  )

  const scores: Scores = completed
    ? {
        overall: completed.overallScore ?? undefined,
        architecture: completed.architectureScore ?? undefined,
        techDebt: completed.techDebtScore ?? undefined,
        performance: completed.performanceScore ?? undefined,
        documentation: completed.documentationScore ?? undefined,
        security: completed.securityScore ?? undefined,
      }
    : (project.latestScores ?? {})

  const stack = completed?.techStack ?? project.detectedStack ?? null
  const metrics = completed?.metrics ?? null
  const structure: Record<string, unknown> | null = completed?.structure ?? null
  const findings = completed?.findings ?? []
  const graphCycles = (completed?.metrics?.circularDeps as string[][] | undefined) ?? []

  const stat = (k: string, fallback?: number) =>
    (metrics?.[k] as number) ?? fallback

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge
            variant={running ? 'secondary' : latest?.status === 'failed' ? 'destructive' : 'default'}
            className="capitalize"
          >
            {running && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {latest?.status ?? 'no-analysis'}
            {running}
          </Badge>
          {completed?.durationMs && (
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(completed.durationMs / 1000)}s
            </span>
          )}
          {completed?.commitSha && (
            <span className="font-mono text-xs text-muted-foreground">
              {completed.commitSha.slice(0, 7)}
            </span>
          )}
        </div>
        <Button size="sm" disabled={running || analyze.isPending} onClick={() => analyze.mutate({ slug })}>
          {running || analyze.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
          {latest ? 'Re-analyze' : 'Analyze'}
        </Button>
      </div>

      {latest?.status === 'failed' && (
        <Card className="border-red-500/40">
          <CardContent className="py-3 text-sm text-red-500">{latest.errorMessage}</CardContent>
        </Card>
      )}

      {!completed && !running && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No completed analysis yet.{' '}
            {latest ? '' : 'The analysis engine clones the repo, inspects the code, and scores it in about 10–30 seconds.'}
          </CardContent>
        </Card>
      )}

      {(completed || running) && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <ScoreCard label="Overall" value={scores.overall} running={running} />
            <ScoreCard label="Architecture" value={scores.architecture} running={running} />
            <ScoreCard label="Tech Debt" value={scores.techDebt} running={running} />
            <ScoreCard label="Performance" value={scores.performance} running={running} />
            <ScoreCard label="Docs" value={scores.documentation} running={running} />
            <ScoreCard label="Security" value={scores.security} running={running} />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="findings">Findings ({findings.length})</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              {stack && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Tech stack</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {[
                      stack.framework,
                      stack.packageManager,
                      ...(stack.languages ?? []),
                      ...(stack.databases ?? []),
                      ...(stack.testing ?? []),
                      ...(stack.ui ?? []),
                    ]
                      .filter(Boolean)
                      .map((c) => (
                        <Badge key={c as string} variant="secondary">
                          {c as string}
                        </Badge>
                      ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Codebase stats</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <span>{stat('files')} files</span>
                  <span>{stat('loc')} LOC</span>
                  <span>{stat('components')} components</span>
                  <span>{stat('hooks')} hooks</span>
                  <span>{stat('anyTypes', 0)} <code>any</code></span>
                  <span>{stat('consoleLogs', 0)} console.log</span>
                  <span>{stat('clientComponents', 0)} client components</span>
                  <span>{stat('serverComponents', 0)} server components</span>
                </CardContent>
              </Card>

              {structure && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Structure</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      Top-level dirs:{' '}
                      {(structure.topLevelDirs as string[] | undefined)?.slice(0, 10).join(', ') ?? '—'}
                    </p>
                    <p className="mt-1">
                      Average file: {(structure.avgFileLines as number | undefined) ?? '—'} lines
                    </p>
                    {((structure.hugeFiles as { file: string; lines: number }[]) ?? []).slice(0, 3).map((h) => (
                      <p key={h.file} className="mt-1 font-mono text-xs">
                        {h.file} — {h.lines} lines
                      </p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {graphCycles.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-amber-500">
                      {graphCycles.length} circular import section(s)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 font-mono text-xs">
                    {graphCycles.slice(0, 5).map((c, i) => (
                      <p key={i}>{c.join(' → ')}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="findings" className="mt-4">
              {findings.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-sm text-muted-foreground">No findings. Clean repo!</CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {findings.map((f) => (
                    <Card key={f.id}>
                      <CardContent className="flex items-start gap-3 py-3">
                        <Badge className={sevClass(f.severity)}>{f.severity}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{f.title}</p>
                          {f.detail && <p className="mt-0.5 text-sm text-muted-foreground">{f.detail}</p>}
                          {f.file && <p className="mt-1 font-mono text-xs text-muted-foreground">{f.file}{f.line ? `:${f.line}` : ''}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardContent className="py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">When</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Overall</th>
                        <th className="pb-2">Commit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.analyses.map((a) => (
                        <tr key={a.id} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-4">{new Date(a.createdAt).toLocaleString()}</td>
                          <td className="py-2 pr-4 capitalize">{a.status}</td>
                          <td className={`py-2 pr-4 font-mono ${scoreColor(a.overallScore)}`}>
                            {a.overallScore ?? '—'}
                          </td>
                          <td className="py-2 font-mono text-muted-foreground">
                            {a.commitSha?.slice(0, 7) ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
      <Separator />
    </div>
  )
}

function ScoreCard({ label, value, running }: { label: string; value?: number; running: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`font-mono text-3xl ${scoreColor(value)}`}>
          {running && value == null ? (
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          ) : (
            value ?? <span className="text-lg text-muted-foreground">—</span>
          )}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}