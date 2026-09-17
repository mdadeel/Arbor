import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, GitBranch, ShieldCheck } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServerCaller } from '@/server/caller'
import { Badge } from '@/components/ui/badge'
import { ProjectReport } from '@/components/dashboard/project-report'

export default async function ProjectDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return notFound()

  const caller = await getServerCaller()
  const project = await caller.project.bySlug({ slug: params.slug })
  if (!project) return notFound()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold">{project.name}</h1>
            {project.repoPrivate && (
              <Badge variant="outline">
                <ShieldCheck className="h-3 w-3" />
                Private
              </Badge>
            )}
            <Badge variant="secondary" className="font-mono">
              {project.defaultBranch}
            </Badge>
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          )}
          <p className="mt-1 font-mono text-xs text-muted-foreground">{project.repoFullName}</p>
        </div>
        <Link
          href={project.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary hover:underline"
        >
          <span className="flex items-center gap-1">
            View on GitHub
            <ExternalLink className="h-3 w-3" />
          </span>
        </Link>
      </div>

      <ProjectReport slug={params.slug} project={project as never} />
    </div>
  )
}