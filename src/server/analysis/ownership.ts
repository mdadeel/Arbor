import fs from 'node:fs'
import path from 'node:path'
import { collectGitChurn, type GitChurnSnapshot, type GitCommitSummary } from './hotspots'
import type {
  BusFactorRisk,
  DirectoryOwnerShare,
  DirectoryOwnershipEntry,
  OwnershipReport,
  ProjectStructure,
  StructureNode,
} from './types'

const CODEOWNERS_CANDIDATE_PATHS = [
  '.github/CODEOWNERS',
  'CODEOWNERS',
  'docs/CODEOWNERS',
] as const

const GITHUB_NOREPLY_RE =
  /^(?:\d+\+)?([a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?)@users\.noreply\.github\.com$/i

const GITHUB_HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface MutableContributorStats {
  codeowner: string
  displayName: string
  email: string
  commits: Set<string>
  linesChanged: number
  lastCommitAt: string | null
}

export function isBotContributor(authorEmail: string, authorName: string): boolean {
  const email = authorEmail.trim().toLowerCase()
  const name = authorName.trim().toLowerCase()
  if (!email && !name) return true
  if (email.includes('[bot]') || name.includes('[bot]')) return true

  if (
    /^(?:dependabot|renovate|github-actions|snyk-bot|semantic-release-bot|greenkeeper|codecov|imgbot|allcontributors)(?:@|\b)/.test(
      email
    ) ||
    /^(?:dependabot|renovate|github-actions|snyk-bot|semantic-release-bot|greenkeeper|github web-flow)$/.test(
      name
    )
  ) {
    return true
  }

  if (email === 'noreply@github.com' && (name === 'github' || name === 'github web-flow')) {
    return true
  }

  return false
}

/**
 * Resolves a Git commit author into a valid GitHub CODEOWNERS identifier
 * (`@username` for GitHub noreply emails/handles, or `email@domain` otherwise).
 * Returns `null` for automated bots or unidentifiable placeholders.
 */
export function resolveCodeownerIdentity(
  authorEmail: string,
  authorName: string
): { codeowner: string; displayName: string; email: string } | null {
  if (isBotContributor(authorEmail, authorName)) {
    return null
  }

  const trimmedEmail = authorEmail.trim().toLowerCase()
  const trimmedName = authorName.trim()

  const noreplyMatch = trimmedEmail.match(GITHUB_NOREPLY_RE)
  if (noreplyMatch?.[1]) {
    const handle = noreplyMatch[1].toLowerCase()
    const displayName =
      trimmedName && trimmedName.toLowerCase() !== trimmedEmail ? trimmedName : `@${handle}`
    return {
      codeowner: `@${handle}`,
      displayName,
      email: trimmedEmail,
    }
  }

  if (EMAIL_RE.test(trimmedEmail)) {
    return {
      codeowner: trimmedEmail,
      displayName: trimmedName && trimmedName.toLowerCase() !== trimmedEmail ? trimmedName : trimmedEmail,
      email: trimmedEmail,
    }
  }

  const normalizedHandle = trimmedName.replace(/^@/, '')
  if (GITHUB_HANDLE_RE.test(normalizedHandle) && normalizedHandle.toLowerCase() !== 'unknown') {
    const handle = normalizedHandle.toLowerCase()
    return {
      codeowner: `@${handle}`,
      displayName: trimmedName,
      email: trimmedEmail || `${handle}@users.noreply.github.com`,
    }
  }

  return null
}

export function detectExistingCodeownersPath(repoDir?: string | null): string | null {
  if (!repoDir) return null
  for (const relPath of CODEOWNERS_CANDIDATE_PATHS) {
    try {
      const fullPath = path.join(repoDir, relPath)
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return relPath
      }
    } catch {
      // Ignore unreadable candidate paths
    }
  }
  return null
}

function classifyBusFactorRisk(busFactor: number): BusFactorRisk {
  if (busFactor <= 0) return 'unknown'
  if (busFactor === 1) return 'high'
  if (busFactor === 2) return 'medium'
  return 'low'
}

function contributorWeight(commits: number, linesChanged: number): number {
  if (commits <= 0) return 0
  return commits * 10 + Math.log2(1 + Math.max(0, linesChanged)) * 3
}

function countTreeFiles(node: StructureNode): number {
  if (node.type === 'file') return 1
  let total = 0
  for (const child of node.children ?? []) {
    total += countTreeFiles(child)
  }
  return total
}

function collectTopLevelDirectoryCounts(
  structure: Pick<ProjectStructure, 'topLevelDirs' | 'tree' | 'fileCount'>,
  commits: readonly GitCommitSummary[]
): { dirFileCounts: Map<string, number>; isFlatRepo: boolean } {
  const dirFileCounts = new Map<string, number>()

  for (const node of structure.tree ?? []) {
    if (node.type === 'dir' && node.name && !node.name.startsWith('.')) {
      dirFileCounts.set(node.name, countTreeFiles(node))
    }
  }

  for (const dir of structure.topLevelDirs ?? []) {
    if (dir && !dir.startsWith('.') && !dirFileCounts.has(dir)) {
      dirFileCounts.set(dir, 0)
    }
  }

  const touchedFilesByDir = new Map<string, Set<string>>()
  for (const commit of commits) {
    for (const touch of commit.touches) {
      const slashIdx = touch.file.indexOf('/')
      if (slashIdx <= 0) continue
      const topDir = touch.file.slice(0, slashIdx)
      if (!topDir || topDir.startsWith('.')) continue
      let set = touchedFilesByDir.get(topDir)
      if (!set) {
        set = new Set()
        touchedFilesByDir.set(topDir, set)
      }
      set.add(touch.file)
    }
  }

  for (const [dir, touchedSet] of touchedFilesByDir.entries()) {
    const existing = dirFileCounts.get(dir)
    if (existing === undefined || existing === 0) {
      dirFileCounts.set(dir, Math.max(existing ?? 0, touchedSet.size))
    }
  }

  if (dirFileCounts.size === 0) {
    return {
      dirFileCounts: new Map([['(root)', structure.fileCount ?? 0]]),
      isFlatRepo: true,
    }
  }

  return { dirFileCounts, isFlatRepo: false }
}

function summarizeContributors(
  contributorMap: ReadonlyMap<string, MutableContributorStats>,
  scopeCommitCount: number
): {
  owners: DirectoryOwnerShare[]
  busFactor: number
  risk: BusFactorRisk
  suggestedOwners: string[]
} {
  if (contributorMap.size === 0 || scopeCommitCount === 0) {
    return {
      owners: [],
      busFactor: 0,
      risk: 'unknown',
      suggestedOwners: [],
    }
  }

  const weighted = [...contributorMap.values()].map((item) => ({
    item,
    commits: item.commits.size,
    weight: contributorWeight(item.commits.size, item.linesChanged),
  }))

  weighted.sort(
    (a, b) =>
      b.weight - a.weight ||
      b.commits - a.commits ||
      b.item.linesChanged - a.item.linesChanged ||
      a.item.codeowner.localeCompare(b.item.codeowner)
  )

  const totalWeight = weighted.reduce((acc, entry) => acc + entry.weight, 0)
  if (totalWeight <= 0) {
    return {
      owners: [],
      busFactor: 0,
      risk: 'unknown',
      suggestedOwners: [],
    }
  }

  let cumulativeFraction = 0
  let busFactor = 0
  for (let i = 0; i < weighted.length; i++) {
    cumulativeFraction += weighted[i].weight / totalWeight
    if (busFactor === 0 && cumulativeFraction >= 0.5 - 1e-9) {
      busFactor = i + 1
    }
  }
  if (busFactor === 0) {
    busFactor = weighted.length
  }

  const owners: DirectoryOwnerShare[] = weighted.map(({ item, commits, weight }) => ({
    codeowner: item.codeowner,
    displayName: item.displayName,
    email: item.email,
    commits,
    linesChanged: item.linesChanged,
    sharePercent: Math.max(1, Math.round((weight / totalWeight) * 100)),
    lastCommitAt: item.lastCommitAt,
  }))

  const suggestedOwners: string[] = []
  if (owners.length > 0) {
    suggestedOwners.push(owners[0].codeowner)
    for (let i = 1; i < Math.min(3, owners.length); i++) {
      const candidate = owners[i]
      if (candidate.sharePercent >= 20 && (candidate.commits >= 2 || scopeCommitCount <= 2)) {
        suggestedOwners.push(candidate.codeowner)
      }
    }
  }

  return {
    owners: owners.slice(0, 5),
    busFactor,
    risk: classifyBusFactorRisk(busFactor),
    suggestedOwners,
  }
}

export function buildSuggestedCodeowners(
  defaultOwners: readonly string[],
  directories: readonly DirectoryOwnershipEntry[]
): string {
  const lines: string[] = [
    '# Suggested CODEOWNERS generated by Arbor from git commit history',
    '# Save to .github/CODEOWNERS to route pull request reviews automatically.',
    '',
  ]

  if (defaultOwners.length === 0 && directories.every((d) => d.suggestedOwners.length === 0)) {
    lines.push('# Insufficient git commit history to infer repository owners automatically.')
    return `${lines.join('\n')}\n`
  }

  if (defaultOwners.length > 0) {
    lines.push('# Default fallback owners')
    lines.push(`* ${defaultOwners.join(' ')}`)
    lines.push('')
  }

  const scopedRules = directories
    .filter((dir) => dir.pattern !== '*' && dir.suggestedOwners.length > 0)
    .slice()
    .sort((a, b) => a.pattern.localeCompare(b.pattern))

  if (scopedRules.length > 0) {
    lines.push('# Top-level directory owners')
    const maxPatternLen = Math.max(...scopedRules.map((rule) => rule.pattern.length))
    for (const rule of scopedRules) {
      const paddedPattern = rule.pattern.padEnd(maxPatternLen, ' ')
      lines.push(`${paddedPattern} ${rule.suggestedOwners.join(' ')}`)
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

const GENERIC_AUTHOR_NAMES = new Set([
  'unknown',
  'user',
  'admin',
  'root',
  'developer',
  'dev',
  'git',
  'ci',
  'author',
])

function normalizeAuthorNameKey(name: string): string | null {
  const key = name.trim().replace(/^@/, '').toLowerCase().replace(/\s+/g, ' ')
  if (key.length < 3 || GENERIC_AUTHOR_NAMES.has(key)) return null
  return key
}

function buildUnambiguousHandleAliasMap(
  commits: readonly GitCommitSummary[]
): ReadonlyMap<string, string> {
  const candidates = new Map<string, string | null>()

  const registerAlias = (rawName: string, handleCodeowner: string) => {
    const key = normalizeAuthorNameKey(rawName)
    if (!key) return
    const existing = candidates.get(key)
    if (existing === undefined) {
      candidates.set(key, handleCodeowner)
    } else if (existing !== null && existing !== handleCodeowner) {
      // Ambiguous display name shared by multiple GitHub handles; never merge.
      candidates.set(key, null)
    }
  }

  for (const commit of commits) {
    const identity = resolveCodeownerIdentity(commit.authorEmail, commit.authorName)
    if (!identity || !identity.codeowner.startsWith('@')) continue
    registerAlias(identity.codeowner, identity.codeowner)
    registerAlias(commit.authorName, identity.codeowner)
  }

  const resolved = new Map<string, string>()
  for (const [key, handle] of candidates.entries()) {
    if (handle) resolved.set(key, handle)
  }
  return resolved
}

export function computeOwnershipReport(
  structure: Pick<ProjectStructure, 'topLevelDirs' | 'tree' | 'fileCount'>,
  churn: GitChurnSnapshot,
  existingCodeownersPath: string | null = null
): OwnershipReport {
  const commits = churn.commits ?? []
  const { dirFileCounts, isFlatRepo } = collectTopLevelDirectoryCounts(structure, commits)
  const handleAliasByName = buildUnambiguousHandleAliasMap(commits)

  const repoContributors = new Map<string, MutableContributorStats>()
  const repoCommitShas = new Set<string>()

  const dirContributors = new Map<string, Map<string, MutableContributorStats>>()
  const dirCommitShas = new Map<string, Set<string>>()
  const dirLinesChanged = new Map<string, number>()

  for (const dir of dirFileCounts.keys()) {
    dirContributors.set(dir, new Map())
    dirCommitShas.set(dir, new Set())
    dirLinesChanged.set(dir, 0)
  }

  const recordTouch = (
    map: Map<string, MutableContributorStats>,
    identity: { codeowner: string; displayName: string; email: string },
    sha: string,
    committedAt: string | null,
    linesDelta: number
  ) => {
    let existing = map.get(identity.codeowner)
    if (!existing) {
      existing = {
        codeowner: identity.codeowner,
        displayName: identity.displayName,
        email: identity.email,
        commits: new Set(),
        linesChanged: 0,
        lastCommitAt: committedAt,
      }
      map.set(identity.codeowner, existing)
    } else if (
      identity.displayName &&
      !identity.displayName.startsWith('@') &&
      existing.displayName.startsWith('@')
    ) {
      existing.displayName = identity.displayName
    }

    existing.commits.add(sha)
    existing.linesChanged += linesDelta
    if (committedAt && (!existing.lastCommitAt || committedAt > existing.lastCommitAt)) {
      existing.lastCommitAt = committedAt
    }
  }

  for (const commit of commits) {
    if (commit.touches.length === 0) continue
    const rawIdentity = resolveCodeownerIdentity(commit.authorEmail, commit.authorName)
    if (!rawIdentity) continue
    const nameKey = normalizeAuthorNameKey(commit.authorName)
    const mappedHandle =
      !rawIdentity.codeowner.startsWith('@') && nameKey
        ? handleAliasByName.get(nameKey)
        : undefined
    const identity = mappedHandle
      ? { ...rawIdentity, codeowner: mappedHandle }
      : rawIdentity

    repoCommitShas.add(commit.sha)
    let commitRepoLines = 0

    for (const touch of commit.touches) {
      const delta = touch.linesAdded + touch.linesDeleted
      commitRepoLines += delta

      if (isFlatRepo) {
        const rootMap = dirContributors.get('(root)')!
        recordTouch(rootMap, identity, commit.sha, commit.committedAt, delta)
        dirCommitShas.get('(root)')!.add(commit.sha)
        dirLinesChanged.set('(root)', (dirLinesChanged.get('(root)') ?? 0) + delta)
        continue
      }

      const slashIdx = touch.file.indexOf('/')
      if (slashIdx <= 0) continue
      const topDir = touch.file.slice(0, slashIdx)
      const targetMap = dirContributors.get(topDir)
      if (!targetMap) continue

      recordTouch(targetMap, identity, commit.sha, commit.committedAt, delta)
      dirCommitShas.get(topDir)!.add(commit.sha)
      dirLinesChanged.set(topDir, (dirLinesChanged.get(topDir) ?? 0) + delta)
    }

    recordTouch(repoContributors, identity, commit.sha, commit.committedAt, commitRepoLines)
  }

  const overallSummary = summarizeContributors(repoContributors, repoCommitShas.size)

  const directories: DirectoryOwnershipEntry[] = []
  for (const [directory, fileCount] of dirFileCounts.entries()) {
    const contributors = dirContributors.get(directory) ?? new Map()
    const scopeShas = dirCommitShas.get(directory) ?? new Set()
    const summary = summarizeContributors(contributors, scopeShas.size)
    const pattern = isFlatRepo || directory === '(root)' ? '*' : `/${directory}/`

    directories.push({
      directory,
      pattern,
      fileCount,
      commits: scopeShas.size,
      linesChanged: dirLinesChanged.get(directory) ?? 0,
      contributorCount: contributors.size,
      busFactor: summary.busFactor,
      risk: summary.risk,
      owners: summary.owners,
      suggestedOwners: summary.suggestedOwners,
    })
  }

  directories.sort((a, b) => {
    const aActive = a.commits > 0 ? 1 : 0
    const bActive = b.commits > 0 ? 1 : 0
    if (aActive !== bActive) return bActive - aActive
    if (aActive && a.busFactor !== b.busFactor) return a.busFactor - b.busFactor
    return (
      b.commits - a.commits ||
      b.fileCount - a.fileCount ||
      a.directory.localeCompare(b.directory)
    )
  })

  const suggestedCodeowners = buildSuggestedCodeowners(
    overallSummary.suggestedOwners,
    directories
  )

  return {
    commitsAnalyzed: churn.commitsAnalyzed,
    windowDays: churn.windowDays,
    totalContributors: repoContributors.size,
    overallBusFactor: overallSummary.busFactor,
    overallRisk: overallSummary.risk,
    existingCodeownersPath,
    defaultOwners: overallSummary.suggestedOwners,
    directories,
    suggestedCodeowners,
  }
}

export async function analyzeOwnership(
  repoDir: string,
  structure: Pick<ProjectStructure, 'topLevelDirs' | 'tree' | 'fileCount'>,
  precollectedChurn?: GitChurnSnapshot | null
): Promise<OwnershipReport> {
  const churn = precollectedChurn ?? (await collectGitChurn(repoDir))
  const existingCodeownersPath = detectExistingCodeownersPath(repoDir)
  return computeOwnershipReport(structure, churn, existingCodeownersPath)
}
