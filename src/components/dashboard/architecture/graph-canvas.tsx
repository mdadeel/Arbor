'use client'

import { useMemo, useState } from 'react'
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
import { layoutModules, NODE_WIDTH, type PositionedModule } from './auto-layout'
import type { ModuleGraph } from './module-graph'

type Selection =
  | { kind: 'node'; moduleId: string }
  | { kind: 'edge'; source: string; target: string }

function ModuleNode({ data, selected }: NodeProps<{ label: string; fileCount: number }>) {
  return (
    <div
      className={`rounded-lg border bg-card px-3 py-2 text-sm shadow-sm ${
        selected ? 'border-foreground ring-1 ring-foreground' : 'border-border'
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!bg-border" />
      <div className="flex items-center justify-between gap-2 font-medium">
        <span className="truncate">{data.label}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{data.fileCount}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-border" />
    </div>
  )
}

const nodeTypes = { module: ModuleNode }

export default function GraphCanvas({ graph }: { graph: ModuleGraph }) {
  const [selection, setSelection] = useState<Selection | null>(null)

  const { nodes, edges } = useMemo(() => {
    const positioned = layoutModules(graph.modules, graph.edges)
    const ns: FlowNode[] = positioned.map((m: PositionedModule) => ({
      id: m.id,
      type: 'module',
      position: m.position,
      data: { label: m.label, fileCount: m.fileCount },
    }))
    const es: FlowEdge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: String(e.count),
      style: { stroke: e.circular ? 'rgb(239 68 68)' : undefined },
      labelStyle: { fill: e.circular ? 'rgb(239 68 68)' : undefined, fontSize: 11 },
      labelBgStyle: { fill: 'hsl(var(--card))', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
    }))
    return { nodes: ns, edges: es }
  }, [graph])

  const hidden = selection?.kind === 'node' ? graph.modules.find((m) => m.id === selection.moduleId) : undefined
  const hiddenImports =
    selection?.kind === 'edge'
      ? graph.edges.find((e) => e.source === selection.source && e.target === selection.target)
      : undefined

  if (graph.edges.length === 0 || graph.modules.length < 2) {
    return (
      <div className="grid gap-3 text-sm">
        {graph.modules.map((m) => (
          <div key={m.id} className="flex justify-between rounded-lg border border-border px-3 py-2">
            <span className="font-medium">{m.label}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {m.fileCount} {m.fileCount === 1 ? 'file' : 'files'}
            </span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          No cross-module imports to visualize.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="h-[480px] rounded-lg border border-border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesConnectable={false}
          nodesDraggable={false}
          elementsSelectable={true}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, n) => setSelection({ kind: 'node', moduleId: n.id })}
          onEdgeClick={(_, e) => setSelection({ kind: 'edge', source: e.source, target: e.target })}
          onPaneClick={() => setSelection(null)}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap pannable zoomable className="!bg-background" nodeColor="#4b5563" />
        </ReactFlow>
      </div>

      {hidden && (
        <div className="rounded-lg border border-border px-3 py-2 text-xs">
          <p className="mb-1 font-medium">
            {hidden.label}
            <span className="ml-2 font-mono text-muted-foreground">
              {hidden.fileCount} {hidden.fileCount === 1 ? 'file' : 'files'}
            </span>
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-muted-foreground">
            {hidden.files.slice(0, 20).map((f) => (
              <li key={f} className="truncate">
                {f}
              </li>
            ))}
            {hidden.files.length > 20 && <li>… +{hidden.files.length - 20} more</li>}
          </ul>
        </div>
      )}

      {hiddenImports && (
        <div className="rounded-lg border border-border px-3 py-2 text-xs">
          <p className="mb-1 font-medium">
            {hiddenImports.source} → {hiddenImports.target}
            <span className="ml-2 font-mono text-muted-foreground">{hiddenImports.count} imports</span>
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-muted-foreground">
            {hiddenImports.imports.slice(0, 15).map(([from, to]) => (
              <li key={`${from}-${to}`} className="truncate">
                {from} → {to}
              </li>
            ))}
            {hiddenImports.imports.length > 15 && <li>… +{hiddenImports.imports.length - 15} more</li>}
          </ul>
        </div>
      )}
    </div>
  )
}