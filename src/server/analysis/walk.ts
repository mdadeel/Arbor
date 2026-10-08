import * as fs from 'node:fs'
import * as path from 'node:path'

export const DEFAULT_MAX_FILE_SIZE_BYTES = 100 * 1024

export const IGNORED = new Set([
  '.git', 'node_modules', '.next', '.turbo', 'dist', 'build', 'out',
  '.cache', 'coverage', '.nuxt', '.output', '.svelte-kit', '.expo',
  '.vercel', '__pycache__', '.venv', 'venv', 'target',
])

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'])
const AST_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

export interface FileEntry {
  path: string
  relativePath: string
  sizeBytes: number
}

export interface FileInventory {
  files: FileEntry[]
  repoBytes: number
  truncated: boolean
  discoveredFilesAtLeast: number
}

export interface InventoryLimits {
  maxFiles?: number
  maxRepoBytes?: number
  maxDepth?: number
}

export class AnalysisLimitError extends Error {
  constructor(
    message: string,
    readonly code: 'REPOSITORY_TOO_LARGE' | 'ANALYSIS_TIMEOUT' | 'ANALYSIS_LIMIT'
  ) {
    super(message)
    this.name = 'AnalysisLimitError'
  }
}

/** Deterministic, iterative traversal that never follows repository symlinks. */
export function collectFiles(rootDir: string, limits: InventoryLimits = {}): FileInventory {
  const maxFiles = limits.maxFiles ?? Number.POSITIVE_INFINITY
  const maxRepoBytes = limits.maxRepoBytes ?? Number.POSITIVE_INFINITY
  const maxDepth = limits.maxDepth ?? 64
  const root = path.resolve(rootDir)
  const files: FileEntry[] = []
  const pending: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  let repoBytes = 0
  let truncated = false
  let discoveredFilesAtLeast = 0

  traversal: while (pending.length > 0) {
    const current = pending.pop()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      continue
    }

    const childDirs: string[] = []
    for (const entry of entries) {
      if (IGNORED.has(entry.name) || entry.isSymbolicLink()) continue
      const absolutePath = path.join(current.dir, entry.name)

      if (entry.isDirectory()) {
        if (current.depth >= maxDepth) {
          truncated = true
        } else {
          childDirs.push(absolutePath)
        }
        continue
      }
      if (!entry.isFile()) continue

      discoveredFilesAtLeast++
      if (files.length >= maxFiles) {
        truncated = true
        break traversal
      }

      let sizeBytes = 0
      try {
        const stat = fs.statSync(absolutePath)
        if (!stat.isFile()) continue
        sizeBytes = stat.size
      } catch {
        continue
      }

      repoBytes += sizeBytes
      if (repoBytes > maxRepoBytes) {
        throw new AnalysisLimitError(
          `Repository exceeds the configured ${(maxRepoBytes / (1024 * 1024)).toFixed(0)} MiB analysis limit. No partial score was saved.`,
          'REPOSITORY_TOO_LARGE'
        )
      }

      files.push({
        path: absolutePath,
        relativePath: path.relative(root, absolutePath).split(path.sep).join('/'),
        sizeBytes,
      })
    }

    // Reverse because the stack is LIFO; this preserves alphabetical traversal.
    for (let i = childDirs.length - 1; i >= 0; i--) {
      pending.push({ dir: childDirs[i], depth: current.depth + 1 })
    }
  }

  return {
    files,
    repoBytes,
    truncated,
    discoveredFilesAtLeast: truncated
      ? Math.max(discoveredFilesAtLeast, files.length + 1)
      : files.length,
  }
}

/** Compatibility helper for focused checks and tests; the main pipeline uses collectFiles once. */
export function listFiles(dir: string): string[] {
  return collectFiles(dir).files.map((entry) => entry.path)
}

export function isSourceFile(file: string): boolean {
  return SOURCE_EXT.has(path.extname(file).toLowerCase())
}

export function isAstSourceFile(file: string): boolean {
  return AST_EXT.has(path.extname(file).toLowerCase())
}

const CONFIG_NAMES = new Set([
  'package.json', 'tsconfig.json', 'next.config.mjs', 'next.config.js', 'next.config.ts',
  'vite.config.ts', 'vite.config.js', 'tailwind.config.ts', 'tailwind.config.js',
  'eslint.config.mjs', '.eslintrc.json', '.eslintrc.js', 'prettier.config.js',
  'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile', '.env.example', '.gitignore',
  'vitest.config.ts', 'jest.config.js', 'playwright.config.ts', 'tsup.config.ts',
])

export function isConfigFile(file: string): boolean {
  return CONFIG_NAMES.has(path.basename(file))
}

/** Reads bounded UTF-8 text only; binary and oversized files are deliberately skipped. */
export function readText(
  file: string,
  maxBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
  knownSizeBytes?: number
): string | null {
  try {
    const sizeBytes = knownSizeBytes ?? fs.statSync(file).size
    if (sizeBytes > maxBytes) return null
    const buffer = fs.readFileSync(file)
    if (buffer.length > maxBytes) return null
    if (buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0)) return null
    return buffer.toString('utf8')
  } catch {
    return null
  }
}
