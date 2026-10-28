import type { ImportGraph } from '@/server/analysis/types'

export type EffortEstimate = 'S' | 'M' | 'L'

export type RecommendedActionFindingInput = {
  id?: string
  ruleId?: string
  title: string
  category: string
  severity: 'critical' | 'warning' | 'info'
  detail?: string
  recommendation?: string
  evidence?: string[]
  file?: string
  line?: number
  count?: number
  paths?: string[]
  policySuppressed?: boolean
}

export type RecommendedAction = {
  rank: number
  findingId: string
  title: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  location: string
  blastRadiusScore: number
  blastRadiusLabel: string
  remediation: string
  effort: EffortEstimate
}

const SEVERITY_WEIGHT: Record<'critical' | 'warning' | 'info', number> = {
  critical: 3,
  warning: 2,
  info: 1,
}

const CATEGORY_IMPACT_WEIGHT: Record<string, number> = {
  security: 14,
  structure: 11,
  performance: 9,
  techDebt: 8,
  environment: 6,
  accessibility: 5,
  designSystem: 4,
  documentation: 2,
}

const TEST_FILE_PATTERN = /(?:^|\/)(?:__tests__|tests?)\/|\.(?:test|spec)\.[jt]sx?$/i

function isHugeFileFinding(finding: RecommendedActionFindingInput): boolean {
  const ruleKey = finding.ruleId ?? finding.id ?? ''
  return ruleKey.startsWith('huge-file-') || /^large source file$/i.test(finding.title.trim())
}

function isCircularFinding(finding: RecommendedActionFindingInput): boolean {
  const ruleKey = finding.ruleId ?? finding.id ?? ''
  return ruleKey === 'circular-dep' || /circular dependency/i.test(finding.title)
}

function buildFanInMap(graph?: ImportGraph | null): Map<string, number> {
  const counts = new Map<string, Map<string, true>>()
  if (!graph || !Array.isArray(graph.edges)) return new Map()

  for (const edge of graph.edges) {
    if (!Array.isArray(edge) || edge.length < 2) continue
    const [from, to] = edge
    if (typeof from !== 'string' || typeof to !== 'string' || from === to) continue
    let importers = counts.get(to)
    if (!importers) {
      importers = new Map()
      counts.set(to, importers)
    }
    importers.set(from, true)
  }

  const result = new Map<string, number>()
  for (const [target, importers] of counts.entries()) {
    result.set(target, importers.size)
  }
  return result
}

function formatLocation(finding: RecommendedActionFindingInput): string {
  if (finding.file) {
    return finding.line ? `${finding.file}:${finding.line}` : finding.file
  }
  if (finding.paths && finding.paths.length > 0) {
    const first = finding.paths[0]
    return finding.paths.length > 1 ? `${first} (+${finding.paths.length - 1} more)` : first
  }
  return 'Repository-wide'
}

function computeBlastRadius(
  finding: RecommendedActionFindingInput,
  fanInMap: Map<string, number>
): { score: number; label: string; fanIn: number } {
  const categoryWeight = CATEGORY_IMPACT_WEIGHT[finding.category] ?? 4
  const pathCount = finding.paths?.length ?? 0
  const evidenceCount = finding.evidence?.length ?? 0
  const rawCount = Math.max(1, finding.count ?? 1)
  const hugeFile = isHugeFileFinding(finding)

  if (finding.file) {
    const fanIn = fanInMap.get(finding.file) ?? 0
    const isTestFile = TEST_FILE_PATTERN.test(finding.file)
    const runtimeBonus = isTestFile ? 0 : 25
    const fanInPoints = Math.min(fanIn, 30) * 6
    const sizeOrOccurrencePoints = hugeFile
      ? Math.min(Math.floor(rawCount / 200) * 3, 18)
      : Math.min(Math.floor(Math.log2(rawCount) * 6), 24)
    const evidencePoints = Math.min(evidenceCount, 6) * 2

    const score = runtimeBonus + fanInPoints + sizeOrOccurrencePoints + evidencePoints + categoryWeight

    let label: string
    if (hugeFile) {
      label =
        fanIn > 0
          ? `${rawCount.toLocaleString()} LOC · ${fanIn} dependent${fanIn === 1 ? '' : 's'}`
          : `${rawCount.toLocaleString()} LOC module`
    } else if (isTestFile) {
      label = fanIn > 0 ? `Test module · ${fanIn} dependent${fanIn === 1 ? '' : 's'}` : 'Test suite scope'
    } else if (fanIn >= 5) {
      label = `High fan-in · ${fanIn} dependents`
    } else if (fanIn > 0) {
      label = `Runtime module · ${fanIn} dependent${fanIn === 1 ? '' : 's'}`
    } else {
      label = 'Single runtime module'
    }

    return { score, label, fanIn }
  }

  // Cross-cutting / repository-wide finding
  const crossCuttingBase = 32
  const pathPoints = Math.min(pathCount, 25) * 4
  const occurrencePoints = Math.min(Math.floor(Math.log2(rawCount) * 8), 44)
  const evidencePoints = Math.min(evidenceCount, 8) * 2
  const score = crossCuttingBase + pathPoints + occurrencePoints + evidencePoints + categoryWeight

  let label: string
  if (isCircularFinding(finding)) {
    const cycleRefCount = Math.max(rawCount, evidenceCount)
    label = `Import cycle · ${cycleRefCount} chain${cycleRefCount === 1 ? '' : 's'}`
  } else if (pathCount > 1) {
    label = `Cross-cutting · ${pathCount} files`
  } else if (rawCount > 1) {
    label = `Cross-cutting · ${rawCount.toLocaleString()} occurrences`
  } else {
    label = 'Repository-wide'
  }

  return { score, label, fanIn: 0 }
}

function fallbackRemediation(finding: RecommendedActionFindingInput): string {
  const lowerTitle = finding.title.toLowerCase()
  if (lowerTitle.includes('credential') || lowerTitle.includes('secret') || lowerTitle.includes('token')) {
    return 'Move sensitive values to runtime environment variables, scrub git history if live, and rotate affected credentials.'
  }
  if (isCircularFinding(finding)) {
    return 'Extract shared contracts or utilities into a leaf module so imports flow in one direction.'
  }
  if (isHugeFileFinding(finding)) {
    return 'Split this module along cohesive domain responsibilities to isolate state, queries, and presentation.'
  }
  if (lowerTitle.includes('any')) {
    return 'Replace explicit any annotations with concrete domain interfaces or unknown plus runtime narrowing.'
  }
  if (lowerTitle.includes('client-component')) {
    return 'Keep data-fetching shells as Server Components and push use client boundaries down to interactive leaves.'
  }
  if (lowerTitle.includes('accessible name') || lowerTitle.includes('alternative text')) {
    return 'Provide explicit accessible labels or alt text on interactive and non-decorative media elements.'
  }
  if (lowerTitle.includes('environment variable')) {
    return 'Document every required and optional runtime variable in .env.example with safe placeholder values.'
  }
  if (lowerTitle.includes('hardcoded color')) {
    return 'Replace literal hex/RGB values with semantic design-system CSS tokens for theme consistency.'
  }
  if (finding.category === 'security') {
    return 'Validate untrusted inputs, remove exposed secrets, and upgrade affected packages to patched versions.'
  }
  return 'Refactor the flagged pattern in small, test-backed increments before the next release.'
}

export function toOneLineRemediation(finding: RecommendedActionFindingInput): string {
  const raw = (finding.recommendation ?? '').replace(/\s+/g, ' ').trim()
  const base = raw.length > 0 ? raw : fallbackRemediation(finding)

  // Keep concise single-paragraph guidance suitable for executive tables and A4 print cards.
  if (base.length <= 165) {
    return /[.!?]$/.test(base) ? base : `${base}.`
  }
  const firstSentenceMatch = base.match(/^(.{20,165}?[.!?])(?:\s|$)/)
  if (firstSentenceMatch?.[1]) {
    return firstSentenceMatch[1].trim()
  }
  const clipped = base.slice(0, 162).replace(/\s+\S*$/, '').trim()
  return `${clipped}...`
}

export function estimateRemediationEffort(
  finding: RecommendedActionFindingInput,
  fanIn = 0
): EffortEstimate {
  const rawCount = Math.max(1, finding.count ?? 1)
  const pathCount = finding.paths?.length ?? 0

  if (isCircularFinding(finding)) {
    return rawCount >= 3 ? 'L' : 'M'
  }
  if (isHugeFileFinding(finding)) {
    return rawCount >= 900 || fanIn >= 8 ? 'L' : 'M'
  }

  const lowerTitle = finding.title.toLowerCase()
  if (
    finding.category === 'accessibility' ||
    finding.category === 'documentation' ||
    finding.category === 'environment' ||
    lowerTitle.includes('console.log')
  ) {
    return rawCount > 25 ? 'M' : 'S'
  }

  if (finding.category === 'security') {
    if (finding.file && TEST_FILE_PATTERN.test(finding.file)) return 'S'
    return fanIn >= 8 || pathCount >= 5 ? 'L' : 'M'
  }

  if (!finding.file && (rawCount >= 80 || pathCount >= 12)) {
    return 'L'
  }
  if (rawCount >= 10 || pathCount >= 3 || fanIn >= 4) {
    return 'M'
  }
  return 'S'
}

/**
 * Deterministically ranks active findings by severity and blast radius to produce
 * the top N (default 5) actionable consultant recommendations without any AI call.
 */
export function buildRecommendedActions(
  findings: RecommendedActionFindingInput[],
  options?: {
    dependencyGraph?: ImportGraph | null
    limit?: number
  }
): RecommendedAction[] {
  const limit = Math.max(1, options?.limit ?? 5)
  const fanInMap = buildFanInMap(options?.dependencyGraph)

  const active = findings.filter((finding) => !finding.policySuppressed)

  const enriched = active.map((finding, idx) => {
    const location = formatLocation(finding)
    const { score: blastRadiusScore, label: blastRadiusLabel, fanIn } = computeBlastRadius(
      finding,
      fanInMap
    )
    return {
      findingId: finding.id ?? `finding-${idx + 1}`,
      title: finding.title,
      severity: finding.severity,
      category: finding.category,
      location,
      blastRadiusScore,
      blastRadiusLabel,
      remediation: toOneLineRemediation(finding),
      effort: estimateRemediationEffort(finding, fanIn),
    }
  })

  enriched.sort((a, b) => {
    const sevDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]
    if (sevDiff !== 0) return sevDiff
    if (b.blastRadiusScore !== a.blastRadiusScore) {
      return b.blastRadiusScore - a.blastRadiusScore
    }
    const titleCmp = a.title.localeCompare(b.title)
    if (titleCmp !== 0) return titleCmp
    return a.location.localeCompare(b.location)
  })

  return enriched.slice(0, limit).map((item, idx) => ({
    rank: idx + 1,
    ...item,
  }))
}
