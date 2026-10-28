import { describe, expect, it } from 'vitest'
import {
  buildRecommendedActions,
  estimateRemediationEffort,
  toOneLineRemediation,
  type RecommendedActionFindingInput,
} from './recommended-actions'

describe('buildRecommendedActions', () => {
  const sampleFindings: RecommendedActionFindingInput[] = [
    {
      id: 'f-info',
      title: '13 console.log calls',
      category: 'techDebt',
      severity: 'info',
      detail: 'Found debug logging.',
      count: 13,
    },
    {
      id: 'f-crit-test',
      title: 'Possible Hardcoded credential committed',
      category: 'security',
      severity: 'critical',
      file: 'src/lib/auth.test.ts',
      line: 6,
      recommendation: 'Move fixtures to clearly fake test constants or env mocks.',
    },
    {
      id: 'f-crit-prod',
      title: 'Possible Hardcoded credential committed',
      category: 'security',
      severity: 'critical',
      file: 'src/lib/auth.ts',
      line: 125,
      recommendation: 'Load credentials from server-only environment variables and rotate any exposed secret.',
    },
    {
      id: 'f-warn-global',
      title: '230 explicit `any` type usages',
      category: 'techDebt',
      severity: 'warning',
      count: 230,
      evidence: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    },
    {
      id: 'f-warn-huge',
      ruleId: 'huge-file-admin',
      title: 'Large source file',
      category: 'structure',
      severity: 'warning',
      file: 'src/components/admin-view.tsx',
      count: 1546,
    },
    {
      id: 'f-warn-a11y',
      title: 'Image may be missing alternative text',
      category: 'accessibility',
      severity: 'warning',
      file: 'src/components/hero.tsx',
      line: 42,
    },
    {
      id: 'f-suppressed',
      title: 'Suppressed critical finding',
      category: 'security',
      severity: 'critical',
      file: 'src/server/index.ts',
      line: 1,
      policySuppressed: true,
    },
  ]

  const graph = {
    nodes: ['src/lib/auth.ts', 'src/app/api/trpc/route.ts', 'src/server/trpc.ts', 'src/app/login/page.tsx'],
    edges: [
      ['src/app/api/trpc/route.ts', 'src/lib/auth.ts'],
      ['src/server/trpc.ts', 'src/lib/auth.ts'],
      ['src/app/login/page.tsx', 'src/lib/auth.ts'],
    ] as [string, string][],
  }

  it('excludes suppressed findings and deterministically returns top 5 ranked by severity then blast radius', () => {
    const firstRun = buildRecommendedActions(sampleFindings, { dependencyGraph: graph })
    const secondRun = buildRecommendedActions([...sampleFindings].reverse(), { dependencyGraph: graph })

    expect(firstRun).toHaveLength(5)
    expect(firstRun).toEqual(secondRun)

    // Suppressed critical finding must never appear.
    expect(firstRun.some((item) => item.findingId === 'f-suppressed')).toBe(false)

    // Production high-fan-in critical finding outranks test-file critical finding.
    expect(firstRun[0]?.findingId).toBe('f-crit-prod')
    expect(firstRun[0]?.effort).toBe('M')
    expect(firstRun[0]?.blastRadiusLabel).toContain('3 dependents')

    expect(firstRun[1]?.findingId).toBe('f-crit-test')
    expect(firstRun[1]?.effort).toBe('S')

    // Cross-cutting 230-occurrence warning outranks single-file accessibility warning.
    expect(firstRun[2]?.findingId).toBe('f-warn-global')
    expect(firstRun[2]?.effort).toBe('L')
  })

  it('produces concise one-line remediations and S/M/L effort estimates without AI calls', () => {
    const line = toOneLineRemediation({
      title: 'Circular dependency',
      category: 'structure',
      severity: 'warning',
    })
    expect(line).toContain('leaf module')
    expect(line.includes('\n')).toBe(false)

    expect(
      estimateRemediationEffort({
        ruleId: 'huge-file-1',
        title: 'Large source file',
        category: 'structure',
        severity: 'warning',
        file: 'src/big.tsx',
        count: 1200,
      })
    ).toBe('L')

    expect(
      estimateRemediationEffort({
        title: '2 environment variable(s) are undocumented',
        category: 'environment',
        severity: 'warning',
        count: 2,
      })
    ).toBe('S')
  })
})
