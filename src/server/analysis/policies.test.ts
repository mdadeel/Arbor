import { describe, expect, it } from 'vitest'
import { applyPolicyPacks, POLICY_PACKS } from './policies'
import type { Finding } from './types'

const findings: Finding[] = [
  { id: 'secret-token', category: 'security', severity: 'critical', title: 'Secret', detail: 'Found' },
  { id: 'a11y-img-alt-8', ruleId: 'a11y-img-alt', category: 'accessibility', severity: 'warning', title: 'Image alt', detail: 'Missing', file: 'x.tsx', line: 8 },
  { id: 'raw-img', category: 'performance', severity: 'info', title: 'Raw image', detail: 'Review' },
]

describe('versioned policy packs', () => {
  it('adds stable pack/rule provenance while preserving findings', () => {
    const result = applyPolicyPacks(findings)
    expect(result[0]).toMatchObject({ ruleId: 'secret-token', policyPack: 'security', policyVersion: '1.0.0', severity: 'critical' })
    expect(result[1]).toMatchObject({ ruleId: 'a11y-img-alt', policyPack: 'accessibility', policyVersion: '1.0.0' })
    expect(result[2].policyPack).toBe('maintainability')
    expect(result[0].policySuppressed).toBe(false)
  })

  it('applies an explicit rule suppression and severity adjustment', () => {
    const result = applyPolicyPacks(findings, [{
      packKey: 'security',
      version: '1.2.0',
      enabled: true,
      overrides: { 'secret-token': { enabled: false, severity: 'info' } },
    }])
    expect(result[0]).toMatchObject({ policySuppressed: true, policyVersion: '1.2.0', severity: 'info' })
  })

  it('uses the later (project) setting to override a workspace setting', () => {
    const result = applyPolicyPacks(findings, [
      { packKey: 'accessibility', version: '1.0.0', enabled: false, overrides: {} },
      { packKey: 'accessibility', version: '1.1.0', enabled: true, overrides: {} },
    ])
    expect(result[1]).toMatchObject({ policySuppressed: false, policyVersion: '1.1.0' })
  })

  it('exposes only the supported built-in packs', () => {
    expect(POLICY_PACKS.map((pack) => pack.key)).toEqual(['security', 'maintainability', 'accessibility'])
  })
})
