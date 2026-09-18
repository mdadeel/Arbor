import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  FolderGit2,
  History,
  Play,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServerCaller } from '@/server/caller'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScoreBadge } from '@/components/dashboard/score-badge'
import { TechStackGroup } from '@/components/dashboard/tech-stack-badge'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { SummaryBar } from '@/components/dashboard/summary-bar'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const caller = await getServerCaller()
  const [projects, recentAnalyses, workspaceHealth] = await Promise.all([
    caller.project.list(),
    caller.project.recentAnalyses().catch(() => []),
    caller.health.workspace().catch(() => null),
  ])

  // Summary counts
  const counts = {
    total: projects.length,
    healthy: 0,
    warning: 0,
    error: 0,
    avgScore: workspaceHealth?.avgHealthScore,
    failingBuilds: workspaceHealth?.failingBuilds,
    openPRs: workspaceHealth?.totalOpenPRs,
  }

  // Attention items calculation
  const attentionItems: {
    project: (typeof projects)[0]
    reason: string
    severity: 'critical' | 'warning'
  }[] = []

  for (const project of projects) {
    const health = project.healthData as { score?: number } | null
    const scores = project.latestScores as { overall?: number } | null
    const effectiveScore = health?.score ?? scores?.overall

    if (effectiveScore === undefined || effectiveScore === null) {
      counts.error++
      attentionItems.push({
        project,
        reason: 'No audit run yet — codebase unverified',
        severity: 'warning',
      })
    } else if (effectiveScore >= 80) {
      counts.healthy++
    } else if (effectiveScore >= 60) {
      counts.warning++
      attentionItems.push({
        project,
        reason: `Score warning (${effectiveScore}/100) — quality or CI issues detected`,
        severity: 'warning',
      })
    } else {
      counts.error++
      attentionItems.push({
        project,
        reason: `Critical health score (${effectiveScore}/100) — immediate attention required`,
        severity: 'critical',
      })
    }
  }

  // Integrate live workspace attention items (e.g. failing CI, stale PRs)
  if (workspaceHealth?.attentionList) {
    for (const item of workspaceHealth.attentionList) {
      const proj = projects.find((p) => p.id === item.projectId)
      if (!proj) continue
      for (const issue of item.issues) {
        if (!attentionItems.some((a) => a.project.id === proj.id && a.reason === issue)) {
          attentionItems.unshift({
            project: proj,
            reason: issue,
            severity: item.severity,
          })
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Workbench Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Developer Workbench
          </h1>
          <p className="text-xs text-muted-foreground">
            Overview of repository audits, architectural health, and pending issues.
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5 text-xs">
          <Link href="/projects/new">
            <Plus className="h-3.5 w-3.5" />
            Add project
          </Link>
        </Button>
      </div>

      {/* 4-Metric Summary Bar */}
      <SummaryBar counts={counts} />

      {/* Main Project Health Table */}
      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center py-10">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/40">
              <FolderGit2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">No projects connected</CardTitle>
            <p className="max-w-sm text-xs text-muted-foreground">
              Connect a GitHub repository to trigger your first 30-second automated architecture and quality audit.
            </p>
            <div className="pt-4">
              <Button asChild size="sm">
                <Link href="/projects/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Connect your first repo
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="py-3 px-4 border-b border-border/80 flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Connected Repositories ({projects.length})
              </CardTitle>
              <Link
                href="/projects"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[300px]">Repository</TableHead>
                    <TableHead>Health Score</TableHead>
                    <TableHead>Detected Stack</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.slice(0, 6).map((project) => {
                    const health = project.healthData as { score?: number } | null
                    const scores = project.latestScores as { overall?: number } | null
                    const effectiveScore = health?.score ?? scores?.overall
                    const stack = project.detectedStack as {
                      framework?: string
                      languages?: string[]
                      databases?: string[]
                    } | null

                    const stackItems = [
                      stack?.framework,
                      ...(stack?.languages ?? []).slice(0, 2),
                      ...(stack?.databases ?? []).slice(0, 1),
                    ].filter(Boolean)

                    return (
                      <TableRow key={project.id} className="transition-colors hover:bg-muted/40">
                        <TableCell className="font-medium">
                          <Link
                            href={`/projects/${project.slug}`}
                            className="group flex flex-col gap-0.5"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {project.name}
                              </span>
                              {project.repoPrivate && (
                                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {project.repoFullName}
                            </span>
                          </Link>
                        </TableCell>

                        <TableCell>
                          <ScoreBadge score={effectiveScore} showOutOf size="sm" />
                        </TableCell>

                        <TableCell>
                          {stackItems.length > 0 ? (
                            <TechStackGroup items={stackItems} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {project.defaultBranch}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            <Link href={`/projects/${project.slug}`}>
                              View
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          </Card>

          {/* Two-Column Bottom Workbench Panels */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Needs Attention Panel */}
            <Card className="border-border">
              <CardHeader className="py-3 px-4 border-b border-border/80">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    Needs Attention ({attentionItems.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {attentionItems.length === 0 ? (
                  <div className="flex items-center gap-2 py-6 text-center justify-center text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    All repositories are audited and within healthy thresholds!
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {attentionItems.slice(0, 5).map(({ project, reason, severity }) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.slug}`}
                        className="group flex items-start justify-between gap-3 py-2.5 px-2 rounded transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {severity === 'critical' ? (
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                              {project.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">{reason}</p>
                          </div>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Analyses Panel */}
            <Card className="border-border">
              <CardHeader className="py-3 px-4 border-b border-border/80">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-primary" />
                  Recent Analyses
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {recentAnalyses.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No recent analysis activity recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {recentAnalyses.map((analysis) => (
                      <Link
                        key={analysis.id}
                        href={`/projects/${analysis.project.slug}`}
                        className="group flex items-center justify-between gap-3 py-2 px-2 rounded transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {analysis.project.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                            <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
                            {analysis.durationMs && (
                              <span>· {Math.round(analysis.durationMs / 1000)}s</span>
                            )}
                            {analysis.commitSha && (
                              <span>· {analysis.commitSha.slice(0, 7)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={analysis.status} showSpinner={false} />
                          {analysis.overallScore != null && (
                            <ScoreBadge score={analysis.overallScore} size="sm" />
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}