import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowUpRight, FolderGit2, Plus } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServerCaller } from '@/server/caller'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Scores = { overall?: number }

function ScoreBadge({ latestScores }: { latestScores: unknown }) {
  const scores = latestScores as Scores | null
  if (!scores?.overall) return <Badge variant="outline">Not analyzed</Badge>
  const tone = scores.overall >= 70 ? 'success' : scores.overall >= 40 ? 'warning' : 'destructive'
  return <Badge variant={tone}>{scores.overall}</Badge>
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const caller = await getServerCaller()
  const projects = await caller.project.list()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {session.user.name ?? 'developer'}. Here are your projects.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4" />
            Add project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
              <FolderGit2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription className="max-w-sm">
              Connect a GitHub repository to run your first architecture analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4" />
                Add your first project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Analyses</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {project.repoFullName}
                    </TableCell>
                    <TableCell>
                      <ScoreBadge latestScores={project.latestScores} />
                    </TableCell>
                    <TableCell>{project._count.analyses}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/projects/${project.slug}`}>
                          <ArrowUpRight className="h-4 w-4" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}