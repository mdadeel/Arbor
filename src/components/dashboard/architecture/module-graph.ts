export interface ModuleNodeData {
  id: string
  label: string
  fileCount: number
  files: string[]
}

export interface ModuleEdge {
  id: string
  source: string
  target: string
  count: number
  circular: boolean
  imports: [string, string][]
}

export interface ModuleGraph {
  modules: ModuleNodeData[]
  edges: ModuleEdge[]
}

export interface FileGraph {
  nodes: string[]
  edges: [string, string][]
}

// Thin namespace roots: only `src`/`source` wrap real modules in most TS/JS
// repos. `lib`, `app`, `components` at the repo root are genuine modules.
const SOURCE_ROOTS = new Set(['src', 'source'])

export function moduleFor(rel: string): string {
  const parts = rel.split('/').filter(Boolean)
  if (parts.length <= 1) return '(root)'
  if (parts.length >= 3 && SOURCE_ROOTS.has(parts[0])) return parts[1]
  return parts[0]
}

export function buildModuleGraph(graph: FileGraph, circularDeps: string[][] = []): ModuleGraph {
  const filesByModule = new Map<string, string[]>()
  for (const n of graph.nodes) {
    const m = moduleFor(n)
    const list = filesByModule.get(m) ?? []
    list.push(n)
    filesByModule.set(m, list)
  }

  const modules: ModuleNodeData[] = [...filesByModule.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, files]) => ({
      id,
      label: id === '(root)' ? '(root)' : `${id}/`,
      fileCount: files.length,
      files: [...files].sort(),
    }))

  const pairKey = (a: string, b: string) => `${a}\u0000${b}`
  const rawPairs = new Map<
    string,
    { source: string; target: string; count: number; imports: [string, string][] }
  >()
  for (const [from, to] of graph.edges) {
    const s = moduleFor(from)
    const t = moduleFor(to)
    if (s === t) continue
    const key = pairKey(s, t)
    const p = rawPairs.get(key) ?? { source: s, target: t, count: 0, imports: [] }
    p.count++
    p.imports.push([from, to])
    rawPairs.set(key, p)
  }

  const circularPairs = new Set<string>()
  for (const cycle of circularDeps) {
    for (let i = 0; i < cycle.length; i++) {
      const s = moduleFor(cycle[i])
      const t = moduleFor(cycle[(i + 1) % cycle.length])
      if (s !== t) circularPairs.add(pairKey(s, t))
    }
  }

  const edges: ModuleEdge[] = [...rawPairs.values()]
    .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target))
    .map((p) => ({
      id: `e_${p.source}_${p.target}`,
      source: p.source,
      target: p.target,
      count: p.count,
      circular: circularPairs.has(pairKey(p.source, p.target)),
      imports: p.imports,
    }))

  return { modules, edges }
}