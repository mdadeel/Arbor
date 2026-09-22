import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { runAnalysis } from './index'

describe('runAnalysis (AST Analysis Engine)', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbor-analysis-test-'))

    // Create a mock repository structure
    fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'src', 'lib'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'src', 'app', 'api', 'users'), { recursive: true })

    // package.json
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-repo',
          version: '1.0.0',
          dependencies: {
            react: '^18.2.0',
            'next': '^14.0.0',
            'unused-pkg': '^1.0.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
            vitest: '^1.0.0',
          },
        },
        null,
        2
      )
    )

    // package-lock.json
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}')

    // README.md
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Repository\n\nDocs for testing.')

    // .env.example
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'NEXT_PUBLIC_API_URL=http://localhost:3000\nDATABASE_URL=postgres://...\n')

    // src/lib/utils.ts
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'lib', 'utils.ts'),
      `/**
 * Helper utilities.
 */
import { format } from './formatter'

export function helper(x: any) {
  console.log('debug:', x)
  return format(x)
}

export const unusedExport = 'dead-code'
`
    )

    // src/lib/formatter.ts
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'lib', 'formatter.ts'),
      `import { helper } from './utils'

export function format(val: any) {
  return String(val)
}
`
    )

    // src/components/button.tsx
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'components', 'button.tsx'),
      `'use client'
import React, { useState } from 'react'

export function Button({ label }: { label: string }) {
  const [count, setCount] = useState(0)
  const apiKey = process.env.NEXT_PUBLIC_API_URL
  return (
    <button onClick={() => setCount(count + 1)} style={{ color: '#ff0000' }}>
      {label}: {count} ({apiKey})
    </button>
  )
}
`
    )

    // src/app/api/users/route.ts
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'app', 'api', 'users', 'route.ts'),
      `export async function GET() {
  const db = process.env.DATABASE_URL
  const secret = process.env.SECRET_KEY
  return Response.json({ status: 'ok', db, secret })
}
`
    )
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('runs analysis end-to-end and returns complete report', () => {
    const report = runAnalysis(tmpDir)

    // 1. Tech Stack Detection
    expect(report.techStack.framework).toBe('Next.js')
    expect(report.techStack.languages).toContain('TypeScript')
    expect(report.techStack.packageManager).toBeTruthy()

    // 2. Structure Analysis
    expect(report.structure.loc).toBeGreaterThan(0)
    expect(report.structure.avgFileLines).toBeGreaterThan(0)
    expect(report.structure.topLevelDirs).toContain('src')

    // 3. Metrics
    expect(report.metrics.files).toBe(4)
    expect(report.metrics.components).toBeGreaterThanOrEqual(1)
    expect(report.metrics.hooks).toBeGreaterThanOrEqual(1)
    expect(report.metrics.reactFiles).toBe(1)
    expect(report.metrics.clientFiles).toBe(1)
    expect(report.metrics.anyTypes).toBeGreaterThanOrEqual(2)
    expect(report.metrics.consoleLogs).toBeGreaterThanOrEqual(1)

    // 4. Import Graph & Circular Dependencies
    expect(report.importGraph.nodes.length).toBeGreaterThan(0)
    // utils -> formatter -> utils forms a circular dependency cycle
    expect(report.metrics.circularDeps.length).toBeGreaterThanOrEqual(1)

    // 5. Debt Detection (Unused deps & dead exports)
    expect(report.metrics.unusedDeps).toContain('unused-pkg')
    expect(report.metrics.deadExports.some((d) => d.includes('unusedExport'))).toBe(true)

    // 6. Environment Check
    expect(report.metrics.sourceEnvVars).toContain('SECRET_KEY')

    // 7. Score Calculation
    expect(report.scores.overall).toBeGreaterThanOrEqual(0)
    expect(report.scores.overall).toBeLessThanOrEqual(100)
    expect(report.scores.architecture).toBeGreaterThanOrEqual(0)
    expect(report.scores.techDebt).toBeGreaterThanOrEqual(0)
    expect(report.scores.performance).toBeGreaterThanOrEqual(0)
    expect(report.scores.documentation).toBeGreaterThanOrEqual(0)
    expect(report.scores.security).toBeGreaterThanOrEqual(0)
    expect(report.scores.designSystem).toBeGreaterThanOrEqual(0)

    // 8. Findings Generation
    expect(report.findings.length).toBeGreaterThan(0)
    expect(report.findings.some((f) => f.id === 'circular-dep')).toBe(true)
    expect(report.findings.some((f) => f.id === 'unused-deps')).toBe(true)
    expect(report.findings.some((f) => f.id === 'env-docs')).toBe(true)
  })
})
