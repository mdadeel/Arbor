import type { FindingData } from '@/components/dashboard/finding-item'
import type { SharedDependencyRisk } from '@/server/services/report-sharing'

const MAX_FINDINGS_PER_GROUP = 40

export function PrintableFindingsSection({
  activeFindings,
  criticalFindings,
  warningFindings,
  infoFindings,
}: {
  activeFindings: FindingData[]
  criticalFindings: FindingData[]
  warningFindings: FindingData[]
  infoFindings: FindingData[]
}) {
  const severitySections: Array<{
    key: 'critical' | 'warning' | 'info'
    label: string
    subtitle: string
    badgeClass: string
    items: FindingData[]
  }> = [
    {
      key: 'critical',
      label: 'Critical Severity Findings',
      subtitle: 'High-impact security or structural risks requiring immediate remediation',
      badgeClass: 'audit-sev-critical',
      items: criticalFindings,
    },
    {
      key: 'warning',
      label: 'Warning Severity Findings',
      subtitle: 'Maintainability, accessibility, boundary, and configuration hazards',
      badgeClass: 'audit-sev-warning',
      items: warningFindings,
    },
    {
      key: 'info',
      label: 'Informational Signals',
      subtitle: 'Low-urgency hygiene observations and cleanup opportunities',
      badgeClass: 'audit-sev-info',
      items: infoFindings,
    },
  ]

  return (
    <section className="audit-section audit-section-break" aria-label="Findings Grouped by Severity">
      <div className="audit-section-header">
        <div>
          <span className="audit-section-num">Section 03</span>
          <h2 className="audit-section-title">Detailed Findings by Severity</h2>
        </div>
        <span className="audit-coverage-pill audit-mono">
          {activeFindings.length} active ({criticalFindings.length}C / {warningFindings.length}W /{' '}
          {infoFindings.length}I)
        </span>
      </div>

      {activeFindings.length === 0 ? (
        <div className="audit-empty-box">No active findings recorded for this snapshot.</div>
      ) : (
        severitySections.map((group) => {
          if (group.items.length === 0) return null
          const visibleItems = group.items.slice(0, MAX_FINDINGS_PER_GROUP)
          const omittedCount = group.items.length - visibleItems.length

          return (
            <div key={group.key} className="audit-severity-group">
              <div className="audit-severity-banner audit-avoid-break">
                <div>
                  <h3 className="audit-severity-heading">
                    <span className={`audit-sev-pill ${group.badgeClass}`}>{group.key}</span>
                    <span>
                      {group.label} ({group.items.length})
                    </span>
                  </h3>
                  <p className="audit-severity-subtitle">{group.subtitle}</p>
                </div>
              </div>

              <div className="audit-finding-list">
                {visibleItems.map((finding, idx) => {
                  const fileLoc = finding.file
                    ? `${finding.file}${finding.line ? `:${finding.line}` : ''}`
                    : 'Repository-wide'
                  const evidenceItems = (finding.evidence ?? []).slice(0, 3)

                  return (
                    <article
                      key={`${group.key}-${finding.id}-${finding.file ?? 'global'}-${finding.line ?? idx}-${idx}`}
                      className="audit-finding-card audit-avoid-break"
                    >
                      <div className="audit-finding-top">
                        <div className="audit-finding-title-wrap">
                          <span className="audit-finding-title">{finding.title}</span>
                          <span className="audit-category-tag audit-mono">{finding.category}</span>
                          {finding.policyPack && (
                            <span className="audit-policy-tag audit-mono">
                              {finding.policyPack}
                              {finding.policyVersion ? `@${finding.policyVersion}` : ''}
                            </span>
                          )}
                        </div>
                        <code className="audit-file-loc">{fileLoc}</code>
                      </div>

                      {finding.detail && <p className="audit-finding-detail">{finding.detail}</p>}

                      {evidenceItems.length > 0 && (
                        <div className="audit-evidence-row">
                          <span className="audit-evidence-label">Evidence:</span>
                          <span className="audit-evidence-items audit-mono">
                            {evidenceItems.join(' · ')}
                            {(finding.evidence?.length ?? 0) > evidenceItems.length
                              ? ` (+${(finding.evidence?.length ?? 0) - evidenceItems.length} more)`
                              : ''}
                          </span>
                        </div>
                      )}

                      {finding.recommendation && (
                        <p className="audit-finding-rec">
                          <strong>Remediation:</strong> {finding.recommendation}
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>

              {omittedCount > 0 && (
                <p className="audit-omitted-note">
                  + {omittedCount} additional {group.key} finding(s) recorded in the JSON export
                  snapshot.
                </p>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}

export function PrintableDependencyRiskSection({
  dependencyRisk,
}: {
  dependencyRisk: SharedDependencyRisk | null
}) {
  return (
    <section className="audit-section" aria-label="Dependency and Supply-Chain Risk">
      <div className="audit-section-header">
        <div>
          <span className="audit-section-num">Section 04</span>
          <h2 className="audit-section-title">Dependency &amp; Supply-Chain Risk</h2>
        </div>
        {dependencyRisk && (
          <span className="audit-coverage-pill audit-mono">
            {dependencyRisk.ecosystems.join(', ') || 'No manifests'} · Advisory check:{' '}
            {dependencyRisk.advisoryStatus}
          </span>
        )}
      </div>

      {!dependencyRisk ? (
        <div className="audit-empty-box">
          Dependency inventory metadata was not recorded on this snapshot.
        </div>
      ) : (
        <div className="audit-dep-stack">
          <table className="audit-table audit-avoid-break">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Direct Packages</th>
                <th style={{ width: '22%' }}>Transitive Graph</th>
                <th style={{ width: '28%' }}>Lockfiles Inspected</th>
                <th style={{ width: '28%' }}>Known Advisories</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="audit-mono audit-cell-strong">{dependencyRisk.directCount}</td>
                <td className="audit-mono audit-cell-strong">
                  {dependencyRisk.transitiveCount.toLocaleString()}
                  {dependencyRisk.truncated ? ' (capped)' : ''}
                </td>
                <td className="audit-mono">
                  {dependencyRisk.lockfiles.length > 0
                    ? dependencyRisk.lockfiles.join(', ')
                    : 'Manifest-only (unpinned)'}
                </td>
                <td className="audit-mono">
                  <strong>{dependencyRisk.advisoryCount}</strong> matched ({dependencyRisk.queriedCount}{' '}
                  queried via {dependencyRisk.advisorySource})
                </td>
              </tr>
            </tbody>
          </table>

          {dependencyRisk.advisories.length > 0 ? (
            <div className="audit-avoid-break">
              <h3 className="audit-subtable-title">Matched Vulnerability Advisories</h3>
              <table className="audit-table">
                <thead>
                  <tr>
                    <th style={{ width: '18%' }}>Advisory ID</th>
                    <th style={{ width: '22%' }}>Package</th>
                    <th style={{ width: '12%' }}>Severity</th>
                    <th style={{ width: '32%' }}>Summary</th>
                    <th style={{ width: '16%' }}>Patched</th>
                  </tr>
                </thead>
                <tbody>
                  {dependencyRisk.advisories.slice(0, 20).map((adv) => (
                    <tr key={`${adv.id}-${adv.packageName}`}>
                      <td className="audit-mono">{adv.id}</td>
                      <td className="audit-mono">{adv.packageName}</td>
                      <td className="audit-mono">{adv.severity}</td>
                      <td>{adv.summary}</td>
                      <td className="audit-mono">{adv.patchedVersion ?? 'None listed'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="audit-empty-box audit-avoid-break">
              {dependencyRisk.advisoryStatus === 'complete'
                ? `0 known advisories matched across ${dependencyRisk.queriedCount} pinned package queries against ${dependencyRisk.advisorySource}.`
                : `Advisory lookup status: ${dependencyRisk.advisoryStatus}. Run network-enabled supply-chain audit in CI alongside lockfile verification.`}
            </div>
          )}

          {dependencyRisk.directPackages.length > 0 && (
            <div>
              <h3 className="audit-subtable-title">
                Direct Dependency Inventory Sample (Top{' '}
                {Math.min(24, dependencyRisk.directPackages.length)} of{' '}
                {dependencyRisk.directCount})
              </h3>
              <table className="audit-table">
                <thead>
                  <tr>
                    <th style={{ width: '36%' }}>Package</th>
                    <th style={{ width: '22%' }}>Pinned / Declared Version</th>
                    <th style={{ width: '18%' }}>Scope</th>
                    <th style={{ width: '24%' }}>Ecosystem / License</th>
                  </tr>
                </thead>
                <tbody>
                  {dependencyRisk.directPackages.slice(0, 24).map((pkg) => (
                    <tr key={`${pkg.ecosystem}:${pkg.name}:${pkg.dependencyType}`}>
                      <td className="audit-mono audit-cell-strong">{pkg.name}</td>
                      <td className="audit-mono">{pkg.version}</td>
                      <td className="audit-mono">{pkg.dependencyType}</td>
                      <td className="audit-mono">
                        {pkg.ecosystem}
                        {pkg.license ? ` · ${pkg.license}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
