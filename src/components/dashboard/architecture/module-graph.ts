export interface ModuleNodeData {
  id: string
  label: string
  fileCount: number
  files: string[]
  /** Total non-empty source lines across the module's files that have a count. */
  lines: number
  /** Per-file line counts, keyed by repository-relative path. */
  fileLines: Record<string, number>
}

export interface StructureLineNode {
  name: string
  type: 'dir' | 'file'
  lines?: number
  children?: StructureLineNode[]
}

/** Flattens the stored repository tree into a repository-relative file → line map. */
export function collectFileLineCounts(
  nodes: StructureLineNode[],
  prefix = '',
  counts: Record<string, number> = {}
): Record<string, number> {
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name
    if (node.type === 'dir') {
      collectFileLineCounts(node.children ?? [], fullPath, counts)
    } else if (typeof node.lines === 'number') {
      counts[fullPath] = node.lines
    }
  }
  return counts
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

export function buildModuleGraph(
  graph: FileGraph,
  circularDeps: string[][] = [],
  lineCounts: Record<string, number> = {}
): ModuleGraph {
  const filesByModule = new Map<string, string[]>()
  for (const n of graph.nodes) {
    const m = moduleFor(n)
    const list = filesByModule.get(m) ?? []
    list.push(n)
    filesByModule.set(m, list)
  }

  const modules: ModuleNodeData[] = [...filesByModule.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, files]) => {
      const fileLines: Record<string, number> = {}
      let lines = 0
      for (const file of files) {
        const count = lineCounts[file]
        if (typeof count === 'number') {
          fileLines[file] = count
          lines += count
        }
      }
      return {
        id,
        label: id === '(root)' ? '(root)' : `${id}/`,
        fileCount: files.length,
        files: [...files].sort(),
        lines,
        fileLines,
      }
    })

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