import { describe, expect, it } from 'vitest'
import { findingDetectionMethod, findingRuleId } from './finding-meta'

const base = { id: 'finding-1', category: 'security' }

describe('findingRuleId', () => {
  it('prefers the stored rule id', () => {
    expect(findingRuleId({ ...base, ruleId: 'secret-github-token' })).toBe('secret-github-token')
  })

  it('falls back to the finding id', () => {
    expect(findingRuleId(base)).toBe('finding-1')
  })
})

describe('findingDetectionMethod', () => {
  it.each([
    ['secret-github-token', 'security', 'Pattern match'],
    ['a11y-img-alt', 'accessibility', 'AST (JSX inspection)'],
    ['env-docs', 'environment', 'Source scan + .env.example comparison'],
    ['dependency-advisory', 'security', 'Manifest/lockfile parse'],
    ['unused-deps', 'techDebt', 'Manifest/lockfile parse'],
    ['dead-exports', 'techDebt', 'AST export analysis'],
    ['circular-dependency', 'techDebt', 'Import graph analysis'],
    ['huge-file-src-app.ts', 'techDebt', 'File metrics'],
    ['analysis-coverage', 'analysis', 'Scan budget accounting'],
    ['hardcoded-colors', 'designSystem', 'Token/component scan'],
    ['no-readme', 'documentation', 'README/comment scan'],
    ['raw-img', 'performance', 'AST + rendering heuristics'],
  ])('maps %s to %s', (ruleId, category, expected) => {
    expect(findingDetectionMethod({ ...base, category, ruleId })).toBe(expected)
  })

  it('falls back to the category for unknown rules', () => {
    expect(findingDetectionMethod({ ...base, id: 'mystery-rule' })).toBe('Rule-based static check')
    expect(findingDetectionMethod({ ...base, id: 'mystery-rule', category: 'techDebt' })).toBe('Static heuristics')
    expect(findingDetectionMethod({ ...base, id: 'mystery-rule', category: 'designSystem' })).toBe('Token/component scan')
  })
})
