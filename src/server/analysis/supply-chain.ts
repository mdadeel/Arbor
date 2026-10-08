import type { DependencyAdvisory, DependencyAdvisoryReport, DependencyInventory } from './dependencies'
import type { Finding, Scores } from './types'

function findingSeverity(severity: string): Finding['severity'] {
  if (severity === 'critical' || severity === 'high') return 'critical'
  if (severity === 'medium' || severity === 'moderate') return 'warning'
  if (severity === 'low') return 'info'
  return 'warning'
}

export function dependencyAdvisoryFindings(
  inventory: DependencyInventory,
  report: DependencyAdvisoryReport
): Finding[] {
  const packages = new Map(inventory.packages.map((pkg) => [`${pkg.ecosystem}:${pkg.name}`, pkg]))
  return report.advisories.map((advisory: DependencyAdvisory) => {
    const pkg = packages.get(`${advisory.ecosystem}:${advisory.packageName}`)
    const installed = pkg?.version ?? 'unknown version'
    return {
      id: `dependency-${advisory.id}-${advisory.ecosystem}-${advisory.packageName}`.slice(0, 200),
      ruleId: 'dependency-advisory',
      category: 'security' as const,
      severity: findingSeverity(advisory.severity),
      title: `Known vulnerable dependency: ${advisory.packageName}@${installed}`,
      detail: advisory.summary,
      explanation: `The GitHub Advisory Database reports ${advisory.vulnerableRange ?? 'an affected version range'} for this ${advisory.ecosystem} package. Arbor matched the resolved version in the repository inventory.`,
      impact: `A vulnerable dependency may expose the application to the issue described by ${advisory.id}; actual exploitability depends on how the package is used.`,
      recommendation: advisory.patchedVersion
        ? `Upgrade ${advisory.packageName} to ${advisory.patchedVersion} or a later fixed release, then run the repository's tests.`
        : `Review ${advisory.id} and upgrade to a non-affected release when available.`,
      confidence: 'high',
      evidence: [
        `${pkg?.purl ?? `${advisory.ecosystem}:${advisory.packageName}@${installed}`}`,
        ...(pkg?.dependencyPath?.length ? [`Dependency path: ${pkg.dependencyPath.join(' → ')}`] : []),
        `Advisory: ${advisory.id}${advisory.url ? ` — ${advisory.url}` : ''}`,
      ],
    }
  })
}

export function scoreWithDependencyRisk(scores: Scores, findings: Finding[]): Scores {
  const activeAdvisories = findings.filter((finding) =>
    finding.ruleId === 'dependency-advisory' && !finding.policySuppressed
  )
  const penalty = Math.min(60, activeAdvisories.reduce((sum, finding) => {
    if (finding.severity === 'critical') return sum + 16
    if (finding.severity === 'warning') return sum + 8
    return sum + 2
  }, 0))
  const security = Math.max(0, scores.security - penalty)
  const overall = Math.max(0, Math.min(100, Math.round(scores.overall + (security - scores.security) * 0.15)))
  return { ...scores, security, overall }
}
