/**
 * Presentation metadata for analysis findings.
 *
 * These helpers derive a stable rule identifier and a human-readable detection
 * method from data already stored on every finding. They intentionally work for
 * historical analyses too: no new field or migration is required, and unknown
 * rules fall back to their category.
 */

export interface FindingMetaInput {
  id: string
  category: string
  ruleId?: string
  title?: string
}

const PREFIX_METHODS: Array<[string, string]> = [
  ['a11y-', 'AST (JSX inspection)'],
  ['img-alt', 'AST (JSX inspection)'],
  ['secret-', 'Pattern match'],
  ['no-env-example', 'Source scan + .env.example comparison'],
  ['undocumented-env', 'Source scan + .env.example comparison'],
  ['env-', 'Source scan + .env.example comparison'],
  ['circular-', 'Import graph analysis'],
  ['huge-file-', 'File metrics'],
  ['avg-file-lines', 'File metrics'],
  ['many-top-dirs', 'File metrics'],
  ['no-entrypoint', 'File metrics'],
  ['structure-hint', 'File metrics'],
  ['analysis-coverage', 'Scan budget accounting'],
  ['dependency-advisory', 'Manifest/lockfile parse'],
  ['unused-deps', 'Manifest/lockfile parse'],
  ['dead-exports', 'AST export analysis'],
  ['any-types', 'AST inspection'],
  ['console-logs', 'AST inspection'],
  ['raw-img', 'AST + rendering heuristics'],
  ['next-image-mixed', 'AST + rendering heuristics'],
  ['client-heavy', 'AST + rendering heuristics'],
  ['no-readme', 'README/comment scan'],
  ['low-comments', 'README/comment scan'],
  ['no-comments', 'README/comment scan'],
  ['no-design-tokens', 'Token/component scan'],
  ['hardcoded-colors', 'Token/component scan'],
  ['no-component-pattern', 'Token/component scan'],
  ['split-component-dirs', 'Token/component scan'],
]

const CATEGORY_METHODS: Record<string, string> = {
  security: 'Rule-based static check',
  environment: 'Source scan + .env.example comparison',
  accessibility: 'AST (JSX inspection)',
  performance: 'AST + heuristics',
  structure: 'Static file metrics',
  techDebt: 'Static heuristics',
  documentation: 'README/comment scan',
  designSystem: 'Token/component scan',
  analysis: 'Scan accounting',
}

/** The rule that produced this finding (falls back to the finding id). */
export function findingRuleId(finding: FindingMetaInput): string {
  return finding.ruleId ?? finding.id
}

/** A short, human-readable description of how the finding was detected. */
export function findingDetectionMethod(finding: FindingMetaInput): string {
  const rule = findingRuleId(finding)
  for (const [prefix, method] of PREFIX_METHODS) {
    if (rule.startsWith(prefix)) return method
  }
  return CATEGORY_METHODS[finding.category] ?? 'Rule-based static check'
}
