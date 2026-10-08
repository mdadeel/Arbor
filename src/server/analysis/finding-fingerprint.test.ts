import { describe, expect, it } from 'vitest'
import { fingerprintFinding } from './finding-fingerprint'

describe('finding fingerprints', () => {
  it('is stable when line numbers and finding IDs change but rule/path/title remain the same', () => {
    const first = fingerprintFinding({ id: 'img-alt-10', ruleId: 'img-alt', file: 'src/View.tsx', title: 'Missing alt text' })
    const later = fingerprintFinding({ id: 'img-alt-18', ruleId: 'img-alt', file: 'src/View.tsx', title: 'Missing alt text' })
    expect(first).toBe(later)
  })

  it('separates distinct files and rules', () => {
    const base = { id: 'rule-1', ruleId: 'rule-1', title: 'Problem' }
    expect(fingerprintFinding({ ...base, file: 'a.ts' })).not.toBe(fingerprintFinding({ ...base, file: 'b.ts' }))
    expect(fingerprintFinding({ ...base, ruleId: 'rule-2', file: 'a.ts' })).not.toBe(fingerprintFinding({ ...base, file: 'a.ts' }))
  })
})
