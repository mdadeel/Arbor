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
      {/* Project Header Metadata */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {project.name}
            </h1>
            {project.repoPrivate && (
              <Badge variant="outline" className="gap-1 text-[11px] font-normal py-0">
                <ShieldCheck className="h-3 w-3" />
                Private
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1 font-mono text-[11px] py-0">
              <GitBranch className="h-3 w-3" />
              {project.defaultBranch}
            </Badge>
          </div>

          {project.description && (
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              {project.description}
            </p>
          )}

          <p className="font-mono text-xs text-muted-foreground/80">
            {project.repoFullName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <span>GitHub</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Main Project Report and Tabs */}
      <ProjectReport slug={params.slug} project={project as never} />
    </div>
  )
}