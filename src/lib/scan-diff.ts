import type { Finding, FindingCategory, FindingSeverity } from '@/server/analysis/types'

export interface ComparableScanInput {
  id: string
  createdAt: Date | string
  branch: string
  commitSha: string | null
  overallScore: number | null
  architectureScore: number | null
  techDebtScore: number | null
  performanceScore: number | null
  documentationScore: number | null
  securityScore: number | null
  designSystemScore: number | null
  findings: unknown
  metrics?: unknown
}

export interface ScanDiffSnapshotMeta {
  id: string
  createdAt: string
  branch: string
  commitSha: string | null
  overallScore: number | null
}

export type ScorePillarKey =
  | 'overall'
  | 'architecture'
  | 'techDebt'
  | 'performance'
  | 'documentation'
  | 'security'
  | 'designSystem'

export interface ScorePillarDelta {
  key: ScorePillarKey
  label: string
  previous: number | null
  latest: number | null
  delta: number | null
}

export interface ScanDiffFindingItem {
  key: string
  id: string
  ruleId: string
  severity: FindingSeverity
  category: FindingCategory
  title: string
  detail: string
  file: string | null
  line: number | null
}

export type ScanMetricKey = 'files' | 'loc' | 'circularDeps' | 'highRiskHotspots'

export interface ScanMetricDelta {
  key: ScanMetricKey
  label: string
  previous: number
  latest: number
  delta: number
}

export interface ScanDiffSummary {
  previous: ScanDiffSnapshotMeta
  latest: ScanDiffSnapshotMeta
  sameCommit: boolean
  scores: ScorePillarDelta[]
  counts: {
    previousTotal: number
    latestTotal: number
    netDelta: number
    introducedCount: number
    resolvedCount: number
    persistingCount: number
    criticalDelta: number
    warningDelta: number
    infoDelta: number
  }
  introducedFindings: ScanDiffFindingItem[]
  resolvedFindings: ScanDiffFindingItem[]
  metrics: ScanMetricDelta[]
}

const DEFAULT_MAX_DIFF_FINDINGS = 50

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
}

const VALID_CATEGORIES = new Set<FindingCategory>([
  'structure',
  'techDebt',
  'performance',
  'documentation',
  'security',
  'environment',
  'designSystem',
  'accessibility',
  'analysis',
])

function toIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
}

function normalizeSeverity(raw: unknown): FindingSeverity {
  if (raw === 'critical' || raw === 'warning' || raw === 'info') return raw
  return 'info'
}

function normalizeCategory(raw: unknown): FindingCategory {
  if (typeof raw === 'string' && VALID_CATEGORIES.has(raw as FindingCategory)) {
    return raw as FindingCategory
  }
  return 'analysis'
}

interface NormalizedVisibleFinding {
  baseKey: string
  id: string
  ruleId: string
  severity: FindingSeverity
  category: FindingCategory
  title: string
  detail: string
  file: string | null
  line: number | null
}

function extractVisibleFindings(rawFindings: unknown): NormalizedVisibleFinding[] {
  if (!Array.isArray(rawFindings)) return []
  const result: NormalizedVisibleFinding[] = []

  for (const raw of rawFindings) {
    if (!raw || typeof raw !== 'object') continue
    const f = raw as Partial<Finding> & Record<string, unknown>
    if (f.policySuppressed === true) continue

    const id = typeof f.id === 'string' && f.id ? f.id : 'finding'
    const ruleId = typeof f.ruleId === 'string' && f.ruleId ? f.ruleId : id
    const title = typeof f.title === 'string' && f.title.trim() ? f.title.trim() : ruleId
    const detail = typeof f.detail === 'string' ? f.detail : ''
    const file =
      typeof f.file === 'string' && f.file.trim()
        ? f.file.trim().replaceAll('\\', '/')
        : null
    const line = typeof f.line === 'number' && Number.isFinite(f.line) ? f.line : null
    const severity = normalizeSeverity(f.severity)
    const category = normalizeCategory(f.category)

    // Matches the exact canonical tuple hashed by `fingerprintFinding` in `finding-fingerprint.ts`.
    const baseKey = `${ruleId.toLowerCase()}\0${(file ?? '').toLowerCase()}\0${title.toLowerCase()}`

    result.push({
      baseKey,
      id,
      ruleId,
      severity,
      category,
      title,
      detail,
      file,
      line,
    })
  }

  // Deterministic ordering before assigning multiset occurrence indices.
  result.sort(
    (a, b) =>
      a.baseKey.localeCompare(b.baseKey) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.detail.localeCompare(b.detail)
  )

  return result
}

function indexFindingsByOccurrence(
  findings: readonly NormalizedVisibleFinding[]
): Map<string, ScanDiffFindingItem> {
  const counts = new Map<string, number>()
  const indexed = new Map<string, ScanDiffFindingItem>()

  for (const item of findings) {
    const occ = counts.get(item.baseKey) ?? 0
    counts.set(item.baseKey, occ + 1)
    const key = `${item.baseKey}#${occ}`
    indexed.set(key, {
      key,
      id: item.id,
      ruleId: item.ruleId,
      severity: item.severity,
      category: item.category,
      title: item.title,
      detail: item.detail,
      file: item.file,
      line: item.line,
    })
  }

  return indexed
}

function sortDiffFindings(items: ScanDiffFindingItem[]): ScanDiffFindingItem[] {
  return items.sort(
    (a, b) =>
      SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
      a.category.localeCompare(b.category) ||
      (a.file ?? '').localeCompare(b.file ?? '') ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.title.localeCompare(b.title)
  )
}

function scoreDelta(previous: number | null, latest: number | null): number | null {
  if (typeof previous !== 'number' || typeof latest !== 'number') return null
  return latest - previous
}

interface ExtractedMetricCounts {
  files: number | null
  loc: number | null
  circularDeps: number | null
  highRiskHotspots: number | null
}

function extractMetricCounts(rawMetrics: unknown): ExtractedMetricCounts {
  if (!rawMetrics || typeof rawMetrics !== 'object') {
    return { files: null, loc: null, circularDeps: null, highRiskHotspots: null }
  }
  const m = rawMetrics as Record<string, unknown>
  const files = typeof m.files === 'number' && Number.isFinite(m.files) ? m.files : null
  const loc = typeof m.loc === 'number' && Number.isFinite(m.loc) ? m.loc : null
  const circularDeps = Array.isArray(m.circularDeps) ? m.circularDeps.length : null

  let highRiskHotspots: number | null = null
  if (m.hotspots && typeof m.hotspots === 'object') {
    const h = m.hotspots as Record<string, unknown>
    if (typeof h.highRiskCount === 'number' && Number.isFinite(h.highRiskCount)) {
      highRiskHotspots = h.highRiskCount
    }
  }

  return { files, loc, circularDeps, highRiskHotspots }
}

function buildMetricDeltas(prevRaw: unknown, latestRaw: unknown): ScanMetricDelta[] {
  const prev = extractMetricCounts(prevRaw)
  const next = extractMetricCounts(latestRaw)
  const defs: { key: ScanMetricKey; label: string }[] = [
    { key: 'files', label: 'Source files' },
    { key: 'loc', label: 'Lines of code' },
    { key: 'circularDeps', label: 'Circular loops' },
    { key: 'highRiskHotspots', label: 'High-risk hotspots' },
  ]

  const deltas: ScanMetricDelta[] = []
  for (const def of defs) {
    const p = prev[def.key]
    const l = next[def.key]
    if (p == null || l == null) continue
    deltas.push({
      key: def.key,
      label: def.label,
      previous: p,
      latest: l,
      delta: l - p,
    })
  }
  return deltas
}

export function buildGitHubCompareHref(
  repoUrl: string | undefined,
  previousSha: string | null | undefined,
  latestSha: string | null | undefined
): string | null {
  if (!repoUrl || !repoUrl.startsWith('https://github.com/')) return null
  if (!previousSha || !latestSha) return null
  if (!/^[a-f0-9]{7,64}$/i.test(previousSha) || !/^[a-f0-9]{7,64}$/i.test(latestSha)) {
    return null
  }
  if (previousSha.toLowerCase() === latestSha.toLowerCase()) return null
  const cleanBase = repoUrl.replace(/\.git$/, '').replace(/\/+$/, '')
  return `${cleanBase}/compare/${encodeURIComponent(previousSha)}...${encodeURIComponent(latestSha)}`
}

export function computeScanDiff(
  previousRun: ComparableScanInput,
  latestRun: ComparableScanInput,
  maxFindings: number = DEFAULT_MAX_DIFF_FINDINGS
): ScanDiffSummary {
  const prevVisible = extractVisibleFindings(previousRun.findings)
  const latestVisible = extractVisibleFindings(latestRun.findings)

  const prevMap = indexFindingsByOccurrence(prevVisible)
  const latestMap = indexFindingsByOccurrence(latestVisible)

  const introducedAll: ScanDiffFindingItem[] = []
  const resolvedAll: ScanDiffFindingItem[] = []
  let persistingCount = 0

  for (const [key, item] of latestMap.entries()) {
    if (prevMap.has(key)) {
      persistingCount++
    } else {
      introducedAll.push(item)
    }
  }

  for (const [key, item] of prevMap.entries()) {
    if (!latestMap.has(key)) {
      resolvedAll.push(item)
    }
  }

  sortDiffFindings(introducedAll)
  sortDiffFindings(resolvedAll)

  const countBySeverity = (
    items: readonly NormalizedVisibleFinding[],
    sev: FindingSeverity
  ) => items.filter((item) => item.severity === sev).length

  const scores: ScorePillarDelta[] = [
    {
      key: 'overall',
      label: 'Overall',
      previous: previousRun.overallScore,
      latest: latestRun.overallScore,
      delta: scoreDelta(previousRun.overallScore, latestRun.overallScore),
    },
    {
      key: 'architecture',
      label: 'Architecture',
      previous: previousRun.architectureScore,
      latest: latestRun.architectureScore,
      delta: scoreDelta(previousRun.architectureScore, latestRun.architectureScore),
    },
    {
      key: 'techDebt',
      label: 'Tech Debt',
      previous: previousRun.techDebtScore,
      latest: latestRun.techDebtScore,
      delta: scoreDelta(previousRun.techDebtScore, latestRun.techDebtScore),
    },
    {
      key: 'performance',
      label: 'Performance',
      previous: previousRun.performanceScore,
      latest: latestRun.performanceScore,
      delta: scoreDelta(previousRun.performanceScore, latestRun.performanceScore),
    },
    {
      key: 'documentation',
      label: 'Documentation',
      previous: previousRun.documentationScore,
      latest: latestRun.documentationScore,
      delta: scoreDelta(previousRun.documentationScore, latestRun.documentationScore),
    },
    {
      key: 'security',
      label: 'Security',
      previous: previousRun.securityScore,
      latest: latestRun.securityScore,
      delta: scoreDelta(previousRun.securityScore, latestRun.securityScore),
    },
    {
      key: 'designSystem',
      label: 'Design System',
      previous: previousRun.designSystemScore,
      latest: latestRun.designSystemScore,
      delta: scoreDelta(previousRun.designSystemScore, latestRun.designSystemScore),
    },
  ]

  const sameCommit =
    Boolean(previousRun.commitSha && latestRun.commitSha) &&
    previousRun.commitSha!.toLowerCase() === latestRun.commitSha!.toLowerCase()

  return {
    previous: {
      id: previousRun.id,
      createdAt: toIsoTimestamp(previousRun.createdAt),
      branch: previousRun.branch,
      commitSha: previousRun.commitSha,
      overallScore: previousRun.overallScore,
    },
    latest: {
      id: latestRun.id,
      createdAt: toIsoTimestamp(latestRun.createdAt),
      branch: latestRun.branch,
      commitSha: latestRun.commitSha,
      overallScore: latestRun.overallScore,
    },
    sameCommit,
    scores,
    counts: {
      previousTotal: prevVisible.length,
      latestTotal: latestVisible.length,
      netDelta: latestVisible.length - prevVisible.length,
      introducedCount: introducedAll.length,
      resolvedCount: resolvedAll.length,
      persistingCount,
      criticalDelta:
        countBySeverity(latestVisible, 'critical') -
        countBySeverity(prevVisible, 'critical'),
      warningDelta:
        countBySeverity(latestVisible, 'warning') -
        countBySeverity(prevVisible, 'warning'),
      infoDelta:
        countBySeverity(latestVisible, 'info') - countBySeverity(prevVisible, 'info'),
    },
    introducedFindings: introducedAll.slice(0, maxFindings),
    resolvedFindings: resolvedAll.slice(0, maxFindings),
    metrics: buildMetricDeltas(previousRun.metrics, latestRun.metrics),
  }
}
