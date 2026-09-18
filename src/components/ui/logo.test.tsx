import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Logo } from './logo'

describe('Logo Component', () => {
  it('renders svg logo glyph mark by default', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32')
  })

  it('renders wordmark when showWordmark is true', () => {
    render(<Logo showWordmark={true} />)
    expect(screen.getByText('Arbor')).toBeDefined()
    expect(screen.getByText('DEV')).toBeDefined()
  })

  it('applies correct size classes', () => {
    const { container: smContainer } = render(<Logo size="sm" />)
    expect(smContainer.querySelector('.h-5')).toBeDefined()

    const { container: xlContainer } = render(<Logo size="xl" />)
    expect(xlContainer.querySelector('.h-14')).toBeDefined()
  })
})
