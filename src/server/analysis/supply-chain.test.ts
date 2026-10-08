import { describe, expect, it } from 'vitest'
import { dependencyAdvisoryFindings, scoreWithDependencyRisk } from './supply-chain'
import type { DependencyAdvisoryReport, DependencyInventory } from './dependencies'
import type { Scores } from './types'

const inventory: DependencyInventory = {
  version: 1,
  packages: [{ name: 'lodash', version: '4.17.20', ecosystem: 'npm', direct: true, dependencyType: 'prod', purl: 'pkg:npm/lodash@4.17.20', dependencyPath: ['lodash'], resolved: true }],
  ecosystems: ['npm'], lockfiles: ['package-lock.json'], directCount: 1, transitiveCount: 0, complete: true, truncated: false,
}
const advisoryReport: DependencyAdvisoryReport = {
  status: 'complete', source: 'GitHub Advisory Database', checkedAt: '2026-10-07T00:00:00.000Z',
  queriedCount: 1, advisoryCount: 1,
  advisories: [{
    id: 'GHSA-test', packageName: 'lodash', ecosystem: 'npm', severity: 'high',
    summary: 'A vulnerability', vulnerableRange: '<4.17.21', patchedVersion: '4.17.21', url: 'https://github.com/advisories/GHSA-test',
  }],
}

describe('supply-chain findings and score adjustments', () => {
  it('turns a resolved advisory into a traceable security finding', () => {
    expect(dependencyAdvisoryFindings(inventory, advisoryReport)[0]).toMatchObject({
      ruleId: 'dependency-advisory', category: 'security', severity: 'critical',
      title: 'Known vulnerable dependency: lodash@4.17.20',
      recommendation: expect.stringContaining('4.17.21'),
    })
  })

  it('penalizes security and overall scores for active findings, but not policy-suppressed ones', () => {
    const scores: Scores = { architecture: 90, techDebt: 90, performance: 90, documentation: 90, security: 90, designSystem: 90, overall: 90 }
    const finding = dependencyAdvisoryFindings(inventory, advisoryReport)[0]
    expect(scoreWithDependencyRisk(scores, [finding]).security).toBe(74)
    expect(scoreWithDependencyRisk(scores, [{ ...finding, policySuppressed: true }])).toEqual(scores)
  })
})
