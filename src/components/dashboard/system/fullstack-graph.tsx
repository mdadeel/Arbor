'use client'

import React, { useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { SystemGraphResult } from '@/server/services/system-analysis'
import { Badge } from '@/components/ui/badge'

const NODE_WIDTH = 220

function SystemModuleNode({
  data,
  selected,
}: NodeProps<{ label: string; fileCount: number; type: 'frontend' | 'backend' | 'gateway' }>) {
  const isFrontend = data.type === 'frontend'

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs shadow-sm transition-all ${
        selected ? 'border-foreground ring-1 ring-foreground' : 'border-border'
      } ${isFrontend ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!bg-border" />
      <div className="flex items-center justify-between gap-1.5 font-medium">
        <span className="truncate font-semibold text-foreground">{data.label}</span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{data.fileCount}f</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <Badge
          variant="outline"
          className={`text-[9px] px-1 py-0 ${
            isFrontend ? 'text-cyan-400 border-cyan-500/30' : 'text-emerald-400 border-emerald-500/30'
          }`}
        >
          {isFrontend ? 'Client Layer' : 'Server Layer'}
        </Badge>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-border" />
    </div>
  )
}

const defaultNodeTypes = { systemModule: SystemModuleNode }

export function FullstackGraph({ graph }: { graph: SystemGraphResult }) {

  const { nodes, edges } = useMemo(() => {
    if (!graph || !graph.nodes) return { nodes: [], edges: [] }

    // Separate frontend and backend nodes
    const feNodes = graph.nodes.filter((n) => n.type === 'frontend')
    const beNodes = graph.nodes.filter((n) => n.type === 'backend')

    const ns: FlowNode[] = []
    const seenNodeIds = new Set<string>()

    // Place Frontend nodes on the left column (X: 50)
    feNodes.forEach((n, idx) => {
      if (seenNodeIds.has(n.id)) return
      seenNodeIds.add(n.id)
      ns.push({
        id: n.id,
        type: 'systemModule',
        position: { x: 60, y: 60 + idx * 85 },
        data: { label: n.label, fileCount: n.fileCount, type: 'frontend' },
      })
    })

    // Place Backend nodes on the right column (X: 440)
    beNodes.forEach((n, idx) => {
      if (seenNodeIds.has(n.id)) return
      seenNodeIds.add(n.id)
      ns.push({
        id: n.id,
        type: 'systemModule',
        position: { x: 440, y: 60 + idx * 85 },
        data: { label: n.label, fileCount: n.fileCount, type: 'backend' },
      })
    })

    const seenEdgeIds = new Set<string>()
    const es: FlowEdge[] = []

    for (const e of graph.edges ?? []) {
      if (seenEdgeIds.has(e.id)) continue
      seenEdgeIds.add(e.id)
      const isCross = e.isCrossBoundary

      es.push({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: isCross,
        style: {
          stroke: isCross ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)',
          strokeWidth: isCross ? 2 : 1,
        },
        labelStyle: {
          fill: isCross ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: isCross ? 600 : 400,
        },
        labelBgStyle: {
          fill: 'hsl(var(--card))',
          fillOpacity: 0.95,
        },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      })
    }

    return { nodes: ns, edges: es }
  }, [graph])

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">No cross-service architecture graph available</p>
        <p className="max-w-md">
          Fullstack architecture visualization requires both member repositories to complete scans with parsed AST import graphs. Re-run scans on the individual repositories to generate graph data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>Client Layer Modules (left)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Server Layer Modules (right)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-primary animate-pulse" />
            <span>Inferred HTTP API Boundary</span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground/80">
          Nodes = module directories sized by file count · Edges = cross-service API routes
        </span>
      </div>

      <div className="h-[520px] rounded-lg border border-border bg-card/30 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={defaultNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
          <Controls className="!bg-card !border-border !text-foreground" />
          <MiniMap
            className="!bg-card !border-border"
            nodeColor={(n) => (n.data?.type === 'frontend' ? '#06b6d4' : '#10b981')}
          />
        </ReactFlow>
      </div>
    </div>
  )
}
