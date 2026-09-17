import { describe, expect, it } from 'vitest'
import { buildModuleGraph, moduleFor } from './module-graph'

describe('moduleFor', () => {
  it('groups paths by top-level segment', () => {
    expect(moduleFor('pages/about.tsx')).toBe('pages')
    expect(moduleFor('lib/util.ts')).toBe('lib')
    expect(moduleFor('root.ts')).toBe('(root)')
  })

  it('skips the thin src/source roots then keeps the real module', () => {
    expect(moduleFor('src/app/page.tsx')).toBe('app')
    expect(moduleFor('src/components/button.tsx')).toBe('components')
    expect(moduleFor('src/lib/utils.ts')).toBe('lib')
    expect(moduleFor('src/index.ts')).toBe('src')
    expect(moduleFor('source/core/thing.ts')).toBe('core')
  })
})

describe('buildModuleGraph', () => {
  it('aggregates file edges into weighted module edges', () => {
    const g = buildModuleGraph(
      {
        nodes: ['a/x.ts', 'a/y.ts', 'b/z.ts', 'c/w.ts'],
        edges: [
          ['a/x.ts', 'b/z.ts'],
          ['a/y.ts', 'b/z.ts'],
          ['b/z.ts', 'c/w.ts'],
        ],
      },
      []
    )
    expect(g.modules.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(g.modules.find((m) => m.id === 'a')?.files).toEqual(['a/x.ts', 'a/y.ts'])
    const ab = g.edges.find((e) => e.source === 'a' && e.target === 'b')
    expect(ab?.count).toBe(2)
    expect(g.edges).toHaveLength(2)
  })

  it('drops intra-module self edges', () => {
    const g = buildModuleGraph(
      {
        nodes: ['a/x.ts', 'a/y.ts'],
        edges: [
          ['a/x.ts', 'a/y.ts'],
          ['a/x.ts', 'b/s.ts'],
        ],
      },
      []
    )
    expect(g.edges).toHaveLength(1)
  })

  it('flags module edges that are part of a circular dep', () => {
    const g = buildModuleGraph(
      {
        nodes: ['a/x.ts', 'b/y.ts'],
        edges: [
          ['a/x.ts', 'b/y.ts'],
          ['b/y.ts', 'a/x.ts'],
        ],
      },
      // findCircularDeps repeats the start node: a -> b -> a
      [['a/x.ts', 'b/y.ts', 'a/x.ts']]
    )
    const ab = g.edges.find((e) => e.source === 'a' && e.target === 'b')
    const ba = g.edges.find((e) => e.source === 'b' && e.target === 'a')
    expect(ab?.circular).toBe(true)
    expect(ba?.circular).toBe(true)
  })

  it('sorts module ids and keeps files sorted', () => {
    const g = buildModuleGraph(
      { nodes: ['b/z.ts', 'a/q.ts'], edges: [['a/q.ts', 'b/z.ts']] },
      []
    )
    expect(g.modules.map((m) => m.id)).toEqual(['a', 'b'])
    expect(g.modules[1].files).toEqual(['b/z.ts'])
  })
})