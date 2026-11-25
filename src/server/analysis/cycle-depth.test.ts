import { describe, expect, it } from 'vitest'
import { findCircularDeps } from './checks'

describe('findCircularDeps (iterative DFS)', () => {
  it('detects a simple cycle', () => {
    const cycles = findCircularDeps({
      nodes: ['a', 'b', 'c'],
      edges: [['a', 'b'], ['b', 'c'], ['c', 'a']],
    })
    expect(cycles).toHaveLength(1)
    expect(new Set(cycles[0])).toEqual(new Set(['a', 'b', 'c']))
  })

  it('reports no cycles for an acyclic graph', () => {
    const cycles = findCircularDeps({
      nodes: ['a', 'b', 'c'],
      edges: [['a', 'b'], ['a', 'c'], ['b', 'c']],
    })
    expect(cycles).toEqual([])
  })

  it('survives an import chain deeper than the JS call stack without overflowing', () => {
    // A recursive visit() over this graph throws RangeError; the iterative
    // version must complete and report the (single) cycle at the far end.
    const depth = 60_000
    const nodes = Array.from({ length: depth + 1 }, (_, i) => `m${i}`)
    const edges: Array<[string, string]> = []
    for (let i = 0; i < depth; i++) edges.push([`m${i}`, `m${i + 1}`])
    edges.push([`m${depth}`, 'm0'])

    const cycles = findCircularDeps({ nodes, edges })
    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toContain('m0')
  })

  it('deduplicates rotated versions of the same cycle', () => {
    const cycles = findCircularDeps({
      nodes: ['a', 'b'],
      edges: [['a', 'b'], ['b', 'a'], ['b', 'a']],
    })
    expect(cycles).toHaveLength(1)
  })
})
