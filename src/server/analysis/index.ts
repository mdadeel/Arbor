import path from 'node:path'
import fs from 'node:fs'
import { listFiles, isSourceFile, readText } from './walk'
import { parseFile } from './ast'
import { analyzeStructure } from './structure'
import { detectTechStack } from './stack'
import { auditDesignSystem, designSystemFindings } from './designSystem'
import { computeScores, type ScoreInput } from './score'
import {
  scanSecrets,
  envCheck,
  findCircularDeps,
  detectUnusedDeps,
  detectDeadExports,
  structureFindings,
  perfFindings,
  docFindings,
} from './checks'
import type { AnalysisReport, Finding, ImportGraph } from './types'

const MAX_PARSE_FILES = 1500

function debtFindings(metrics: {
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
      severity: cycle.length > 2 ? 'critical' : 'warning',
      title: 'Circular dependency',
      detail: `Import cycle: ${cycle.join(' → ')}. This can cause runtime ordering bugs.`,
      paths: cycle,
    })
  }
  if (metrics.unusedDeps.length) {
    findings.push({
      id: 'unused-deps',
      category: 'techDebt',
      severity: 'warning',
      title: `${metrics.unusedDeps.length} dependency(ies) never imported`,
      detail: metrics.unusedDeps.slice(0, 10).join(', '),
      count: metrics.unusedDeps.length,
    })
  }
  if (metrics.deadExports.length) {
    findings.push({
      id: 'dead-exports',
      category: 'techDebt',
      severity: 'info',
      title: `${metrics.deadExports.length} export(s) never imported`,
      detail: metrics.deadExports
        .slice(0, 6)
        .map((d) => `${d.file}#${d.name}`)
        .join(', '),
      count: metrics.deadExports.length,
    })
  }
  if (metrics.anyTypes > 3) {
    findings.push({
      id: 'any-types',
      category: 'techDebt',
      severity: metrics.anyTypes > 20 ? 'warning' : 'info',
      title: `${metrics.anyTypes} \`any\` type usages`,
      detail: 'Unknown statuses undermine strict typing; prefer explicit types.',
      count: metrics.anyTypes,
    })
  }
  if (metrics.consoleLogs > 2) {
    findings.push({
      id: 'console-logs',
      category: 'techDebt',
      severity: 'info',
      title: `${metrics.consoleLogs} console.log calls`,
      detail: 'Debug logging left in source.',
      count: metrics.consoleLogs,
    })
  }
  return findings
}

export function runAnalysis(repoDir: string): AnalysisReport {
  const files = listFiles(repoDir)
  const sourceFiles = files.filter((f) => isSourceFile(f)).slice(0, MAX_PARSE_FILES)
  const stack = detectTechStack(repoDir)
  const structure = analyzeStructure(repoDir)

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
  const sourceEnvSet = new Set<string>()
  const exportedByFile = new Map<string, string[]>()
  const importsBySource = new Map<string, string[]>()
  const secretFindings: Finding[] = []
  const edges: [string, string][] = []
  const graphNodes = new Set<string>()

  for (const f of sourceFiles) {
    const text = readText(f) ?? ''
    const a = parseFile(f)
    const rel = path.relative(repoDir, f).split(path.sep).join('/')

    components += a.components
    hooks += a.hooks
    anyTypes += a.anyTypes
    consoleLogs += a.consoleLogs
    imgTags += a.imgTags
    jsdocCount += a.jsdocCount
    commentLines += a.commentLines
    todos += (text.match(/(?:TODO|FIXME|HACK)/g) ?? []).length
    nextImage ||= a.nextImageImports
    if (a.isReactFile) {
      reactFiles++
      if (a.clientDirective) clientFiles++
    }
    if (a.clientDirective) clientComponents += a.components
    else serverComponents += a.components
    for (const v of a.processEnv) sourceEnvSet.add(v)
    if (a.exportedNames.length || a.hasDefaultExport) {
      exportedByFile.set(rel, [...a.exportedNames, a.hasDefaultExport ? 'default' : ''].filter(Boolean))
    }
    importsBySource.set(rel, [...a.imports, ...a.importedSymbols])
    graphNodes.add(rel)
    for (const t of a.localTargets) edges.push([rel, t])
    secretFindings.push(...scanSecrets(text, rel))
  }

  const graph: ImportGraph = { nodes: [...graphNodes], edges }
  const circularDeps = findCircularDeps(graph)
  const unusedDeps = detectUnusedDeps(repoDir)
  const deadExports = detectDeadExports(exportedByFile, importsBySource)
  const designSystem = auditDesignSystem(repoDir)
  const secrets = secretFindings.filter((f) => f.severity === 'critical')
  const env = envCheck(repoDir, sourceEnvSet)
  const readmeExists = fs.existsSync(path.join(repoDir, 'README.md')) || fs.existsSync(path.join(repoDir, 'readme.md'))
  const totalLineish = Math.max(1, structure.loc + commentLines)

  const metrics = {
    comments: commentLines,
    commentRatio: commentLines / totalLineish,
    clientRatio: reactFiles ? clientFiles / reactFiles : 0,
  }

  // --- findings ---
  const findings: Finding[] = [
    ...secretFindings.slice(0, 5),
    ...structureFindings(structure),
    ...debtFindings({ circularDeps, unusedDeps, deadExports, anyTypes, consoleLogs }),
    ...perfFindings({ reactFiles, clientFiles, imgTags, nextImage, avgFileLines: structure.avgFileLines }),
    ...docFindings(readmeExists, metrics.commentRatio, jsdocCount),
    ...designSystemFindings(designSystem),
  ]

  if (env.missingFromExample.length) {
    findings.push({
      id: 'env-docs',
      category: 'environment',
      severity: 'warning',
      title: `${env.missingFromExample.length} env var(s) used but undocumented`,
      detail: env.missingFromExample.slice(0, 10).join(', ') + (env.missingFromExample.length > 10 ? ', …' : ''),
      count: env.missingFromExample.length,
    })
  }
  if (!env.hasExample && sourceEnvSet.size > 0) {
    findings.push({
      id: 'no-env-example',
      category: 'environment',
      severity: 'warning',
      title: 'No .env.example',
      detail: 'Docs on required environment variables are missing.',
    })
  }
  if (structure.hugeFiles.length && reactFiles === 0 && components === 0) {
    findings.push({
      id: 'structure-hint',
      category: 'structure',
      severity: 'info',
      title: 'Large monolith detected',
      detail: 'Single-file-heavy structure without clear modules.',
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
    dsVariantRatio:
      designSystem.componentFiles > 0
        ? designSystem.variantComponents / designSystem.componentFiles
        : 0,
  })

  return {
    techStack: stack,
    structure,
    metrics: {
      files: sourceFiles.length,
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
      deadExports: deadExports.map((d) => `${d.file}#${d.name}`),
      circularDeps,
      imgTagCount: imgTags,
      nextImageCount: nextImage ? 1 : 0,
      jsdocCount,
      commentRatio: metrics.commentRatio,
      sourceEnvVars: [...sourceEnvSet].sort(),
    },
    importGraph: graph,
    designSystem,
    findings: findings.slice(0, 50),
    scores,
  }
}