import fs from 'node:fs'
import path from 'node:path'
import { listFiles, readText } from './walk'
import type { Finding, ImportGraph, ProjectStructure } from './types'

const SECRET_PATTERNS: [string, RegExp][] = [
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub token', /\bghp_[A-Za-z0-9]{36}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  [
    'Hardcoded credential',
    /(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*["'][^"']{16,}["']/i,
  ],
  ['Generic secret assignment',
    /(?:private[_-]?key|client[_-]?secret)\s*[:=]\s*["'][^"']{16,}["']/i,
  ],
]

export function scanSecrets(text: string, relFile: string): Finding[] {
  const findings: Finding[] = []
  for (const [label, re] of SECRET_PATTERNS) {
    const match = text.match(re)
    if (match) {
      const line = text.slice(0, match.index).split('\n').length
      findings.push({
        id: `secret-${label.replace(/\W+/g, '-').toLowerCase()}`,
        category: 'security',
        severity: 'critical',
        title: `Possible ${label} committed`,
        detail:
          'A value matching this pattern was committed. High-priority risk even if it is a test value.',
        file: relFile,
        line,
      })
    }
  }
  return findings
}

export function envCheck(
  repoDir: string,
  sourceEnvVars: Set<string>
): { missingFromExample: string[]; hasExample: boolean } {
  const examplePath = path.join(repoDir, '.env.example')
  let hasExample = fs.existsSync(examplePath)
  let exampleKeys = new Set<string>()
  if (hasExample) {
    const text = fs.readFileSync(examplePath, 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)=/)
      if (m) exampleKeys.add(m[1])
    }
  }
  if (sourceEnvVars.size === 0) {
    return { missingFromExample: [], hasExample }
  }
  const missing = [...sourceEnvVars]
    .filter((v) => !exampleKeys.has(v))
    .sort()
  return { missingFromExample: missing, hasExample }
}

export function findCircularDeps(graph: ImportGraph): string[][] {
  const adj = new Map<string, string[]>()
  for (const n of graph.nodes) adj.set(n, [])
  for (const [a, b] of graph.edges) {
    adj.get(a)?.push(b)
  }

  const cycles: string[][] = []
  const stack: string[] = []
  const stacked = new Set<string>()
  const visited = new Set<string>()
  const seenCanonical = new Set<string>()

  const canonical = (cycle: string[]) =>
    [...cycle.slice(0, -1)].sort().join('->')

  const visit = (node: string) => {
    if (stacked.has(node)) {
      const start = stack.indexOf(node)
      const cycle = [...stack.slice(start), node]
      const key = canonical(cycle)
      if (!seenCanonical.has(key)) {
        seenCanonical.add(key)
        cycles.push(cycle)
      }
      return
    }
    if (visited.has(node)) return
    visited.add(node)
    stack.push(node)
    stacked.add(node)
    for (const next of adj.get(node) ?? []) visit(next)
    stack.pop()
    stacked.delete(node)
  }

  for (const n of graph.nodes) visit(n)
  return cycles.slice(0, 10)
}

export function detectUnusedDeps(repoDir: string): string[] {
  const pkgPath = path.join(repoDir, 'package.json')
  let deps: string[] = []
  let blob = ''
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    deps = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
    blob = JSON.stringify(pkg.scripts ?? {})
  } catch {
    return []
  }
  // whole-tree text coverage catches config-referenced deps (tailwind, autoprefixer) too
  for (const f of listFiles(repoDir).slice(0, 2000)) {
    const base = path.basename(f)
    if (
      base === 'package.json' ||
      base === 'package-lock.json' ||
      base === 'yarn.lock' ||
      base === 'pnpm-lock.yaml' ||
      base === 'bun.lockb'
    ) {
      continue
    }
    blob += readText(f) ?? ''
  }
  return deps.filter((d) => {
    // @types/* are ambient devDeps, never imported
    if (d.startsWith('@types/')) return false
    if (d.startsWith('@')) return !blob.includes(d)
    return !new RegExp(`\\b${d}\\b`).test(blob)
  }).sort()
}

export function detectDeadExports(
  exportedByFile: Map<string, string[]>,
  importsBySource: Map<string, string[]>
): { file: string; name: string }[] {
  const usedNames = new Set<string>()
  for (const imports of importsBySource.values()) {
    for (const i of imports) {
      for (const part of i.split(/[,\s]+/)) {
        const name = part.replace(/^.*\* as\s+/, '').trim()
        if (/^[A-Za-z_$][\w$]*$/.test(name)) usedNames.add(name)
      }
    }
  }
  const dead: { file: string; name: string }[] = []
  for (const [file, names] of exportedByFile) {
    for (const name of names) {
      if (name && !usedNames.has(name)) dead.push({ file, name })
    }
  }
  return dead.slice(0, 20)
}

export function structureFindings(structure: ProjectStructure): Finding[] {
  const findings: Finding[] = []
  if (structure.fileCount === 0) return findings

  if (structure.avgFileLines > 150) {
    findings.push({
      id: 'avg-file-lines',
      category: 'techDebt',
      severity: 'warning',
      title: 'Files are long on average',
      detail: `Average ${structure.avgFileLines} non-empty lines per file; aim under ~150 for maintainability.`,
      count: structure.avgFileLines,
    })
  }
  for (const h of structure.hugeFiles.slice(0, 5)) {
    findings.push({
      id: `huge-file-${h.file}`,
      category: 'techDebt',
      severity: h.lines > 600 ? 'critical' : 'warning',
      title: 'Very large file',
      detail: `${h.file} has ${h.lines} non-empty lines; consider splitting.`,
      file: h.file,
      count: h.lines,
    })
  }
  const topDirs = structure.topLevelDirs.join(', ')
  if (structure.topLevelDirs.length > 12) {
    findings.push({
      id: 'many-top-dirs',
      category: 'structure',
      severity: 'info',
      title: 'Flat/messy top-level layout',
      detail: `${structure.topLevelDirs.length} top-level directories (${topDirs}).`,
    })
  }
  if (!structure.entryPoints.length && structure.fileCount > 5) {
    findings.push({
      id: 'no-entrypoint',
      category: 'structure',
      severity: 'warning',
      title: 'No obvious entry point detected',
      detail: 'No package.json, next.config, or main source entry found.',
    })
  }
  if (!structure.configFiles.length) {
    findings.push({
      id: 'no-config',
      category: 'structure',
      severity: 'warning',
      title: 'No config files found',
      detail: 'No tsconfig, next/vite config, eslint, or format config detected.',
    })
  }
  return findings
}

export function perfFindings(metrics: {
  reactFiles: number
  clientFiles: number
  imgTags: number
  nextImage: boolean
  avgFileLines: number
}): Finding[] {
  const findings: Finding[] = []
  const clientRatio = metrics.reactFiles ? metrics.clientFiles / metrics.reactFiles : 0
  if (metrics.reactFiles > 0 && clientRatio > 0.5) {
    findings.push({
      id: 'client-heavy',
      category: 'performance',
      severity: 'warning',
      title: 'Heavy client-component usage',
      detail: `${Math.round(clientRatio * 100)}% of React files are "use client"; prefer server components where possible.`,
      count: Math.round(clientRatio * 100),
    })
  }
  if (metrics.imgTags > 0 && metrics.nextImage) {
    findings.push({
      id: 'next-image-mixed',
      category: 'performance',
      severity: 'warning',
      title: 'Both next/image and raw <img> tags',
      detail: `${metrics.imgTags} raw <img> tags found though next/image is available; they skip optimization.`,
      count: metrics.imgTags,
    })
  }
  if (metrics.imgTags > 0 && !metrics.nextImage) {
    findings.push({
      id: 'raw-img',
      category: 'performance',
      severity: 'info',
      title: 'Raw <img> tags used',
      detail: `${metrics.imgTags} raw <img> tags; Next.js projects should prefer next/image.`,
      count: metrics.imgTags,
    })
  }
  if (metrics.avgFileLines > 250) {
    findings.push({
      id: 'avg-lines-high',
      category: 'performance',
      severity: 'warning',
      title: 'High average file size',
      detail: `Average ${metrics.avgFileLines} lines can slow first paint and parsing.`,
    })
  }
  return findings
}

export function docFindings(
  readmeExists: boolean,
  commentRatio: number,
  jsdocCount: number
): Finding[] {
  const findings: Finding[] = []
  if (!readmeExists) {
    findings.push({
      id: 'no-readme',
      category: 'documentation',
      severity: 'warning',
      title: 'No README.md',
      detail: 'A README is the first stop for anyone onboarding the project.',
    })
  }
  if (commentRatio < 0.05 && commentRatio > 0) {
    findings.push({
      id: 'low-comments',
      category: 'documentation',
      severity: 'info',
      title: 'Very few comments',
      detail: `${Math.round(commentRatio * 100)}% of lines are comments.`,
    })
  }
  if (jsdocCount === 0 && commentRatio === 0) {
    findings.push({
      id: 'no-comments',
      category: 'documentation',
      severity: 'info',
      title: 'No comments or docstrings',
      detail: 'Zero comment lines across the codebase.',
    })
  }
  return findings
}