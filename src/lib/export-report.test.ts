import { describe, it, expect } from 'vitest'
import { generateMarkdownReport, generateJsonReport } from './export-report'

describe('Report Export Utilities', () => {
  const mockProject = {
    id: 'proj-1',
    slug: 'arbor',
    name: 'Arbor Core',
    repoFullName: 'arbor/arbor-core',
    defaultBranch: 'main',
    repoUrl: 'https://github.com/arbor/arbor-core',
    description: 'Developer portal architecture engine',
  }

  const mockAnalysis = {
    id: 'an-1',
    status: 'completed',
    branch: 'main',
    commitSha: 'abcdef1234567890',
    overallScore: 88,
    architectureScore: 92,
    techDebtScore: 85,
    performanceScore: 90,
    documentationScore: 80,
    securityScore: 95,
    designSystemScore: 86,
    techStack: {
      framework: 'Next.js',
      languages: ['TypeScript', 'CSS'],
      packageManager: 'npm',
      databases: ['PostgreSQL'],
      testing: ['Vitest'],
      ui: ['Tailwind CSS'],
    },
    metrics: {
      totalLoc: 4500,
      totalFiles: 42,
      circularDeps: [['src/a.ts', 'src/b.ts', 'src/a.ts']],
    },
    findings: [
      {
        id: 'f-1',
        category: 'Debt',
        ruleId: 'large-file',
        title: 'Large File',
        detail: 'File exceeds 500 lines',
        severity: 'warning' as const,
        file: 'src/big.ts',
        line: 520,
      },
      {
        id: 'f-2',
        category: 'Security',
        ruleId: 'hardcoded-secret',
        title: 'Hardcoded Secret',
        detail: 'Found potential API key',
        severity: 'critical' as const,
        file: 'src/secret.ts',
        line: 12,
      },
      {
        id: 'f-3',
        category: 'Architecture',
        ruleId: 'suggest-hook',
        title: 'Refactor Suggestion',
        detail: 'Extract logic into custom hook',
        severity: 'info' as const,
        file: 'src/comp.tsx',
      },
    ],
    durationMs: 4200,
    createdAt: '2026-09-18T10:00:00.000Z',
  }

  it('generates a complete, structured Markdown audit report with Arbor branding', () => {
    const md = generateMarkdownReport(mockProject, mockAnalysis)

    expect(md).toContain('# Arbor Architecture Audit Report')
    expect(md).toContain('[Arbor Core](https://github.com/arbor/arbor-core)')
    expect(md).toContain('88/100')
    expect(md).toContain('4,500')
    expect(md).toContain('Next.js')
    expect(md).toContain('1 cycle(s) identified')
    expect(md).toContain('`src/a.ts → src/b.ts → src/a.ts`')
    expect(md).toContain('### 🔴 Critical Issues (1)')
    expect(md).toContain('`src/secret.ts:12`')
    expect(md).toContain('### 🟡 Warnings (1)')
    expect(md).toContain('`src/big.ts:520`')
    expect(md).toContain('### 🔵 Architectural Suggestions (1)')
    expect(md).toContain('Generated automatically by [Arbor]')
  })

  it('generates a valid JSON export with metadata and complete payload', () => {
    const jsonStr = generateJsonReport(mockProject, mockAnalysis)
    const parsed = JSON.parse(jsonStr)

    expect(parsed.generator).toBe('Arbor AST Analysis Engine')
    expect(parsed.project.slug).toBe('arbor')
    expect(parsed.analysis.overallScore).toBe(88)
    expect(parsed.analysis.findings).toHaveLength(3)
  })
})
