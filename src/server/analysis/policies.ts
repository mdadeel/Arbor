import type { Finding, FindingCategory, FindingSeverity } from './types'
import { fingerprintFinding } from './finding-fingerprint'

export const POLICY_PACKS = [
  {
    key: 'security',
    version: '1.0.0',
    title: 'Security',
    description: 'Prioritizes secret exposure and security-category findings.',
    categories: ['security'] as FindingCategory[],
    rules: [
      { id: 'secret-aws-access-key', title: 'AWS access key patterns' },
      { id: 'secret-private-key', title: 'Private key blocks' },
      { id: 'secret-github-token', title: 'GitHub token patterns' },
      { id: 'secret-slack-token', title: 'Slack token patterns' },
      { id: 'secret-hardcoded-credential', title: 'Hardcoded credential patterns' },
      { id: 'secret-generic-secret-assignment', title: 'Generic secret assignments' },
      { id: 'dependency-advisory', title: 'Known vulnerable dependencies' },
    ],
  },
  {
    key: 'maintainability',
    version: '1.0.0',
    title: 'Maintainability',
    description: 'Reviews structure, technical debt, performance, documentation, and environment hygiene.',
    categories: ['structure', 'techDebt', 'performance', 'documentation', 'environment', 'designSystem'] as FindingCategory[],
    rules: [
      { id: 'circular-dep', title: 'Circular dependencies' },
      { id: 'unused-deps', title: 'Possibly unused dependencies' },
      { id: 'dead-exports', title: 'Possibly unused exports' },
      { id: 'avg-file-lines', title: 'Large average file size' },
      { id: 'huge-file-*', title: 'Large source files' },
      { id: 'client-heavy', title: 'Client-heavy React source' },
      { id: 'raw-img', title: 'Unoptimized image tags' },
      { id: 'env-docs', title: 'Undocumented environment variables' },
      { id: 'no-env-example', title: 'Missing environment example' },
      { id: 'no-readme', title: 'Missing repository README' },
    ],
  },
  {
    key: 'accessibility',
    version: '1.0.0',
    title: 'Accessibility',
    description: 'Flags source-level accessibility patterns for human review.',
    categories: ['accessibility'] as FindingCategory[],
    rules: [
      { id: 'a11y-img-alt', title: 'Image alternative text' },
      { id: 'a11y-button-name', title: 'Button accessible name' },
    ],
  },
] as const

export type PolicyPackKey = (typeof POLICY_PACKS)[number]['key']
export type PolicyRuleOverride = { enabled?: boolean; severity?: FindingSeverity }
export type PolicyPackSetting = {
  packKey: string
  version: string
  enabled: boolean
  overrides: unknown
}

const VALID_SEVERITIES = new Set<FindingSeverity>(['critical', 'warning', 'info'])

function parseOverrides(value: unknown): Record<string, PolicyRuleOverride> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, PolicyRuleOverride> = {}
  for (const [ruleId, raw] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    if (!/^[a-zA-Z0-9:_*\-]{1,160}$/.test(ruleId) || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const entry = raw as Record<string, unknown>
    const override: PolicyRuleOverride = {}
    if (typeof entry.enabled === 'boolean') override.enabled = entry.enabled
    if (typeof entry.severity === 'string' && VALID_SEVERITIES.has(entry.severity as FindingSeverity)) {
      override.severity = entry.severity as FindingSeverity
    }
    result[ruleId] = override
  }
  return result
}

export function policyRuleForFinding(finding: Finding): string {
  const ruleId = finding.ruleId ?? finding.id
  if (ruleId.startsWith('huge-file-')) return 'huge-file-*'
  return ruleId
}

function packForFinding(finding: Finding) {
  return POLICY_PACKS.find((pack) => (pack.categories as readonly string[]).includes(finding.category))
}

/**
 * Apply workspace settings first, then project settings. A project setting for a
 * pack replaces the workspace setting for that pack; each finding retains the
 * exact ruleset version and rule identity used for later triage/audit.
 */
export function applyPolicyPacks(
  findings: Finding[],
  settings: PolicyPackSetting[] = []
): Finding[] {
  const resolved = new Map<string, PolicyPackSetting>()
  for (const setting of settings) resolved.set(setting.packKey, setting)

  return findings.map((finding) => {
    const ruleId = policyRuleForFinding(finding)
    const pack = packForFinding(finding)
    if (!pack) return { ...finding, ruleId, fingerprint: finding.fingerprint ?? fingerprintFinding(finding) }

    const setting = resolved.get(pack.key)
    const overrides = parseOverrides(setting?.overrides)
    const override = overrides[ruleId] ?? overrides[finding.id]
    const enabled = (setting?.enabled ?? true) && override?.enabled !== false
    return {
      ...finding,
      ruleId,
      fingerprint: finding.fingerprint ?? fingerprintFinding(finding),
      policyPack: pack.key,
      policyVersion: setting?.version ?? pack.version,
      policySuppressed: !enabled,
      severity: override?.severity ?? finding.severity,
    }
  })
}
