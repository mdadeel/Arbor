import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Network, Plus } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServerCaller } from '@/server/caller'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScoreBadge } from '@/components/dashboard/score-badge'

export default async function SystemsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const caller = await getServerCaller()
  const systems = await caller.system.list()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Fullstack Systems & Project Groups
          </h1>
          <p className="text-xs text-muted-foreground">
            Merge client and server repositories to evaluate cross-repo API contracts, route drift, and end-to-end architecture.
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5 text-xs">
          <Link href="/systems/new">
            <Plus className="h-3.5 w-3.5" />
            <span>Create System Group</span>
          </Link>
        </Button>
      </div>

      {systems.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center pb-2">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Network className="h-6 w-6" />
            </div>
            <CardTitle className="text-base">No system groups configured</CardTitle>
            <CardDescription className="max-w-md text-xs">
              Connect your frontend and backend repositories into a system group to verify API route parity, detect 404 broken calls, and visualize fullstack data flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8 pt-2">
            <Button asChild size="sm" className="gap-1.5 text-xs">
              <Link href="/systems/new">
                <Plus className="h-3.5 w-3.5" />
                <span>Create your first system group</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {systems.map((system) => {
            const systemData = system.systemData as {
              totalEndpoints?: number
              connected?: number
              broken?: number
              orphaned?: number
            } | null

            return (
              <Card key={system.id} className="border-border hover:border-border/80 transition-colors flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-primary shrink-0" />
                        <CardTitle className="text-base font-semibold">
                          {system.name}
                        </CardTitle>
                      </div>
                      {system.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {system.description}
                        </p>
                      )}
                    </div>
                    <ScoreBadge score={system.latestScore ?? undefined} size="sm" />
                  </div>

                  {/* Members badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 font-mono">
                    {system.members.map((m) => (
                      <Badge
                        key={m.id}
                        variant="outline"
                        className={`text-[10px] gap-1 py-0.5 ${
                          m.role === 'frontend'
                            ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5'
                            : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                        }`}
                      >
                        <span className="opacity-70 capitalize">{m.role}:</span>
                        <span>{m.project.name}</span>
                      </Badge>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {systemData && (
                    <div className="flex items-center gap-4 rounded-md border border-border/60 bg-muted/20 p-2.5 font-mono text-xs text-muted-foreground">
                      <div>
                        <span className="text-[10px] uppercase text-muted-foreground/70">Routes</span>
                        <p className="font-semibold text-foreground">{systemData.totalEndpoints ?? 0}</p>
                      </div>
                      <div className="h-6 w-px bg-border/60" />
                      <div>
                        <span className="text-[10px] uppercase text-emerald-500">Connected</span>
                        <p className="font-semibold text-emerald-400">{systemData.connected ?? 0}</p>
                      </div>
                      <div className="h-6 w-px bg-border/60" />
                      <div>
                        <span className="text-[10px] uppercase text-red-500">Broken (404)</span>
                        <p className="font-semibold text-red-400">{systemData.broken ?? 0}</p>
                      </div>
                    </div>
                  )}

                  <Button asChild variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5 justify-between">
                    <Link href={`/systems/${system.slug}`}>
                      <span>Open System Workbench</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
