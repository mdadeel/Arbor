// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ScanDiffCard } from './scan-diff-card'
import type { ScanDiffSummary } from '@/lib/scan-diff'

const SAMPLE_SCAN_DIFF: ScanDiffSummary = {
  previous: {
    id: 'scan_prev',
    createdAt: '2026-10-25T10:00:00.000Z',
    branch: 'main',
    commitSha: 'efef02783d86402dd62d6549ca30481a3d2881b4',
    overallScore: 71,
  },
  latest: {
    id: 'scan_latest',
    createdAt: '2026-10-29T10:00:00.000Z',
    branch: 'main',
    commitSha: '4b843d69f61cc83b9e2b5375a81e8b3daadee173',
    overallScore: 80,
  },
  sameCommit: false,
  scores: [
    { key: 'overall', label: 'Overall', previous: 71, latest: 80, delta: 9 },
    { key: 'architecture', label: 'Architecture', previous: 88, latest: 92, delta: 4 },
    { key: 'techDebt', label: 'Tech Debt', previous: 52, latest: 66, delta: 14 },
    { key: 'performance', label: 'Performance', previous: 90, latest: 90, delta: 0 },
    { key: 'documentation', label: 'Documentation', previous: 74, latest: 78, delta: 4 },
    { key: 'security', label: 'Security', previous: 65, latest: 82, delta: 17 },
    { key: 'designSystem', label: 'Design System', previous: 59, latest: 59, delta: 0 },
  ],
  counts: {
    previousTotal: 6,
    latestTotal: 5,
    netDelta: -1,
    introducedCount: 1,
    resolvedCount: 2,
    persistingCount: 4,
    criticalDelta: -1,
    warningDelta: 0,
    infoDelta: 0,
  },
  introducedFindings: [
    {
      key: 'new-1',
      id: 'raw-img',
      ruleId: 'raw-img-tag',
      severity: 'warning',
      category: 'performance',
      title: 'Unoptimized image element',
      detail: 'Use next/image for automatic sizing.',
      file: 'src/components/banner.tsx',
      line: 24,
    },
  ],
  resolvedFindings: [
    {
      key: 'res-1',
      id: 'secret-1',
      ruleId: 'secret-hardcoded-credential',
      severity: 'critical',
      category: 'security',
      title: 'Hardcoded secret removed',
      detail: 'Moved credential to environment configuration.',
      file: 'src/server/legacy-auth.ts',
      line: 11,
    },
  ],
  metrics: [
    { key: 'files', label: 'Source files', previous: 350, latest: 354, delta: 4 },
    { key: 'circularDeps', label: 'Circular loops', previous: 1, latest: 0, delta: -1 },
  ],
}

describe('ScanDiffCard', () => {
  it('renders score deltas, GitHub compare + commit-pinned file links, filters, and baseline switcher', () => {
    const onSelectBaseline = vi.fn()
    render(
      <ScanDiffCard
        scanDiff={SAMPLE_SCAN_DIFF}
        repoUrl="https://github.com/mdadeel/Arbor"
        baselineOptions={[
          {
            id: 'scan_prev',
            createdAt: '2026-10-25T10:00:00.000Z',
            commitSha: 'efef02783d86402dd62d6549ca30481a3d2881b4',
            overallScore: 71,
          },
          {
            id: 'scan_older',
            createdAt: '2026-10-18T10:00:00.000Z',
            commitSha: 'b35e44f9004631efab4800cdd2f7941569b92742',
            overallScore: 63,
          },
        ]}
        onSelectBaseline={onSelectBaseline}
      />
    )

    expect(screen.getByText('What Changed Since Previous Scan')).toBeTruthy()
    expect(screen.getByText('+9 pts')).toBeTruthy()
    expect(screen.getByText('Unoptimized image element')).toBeTruthy()
    expect(screen.getByText('Hardcoded secret removed')).toBeTruthy()

    const compareLink = screen.getByRole('link', { name: /Compare commits/i })
    expect(compareLink.getAttribute('href')).toBe(
      'https://github.com/mdadeel/Arbor/compare/efef02783d86402dd62d6549ca30481a3d2881b4...4b843d69f61cc83b9e2b5375a81e8b3daadee173'
    )

    // Newly introduced finding links to latest commit SHA; resolved finding links to previous commit SHA
    const newFileLink = screen.getByRole('link', { name: 'src/components/banner.tsx:24' })
    expect(newFileLink.getAttribute('href')).toBe(
      'https://github.com/mdadeel/Arbor/blob/4b843d69f61cc83b9e2b5375a81e8b3daadee173/src/components/banner.tsx#L24'
    )
    const resolvedFileLink = screen.getByRole('link', { name: 'src/server/legacy-auth.ts:11' })
    expect(resolvedFileLink.getAttribute('href')).toBe(
      'https://github.com/mdadeel/Arbor/blob/efef02783d86402dd62d6549ca30481a3d2881b4/src/server/legacy-auth.ts#L11'
    )

    // Filter to Resolved only
    fireEvent.click(screen.getByRole('button', { name: 'Resolved (2)' }))
    expect(screen.queryByText('Unoptimized image element')).toBeNull()
    expect(screen.getByText('Hardcoded secret removed')).toBeTruthy()

    // Switch baseline dropdown
    const baselineSelect = screen.getByLabelText('Compare latest scan against')
    fireEvent.change(baselineSelect, { target: { value: 'scan_older' } })
    expect(onSelectBaseline).toHaveBeenCalledWith('scan_older')
  })

  it('renders an informative empty state when no previous comparable scan exists', () => {
    render(<ScanDiffCard scanDiff={null} />)
    expect(screen.getByText('No previous comparable scan yet')).toBeTruthy()
  })
})
