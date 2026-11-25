import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { requireAccessibleProject } from './project-access'
import { resolveGitHubToken } from './github'

const CONTEXT_RADIUS = 15
const MAX_SOURCE_BYTES = 1024 * 1024
const GITHUB_TIMEOUT_MS = 8_000

export interface FindingCodeLine {
  number: number
  text: string
  focus: boolean
}

export interface FindingCodeContext {
  file: string
  startLine: number
  endLine: number
  focusLine: number
  totalLines: number
  truncated: boolean
  lines: FindingCodeLine[]
}

type StoredFinding = {
  fingerprint?: unknown
  file?: unknown
  line?: unknown
  policySuppressed?: unknown
}

type ContentsResponse = {
  type?: string
  encoding?: string
  content?: string
  size?: number
  message?: string
}

/**
 * Rejects paths that could escape the repository when interpolated into the
 * GitHub contents API. Callers never supply a path directly: the value comes
 * from a stored finding, but it is still validated before the request.
 */
function validateFindingPath(file: string, line: number): void {
  if (!file || file.length > 400) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This finding has no source file to inspect.' })
  }
  if (file.startsWith('/') || file.includes('\\') || file.split('/').some((segment) => segment === '..' || segment === '')) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'The finding source path is not a valid repository path.' })
  }
  if (!Number.isInteger(line) || line < 1) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This finding has no source line to inspect.' })
  }
}

function githubFileUrl(repoFullName: string, file: string): string {
  const encodedPath = file.split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${repoFullName}/contents/${encodedPath}`
}

/**
 * Fetches a bounded excerpt of the analysed source file on demand.
 *
 * Source text is never persisted: the excerpt is returned to the caller and
 * discarded, keeping the "reports store locations, not source" promise intact.
 */
export async function getFindingCodeContext(
  userId: string,
  input: { slug: string; analysisId: string; fingerprint: string }
): Promise<FindingCodeContext> {
  const { allowed } = await checkRateLimit(`rate:finding-context:${userId}`, 60, 3600)
  if (!allowed) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Code context limit reached for this hour. Try again later.' })
  }

  const project = await requireAccessibleProject(userId, input.slug)

  const analysis = await prisma.analysis.findFirst({
    where: { id: input.analysisId, projectId: project.id },
    select: { id: true, status: true, commitSha: true, findings: true },
  })
  if (!analysis || analysis.status !== 'completed') {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Completed analysis not found for this project.' })
  }

  const findings = Array.isArray(analysis.findings) ? (analysis.findings as StoredFinding[]) : []
  const finding = findings.find((entry) => entry && typeof entry === 'object' && entry.fingerprint === input.fingerprint)
  if (!finding) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Finding not found in this analysis snapshot.' })
  }

  const file = typeof finding.file === 'string' ? finding.file : ''
  const line = typeof finding.line === 'number' ? finding.line : 0
  validateFindingPath(file, line)

  const { token } = await resolveGitHubToken(project.userId, project.githubAccountId)
  if (!token && project.repoPrivate) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Connect a GitHub account with access to this private repository to inspect its source.',
    })
  }

  const ref = analysis.commitSha ?? project.defaultBranch
  const url = `${githubFileUrl(project.repoFullName, file)}?ref=${encodeURIComponent(ref)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Arbor-App',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: 'GitHub did not respond while loading the code excerpt.' })
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 404) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'This file no longer exists at the analysed commit.' })
  }
  if (response.status === 401 || response.status === 403) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'GitHub denied access to this file. Check that the connected account can read the repository.',
    })
  }
  if (!response.ok) {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: `GitHub returned ${response.status} while loading the code excerpt.` })
  }

  const body = (await response.json().catch(() => null)) as ContentsResponse | null
  if (!body || body.type !== 'file' || typeof body.content !== 'string') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This path does not resolve to a readable source file.' })
  }
  if (typeof body.size === 'number' && body.size > MAX_SOURCE_BYTES) {
    throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'This source file is too large to preview inline.' })
  }

  const source = Buffer.from(body.content, body.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8')
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'This source file is too large to preview inline.' })
  }

  const allLines = source.split('\n')
  const totalLines = allLines.length
  const focusLine = Math.min(line, totalLines)
  const startLine = Math.max(1, focusLine - CONTEXT_RADIUS)
  const endLine = Math.min(totalLines, focusLine + CONTEXT_RADIUS)

  return {
    file,
    startLine,
    endLine,
    focusLine,
    totalLines,
    truncated: startLine > 1 || endLine < totalLines,
    lines: allLines.slice(startLine - 1, endLine).map((text, index) => ({
      number: startLine + index,
      text,
      focus: startLine + index === focusLine,
    })),
  }
}
