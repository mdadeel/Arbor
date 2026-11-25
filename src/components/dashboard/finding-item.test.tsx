import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FindingItem, type FindingData } from './finding-item'

afterEach(() => {
  cleanup()
})

const finding: FindingData = {
  id: 'secret-github-token-1',
  ruleId: 'secret-github-token',
  category: 'security',
  severity: 'critical',
  title: 'Possible GitHub token committed',
  detail: 'A value matching this pattern was found in source text.',
  file: 'src/config.ts',
  line: 12,
}

describe('FindingItem metadata', () => {
  it('renders the rule and the detection method for every finding', () => {
    render(<FindingItem finding={finding} />)

    expect(screen.getByText('Detected by')).toBeDefined()
    expect(screen.getByText('Pattern match')).toBeDefined()
    expect(screen.getByText('Rule')).toBeDefined()
    expect(screen.getByText('secret-github-token')).toBeDefined()
  })

  it('falls back to the finding id and category method when no rule is stored', () => {
    render(
      <FindingItem
        finding={{ ...finding, id: 'mystery-1', ruleId: undefined, category: 'techDebt', severity: 'warning' }}
      />
    )

    expect(screen.getByText('mystery-1')).toBeDefined()
    expect(screen.getByText('Static heuristics')).toBeDefined()
  })
})
