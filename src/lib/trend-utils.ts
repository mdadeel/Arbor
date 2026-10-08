export type TrendCompatibilityFields = {
  branch: string
  analysisVersion: number
  policySnapshot: unknown
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

export function selectComparableRuns<T extends TrendCompatibilityFields>(rows: T[]) {
  const anchor = rows[0]
  if (!anchor) return { rows: [] as T[], branch: null, analysisVersion: null, excludedRuns: 0 }
  const policyKey = canonicalJson(anchor.policySnapshot)
  const comparableRows = rows.filter((row) =>
    row.branch === anchor.branch &&
    row.analysisVersion === anchor.analysisVersion &&
    canonicalJson(row.policySnapshot) === policyKey
  )
  return {
    rows: comparableRows,
    branch: anchor.branch,
    analysisVersion: anchor.analysisVersion,
    excludedRuns: rows.length - comparableRows.length,
  }
}
