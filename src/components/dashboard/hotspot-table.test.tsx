// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HotspotTable } from './hotspot-table'

describe('HotspotTable component', () => {
  it('returns null gracefully when hotspot metrics are absent on legacy analyses', () => {
    const { container } = render(<HotspotTable rawHotspots={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders ranked hotspot rows with GitHub blob links, churn counts, and AST complexity', () => {
    render(
      <HotspotTable
        repoUrl="https://github.com/mdadeel/Arbor"
        commitSha="58a5dbec833ce3e67377d205d1987ba81bfb5515"
        rawHotspots={{
          commitsAnalyzed: 42,
          windowDays: 180,
          filesWithChurn: 18,
          highRiskCount: 1,
          entries: [
            {
              rank: 1,
              file: 'src/server/analysis/index.ts',
              hotspotScore: 84,
              risk: 'high',
              commits: 9,
              linesChanged: 312,
              distinctAuthors: 2,
              lastModifiedAt: '2026-10-28T14:00:00.000Z',
              cyclomaticComplexity: 56,
              functionCount: 11,
              loc: 472,
            },
            {
              rank: 2,
              file: 'src/lib/env.ts',
              hotspotScore: 28,
              risk: 'low',
              commits: 3,
              linesChanged: 24,
              distinctAuthors: 1,
              lastModifiedAt: '2026-10-27T09:00:00.000Z',
              cyclomaticComplexity: 4,
              functionCount: 0,
              loc: 38,
            },
          ],
        }}
      />
    )

    expect(
      screen.getByRole('table', { name: 'Ranked code hotspots' })
    ).toBeDefined()
    expect(screen.getByText('18 active files')).toBeDefined()
    expect(screen.getByText('1 high-friction')).toBeDefined()

    const firstLink = screen.getByRole('link', { name: /src\/server\/analysis\/index\.ts/i })
    expect(firstLink.getAttribute('href')).toBe(
      'https://github.com/mdadeel/Arbor/blob/58a5dbec833ce3e67377d205d1987ba81bfb5515/src/server/analysis/index.ts'
    )
    expect(screen.getByText('9 commits')).toBeDefined()
    expect(screen.getByText('CC 56')).toBeDefined()
  })
})
