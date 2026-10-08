import { afterEach, describe, it, expect, vi } from 'vitest'
import { explainFinding, generateDocSummary, generateReleaseNotes, generateReviewPatch } from './ai'
import type { Finding } from '@/server/analysis/types'

describe('ai service', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  const sampleFinding: Finding = {
    id: 'finding-1', category: 'security', severity: 'warning',
    title: 'Avoid exposing tokens', detail: 'A token-like value is assigned in client code.',
  }

  it('uses the bounded OpenAI adapter with an allowlisted model and structured output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ summary: 'Review the token use.', impact: 'Could expose access.', recommendation: 'Move it to a server-only secret.' }) } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await explainFinding(sampleFinding, { apiKey: 'test-openai-key', provider: 'openai', model: 'not-allowlisted' })
    const [url, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(String(init.body)) as { model: string }

    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-openai-key')
    expect(body.model).toBe('gpt-4o')
    expect(result.summary).toBe('Review the token use.')
    expect(result.confidenceScore).toBe(0.92)
  })

  it('uses the Anthropic adapter and degrades to deterministic guidance on provider failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify({ summary: 'Review the finding.', impact: 'Potential exposure.', recommendation: 'Use a secret manager.' }) }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('provider unavailable', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await explainFinding(sampleFinding, { apiKey: 'test-anthropic-key', provider: 'anthropic', model: 'claude-3-haiku-20240307' })
    const [, init] = fetchMock.mock.calls[0]
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
    expect(new Headers(init.headers).get('x-api-key')).toBe('test-anthropic-key')
    expect(result.summary).toBe('Review the finding.')

    const fallback = await explainFinding(sampleFinding, { apiKey: 'test-anthropic-key', provider: 'anthropic' })
    expect(fallback.confidenceScore).toBe(0.88)
    expect(fallback.recommendation).toContain('token')
  })
  it('only returns a single-file patch that applies to the supplied snapshot', async () => {
    const source = 'const token = "placeholder"\nconsole.log(token)\n'
    const file = 'src/token.ts'
    const diff = [
      `diff --git a/${file} b/${file}`,
      `--- a/${file}`,
      `+++ b/${file}`,
      '@@ -1,2 +1,2 @@',
      '-const token = "placeholder"',
      '+const token = process.env.APP_TOKEN ?? ""',
      ' console.log(token)',
    ].join('\n')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ summary: 'Read a server-side environment value.', diff }) } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const suggestion = await generateReviewPatch({
      finding: { ...sampleFinding, file }, file, source, apiKey: 'test-key', provider: 'openai', model: 'gpt-4o-mini',
    })
    expect(suggestion.validation).toMatchObject({ appliesCleanly: true, addedLines: 1, removedLines: 1, repositoryModified: false, testsRun: false })
    expect(suggestion.diff).toBe(diff)

    const unsafeDiff = diff.replace('src/token.ts', '../outside.ts')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ summary: 'Unsafe path.', diff: unsafeDiff }) } }],
    }), { status: 200 })))
    await expect(generateReviewPatch({
      finding: { ...sampleFinding, file }, file, source, apiKey: 'test-key', provider: 'openai',
    })).rejects.toThrow(/exactly the finding file/)
  })

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

    const release = generateReleaseNotes('Arbor', commits, prs)
    expect(release.features.length).toBe(1)
    expect(release.features[0]).toContain('#42')
    expect(release.fixes.length).toBe(1)
    expect(release.fixes[0]).toContain('#43')
    expect(release.markdown).toContain('# Arbor')
    expect(release.markdown).toContain('🚀 New Features')
    expect(release.markdown).toContain('🐛 Bug Fixes')
  })
})
