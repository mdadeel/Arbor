import { describe, expect, it } from 'vitest'
import { selectComparableRuns } from './trend-utils'

describe('compatible trend snapshots', () => {
  it('compares only the latest branch, analyzer version, and effective policy snapshot', () => {
    const rows = [
      { id: 'latest', branch: 'main', analysisVersion: 2, policySnapshot: { schemaVersion: 1, packs: [{ key: 'security', overrides: { b: 2, a: 1 } }] } },
      { id: 'same', branch: 'main', analysisVersion: 2, policySnapshot: { packs: [{ overrides: { a: 1, b: 2 }, key: 'security' }], schemaVersion: 1 } },
      { id: 'different-policy', branch: 'main', analysisVersion: 2, policySnapshot: { schemaVersion: 1, packs: [{ key: 'security', overrides: { a: 1 } }] } },
      { id: 'different-version', branch: 'main', analysisVersion: 1, policySnapshot: { schemaVersion: 1, packs: [{ key: 'security', overrides: { a: 1, b: 2 } }] } },
      { id: 'other-branch', branch: 'feature/x', analysisVersion: 2, policySnapshot: { schemaVersion: 1, packs: [{ key: 'security', overrides: { a: 1, b: 2 } }] } },
    ]

    expect(selectComparableRuns(rows)).toEqual({
      rows: [rows[0], rows[1]],
      branch: 'main',
      analysisVersion: 2,
      excludedRuns: 3,
    })
  })

  it('returns an empty trend for projects without completed runs', () => {
    expect(selectComparableRuns([])).toEqual({ rows: [], branch: null, analysisVersion: null, excludedRuns: 0 })
  })
})
