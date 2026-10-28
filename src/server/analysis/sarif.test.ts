import { describe, expect, it } from 'vitest'
import { runAnalysis } from './index'
import { validateSarifLog, assertValidSarifLog } from './sarif-validator'
import {
  SARIF_SCHEMA_URI,
  SARIF_VERSION,
  buildSarifLog,
  normalizeRelativeArtifactUri,
} from '@/lib/sarif'

describe('SARIF 2.1.0 export & official schema validation', () => {
  it('emits schema-valid SARIF 2.1.0 for real Arbor repository findings', () => {
    const report = runAnalysis(process.cwd())
    const sarif = buildSarifLog({
      findings: report.findings,
      repoUrl: 'https://github.com/mdadeel/Arbor',
      branch: 'main',
      commitSha: 'b35e44f9004631efab4800cdd2f7941569b92742',
    })

    expect(sarif.$schema).toBe(SARIF_SCHEMA_URI)
    expect(sarif.version).toBe(SARIF_VERSION)
    expect(sarif.runs).toHaveLength(1)

    const validation = validateSarifLog(sarif)
    expect(validation).toEqual({ valid: true, errors: [] })
    expect(() => assertValidSarifLog(sarif)).not.toThrow()

    const [run] = sarif.runs
    expect(run.tool.driver.name).toBe('Arbor')
    expect(run.results?.length).toBe(report.findings.length)

    // Every result must have a matching rule descriptor and a valid relative physicalLocation with startLine >= 1
    const ruleIds = new Set((run.tool.driver.rules ?? []).map((rule) => rule.id))
    for (const result of run.results ?? []) {
      expect(result.ruleId).toBeTruthy()
      expect(ruleIds.has(result.ruleId ?? '')).toBe(true)
      const loc = result.locations?.[0]?.physicalLocation
      expect(loc?.artifactLocation?.uri).toBeTruthy()
      expect(loc?.artifactLocation?.uri?.startsWith('/')).toBe(false)
      expect(loc?.region?.startLine).toBeGreaterThanOrEqual(1)
    }
  })

  it('normalizes paths, maps cycle paths to relatedLocations, and encodes policy/triage suppressions validly', () => {
    expect(normalizeRelativeArtifactUri('\\src\\server\\\\billing.ts')).toBe(
      'src/server/billing.ts'
    )
    expect(normalizeRelativeArtifactUri('/../../etc/passwd')).toBe('etc/passwd')

    const triageMap = new Map([
      [
        'fp-sec-1',
        {
          status: 'accepted_risk' as const,
          note: 'Reviewed test fixture credential.',
        },
      ],
    ])

    const sarif = buildSarifLog({
      findings: [
        {
          id: 'secret-hardcoded-credential',
          ruleId: 'secret-hardcoded-credential',
          category: 'security',
          severity: 'critical',
          title: 'Possible hardcoded credential',
          detail: 'Matched credential pattern in test file.',
          explanation: 'Heuristic credential regex matched.',
          impact: 'Secrets in source control risk unauthorized access.',
          recommendation: 'Move secrets into environment variables.',
          confidence: 'high',
          fingerprint: 'fp-sec-1',
          file: './src/config.ts',
          line: 42,
        },
        {
          id: 'circular-dependency',
          category: 'techDebt',
          severity: 'warning',
          title: 'Circular dependency',
          detail: 'Cycle detected across modules.',
          policySuppressed: true,
          policyPack: 'arbor-essential',
          policyVersion: '1.0.0',
          paths: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
        },
        {
          id: 'undocumented-env',
          category: 'environment',
          severity: 'info',
          title: 'Undocumented env vars',
          detail: 'CUSTOM_FLAG missing from .env.example.',
        },
      ],
      triageSuppressionsByFingerprint: triageMap,
    })

    const validation = validateSarifLog(sarif)
    expect(validation).toEqual({ valid: true, errors: [] })

    const results = sarif.runs[0]?.results ?? []
    expect(results).toHaveLength(3)

    // Security rule gets security-severity for GitHub Security tab
    const secRule = sarif.runs[0]?.tool.driver.rules?.find(
      (r) => r.id === 'secret-hardcoded-credential'
    )
    expect(secRule?.properties?.['security-severity']).toBe('9.0')
    expect(secRule?.properties?.tags).toContain('security')
    expect(results[0]?.level).toBe('error')
    expect(results[0]?.locations?.[0]?.physicalLocation?.region?.startLine).toBe(42)
    expect(results[0]?.suppressions).toHaveLength(1)

    // Cycle paths map primary + relatedLocations + policy suppression
    expect(results[1]?.locations?.[0]?.physicalLocation?.artifactLocation?.uri).toBe('src/a.ts')
    expect(results[1]?.relatedLocations).toHaveLength(2)
    expect(results[1]?.suppressions?.[0]?.status).toBe('accepted')

    // Repo-wide environment finding anchors to .env.example
    expect(results[2]?.locations?.[0]?.physicalLocation?.artifactLocation?.uri).toBe(
      '.env.example'
    )
  })

  it('rejects malformed SARIF documents that violate the OASIS 2.1.0 schema', () => {
    const invalidPayload = {
      version: '2.1.0',
      runs: [
        {
          tool: { driver: {} }, // missing required driver.name
          results: [{ level: 'not-a-valid-level' }],
        },
      ],
    }

    const validation = validateSarifLog(invalidPayload)
    expect(validation.valid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
    expect(() => assertValidSarifLog(invalidPayload)).toThrow(/Invalid SARIF 2\.1\.0 output/)
  })
})
