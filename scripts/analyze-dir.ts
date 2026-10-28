// Self-check + dogfood: analyze a local dir with the engine and print scores/findings.
// Usage: npx tsx scripts/analyze-dir.ts [dir] [--sarif <output-path>] [--branch <ref>] [--commit <sha>] [--repo-url <url>]
import fs from 'node:fs'
import path from 'node:path'
import { runAnalysis } from '../src/server/analysis'
import { analyzeHotspots } from '../src/server/analysis/hotspots'
import { buildSarifLog } from '../src/lib/sarif'
import { assertValidSarifLog } from '../src/server/analysis/sarif-validator'

interface CliArgs {
  dir: string
  sarifPath: string | null
  branch: string | null
  commitSha: string | null
  repoUrl: string | null
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dirArg: string | null = null
  let sarifPath: string | null = null
  let branch: string | null = null
  let commitSha: string | null = null
  let repoUrl: string | null = null

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--sarif') {
      sarifPath = argv[++i] ?? null
      if (!sarifPath) {
        throw new Error('Missing output file path after --sarif')
      }
    } else if (arg.startsWith('--sarif=')) {
      sarifPath = arg.slice('--sarif='.length)
    } else if (arg === '--branch') {
      branch = argv[++i] ?? null
    } else if (arg === '--commit') {
      commitSha = argv[++i] ?? null
    } else if (arg === '--repo-url') {
      repoUrl = argv[++i] ?? null
    } else if (!arg.startsWith('-') && !dirArg) {
      dirArg = arg
    }
  }

  return {
    dir: path.resolve(dirArg ?? process.cwd()),
    sarifPath: sarifPath ? path.resolve(sarifPath) : null,
    branch,
    commitSha,
    repoUrl,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const started = Date.now()
  const report = runAnalysis(args.dir)
  const hotspots = await analyzeHotspots(args.dir, report.metrics.fileComplexities ?? [])
  report.metrics.hotspots = hotspots
  const secs = ((Date.now() - started) / 1000).toFixed(1)

  console.log(`analyzed ${args.dir} in ${secs}s`)
  console.log(`  files ${report.structure.fileCount} | loc ${report.structure.loc} | components ${report.metrics.components} | hooks ${report.metrics.hooks}`)
  console.log(`  stack: ${[report.techStack.framework, report.techStack.languages.join('/'), report.techStack.packageManager].filter(Boolean).join(' ')}`)
  console.log(`  scores: overall=${report.scores.overall} arch=${report.scores.architecture} debt=${report.scores.techDebt} perf=${report.scores.performance} docs=${report.scores.documentation} sec=${report.scores.security} ds=${report.scores.designSystem}`)
  console.log(`  import graph: ${report.importGraph.nodes.length} nodes, ${report.importGraph.edges.length} edges`)
  if (hotspots.entries.length > 0) {
    const topPreview = hotspots.entries
      .slice(0, 3)
      .map((h) => `${h.file} (score=${h.hotspotScore}, commits=${h.commits}, cc=${h.cyclomaticComplexity})`)
      .join(', ')
    console.log(`  hotspots (${hotspots.commitsAnalyzed} commits): ${topPreview}`)
  }
  for (const f of report.findings) {
    console.log(`  [${f.severity}/${f.category}] ${f.title}${f.file ? ` @ ${f.file}` : ''}${f.detail ? ` — ${f.detail}` : ''}`)
  }

  if (args.sarifPath) {
    const sarifLog = buildSarifLog({
      findings: report.findings,
      branch: args.branch,
      commitSha: args.commitSha,
      repoUrl: args.repoUrl,
    })
    assertValidSarifLog(sarifLog)
    fs.mkdirSync(path.dirname(args.sarifPath), { recursive: true })
    fs.writeFileSync(args.sarifPath, JSON.stringify(sarifLog, null, 2), 'utf8')
    console.log(`  wrote validated SARIF 2.1.0 (${report.findings.length} results) -> ${args.sarifPath}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
