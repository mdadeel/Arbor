import fs from 'node:fs'
import path from 'node:path'
import { simpleGit } from 'simple-git'
import type { FileComplexityEntry, HotspotEntry, HotspotReport, HotspotRisk } from './types'

const COMMIT_MARKER = '__ARBOR_COMMIT__'
const DEFAULT_MAX_COMMITS = 200
const DEFAULT_WINDOW_DAYS = 180
const DEFAULT_TOP_HOTSPOTS = 20

export interface FileGitChurn {
  commits: number
  linesAdded: number
  linesDeleted: number
  linesChanged: number
  distinctAuthors: number
  lastModifiedAt: string | null
}

export interface GitCommitTouch {
  file: string
  linesAdded: number
  linesDeleted: number
}

export interface GitCommitSummary {
  sha: string
  committedAt: string | null
  authorEmail: string
  authorName: string
  touches: GitCommitTouch[]
}

export interface GitChurnSnapshot {
  commitsAnalyzed: number
  windowDays: number
  files: Map<string, FileGitChurn>
  commits?: GitCommitSummary[]
}

interface MutableFileChurn {
  commits: Set<string>
  linesAdded: number
  linesDeleted: number
  authors: Set<string>
  lastModifiedAt: string | null
}

/**
 * Normalizes raw `git log --numstat` file paths, resolving Git rename expressions
 * such as `src/{old.ts => new.ts}` or `old.ts => new.ts` to the current path.
 */
export function normalizeGitNumstatPath(rawPath: string): string {
  let cleaned = rawPath.trim()
  if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length >= 2) {
    cleaned = cleaned.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }

  // Handle brace rename syntax: `dir/{oldName => newName}/file.ts`
  cleaned = cleaned.replace(/\{[^{}]*?=>\s*([^{}]*)\}/g, '$1')

  // Handle full-path rename syntax: `old/path.ts => new/path.ts`
  if (cleaned.includes(' => ')) {
    const parts = cleaned.split(' => ')
    cleaned = parts[parts.length - 1] ?? cleaned
  }

  return cleaned
    .replaceAll('\\', '/')
    .replace(/\/+/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
}

export function parseGitLogNumstat(
  rawLog: string,
  windowDays: number
): GitChurnSnapshot {
  const mutable = new Map<string, MutableFileChurn>()
  const seenCommits = new Set<string>()
  const commits: GitCommitSummary[] = []

  let currentSha: string | null = null
  let currentDateIso: string | null = null
  let currentAuthor = 'unknown'
  let currentCommitRecord: GitCommitSummary | null = null

  for (const rawLine of rawLog.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (!line) continue

    if (line.startsWith(COMMIT_MARKER)) {
      const payload = line.slice(COMMIT_MARKER.length)
      const [sha = '', dateStr = '', author = '', ...nameRest] = payload.split('\t')
      currentSha = sha.trim() || null
      const parsedDate = dateStr ? new Date(dateStr.trim()) : null
      currentDateIso =
        parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null
      const trimmedEmail = author.trim()
      currentAuthor = (trimmedEmail || 'unknown').toLowerCase()
      const authorName = nameRest.join('\t').trim() || trimmedEmail || 'unknown'
      if (currentSha) {
        seenCommits.add(currentSha)
        currentCommitRecord = {
          sha: currentSha,
          committedAt: currentDateIso,
          authorEmail: currentAuthor,
          authorName,
          touches: [],
        }
        commits.push(currentCommitRecord)
      } else {
        currentCommitRecord = null
      }
      continue
    }

    if (!currentSha) continue

    const tabParts = line.split('\t')
    if (tabParts.length < 3) continue
    const [addedStr, deletedStr, ...pathRest] = tabParts
    const normalizedPath = normalizeGitNumstatPath(pathRest.join('\t'))
    if (!normalizedPath) continue

    const added = addedStr === '-' ? 0 : Number.parseInt(addedStr, 10)
    const deleted = deletedStr === '-' ? 0 : Number.parseInt(deletedStr, 10)
    const safeAdded = Number.isFinite(added) && added > 0 ? added : 0
    const safeDeleted = Number.isFinite(deleted) && deleted > 0 ? deleted : 0

    currentCommitRecord?.touches.push({
      file: normalizedPath,
      linesAdded: safeAdded,
      linesDeleted: safeDeleted,
    })

    let entry = mutable.get(normalizedPath)
    if (!entry) {
      entry = {
        commits: new Set(),
        linesAdded: 0,
        linesDeleted: 0,
        authors: new Set(),
        lastModifiedAt: currentDateIso,
      }
      mutable.set(normalizedPath, entry)
    }

    entry.commits.add(currentSha)
    entry.linesAdded += safeAdded
    entry.linesDeleted += safeDeleted
    entry.authors.add(currentAuthor)
    if (
      currentDateIso &&
      (!entry.lastModifiedAt || currentDateIso > entry.lastModifiedAt)
    ) {
      entry.lastModifiedAt = currentDateIso
    }
  }

  const files = new Map<string, FileGitChurn>()
  for (const [file, item] of mutable.entries()) {
    files.set(file, {
      commits: item.commits.size,
      linesAdded: item.linesAdded,
      linesDeleted: item.linesDeleted,
      linesChanged: item.linesAdded + item.linesDeleted,
      distinctAuthors: item.authors.size,
      lastModifiedAt: item.lastModifiedAt,
    })
  }

  return {
    commitsAnalyzed: seenCommits.size,
    windowDays,
    files,
    commits,
  }
}

export async function collectGitChurn(
  repoDir: string,
  options?: { maxCommits?: number; windowDays?: number; timeoutMs?: number }
): Promise<GitChurnSnapshot> {
  const maxCommits = options?.maxCommits ?? DEFAULT_MAX_COMMITS
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS
  const timeoutMs = options?.timeoutMs ?? 15_000

  if (!fs.existsSync(path.join(repoDir, '.git'))) {
    return { commitsAnalyzed: 0, windowDays, files: new Map(), commits: [] }
  }

  try {
    const git = simpleGit(repoDir, {
      timeout: { block: timeoutMs },
      maxConcurrentProcesses: 1,
    })

    const formatArg = `--format=${COMMIT_MARKER}%H%x09%aI%x09%ae%x09%an`
    const recentRaw = await git.raw([
      'log',
      '-n',
      String(maxCommits),
      '--no-merges',
      `--since=${windowDays}.days.ago`,
      formatArg,
      '--numstat',
    ])

    const recentSnapshot = parseGitLogNumstat(recentRaw, windowDays)
    if (recentSnapshot.commitsAnalyzed > 0) {
      return recentSnapshot
    }

    // Fallback for repositories whose latest commits predate the rolling window.
    const fallbackRaw = await git.raw([
      'log',
      '-n',
      String(Math.min(100, maxCommits)),
      '--no-merges',
      formatArg,
      '--numstat',
    ])
    return parseGitLogNumstat(fallbackRaw, 0)
  } catch {
    return { commitsAnalyzed: 0, windowDays, files: new Map(), commits: [] }
  }
}

function classifyHotspotRisk(
  hotspotScore: number,
  commits: number,
  cyclomaticComplexity: number
): HotspotRisk {
  if (hotspotScore >= 65 && commits >= 2 && cyclomaticComplexity >= 15) {
    return 'high'
  }
  if (hotspotScore >= 35) {
    return 'medium'
  }
  return 'low'
}

function rawChurnSignal(commits: number, linesChanged: number): number {
  if (commits <= 0) return 0
  // Weight repeated commit touches more heavily than one-time bulk line additions.
  return commits * 12 + Math.min(24, Math.log2(1 + linesChanged) * 2.5)
}

export function computeHotspotReport(
  fileComplexities: readonly FileComplexityEntry[],
  churn: GitChurnSnapshot,
  maxEntries: number = DEFAULT_TOP_HOTSPOTS
): HotspotReport {
  if (fileComplexities.length === 0) {
    return {
      commitsAnalyzed: churn.commitsAnalyzed,
      windowDays: churn.windowDays,
      filesWithChurn: 0,
      highRiskCount: 0,
      entries: [],
    }
  }

  let maxComplexity = 40
  let maxChurnSignal = 120
  let filesWithChurn = 0

  for (const item of fileComplexities) {
    if (item.cyclomaticComplexity > maxComplexity) {
      maxComplexity = item.cyclomaticComplexity
    }
    const fileChurn = churn.files.get(item.file)
    if (fileChurn && fileChurn.commits > 0) {
      filesWithChurn++
      const sig = rawChurnSignal(fileChurn.commits, fileChurn.linesChanged)
      if (sig > maxChurnSignal) maxChurnSignal = sig
    }
  }

  const complexityDenom = Math.log2(1 + maxComplexity)

  const scored: Omit<HotspotEntry, 'rank'>[] = []

  for (const item of fileComplexities) {
    const fileChurn = churn.files.get(item.file)
    const commits = fileChurn?.commits ?? 0
    const linesChanged = fileChurn?.linesChanged ?? 0
    const distinctAuthors = fileChurn?.distinctAuthors ?? 0
    const lastModifiedAt = fileChurn?.lastModifiedAt ?? null

    if (commits === 0 && churn.commitsAnalyzed > 0) {
      continue
    }

    const complexityFactor = Math.min(
      1,
      Math.log2(1 + item.cyclomaticComplexity) / complexityDenom
    )
    const churnFactor =
      commits > 0
        ? Math.min(1, Math.sqrt(rawChurnSignal(commits, linesChanged) / maxChurnSignal))
        : 0

    const hotspotScore = Math.round(100 * complexityFactor * churnFactor)
    const risk = classifyHotspotRisk(hotspotScore, commits, item.cyclomaticComplexity)

    scored.push({
      file: item.file,
      hotspotScore,
      risk,
      commits,
      linesChanged,
      distinctAuthors,
      lastModifiedAt,
      cyclomaticComplexity: item.cyclomaticComplexity,
      functionCount: item.functionCount,
      loc: item.loc,
    })
  }

  scored.sort(
    (a, b) =>
      b.hotspotScore - a.hotspotScore ||
      b.commits - a.commits ||
      b.cyclomaticComplexity - a.cyclomaticComplexity ||
      b.loc - a.loc ||
      a.file.localeCompare(b.file)
  )

  const highRiskCount = scored.filter((entry) => entry.risk === 'high').length
  const entries: HotspotEntry[] = scored.slice(0, maxEntries).map((entry, idx) => ({
    rank: idx + 1,
    ...entry,
  }))

  return {
    commitsAnalyzed: churn.commitsAnalyzed,
    windowDays: churn.windowDays,
    filesWithChurn,
    highRiskCount,
    entries,
  }
}

export async function analyzeHotspots(
  repoDir: string,
  fileComplexities: readonly FileComplexityEntry[],
  precollectedChurn?: GitChurnSnapshot | null,
  maxEntries: number = DEFAULT_TOP_HOTSPOTS
): Promise<HotspotReport> {
  const churn = precollectedChurn ?? (await collectGitChurn(repoDir))
  return computeHotspotReport(fileComplexities, churn, maxEntries)
}
