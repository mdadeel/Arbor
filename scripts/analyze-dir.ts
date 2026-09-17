// Self-check + dogfood: analyze a local dir with the engine and print scores/findings.
// Usage: npx tsx scripts/analyze-dir.ts [dir]
import { runAnalysis } from '../src/server/analysis'
import path from 'node:path'

async function main() {
  const dir = path.resolve(process.argv[2] ?? process.cwd())
  const started = Date.now()
  const report = runAnalysis(dir)
  const secs = ((Date.now() - started) / 1000).toFixed(1)

  console.log(`analyzed ${dir} in ${secs}s`)
  console.log(`  files ${report.structure.fileCount} | loc ${report.structure.loc} | components ${report.metrics.components} | hooks ${report.metrics.hooks}`)
  console.log(`  stack: ${[report.techStack.framework, report.techStack.languages.join('/'), report.techStack.packageManager].filter(Boolean).join(' ')}`)
  console.log(`  scores: overall=${report.scores.overall} arch=${report.scores.architecture} debt=${report.scores.techDebt} perf=${report.scores.performance} docs=${report.scores.documentation} sec=${report.scores.security} ds=${report.scores.designSystem}`)
  console.log(`  import graph: ${report.importGraph.nodes.length} nodes, ${report.importGraph.edges.length} edges`)
  for (const f of report.findings) {
    console.log(`  [${f.severity}/${f.category}] ${f.title}${f.file ? ` @ ${f.file}` : ''}${f.detail ? ` — ${f.detail}` : ''}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})