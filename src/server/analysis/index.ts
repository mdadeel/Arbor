import path from 'node:path'
import fs from 'node:fs'
import {
  AnalysisLimitError,
  collectFiles,
  isAstSourceFile,
  isSourceFile,
  readText,
} from './walk'
import { parseFile } from './ast'
import { analyzeStructure } from './structure'
import { detectTechStack } from './stack'
import { auditDesignSystem, designSystemFindings } from './designSystem'
import type { ComponentAuditSummary } from './designSystem'
import { computeScores } from './score'
import { enrichFinding } from './finding-guidance'
import {
  scanSecrets,
  accessibilityFindings,
  envCheck,
  findCircularDeps,
  detectUnusedDeps,
  detectDeadExports,
  structureFindings,
  perfFindings,
  docFindings,
} from './checks'
import type { AnalysisReport, Finding, ImportGraph } from './types'

export { AnalysisLimitError } from './walk'

export const ANALYSIS_VERSION = 1

export interface AnalysisOptions {
  maxFiles: number
  maxRepoSizeBytes: number
  maxFileSizeBytes: number
  maxParseFiles: number
  maxDurationMs: number
  maxDirectoryDepth: number
}

export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  maxFiles: 5000,
  maxRepoSizeBytes: 500 * 1024 * 1024,
  maxFileSizeBytes: 100 * 1024,
  maxParseFiles: 2500,
  maxDurationMs: 300_000,
  maxDirectoryDepth: 64,
}

const COMPONENT_DIRS = new Set(['components', 'ui', 'shared', 'primitives'])
const TOKEN_CANDIDATE_RE = /(theme|tokens|design.?tokens|globals|colors?|variables)\.(css|scss|ts|tsx|js|jsx)$/i
const TAILWIND_CANDIDATE_RE = /tailwind\.config\.(ts|js|mjs|cjs)$/
const HEX_COLOR_RE = /#[\da-f]{3,8}\b/gi
const RGB_COLOR_RE = /rgba?\(|hsla?\(/gi
const COMPONENT_FUNCTION_RE = /export\s+(?:default\s+)?function\s+([A-Z]\w*)/g
const COMPONENT_ARROW_RE = /const\s+([A-Z]\w*)\s*[:=]\s*(?:React\.)?(?:memo\s*\(\s*)?\(?[^)]*\)?\s*=>/g

function countNonEmptyLines(text: string): number {
  let count = 0
  for (const line of text.split(/\r?\n/)) if (line.trim()) count++
  return count
}

function countCommentLines(text: string): number {
  let count = 0
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim()
    if (value.startsWith('//') || value.startsWith('/*') || value.startsWith('*')) count++
  }
  return count
}

function matchesComponentDirectory(file: string): boolean {
  return file.split('/').some((segment) => COMPONENT_DIRS.has(segment))
}

function dependencyFindings(metrics: {
  circularDeps: string[][]
  unusedDeps: string[]
  deadExports: { file: string; name: string }[]
  anyTypes: number
  consoleLogs: number
}): Finding[] {
  const findings: Finding[] = []
  for (const cycle of metrics.circularDeps.slice(0, 5)) {
    findings.push({
      id: 'circular-dep',
      category: 'techDebt',
      severity: 'warning',
      title: 'Circular dependency',
      detail: `Import cycle: ${cycle.join(' → ')}. This is a coupling signal, not proof of a runtime bug.`,
      paths: cycle,
    })
  }
  if (metrics.unusedDeps.length) {
    findings.push({
      id: 'unused-deps',
      category: 'techDebt',
      severity: 'info',
      title: `${metrics.unusedDeps.length} possibly unused dependency(ies)`,
      detail: metrics.unusedDeps.slice(0, 10).join(', '),
      count: metrics.unusedDeps.length,
    })
  }
  if (metrics.deadExports.length) {
    findings.push({
      id: 'dead-exports',
      category: 'techDebt',
      severity: 'info',
      title: `${metrics.deadExports.length} export(s) not found in static imports`,
      detail: metrics.deadExports
        .slice(0, 6)
        .map((item) => `${item.file}#${item.name}`)
        .join(', '),
      count: metrics.deadExports.length,
    })
  }
  if (metrics.anyTypes > 3) {
    findings.push({
      id: 'any-types',
      category: 'techDebt',
      severity: metrics.anyTypes > 20 ? 'warning' : 'info',
      title: `${metrics.anyTypes} explicit \`any\` type usages`,
      detail: 'Explicit any types weaken compile-time guarantees in the locations where they occur.',
      count: metrics.anyTypes,
    })
  }
  if (metrics.consoleLogs > 2) {
    findings.push({
      id: 'console-logs',
      category: 'techDebt',
      severity: 'info',
      title: `${metrics.consoleLogs} console.log calls`,
      detail: 'Static scan found console.log calls; some may be intentional diagnostics.',
      count: metrics.consoleLogs,
    })
  }
  return findings
}

function countTextMatches(text: string, expression: RegExp): number {
  return (text.match(expression) ?? []).length
}

export function runAnalysis(
  repoDir: string,
  overrides: Partial<AnalysisOptions> = {}
): AnalysisReport {
  const options = { ...DEFAULT_ANALYSIS_OPTIONS, ...overrides }
  const startedAt = Date.now()
  const checkDeadline = () => {
    if (Date.now() - startedAt > options.maxDurationMs) {
      throw new AnalysisLimitError(
        `Analysis exceeded its ${Math.ceil(options.maxDurationMs / 1000)} second processing budget.`,
        'ANALYSIS_TIMEOUT'
      )
    }
  }

  const inventory = collectFiles(repoDir, {
    maxFiles: options.maxFiles,
    maxRepoBytes: options.maxRepoSizeBytes,
    maxDepth: options.maxDirectoryDepth,
  })
  checkDeadline()
  const files = inventory.files.map((entry) => entry.path)
  const sourceEntries = inventory.files.filter((entry) => isSourceFile(entry.path))
  const sourceEntriesWithinSize = sourceEntries.filter((entry) => entry.sizeBytes <= options.maxFileSizeBytes)
  const astEntries = sourceEntriesWithinSize.filter((entry) => isAstSourceFile(entry.path))
  const parseEntries = astEntries.slice(0, options.maxParseFiles)
  const parsePaths = new Set(parseEntries.map((entry) => entry.path))
  const entryByPath = new Map(inventory.files.map((entry) => [entry.path, entry]))

  const stack = detectTechStack(repoDir, files)
  checkDeadline()
  const lineCounts = new Map<string, number>()
  const sourceImports = new Map<string, string[]>()
  const exportedByFile = new Map<string, string[]>()
  const importsBySource = new Map<string, string[]>()
  const graphNodes = new Set<string>()
  const edges: [string, string][] = []
  const secretFindings: Finding[] = []
  const a11yFindings: Finding[] = []
  const sourceEnvSet = new Set<string>()
  const tokenTextCache = new Map<string, string | null>()

  let parsedFiles = 0
  let parseFailedFiles = 0
  let unreadableSourceFiles = 0
  let components = 0
  let hooks = 0
  let anyTypes = 0
  let consoleLogs = 0
  let reactFiles = 0
  let clientFiles = 0
  let clientComponents = 0
  let serverComponents = 0
  let todos = 0
  let imgTags = 0
  let nextImage = false
  let jsdocCount = 0
  let commentLines = 0
  let componentHardcodedColors = 0
  let componentVariantFiles = 0
  let designComponentCount = 0

  for (const entry of sourceEntries) {
    checkDeadline()
    if (entry.sizeBytes > options.maxFileSizeBytes) continue

    const text = readText(entry.path, options.maxFileSizeBytes, entry.sizeBytes)
    if (text == null) {
      unreadableSourceFiles++
      continue
    }

    const relativePath = entry.relativePath
    lineCounts.set(relativePath, countNonEmptyLines(text))
    commentLines += countCommentLines(text)
    jsdocCount += countTextMatches(text, /\/\*\*/g)
    todos += countTextMatches(text, /(?:TODO|FIXME|HACK)/g)
    imgTags += countTextMatches(text, /\b<img\b/g)
    secretFindings.push(...scanSecrets(text, relativePath))
    a11yFindings.push(...accessibilityFindings(text, relativePath))

    for (const match of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) sourceEnvSet.add(match[1])
    for (const match of text.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) sourceEnvSet.add(match[1])
    for (const match of text.matchAll(/process\.env\[['"]([A-Z0-9_]+)['"]\]/g)) sourceEnvSet.add(match[1])

    if (TOKEN_CANDIDATE_RE.test(path.basename(entry.path)) || TAILWIND_CANDIDATE_RE.test(path.basename(entry.path))) {
      tokenTextCache.set(entry.path, text)
    }

    if (matchesComponentDirectory(relativePath)) {
      componentHardcodedColors += countTextMatches(text, HEX_COLOR_RE)
      componentHardcodedColors += countTextMatches(text, RGB_COLOR_RE)
      if (/\bvariant\s*\??[:=]/.test(text)) componentVariantFiles++
      designComponentCount += countTextMatches(text, COMPONENT_FUNCTION_RE)
      designComponentCount += countTextMatches(text, COMPONENT_ARROW_RE)
    }

    if (!parsePaths.has(entry.path)) continue

    parsedFiles++
    let parsed
    try {
      parsed = parseFile(entry.path, text, repoDir)
    } catch {
      parseFailedFiles++
      continue
    }
    if (parsed.parseFailed) parseFailedFiles++

    components += parsed.components
    hooks += parsed.hooks
    anyTypes += parsed.anyTypes
    consoleLogs += parsed.consoleLogs
    nextImage ||= parsed.nextImageImports
    if (parsed.isReactFile) {
      reactFiles++
      if (parsed.clientDirective) clientFiles++
    }
    if (parsed.clientDirective) clientComponents += parsed.components
    else serverComponents += parsed.components

    const imports = [...parsed.imports]
    sourceImports.set(relativePath, imports)
    importsBySource.set(relativePath, [...parsed.imports, ...parsed.importedSymbols])
    if (parsed.exportedNames.length || parsed.hasDefaultExport) {
      exportedByFile.set(relativePath, [...parsed.exportedNames, parsed.hasDefaultExport ? 'default' : ''].filter(Boolean))
    }
    graphNodes.add(relativePath)
    for (const target of parsed.localTargets) edges.push([relativePath, target])
  }

  checkDeadline()
  const structure = analyzeStructure(repoDir, files, lineCounts)
  checkDeadline()
  const circularDeps = findCircularDeps({ nodes: [...graphNodes], edges })
  const importedSpecifiers = [...sourceImports.values()].flat()
  const readBoundedText = (file: string) => {
    const cached = tokenTextCache.get(file)
    if (cached !== undefined || tokenTextCache.has(file)) return cached ?? null
    const entry = entryByPath.get(file)
    if (!entry || entry.sizeBytes > options.maxFileSizeBytes) return null
    return readText(file, options.maxFileSizeBytes, entry.sizeBytes)
  }
  const unusedDeps = detectUnusedDeps(repoDir, importedSpecifiers, readBoundedText)
  const deadExports = detectDeadExports(exportedByFile, importsBySource)
  checkDeadline()

  const componentEntries = inventory.files.filter((entry) => matchesComponentDirectory(entry.relativePath))
  const componentDirectories = [...new Set(
    componentEntries.flatMap((entry) => entry.relativePath.split('/').filter((segment) => COMPONENT_DIRS.has(segment)))
  )].sort()
  for (const entry of componentEntries) {
    if (isSourceFile(entry.path) || entry.sizeBytes > options.maxFileSizeBytes) continue
    const extension = path.extname(entry.path).toLowerCase()
    if (!['.css', '.scss', '.sass', '.less', '.html', '.md', '.mdx'].includes(extension)) continue
    const text = readBoundedText(entry.path)
    if (!text) continue
    componentHardcodedColors += countTextMatches(text, HEX_COLOR_RE)
    componentHardcodedColors += countTextMatches(text, RGB_COLOR_RE)
  }

  const componentSummary: ComponentAuditSummary = {
    componentFiles: componentEntries.length,
    components: designComponentCount,
    componentDirs: componentDirectories,
    hardcodedColors: componentHardcodedColors,
    variantComponents: componentVariantFiles,
  }
  const designSystem = auditDesignSystem(repoDir, files, readBoundedText, componentSummary)
  checkDeadline()
  const secrets = secretFindings.filter((finding) => finding.severity === 'critical')
  const env = envCheck(repoDir, sourceEnvSet)
  const readmeExists = fs.existsSync(path.join(repoDir, 'README.md')) || fs.existsSync(path.join(repoDir, 'readme.md'))
  const commentRatio = commentLines / Math.max(1, structure.loc)

  const textAssetExtensions = new Set(['.css', '.scss', '.sass', '.less', '.html', '.md', '.mdx'])
  const relevantTextEntries = inventory.files.filter((entry) => {
    const base = path.basename(entry.path)
    return isSourceFile(entry.path) ||
      base === 'package.json' ||
      base === '.env.example' ||
      TOKEN_CANDIDATE_RE.test(base) ||
      TAILWIND_CANDIDATE_RE.test(base) ||
      (matchesComponentDirectory(entry.relativePath) && textAssetExtensions.has(path.extname(entry.path).toLowerCase()))
  })
  const skippedLargeFiles = relevantTextEntries.filter((entry) => entry.sizeBytes > options.maxFileSizeBytes).length
  const unsupportedSourceFiles = sourceEntries.filter((entry) => !isAstSourceFile(entry.path)).length
  const parserLimitReached = astEntries.length > parseEntries.length
  const partial = Boolean(
    inventory.truncated || skippedLargeFiles || parserLimitReached || parseFailedFiles ||
    unsupportedSourceFiles || unreadableSourceFiles
  )
  const coverage = {
    filesIncluded: inventory.files.length,
    discoveredFilesAtLeast: inventory.discoveredFilesAtLeast,
    sourceFiles: sourceEntries.length,
    parsedFiles,
    parseFailedFiles,
    skippedLargeFiles,
    unsupportedSourceFiles,
    unreadableSourceFiles,
    truncated: inventory.truncated,
    partial,
    repoBytes: inventory.repoBytes,
    maxFiles: options.maxFiles,
    maxFileSizeBytes: options.maxFileSizeBytes,
    maxParseFiles: options.maxParseFiles,
  }

  const metrics = {
    commentRatio,
    clientRatio: reactFiles ? clientFiles / reactFiles : 0,
  }

  const findings: Finding[] = [
    ...secretFindings.slice(0, 5),
    ...a11yFindings.slice(0, 50),
    ...structureFindings(structure),
    ...dependencyFindings({ circularDeps, unusedDeps, deadExports, anyTypes, consoleLogs }),
    ...perfFindings({ reactFiles, clientFiles, imgTags, nextImage }),
    ...docFindings(readmeExists, metrics.commentRatio, jsdocCount),
    ...designSystemFindings(designSystem),
  ]

  if (partial) {
    const reasons: string[] = []
    if (inventory.truncated) {
      reasons.push(`File traversal reached the ${options.maxFiles.toLocaleString()}-file limit (at least ${inventory.discoveredFilesAtLeast.toLocaleString()} files were encountered).`)
    }
    if (skippedLargeFiles) {
      reasons.push(`${skippedLargeFiles} file(s) larger than ${Math.round(options.maxFileSizeBytes / 1024)} KiB were not read.`)
    }
    if (parserLimitReached) {
      reasons.push(`AST inspection was capped at ${options.maxParseFiles.toLocaleString()} of ${astEntries.length.toLocaleString()} supported source files.`)
    }
    if (parseFailedFiles) reasons.push(`${parseFailedFiles} source file(s) could not be parsed.`)
    if (unsupportedSourceFiles) reasons.push(`${unsupportedSourceFiles} Vue/Svelte source file(s) were counted but not AST-analyzed.`)
    if (unreadableSourceFiles) reasons.push(`${unreadableSourceFiles} source file(s) could not be read as bounded UTF-8 text.`)
    findings.push({
      id: 'analysis-coverage',
      category: 'analysis',
      severity: 'warning',
      title: 'Partial analysis — review scan coverage',
      detail: reasons.join(' '),
      count: skippedLargeFiles + parseFailedFiles + unreadableSourceFiles,
      evidence: [
        `${coverage.parsedFiles} of ${coverage.sourceFiles} source files were parsed`,
        `${coverage.filesIncluded} repository files were included (${(coverage.repoBytes / (1024 * 1024)).toFixed(1)} MiB indexed)`,
      ],
    })
  }

  if (env.missingFromExample.length) {
    findings.push({
      id: 'env-docs',
      category: 'environment',
      severity: 'warning',
      title: `${env.missingFromExample.length} environment variable(s) are undocumented`,
      detail: env.missingFromExample.slice(0, 10).join(', ') + (env.missingFromExample.length > 10 ? ', …' : ''),
      count: env.missingFromExample.length,
    })
  }
  if (!env.hasExample && sourceEnvSet.size > 0) {
    findings.push({
      id: 'no-env-example',
      category: 'environment',
      severity: 'warning',
      title: 'No .env.example found',
      detail: 'Add a safe example file with variable names and non-secret placeholder values.',
    })
  }
  if (structure.hugeFiles.length && reactFiles === 0 && components === 0) {
    findings.push({
      id: 'structure-hint',
      category: 'structure',
      severity: 'info',
      title: 'Large-file-heavy structure detected',
      detail: 'The scan found large source files but few recognizable React components; confirm that this matches the project architecture.',
    })
  }

  const scores = computeScores({
    avgFileLines: structure.avgFileLines,
    topLevelDirs: structure.topLevelDirs.length,
    entryPoints: structure.entryPoints.length,
    configFiles: structure.configFiles.length,
    circularDeps: circularDeps.length,
    hugeFiles: structure.hugeFiles.length,
    unusedDeps: unusedDeps.length,
    deadExports: deadExports.length,
    anyTypes,
    consoleLogs,
    clientRatio: metrics.clientRatio,
    imgTags,
    hasNextImage: nextImage,
    readme: readmeExists,
    commentRatio: metrics.commentRatio,
    jsdocCount,
    secrets: secrets.length,
    missingEnvDocs: env.missingFromExample.length,
    hasEnvExample: env.hasExample,
    dsComponentFiles: designSystem.componentFiles,
    dsTokens: designSystem.tokenType != null,
    dsHardcodedColors: designSystem.hardcodedColors,
    dsVariantRatio: designSystem.componentFiles > 0
      ? designSystem.variantComponents / designSystem.componentFiles
      : 0,
  })

  checkDeadline()
  return {
    techStack: stack,
    structure,
    metrics: {
      files: parsedFiles,
      loc: structure.loc,
      components,
      hooks,
      anyTypes,
      consoleLogs,
      todos,
      reactFiles,
      clientFiles,
      serverComponents,
      clientComponents,
      unusedDeps,
      deadExports: deadExports.map((item) => `${item.file}#${item.name}`),
      circularDeps,
      imgTagCount: imgTags,
      nextImageCount: nextImage ? 1 : 0,
      jsdocCount,
      commentRatio: metrics.commentRatio,
      sourceEnvVars: [...sourceEnvSet].sort(),
      coverage,
    },
    importGraph: { nodes: [...graphNodes], edges } as ImportGraph,
    designSystem,
    findings: findings.map(enrichFinding).slice(0, 50),
    scores,
  }
}
