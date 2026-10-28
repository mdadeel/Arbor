import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { simpleGit } from 'simple-git'
import { describe, expect, it } from 'vitest'
import { parseFile } from './ast'
import { runAnalysis } from './index'
import {
  analyzeHotspots,
  computeHotspotReport,
  normalizeGitNumstatPath,
  parseGitLogNumstat,
} from './hotspots'

describe('Hotspot analysis (Git log churn × per-file AST complexity)', () => {
  it('measures per-file AST cyclomatic complexity and function count in a single parse pass', () => {
    const simpleSource = `export const add = (a: number, b: number) => a + b\n`
    const simpleParsed = parseFile('src/math.ts', simpleSource, process.cwd())
    expect(simpleParsed.parseFailed).toBe(false)
    expect(simpleParsed.functionCount).toBe(1)
    expect(simpleParsed.cyclomaticComplexity).toBe(1)

    const branchingSource = `
      export function evaluateOrder(total: number, vip: boolean, retries: number) {
        if (total <= 0 || Number.isNaN(total)) return 'invalid'
        let score = vip ? 10 : 0
        for (let i = 0; i < retries; i++) {
          if (i % 2 === 0 && total > 100) score += 5
        }
        switch (score) {
          case 10:
            return 'tier-1'
          case 15:
            return 'tier-2'
          default:
            return 'standard'
        }
      }
    `
    const complexParsed = parseFile('src/order.ts', branchingSource, process.cwd())
    expect(complexParsed.parseFailed).toBe(false)
    expect(complexParsed.functionCount).toBe(1)
    // Base (1) + 2 IfStatements + 2 LogicalExpressions (||, &&) + 1 ConditionalExpression + 1 ForStatement + 2 non-default SwitchCases = 9
    expect(complexParsed.cyclomaticComplexity).toBe(9)
  })

  it('normalizes Git rename numstat paths and ranks high-churn × high-complexity files first', () => {
    expect(normalizeGitNumstatPath('src/{legacy => server}/billing.ts')).toBe(
      'src/server/billing.ts'
    )
    expect(normalizeGitNumstatPath('old/engine.ts => src/engine.ts')).toBe('src/engine.ts')

    const rawLog = [
      '__ARBOR_COMMIT__aaa111\t2026-10-28T10:00:00Z\talice@acme.dev',
      '45\t12\tsrc/{legacy => server}/hotspot.ts',
      '2\t1\tsrc/constants.ts',
      '__ARBOR_COMMIT__bbb222\t2026-10-27T09:00:00Z\tbob@acme.dev',
      '80\t30\tsrc/server/hotspot.ts',
      '3\t1\tsrc/constants.ts',
      '__ARBOR_COMMIT__ccc333\t2026-10-26T08:00:00Z\talice@acme.dev',
      '60\t20\tsrc/server/hotspot.ts',
      '1\t1\tsrc/constants.ts',
    ].join('\n')

    const churn = parseGitLogNumstat(rawLog, 180)
    expect(churn.commitsAnalyzed).toBe(3)
    expect(churn.files.get('src/server/hotspot.ts')).toEqual({
      commits: 3,
      linesAdded: 185,
      linesDeleted: 62,
      linesChanged: 247,
      distinctAuthors: 2,
      lastModifiedAt: '2026-10-28T10:00:00.000Z',
    })

    const report = computeHotspotReport(
      [
        // High complexity AND high churn -> should rank #1
        { file: 'src/server/hotspot.ts', loc: 420, cyclomaticComplexity: 48, functionCount: 14 },
        // High churn, trivial complexity -> lower score than hotspot.ts
        { file: 'src/constants.ts', loc: 15, cyclomaticComplexity: 1, functionCount: 0 },
        // High complexity, zero churn -> excluded from active churn hotspots
        { file: 'src/dormant-legacy.ts', loc: 600, cyclomaticComplexity: 65, functionCount: 20 },
      ],
      churn
    )

    expect(report.filesWithChurn).toBe(2)
    expect(report.entries).toHaveLength(2)
    expect(report.entries[0]?.file).toBe('src/server/hotspot.ts')
    expect(report.entries[0]?.rank).toBe(1)
    expect(report.entries[1]?.file).toBe('src/constants.ts')
    expect(report.entries[0]!.hotspotScore).toBeGreaterThan(report.entries[1]!.hotspotScore)
  })

  it('computes end-to-end hotspots from real simple-git commit history in a temporary repository', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbor-hotspot-test-'))
    try {
      const git = simpleGit(tmpDir)
      await git.init()
      await git.addConfig('user.name', 'Test Engineer')
      await git.addConfig('user.email', 'engineer@example.com')

      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true })
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'hotspot-fixture', version: '1.0.0' }),
        'utf8'
      )
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'stable.ts'),
        `export function stableHelper(x: number) { return x > 0 ? x : 0 }\n`,
        'utf8'
      )
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'engine.ts'),
        `export function processItems(items: number[]) {
          let total = 0
          for (const item of items) {
            if (item > 10 && item < 100) total += item
            else if (item >= 100) total += item * 2
          }
          return total
        }\n`,
        'utf8'
      )
      await git.add('.')
      await git.commit('feat: initial files')

      // Churn src/engine.ts across two additional commits with increasing branching complexity
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'engine.ts'),
        `export function processItems(items: number[], strict = false) {
          let total = 0
          for (const item of items) {
            if (strict && item < 0) throw new Error('negative')
            if (item > 10 && item < 100) total += item
            else if (item >= 100 || item === 42) total += item * 2
            else total += item > 0 ? 1 : 0
          }
          return total
        }\n`,
        'utf8'
      )
      await git.add('.')
      await git.commit('feat: add strict mode branching')

      const analysis = runAnalysis(tmpDir)
      const hotspots = await analyzeHotspots(tmpDir, analysis.metrics.fileComplexities ?? [])

      expect(hotspots.commitsAnalyzed).toBe(2)
      expect(hotspots.entries[0]?.file).toBe('src/engine.ts')
      expect(hotspots.entries[0]?.commits).toBe(2)
      expect(hotspots.entries[0]!.cyclomaticComplexity).toBeGreaterThan(
        hotspots.entries[1]!.cyclomaticComplexity
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
