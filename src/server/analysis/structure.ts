import path from 'node:path'
import fs from 'node:fs'
import { listFiles, isSourceFile, isConfigFile, readText } from './walk'
import type { ProjectStructure } from './types'

export const HUGE_FILE_LINES = 300

export function analyzeStructure(dir: string): ProjectStructure {
  const files = listFiles(dir)
  const sourceFiles = files.filter(isSourceFile)
  const configFiles = files.filter(isConfigFile)

  const dirCounts = new Map<string, number>()
  let loc = 0
  const hugeFiles: { file: string; lines: number }[] = []
  const lineCounts: number[] = []

  for (const f of sourceFiles) {
    const text = readText(f)
    if (text == null) continue
    let lines = 0
    for (const line of text.split('\n')) {
      if (line.trim().length > 0) lines++
    }
    loc += lines
    lineCounts.push(lines)
    const rel = path.relative(dir, f)
    const d = path.dirname(rel)
    if (d !== '.') dirCounts.set(d, (dirCounts.get(d) ?? 0) + 1)
    if (lines > HUGE_FILE_LINES) hugeFiles.push({ file: rel, lines })
  }

  hugeFiles.sort((a, b) => b.lines - a.lines)

  const dirs = [...dirCounts.entries()]
    .map(([path2, files2]) => ({ path: path2, files: files2 }))
    .sort((a, b) => b.files - a.files)
    .slice(0, 20)

  const topLevelDirs = new Set<string>()
  for (const d of dirCounts.keys()) {
    const top = d.split(/[\\/]/)[0]
    if (top) topLevelDirs.add(top)
  }

  const entryPoints = [
    'package.json',
    'next.config.mjs',
    'next.config.js',
    'next.config.ts',
    'src/app/layout.tsx',
    'src/app/layout.ts',
    'app/layout.tsx',
    'src/index.ts',
    'src/index.js',
    'index.ts',
    'index.js',
    'server.ts',
    'main.ts',
  ].filter((p) => fs.existsSync(path.join(dir, p)))

  const avgFileLines =
    sourceFiles.length === 0 ? 0 : Math.round(loc / sourceFiles.length)

  return {
    fileCount: files.length,
    loc,
    avgFileLines,
    dirs,
    topLevelDirs: [...topLevelDirs].sort(),
    entryPoints: entryPoints.map((p) => (p === 'package.json' ? 'package.json' : p)),
    configFiles: configFiles.map((f) => path.relative(dir, f)).sort(),
    hugeFiles,
  }
}