import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowUpRight, FolderGit2, Plus, ShieldCheck } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServerCaller } from '@/server/caller'
import { Button } from '@/components/ui/button'
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
    if (!scores?.overall) {
      counts.error++
    } else if (scores.overall >= 80) {
      counts.healthy++
    } else if (scores.overall >= 60) {
      counts.warning++
    } else {
      counts.error++
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Projects</h1>
          <p className="text-xs text-muted-foreground">
            Manage and audit your connected repositories.
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/projects/new">
            <Plus className="h-4 w-4" />
            Add project
          </Link>
        </Button>
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
            <Button asChild size="sm">
              <Link href="/projects/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Add your first project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <Table>
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
                {projects.map((project) => {
                  const scores = project.latestScores as { overall?: number } | null
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
                        <ScoreBadge score={scores?.overall} showOutOf size="sm" />
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
                        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                          <Link href={`/projects/${project.slug}`}>
                            View
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
