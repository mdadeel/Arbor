'use client'

import { useState } from 'react'
import { Activity, ArrowDownRight, GitBranch, GitFork, Layers3 } from 'lucide-react'
import { Badge } from '@/components/ui/createui/badge'

interface NodeItem {
  id: string
  name: string
  layer: string
  deps: string[]
  loc: number
  x: string
  y: string
}

const NODES: NodeItem[] = [
  { id: 'entry', name: 'app.ts', layer: 'Application entry', deps: ['router.ts', 'db.ts'], loc: 94, x: '10%', y: '34%' },
  { id: 'router', name: 'router.ts', layer: 'Route dispatch', deps: ['auth.ts', 'audit.ts'], loc: 182, x: '43%', y: '43%' },
  { id: 'auth', name: 'auth.ts', layer: 'Authentication', deps: ['db.ts'], loc: 120, x: '79%', y: '62%' },
  { id: 'db', name: 'db.ts', layer: 'Persistence layer', deps: [], loc: 64, x: '19%', y: '77%' },
  { id: 'audit', name: 'audit.ts', layer: 'AST analysis service', deps: ['db.ts'], loc: 310, x: '78%', y: '20%' },
]

const HEALTH_DIMENSIONS = [
  { label: 'Architecture', score: 91 },
  { label: 'Maintainability', score: 84 },
  { label: 'Security', score: 84 },
  { label: 'Performance', score: 79 },
]

const GRAPH_EDGES = [
  { from: 'entry', to: 'router', x1: 11, y1: 34, x2: 43, y2: 43 },
  { from: 'router', to: 'auth', x1: 43, y1: 43, x2: 79, y2: 62 },
  { from: 'router', to: 'audit', x1: 43, y1: 43, x2: 78, y2: 20 },
  { from: 'auth', to: 'db', x1: 79, y1: 62, x2: 19, y2: 77 },
  { from: 'entry', to: 'db', x1: 11, y1: 34, x2: 19, y2: 77 },
]

export function HeroPreviewCard() {
  const [selectedNode, setSelectedNode] = useState('router')
  const activeNode = NODES.find((node) => node.id === selectedNode) ?? NODES[1]

  return (
    <div className="relative mx-auto w-full max-w-6xl text-left">
      <div className="overflow-hidden rounded-2xl border border-border/90 bg-card text-card-foreground shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-red-400/80" />
              <span className="size-2.5 rounded-full bg-amber-400/80" />
              <span className="size-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
            <div className="flex min-w-0 items-center gap-2">
              <GitFork className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate text-sm font-semibold text-foreground">arbor / sample-api</span>
            </div>
            <Badge variant="neutral" appearance="outline" size="xs" className="hidden sm:inline-flex">
              <GitBranch aria-hidden="true" />
              main
            </Badge>
          </div>
          <Badge variant="success" appearance="soft" size="xs" className="shrink-0">
            Sample audit
          </Badge>
        </div>

        <div className="grid min-w-0 divide-y divide-border md:grid-cols-[220px_minmax(0,1fr)] md:divide-x md:divide-y-0 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="flex min-w-0 flex-col justify-between gap-6 bg-card p-5 sm:p-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Activity className="size-4 text-primary" aria-hidden="true" />
                Repository health
              </div>
              <div className="mt-3 flex items-baseline gap-1.5 font-mono">
                <span className="text-5xl font-semibold tracking-tight text-foreground tabular-nums">82</span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <Badge variant="success" appearance="soft" size="xs" className="mt-3">
                Ready for review
              </Badge>
            </div>

            <div className="space-y-4 border-t border-border pt-4" aria-label="Sample health dimensions">
              {HEALTH_DIMENSIONS.map(({ label, score }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="truncate text-muted-foreground">{label}</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">{score}</span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${label}: ${score} out of 100`}
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="flex min-w-0 flex-col p-4 sm:p-5" aria-label="Sample dependency graph">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Dependency map</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Select a module to inspect its imports</p>
              </div>
              <Badge variant="neutral" appearance="soft" size="xs">
                <Layers3 aria-hidden="true" />
                5 modules
              </Badge>
            </div>

            <div
              className="relative min-h-[300px] flex-1 overflow-hidden rounded-xl border border-border bg-muted/15 sm:min-h-[350px]"
              style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--foreground) / 0.12) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
            >
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {GRAPH_EDGES.map((edge) => {
                  const active = edge.from === selectedNode || edge.to === selectedNode
                  return (
                    <line
                      key={`${edge.from}-${edge.to}`}
                      x1={edge.x1}
                      y1={edge.y1}
                      x2={edge.x2}
                      y2={edge.y2}
                      stroke="currentColor"
                      strokeWidth={active ? 1.2 : 0.65}
                      strokeDasharray={active ? undefined : '2 2'}
                      className={active ? 'text-primary' : 'text-muted-foreground/40'}
                    />
                  )
                })}
              </svg>

              {NODES.map((node) => {
                const isSelected = selectedNode === node.id
                return (
                  <button
                    key={node.id}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${node.name}, ${node.layer}, ${node.deps.length} imports`}
                    onClick={() => setSelectedNode(node.id)}
                    style={{ left: node.x, top: node.y }}
                    className={[
                      'absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:px-2.5 sm:text-[11px]',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground shadow-md'
                        : 'border-border bg-card text-foreground shadow-sm hover:border-primary/50 hover:bg-muted',
                    ].join(' ')}
                  >
                    {node.name}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-[11px]" aria-live="polite">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono font-semibold text-foreground">{activeNode.name}</span>
                <span className="truncate text-muted-foreground">{activeNode.layer}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                <ArrowDownRight className="size-3.5" aria-hidden="true" />
                <span>{activeNode.deps.length ? activeNode.deps.join(', ') : 'No imports'}</span>
              </div>
            </div>
          </section>
        </div>

        <dl className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border bg-muted/20 sm:grid-cols-4 sm:divide-y-0">
          <div className="flex flex-col-reverse px-4 py-3 sm:px-5">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Typical audit time</dt>
            <dd className="font-mono text-lg font-semibold text-foreground">~30s</dd>
          </div>
          <div className="flex flex-col-reverse px-4 py-3 sm:px-5">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Code analysis</dt>
            <dd className="font-mono text-lg font-semibold text-foreground">AST</dd>
          </div>
          <div className="flex flex-col-reverse px-4 py-3 sm:px-5">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Score dimensions</dt>
            <dd className="font-mono text-lg font-semibold text-foreground">6</dd>
          </div>
          <div className="flex flex-col-reverse px-4 py-3 sm:px-5">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Working copy</dt>
            <dd className="font-mono text-lg font-semibold text-foreground">Removed</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
