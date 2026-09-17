import dagre from 'dagre'
import type { ModuleEdge, ModuleNodeData } from './module-graph'

export const NODE_WIDTH = 220
export const NODE_HEIGHT = 56

export interface PositionedModule extends ModuleNodeData {
  position: { x: number; y: number }
}

// Lay out a module-level DAG left-to-right with dagre.
export function layoutModules(modules: ModuleNodeData[], edges: ModuleEdge[]): PositionedModule[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90, marginx: 12, marginy: 12 })
  g.setDefaultEdgeLabel(() => ({}))
  g.setDefaultNodeLabel(() => ({}))

  for (const m of modules) g.setNode(m.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  for (const e of edges) g.setEdge(e.source, e.target)

  dagre.layout(g)

  return modules.map((m) => {
    const p = g.node(m.id)
    return {
      ...m,
      position: { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 },
    }
  })
}