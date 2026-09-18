import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Network, Server, Globe } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServerCaller } from '@/server/caller'
import { Badge } from '@/components/ui/badge'
import { SystemReport } from '@/components/dashboard/system/system-report'

export default async function SystemDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return notFound()

  const caller = await getServerCaller()
  const group = await caller.system.bySlug({ slug: params.slug })
  if (!group) return notFound()

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="space-y-2">
        <Link
          href="/systems"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Systems</span>
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {group.name}
              </h1>
              <Badge variant="outline" className="gap-1 font-mono text-[11px] py-0 text-primary border-primary/40">
                <Network className="h-3 w-3" />
                Fullstack System
              </Badge>
            </div>

            {group.description && (
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                {group.description}
              </p>
            )}

            {/* Member repos overview chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
              {group.members.map((m) => (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/20 px-2 py-0.5 text-[11px]"
                >
                  {m.role === 'frontend' ? (
                    <Globe className="h-3 w-3 text-cyan-400" />
                  ) : (
                    <Server className="h-3 w-3 text-emerald-400" />
                  )}
                  <span className="capitalize text-muted-foreground">{m.role}:</span>
                  <span className="font-semibold text-foreground">{m.project.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main System Workbench */}
      <SystemReport group={group as never} />
    </div>
  )
}
