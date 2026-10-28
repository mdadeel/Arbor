import type {
  Location,
  Log,
  ReportingConfiguration,
  ReportingDescriptor,
  Result,
  Run,
  Suppression,
} from 'sarif'

export const SARIF_VERSION = '2.1.0' as const
export const SARIF_SCHEMA_URI =
  'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json'
export const SARIF_MEDIA_TYPE = 'application/sarif+json'

export interface SarifInputFinding {
  id: string
  category: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  explanation?: string
  impact?: string
  recommendation?: string
  confidence?: 'high' | 'medium' | 'low'
  ruleId?: string
  policyPack?: string
  policyVersion?: string
  policySuppressed?: boolean
  fingerprint?: string
  evidence?: string[]
  file?: string
  line?: number
  count?: number
  paths?: string[]
}

export interface SarifSuppressionOverride {
  status: 'accepted_risk' | 'false_positive'
  note?: string | null
}

export interface BuildSarifLogInput {
  findings: readonly SarifInputFinding[]
  toolVersion?: string
  repoUrl?: string | null
  branch?: string | null
  commitSha?: string | null
  fallbackArtifactUri?: string
  triageSuppressionsByFingerprint?: ReadonlyMap<string, SarifSuppressionOverride>
}

export function normalizeRelativeArtifactUri(rawPath: string): string {
  const posix = rawPath.trim().replaceAll('\\', '/')
  const segments = posix
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')

  return segments.join('/')
}

function defaultAnchorForCategory(category: string, fallbackArtifactUri: string): string {
  if (category === 'environment') return '.env.example'
  if (category === 'documentation') return 'README.md'
  return normalizeRelativeArtifactUri(fallbackArtifactUri) || 'package.json'
}

export function severityToSarifLevel(
  severity: 'critical' | 'warning' | 'info'
): ReportingConfiguration.level {
  if (severity === 'critical') return 'error'
  if (severity === 'warning') return 'warning'
  return 'note'
}

function toPascalRuleName(ruleId: string): string {
  const cleaned = ruleId
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  return cleaned || 'ArborStaticCheck'
}

function securitySeverityScore(severity: 'critical' | 'warning' | 'info'): string {
  if (severity === 'critical') return '9.0'
  if (severity === 'warning') return '5.5'
  return '2.0'
}

function deterministicHexHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length
  let h2 = 0x41c6ce57 ^ input.length
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hi = (h2 >>> 0).toString(16).padStart(8, '0')
  const lo = (h1 >>> 0).toString(16).padStart(8, '0')
  return `${hi}${lo}`
}

function buildRuleHelp(finding: SarifInputFinding): { text: string; markdown: string } {
  const textSections: string[] = [finding.explanation ?? finding.detail]
  const mdSections: string[] = [finding.explanation ?? finding.detail]

  if (finding.impact) {
    textSections.push(`Impact: ${finding.impact}`)
    mdSections.push(`### Impact\n${finding.impact}`)
  }
  if (finding.recommendation) {
    textSections.push(`Recommendation: ${finding.recommendation}`)
    mdSections.push(`### Recommended Action\n${finding.recommendation}`)
  }

  return {
    text: textSections.filter(Boolean).join('\n\n'),
    markdown: mdSections.filter(Boolean).join('\n\n'),
  }
}

function resolveFindingLocations(
  finding: SarifInputFinding,
  fallbackArtifactUri: string
): { locations: Location[]; relatedLocations?: Location[] } {
  const normalizedFile = finding.file ? normalizeRelativeArtifactUri(finding.file) : ''
  if (normalizedFile) {
    const startLine =
      typeof finding.line === 'number' && Number.isFinite(finding.line) && finding.line >= 1
        ? Math.trunc(finding.line)
        : 1

    return {
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: normalizedFile,
              uriBaseId: '%SRCROOT%',
            },
            region: {
              startLine,
            },
          },
        },
      ],
    }
  }

  const candidatePaths = (finding.paths ?? [])
    .map(normalizeRelativeArtifactUri)
    .filter((uri) => uri.length > 0)

  if (candidatePaths.length > 0) {
    const [primaryUri, ...restUris] = candidatePaths
    const relatedLocations: Location[] = restUris.slice(0, 20).map((uri, idx) => ({
      id: idx + 1,
      physicalLocation: {
        artifactLocation: {
          uri,
          uriBaseId: '%SRCROOT%',
        },
        region: {
          startLine: 1,
        },
      },
      message: {
        text: `Related module path in ${finding.title}: ${uri}`,
      },
    }))

    return {
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: primaryUri,
              uriBaseId: '%SRCROOT%',
            },
            region: {
              startLine: 1,
            },
          },
        },
      ],
      ...(relatedLocations.length > 0 ? { relatedLocations } : {}),
    }
  }

  const anchorUri = defaultAnchorForCategory(finding.category, fallbackArtifactUri)
  return {
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: anchorUri,
            uriBaseId: '%SRCROOT%',
          },
          region: {
            startLine: 1,
          },
        },
      },
    ],
  }
}

function isValidHttpUri(candidate: string | null | undefined): candidate is string {
  if (!candidate) return false
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function buildSarifLog(input: BuildSarifLogInput): Log {
  const fallbackArtifactUri = input.fallbackArtifactUri ?? 'package.json'
  const rulesById = new Map<string, { index: number; descriptor: ReportingDescriptor }>()
  const results: Result[] = []

  for (const finding of input.findings) {
    const rawRuleId = (finding.ruleId ?? finding.id).trim() || 'arbor-finding'
    const ruleId = rawRuleId.replace(/[^A-Za-z0-9._/-]/g, '-')
    const level = severityToSarifLevel(finding.severity)

    let ruleEntry = rulesById.get(ruleId)
    if (!ruleEntry) {
      const isSecurityRule = finding.category === 'security' || ruleId.startsWith('secret-')
      const tags = Array.from(
        new Set([
          'arbor',
          finding.category,
          ...(isSecurityRule ? ['security'] : ['maintainability']),
        ])
      )
      const precision =
        finding.confidence === 'high'
          ? 'high'
          : finding.confidence === 'low'
            ? 'low'
            : 'medium'
      const descriptor: ReportingDescriptor = {
        id: ruleId,
        name: toPascalRuleName(ruleId),
        shortDescription: {
          text: finding.title,
        },
        fullDescription: {
          text: finding.explanation ?? finding.detail,
        },
        help: buildRuleHelp(finding),
        defaultConfiguration: {
          level,
        },
        properties: {
          tags,
          precision,
          ...(isSecurityRule
            ? { 'security-severity': securitySeverityScore(finding.severity) }
            : {}),
        },
      }
      ruleEntry = { index: rulesById.size, descriptor }
      rulesById.set(ruleId, ruleEntry)
    }

    const { locations, relatedLocations } = resolveFindingLocations(finding, fallbackArtifactUri)
    const fingerprint =
      finding.fingerprint ??
      deterministicHexHash(
        `${ruleId}\0${(finding.file ?? '').toLowerCase()}\0${finding.title.trim().toLowerCase()}`
      )

    const suppressions: Suppression[] = []
    if (finding.policySuppressed) {
      suppressions.push({
        kind: 'external',
        status: 'accepted',
        justification: finding.policyPack
          ? `Suppressed by Arbor policy pack ${finding.policyPack}${finding.policyVersion ? `@${finding.policyVersion}` : ''}.`
          : 'Suppressed by workspace or project policy override.',
      })
    }

    const triageOverride = finding.fingerprint
      ? input.triageSuppressionsByFingerprint?.get(finding.fingerprint)
      : undefined
    if (triageOverride) {
      suppressions.push({
        kind: 'external',
        status: 'accepted',
        justification:
          triageOverride.note?.trim() ||
          (triageOverride.status === 'false_positive'
            ? 'Marked as false positive in Arbor finding triage.'
            : 'Marked as accepted risk in Arbor finding triage.'),
      })
    }

    const messageParts = [finding.detail || finding.title]
    if (finding.recommendation) {
      messageParts.push(`Recommendation: ${finding.recommendation}`)
    }

    const result: Result = {
      ruleId,
      ruleIndex: ruleEntry.index,
      level,
      message: {
        text: messageParts.join(' '),
      },
      locations,
      ...(relatedLocations ? { relatedLocations } : {}),
      partialFingerprints: {
        'arborFindingFingerprint/v1': fingerprint,
      },
      ...(suppressions.length > 0 ? { suppressions } : {}),
      properties: {
        category: finding.category,
        severity: finding.severity,
        ...(finding.confidence ? { confidence: finding.confidence } : {}),
        ...(typeof finding.count === 'number' ? { occurrences: finding.count } : {}),
      },
    }

    results.push(result)
  }

  const run: Run = {
    tool: {
      driver: {
        name: 'Arbor',
        version: input.toolVersion ?? '0.1.0',
        semanticVersion: input.toolVersion ?? '0.1.0',
        informationUri: 'https://github.com/mdadeel/Arbor',
        rules: Array.from(rulesById.values()).map((entry) => entry.descriptor),
      },
    },
    automationDetails: {
      id: input.branch ? `arbor/${input.branch}` : 'arbor/static-analysis',
    },
    ...(isValidHttpUri(input.repoUrl)
      ? {
          versionControlProvenance: [
            {
              repositoryUri: input.repoUrl,
              ...(input.commitSha ? { revisionId: input.commitSha } : {}),
              ...(input.branch ? { branch: input.branch } : {}),
            },
          ],
        }
      : {}),
    results,
  }

  return {
    $schema: SARIF_SCHEMA_URI,
    version: SARIF_VERSION,
    runs: [run],
  }
}

export function serializeSarifLog(input: BuildSarifLogInput): string {
  return JSON.stringify(buildSarifLog(input), null, 2)
}
