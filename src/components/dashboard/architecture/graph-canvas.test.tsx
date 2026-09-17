import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import GraphCanvas from './graph-canvas'
import { buildModuleGraph } from './module-graph'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.assign(globalThis, { ResizeObserver: ResizeObserverMock })

describe('GraphCanvas', () => {
  it('renders flow nodes and edges', () => {
    const mg = buildModuleGraph(
      { nodes: ['a/x.ts', 'b/y.ts'], edges: [['a/x.ts', 'b/y.ts']] },
      []
    )
    const { baseElement } = render(<GraphCanvas graph={mg} />)
    expect(baseElement.querySelector('.react-flow')).toBeTruthy()
  })

  it('shows the table fallback when there are no cross-module edges', () => {
    const mg = buildModuleGraph({ nodes: ['a/x.ts', 'a/y.ts'], edges: [['a/x.ts', 'a/y.ts']] }, [])
    const { getByText } = render(<GraphCanvas graph={mg} />)
    expect(getByText(/no cross-module imports/i)).toBeTruthy()
  })
})
