import { describe, it, expect } from 'vitest'
import { explainFinding, generateDocSummary, generateReleaseNotes } from './ai'
import type { Finding } from '@/server/analysis/types'

describe('ai service', () => {
  it('generates structured finding explanations for security issues', async () => {
    const finding: Finding = {
      id: 'f-sec-1',
      category: 'security',
      severity: 'critical',
      title: 'Exposed Stripe API key in client component',
      detail: 'Hardcoded sk_live_... found in checkout.tsx:15',
      file: 'src/components/checkout.tsx',
      line: 15,
    }

    const explanation = await explainFinding(finding)
    expect(explanation.summary).toContain('Exposed Stripe API key')
    expect(explanation.impact).toContain('Potential security exposure')
    expect(explanation.recommendation).toContain('checkout.tsx')
    expect(explanation.confidenceScore).toBeGreaterThanOrEqual(0.8)
  })

  it('generates document summary and estimates reading time', () => {
    const markdown = `
# Developer Onboarding Guide

## Prerequisites
Install Node.js, Docker, and PostgreSQL.

## Environment Setup
Run \`npm run setup\` to generate local certificates and database schemas.

## API Architecture
The service proxies requests through tRPC with full TypeScript validation.
`

    const summary = generateDocSummary('Developer Onboarding Guide', markdown)
    expect(summary.readingTimeMinutes).toBe(1)
    expect(summary.keyPoints.length).toBeGreaterThanOrEqual(3)
    expect(summary.suggestedTags).toContain('API')
    expect(summary.suggestedTags).toContain('Database')
    expect(summary.executiveSummary).toContain('Developer Onboarding Guide')
  })

  it('generates structured release notes from commits and PRs', () => {
    const commits = [
      { message: 'feat: add dark mode theme switcher', sha: 'a1b2c3d4e5f' },
      { message: 'fix: resolve race condition in audit queue', sha: 'f9e8d7c6b5a' },
      { message: 'chore: upgrade dependencies', sha: '1234567890a' },
    ]
    const prs = [
      { title: 'feat: add architecture graph visualizer', number: 42 },
      { title: 'fix: handle missing openapi spec gracefully', number: 43 },
    ]

    const release = generateReleaseNotes('DevHub', commits, prs)
    expect(release.features.length).toBe(1)
    expect(release.features[0]).toContain('#42')
    expect(release.fixes.length).toBe(1)
    expect(release.fixes[0]).toContain('#43')
    expect(release.markdown).toContain('# DevHub')
    expect(release.markdown).toContain('🚀 New Features')
    expect(release.markdown).toContain('🐛 Bug Fixes')
  })
})
