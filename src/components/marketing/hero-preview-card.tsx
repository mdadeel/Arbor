'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

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
  { id: 'n1', name: 'app.ts', layer: 'Entrypoint', deps: ['router.ts'], loc: 94, x: '8%', y: '28%' },
  { id: 'n2', name: 'router.ts', layer: 'Router / Dispatch', deps: ['auth.ts', 'audit.ts'], loc: 182, x: '44%', y: '36%' },
  { id: 'n3', name: 'auth.ts', layer: 'Security / Session', deps: ['db.ts'], loc: 120, x: '78%', y: '58%' },
  { id: 'n4', name: 'db.ts', layer: 'Persistence / Prisma', deps: [], loc: 64, x: '16%', y: '74%' },
  { id: 'n5', name: 'audit.ts', layer: 'AST Analysis Service', deps: ['db.ts'], loc: 310, x: '74%', y: '18%' },
]

export function HeroPreviewCard() {
  const [selectedNode, setSelectedNode] = useState<string>('n2')
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const activeFocus = hoveredNode || selectedNode
  const activeNode = NODES.find((n) => n.id === activeFocus) || NODES[1]

  const isEdgeActive = (nodeA: string, nodeB: string) => {
    return activeFocus === nodeA || activeFocus === nodeB
  }

  return (
    <div className="relative mx-auto w-full max-w-5xl text-left font-mono">
      {/* Product Frame with Sharp Border and Offset Accent Shadow */}
      <div className="relative border border-foreground/20 dark:border-line-strong bg-card text-foreground shadow-offset-accent transition-all duration-200">
        
        {/* Frame Top Header Strip */}
        <div className="flex items-center justify-between gap-4 border-b border-border dark:border-line-strong px-4 sm:px-6 py-3 text-[11px] font-medium uppercase tracking-wider bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground">arbor / architecture.audit</span>
            <span className="hidden sm:inline-block text-muted-foreground">·</span>
            <span className="hidden sm:inline-block text-muted-foreground">main @ 2f27537</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-acid text-[#11170f] font-bold px-2 py-0.5 text-[10px] tracking-widest border border-[#11170f]/20">
              SAMPLE AUDIT
            </span>
          </div>
        </div>

        {/* Dashboard Body: Score + Graph Split */}
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr] divide-y md:divide-y-0 md:divide-x divide-border dark:divide-line-strong">
          
          {/* Left Column: Repository Health Score & Dimension Bars */}
          <div className="p-5 sm:p-6 flex flex-col justify-between space-y-6 bg-card/60">
            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider leading-tight">
                Repository<br />Health Score
              </div>
              <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-foreground tabular-nums mt-3">
                82<span className="text-base text-muted-foreground font-normal">/100</span>
              </div>
              <div className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                READY FOR SHIP
              </div>
            </div>

            {/* Health Dimension Bars */}
            <div className="space-y-3 pt-4 border-t border-border dark:border-line">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Architecture</span>
                  <span className="tabular-nums font-semibold text-foreground">91%</span>
                </div>
                <div className="h-1.5 w-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-600 dark:bg-[#4c8f63]" style={{ width: '91%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Tech Debt</span>
                  <span className="tabular-nums font-semibold text-foreground">74%</span>
                </div>
                <div className="h-1.5 w-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-600 dark:bg-[#4c8f63]" style={{ width: '74%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Security</span>
                  <span className="tabular-nums font-semibold text-foreground">84%</span>
                </div>
                <div className="h-1.5 w-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-600 dark:bg-[#4c8f63]" style={{ width: '84%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Performance</span>
                  <span className="tabular-nums font-semibold text-foreground">79%</span>
                </div>
                <div className="h-1.5 w-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-600 dark:bg-[#4c8f63]" style={{ width: '79%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Inspectable Dependency Graph / Route Layer */}
          <div className="relative min-h-[320px] sm:min-h-[360px] p-5 sm:p-6 overflow-hidden bg-card/30 flex flex-col justify-between"
               style={{
                 backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
                 backgroundSize: '16px 16px',
                 color: 'var(--grid)',
               }}>
            
            {/* Graph Header Label */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Dependency Graph / Route Layer
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                Click nodes to inspect edges
              </span>
            </div>

            {/* Simulated Edge Lines */}
            <div className="absolute inset-0 pointer-events-none text-foreground">
              {/* e1: app.ts (n1) -> router.ts (n2) */}
              <div
                className={`absolute origin-left transition-all duration-200 ${
                  isEdgeActive('n1', 'n2')
                    ? 'h-[2px] bg-acid opacity-100 z-10'
                    : 'h-[1px] bg-current opacity-30 dark:opacity-40'
                }`}
                style={{ width: '38%', left: '16%', top: '34%', transform: 'rotate(8deg)' }}
              />
              {/* e2: router.ts (n2) -> auth.ts (n3) */}
              <div
                className={`absolute origin-left transition-all duration-200 ${
                  isEdgeActive('n2', 'n3')
                    ? 'h-[2px] bg-acid opacity-100 z-10'
                    : 'h-[1px] bg-current opacity-30 dark:opacity-40'
                }`}
                style={{ width: '36%', left: '50%', top: '42%', transform: 'rotate(24deg)' }}
              />
              {/* e3: router.ts (n2) -> audit.ts (n5) */}
              <div
                className={`absolute origin-left transition-all duration-200 ${
                  isEdgeActive('n2', 'n5')
                    ? 'h-[2px] bg-acid opacity-100 z-10'
                    : 'h-[1px] bg-current opacity-30 dark:opacity-40'
                }`}
                style={{ width: '32%', left: '50%', top: '36%', transform: 'rotate(-26deg)' }}
              />
              {/* e4: auth.ts (n3) -> db.ts (n4) */}
              <div
                className={`absolute origin-left transition-all duration-200 ${
                  isEdgeActive('n3', 'n4')
                    ? 'h-[2px] bg-acid opacity-100 z-10'
                    : 'h-[1px] bg-current opacity-30 dark:opacity-40'
                }`}
                style={{ width: '64%', left: '22%', top: '75%', transform: 'rotate(-16deg)' }}
              />
              {/* e5: app.ts (n1) -> db.ts (n4) */}
              <div
                className={`absolute origin-left transition-all duration-200 ${
                  isEdgeActive('n1', 'n4')
                    ? 'h-[2px] bg-acid opacity-100 z-10'
                    : 'h-[1px] bg-current opacity-30 dark:opacity-40'
                }`}
                style={{ width: '42%', left: '12%', top: '36%', transform: 'rotate(72deg)' }}
              />
            </div>

            {/* Interactive Graph Nodes */}
            <div className="absolute inset-0">
              {NODES.map((node) => {
                const isSelected = selectedNode === node.id
                const isHovered = hoveredNode === node.id
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNode(node.id)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ left: node.x, top: node.y }}
                    className={`absolute z-20 px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all duration-150 cursor-pointer border ${
                      isSelected
                        ? 'bg-acid text-[#11170f] border-foreground shadow-[3px_3px_0_currentColor] scale-105'
                        : isHovered
                        ? 'bg-muted/90 text-foreground border-foreground shadow-[2px_2px_0_currentColor] scale-105'
                        : 'bg-card text-foreground border-border dark:border-line-strong hover:border-foreground shadow-[2px_2px_0_rgba(0,0,0,0.2)]'
                    }`}
                  >
                    {node.name}
                  </button>
                )
              })}
            </div>

            {/* Node Inspection Detail Strip */}
            <div className="relative z-10 mt-auto pt-4 border-t border-border dark:border-line bg-card/90 backdrop-blur-xs p-3 flex flex-wrap items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground">{activeNode.name}</span>
                <span className="text-muted-foreground">{activeNode.layer}</span>
                <span className="text-muted-foreground">· {activeNode.loc} LOC</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-[10px]">
                <span>Imports:</span>
                <span className="text-foreground font-semibold">
                  {activeNode.deps.length > 0 ? activeNode.deps.join(', ') : 'None (Leaf Node)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Frame Foot Metrics (The 4 Quantified Invariants) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border dark:border-line-strong divide-x divide-border dark:divide-line-strong bg-muted/10">
          <div className="p-3 sm:p-4">
            <b className="block text-base sm:text-lg font-bold font-mono tracking-tight text-foreground tabular-nums">
              &lt; 30s
            </b>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              AUDIT TIME
            </span>
          </div>

          <div className="p-3 sm:p-4">
            <b className="block text-base sm:text-lg font-bold font-mono tracking-tight text-foreground tabular-nums">
              100%
            </b>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              DETERMINISTIC AST
            </span>
          </div>

          <div className="p-3 sm:p-4">
            <b className="block text-base sm:text-lg font-bold font-mono tracking-tight text-foreground tabular-nums">
              7
            </b>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              HEALTH DIMENSIONS
            </span>
          </div>

          <div className="p-3 sm:p-4">
            <b className="block text-base sm:text-lg font-bold font-mono tracking-tight text-foreground tabular-nums">
              0 bytes
            </b>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              SOURCE RETAINED
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}