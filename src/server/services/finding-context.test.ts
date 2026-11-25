import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    analysis: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn(),
}))
vi.mock('./project-access', () => ({
  requireAccessibleProject: vi.fn(),
}))
vi.mock('./github', () => ({
  resolveGitHubToken: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { requireAccessibleProject } from './project-access'
import { resolveGitHubToken } from './github'
import { getFindingCodeContext } from './finding-context'

const project = {
  id: 'project-1',
  slug: 'demo',
  userId: 'user-1',
  workspaceId: null,
  repoUrl: 'https://github.com/acme/demo',
  repoFullName: 'acme/demo',
  githubAccountId: null as string | null,
  defaultBranch: 'main',
  name: 'Demo',
  repoPrivate: false,
}

const fingerprint = 'a'.repeat(64)
const source = Array.from({ length: 60 }, (_, index) => `line ${index + 1}`).join('\n')

function contentsBody(overrides: Record<string, unknown> = {}) {
  return {
    type: 'file',
    encoding: 'base64',
    content: Buffer.from(source, 'utf8').toString('base64'),
    size: Buffer.byteLength(source, 'utf8'),
    ...overrides,
  }
}

function mockAnalysis(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.analysis.findFirst).mockResolvedValue({
    id: 'analysis-1',
    status: 'completed',
    commitSha: 'abc123',
    findings: [{ fingerprint, file: 'src/app.ts', line: 30 }],
    ...overrides,
  } as never)
}

describe('getFindingCodeContext', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, degraded: false } as never)
    vi.mocked(requireAccessibleProject).mockResolvedValue(project as never)
    vi.mocked(resolveGitHubToken).mockResolvedValue({ token: null, accountId: null })
    mockAnalysis()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(contentsBody()), { status: 200 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a bounded excerpt around the finding line and pins the request to the analysed commit', async () => {
    const result = await getFindingCodeContext('user-1', { slug: 'demo', analysisId: 'analysis-1', fingerprint })

    expect(result.file).toBe('src/app.ts')
    expect(result.startLine).toBe(15)
    expect(result.endLine).toBe(45)
    expect(result.focusLine).toBe(30)
    expect(result.totalLines).toBe(60)
    expect(result.truncated).toBe(true)
    expect(result.lines).toHaveLength(31)
    expect(result.lines.find((entry) => entry.focus)?.number).toBe(30)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe('https://api.github.com/repos/acme/demo/contents/src/app.ts?ref=abc123')
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('uses the connected token for private repositories', async () => {
    vi.mocked(requireAccessibleProject).mockResolvedValue({ ...project, repoPrivate: true } as never)
    vi.mocked(resolveGitHubToken).mockResolvedValue({ token: 'secret-token', accountId: 'account-1' })

    await getFindingCodeContext('user-1', { slug: 'demo', analysisId: 'analysis-1', fingerprint })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-token')
  })

  it('refuses private repositories without a connected token', async () => {
    vi.mocked(requireAccessibleProject).mockResolvedValue({ ...project, repoPrivate: true } as never)

    await expect(
      getFindingCodeContext('user-1', { slug: 'demo', analysisId: 'analysis-1', fingerprint })
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a fingerprint that is not part of the snapshot', async () => {
    await expect(
      getFindingCodeContext('user-1', { slug: 'demo', analysisId: 'analysis-1', fingerprint: 'b'.repeat(64) })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects path traversal before calling GitHub', async () => {
    mockAnalysis({ findings: [{ fingerprint, file: '../secret', line: 1 }] })

    await expect(
      getFindingCodeContext('user-1', { slug: 'demo', analysisId: 'analysis-1', fingerprint })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects oversized files', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(contentsBody({ size: 2 * 1024 * 1024 })), { status: 200 })
    )

    await expect(
      getFindingCodeContext('user-1', { slug: 'demo', analysisId: 'analysis-1', fingerprint })
    ).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
  })

  it('maps missing files and rate limits to clear errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not found', { status: 404 }))
    await expect(
      getFindingCodeContext('user-1', { slug: 'demo', analysisId: 'analysis-1', fingerprint })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, degraded: false } as never)
    await expect(
      getFindingCodeContext('user-1', { slug: 'demo', analysisId: 'analysis-1', fingerprint })
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
  })
})
