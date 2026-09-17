import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ScoreBadge, getScoreColor } from './score-badge'
import { SummaryBar } from './summary-bar'
import { TechStackBadge, TechStackGroup } from './tech-stack-badge'
import { StatusBadge } from './status-badge'
import { FindingItem } from './finding-item'
import { MethodBadge } from './method-badge'
import { MarkdownViewer, extractToc } from './docs/markdown-viewer'

describe('ScoreBadge', () => {
  it('correctly categorizes scores into health thresholds', () => {
    expect(getScoreColor(90).label).toBe('Healthy')
    expect(getScoreColor(70).label).toBe('Good')
    expect(getScoreColor(50).label).toBe('Warning')
    expect(getScoreColor(20).label).toBe('Critical')
    expect(getScoreColor(null).label).toBe('Not analyzed')
  })

  it('renders score value or fallback dash', () => {
    const { unmount } = render(<ScoreBadge score={85} />)
    expect(screen.getByText('85')).toBeDefined()
    unmount()

    render(<ScoreBadge score={null} />)
    expect(screen.getByText('—')).toBeDefined()
  })
})

describe('SummaryBar', () => {
  it('renders all 4 metrics properly', () => {
    render(
      <SummaryBar
        counts={{
          total: 10,
          healthy: 6,
          warning: 3,
          error: 1,
        }}
      />
    )
    expect(screen.getByText('10')).toBeDefined()
    expect(screen.getByText('6')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
  })
})

describe('TechStackBadge', () => {
  it('renders individual badges and groups', () => {
    render(<TechStackGroup items={['Next.js', 'TypeScript', null, 'PostgreSQL']} />)
    expect(screen.getByText('Next.js')).toBeDefined()
    expect(screen.getByText('TypeScript')).toBeDefined()
    expect(screen.getByText('PostgreSQL')).toBeDefined()
  })
})

describe('StatusBadge', () => {
  it('renders status labels accurately', () => {
    render(<StatusBadge status="completed" />)
    expect(screen.getByText('completed')).toBeDefined()
  })
})

describe('FindingItem', () => {
  it('renders finding title, category, and file', () => {
    render(
      <FindingItem
        finding={{
          id: 'test-1',
          category: 'architecture',
          severity: 'critical',
          title: 'Circular Dependency',
          detail: 'module A and module B import each other',
          file: 'src/lib/a.ts',
          line: 12,
        }}
      />
    )
    expect(screen.getByText('Circular Dependency')).toBeDefined()
    expect(screen.getByText('architecture')).toBeDefined()
    expect(screen.getByText('src/lib/a.ts:12')).toBeDefined()
  })
})

describe('MethodBadge', () => {
  it('renders HTTP method names in uppercase', () => {
    const { unmount } = render(<MethodBadge method="get" />)
    expect(screen.getByText('GET')).toBeDefined()
    unmount()

    render(<MethodBadge method="POST" />)
    expect(screen.getByText('POST')).toBeDefined()
  })
})

describe('MarkdownViewer & TOC', () => {
  it('extracts table of contents items from headings', () => {
    const md = '# Title\n\nSome text\n\n## Subheading\n\n### Nested Item\n'
    const toc = extractToc(md)
    expect(toc).toHaveLength(3)
    expect(toc[0]).toEqual({ id: 'title', text: 'Title', level: 1 })
    expect(toc[1]).toEqual({ id: 'subheading', text: 'Subheading', level: 2 })
    expect(toc[2]).toEqual({ id: 'nested-item', text: 'Nested Item', level: 3 })
  })

  it('renders parsed HTML content', () => {
    render(
      <MarkdownViewer
        content={`## System Overview

This is a sample guide.`}
      />
    )
    expect(screen.getByText('System Overview')).toBeDefined()
    expect(screen.getByText('This is a sample guide.')).toBeDefined()
  })
})
