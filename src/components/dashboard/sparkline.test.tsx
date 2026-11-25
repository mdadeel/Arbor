import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Sparkline, sparklinePoints } from './sparkline'

afterEach(() => {
  cleanup()
})

describe('sparklinePoints', () => {
  it('returns an empty string for fewer than two points', () => {
    expect(sparklinePoints([])).toBe('')
    expect(sparklinePoints([83])).toBe('')
  })

  it('spreads points across the full width in order', () => {
    const points = sparklinePoints([0, 50, 100], 100, 20, 0)
    const coords = points.split(' ').map((pair) => pair.split(',').map(Number))

    expect(coords).toHaveLength(3)
    expect(coords[0][0]).toBe(0)
    expect(coords[2][0]).toBe(100)
    expect(coords[0][1]).toBe(20)
    expect(coords[2][1]).toBe(0)
  })

  it('draws a flat series as a horizontal line instead of dividing by zero', () => {
    const points = sparklinePoints([70, 70, 70], 100, 20, 0)
    const ys = points.split(' ').map((pair) => Number(pair.split(',')[1]))
    expect(new Set(ys).size).toBe(1)
    expect(Number.isFinite(ys[0])).toBe(true)
  })
})

describe('Sparkline', () => {
  it('renders an accessible svg for a trend', () => {
    const { getByRole } = render(<Sparkline values={[61, 74, 83]} label="Demo trend" />)
    expect(getByRole('img', { name: 'Demo trend' })).toBeTruthy()
  })

  it('renders a dash when there is no trend yet', () => {
    const { getByText } = render(<Sparkline values={[]} />)
    expect(getByText('—')).toBeTruthy()
  })
})
