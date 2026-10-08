import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowUpRight, FolderGit2, Plus, ShieldCheck } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServerCaller } from '@/server/caller'
import { Button as CreateButton, ButtonLabel } from '@/components/ui/createui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { SummaryBar } from '@/components/dashboard/summary-bar'

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const caller = await getServerCaller()
  const projects = await caller.project.list()

  // Calculate summary metrics
  const counts = {
    total: projects.length,
    healthy: 0,
    warning: 0,
    error: 0,
  }

  for (const project of projects) {
    const scores = project.latestScores as { overall?: number } | null
    const health = project.healthData as { score?: number } | null
    const effectiveScore = scores?.overall ?? health?.score

    if (effectiveScore === undefined || effectiveScore === null) {
      counts.error++
    } else if (effectiveScore >= 80) {
      counts.healthy++
    } else if (effectiveScore >= 60) {
      counts.warning++
    } else {
      counts.error++
    }
  }

  const projectRows = projects.map((project) => {
    const scores = project.latestScores as { overall?: number } | null
    const health = project.healthData as { score?: number } | null
    const stack = project.detectedStack as {
      framework?: string
      languages?: string[]
      databases?: string[]
    } | null

    return {
      project,
      effectiveScore: scores?.overall ?? health?.score,
      stackItems: [stack?.framework, ...(stack?.languages ?? []).slice(0, 2), ...(stack?.databases ?? []).slice(0, 1)].filter(Boolean),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Projects</h1>
          <p className="text-xs text-muted-foreground">
            Manage and audit your connected repositories.
          </p>
        </div>
        <CreateButton asChild variant="primary" size="sm" shape="pill">
          <Link href="/projects/new">
            <Plus aria-hidden="true" />
            <ButtonLabel>Add project</ButtonLabel>
          </Link>
        </CreateButton>
      </div>

      {projects.length > 0 && <SummaryBar counts={counts} />}

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/50">
              <FolderGit2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">No projects connected</CardTitle>
            <CardDescription className="max-w-sm text-xs">
              Connect your first GitHub repository to run automated architecture and health audits.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <CreateButton asChild variant="primary" size="sm" shape="pill">
              <Link href="/projects/new">
                <Plus aria-hidden="true" />
                <ButtonLabel>Add your first project</ButtonLabel>
              </Link>
            </CreateButton>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto lg:block">
              <Table aria-label="Connected projects">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[280px]">Project</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Detected Stack</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Analyses</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectRows.map(({ project, effectiveScore, stackItems }) => (
                    <TableRow key={project.id} className="transition-colors hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link
                          href={`/projects/${project.slug}`}
                          className="group flex flex-col gap-0.5 cursor-pointer"
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

                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {project._count.analyses}
                      </TableCell>

                      <TableCell className="text-right">
                        <CreateButton asChild variant="neutral-light" appearance="ghost" size="sm" shape="pill">
                          <Link href={`/projects/${project.slug}`}>
                            <ButtonLabel>View</ButtonLabel>
                            <ArrowUpRight aria-hidden="true" />
                          </Link>
                        </CreateButton>
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
            <div className="divide-y divide-border lg:hidden">
              {projectRows.map(({ project, effectiveScore, stackItems }) => (
                <article key={project.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/projects/${project.slug}`} className="truncate text-sm font-semibold text-foreground hover:text-primary">
                          {project.name}
                        </Link>
                        {project.repoPrivate && <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" aria-label="Private repository" />}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{project.repoFullName}</p>
                    </div>
                    <ScoreBadge score={effectiveScore} showOutOf size="sm" />
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Stack</span>
                    {stackItems.length > 0 ? (
                      <TechStackGroup items={stackItems} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Not detected</span>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-xs">
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Default branch</dt>
                      <dd className="mt-1 truncate font-mono text-foreground">{project.defaultBranch}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-muted-foreground">Analyses</dt>
                      <dd className="mt-1 font-mono text-foreground">{project._count.analyses}</dd>
                    </div>
                  </dl>

                  <CreateButton asChild variant="neutral-light" appearance="outline" size="sm" shape="pill" className="w-full">
                    <Link href={`/projects/${project.slug}`}>
                      <ButtonLabel>Open project</ButtonLabel>
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </CreateButton>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
