import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { checkRateLimit } from '@/lib/redis'
import { generateReviewPatch } from './ai'
import { resolveGitHubToken } from './github'
import { requireAccessibleProject, requireProjectEditor } from './project-access'
import type { Finding } from '@/server/analysis/types'

const MAX_SOURCE_BYTES = 64 * 1024
const MAX_GITHUB_RESPONSE_BYTES = 256 * 1024

async function readBodyLimited(response: Response) {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GITHUB_RESPONSE_BYTES) {
    await response.body?.cancel()
    throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'The GitHub source response is too large.' })
  }
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > MAX_GITHUB_RESPONSE_BYTES) {
      await reader.cancel()
      throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'The GitHub source response is too large.' })
    }
    chunks.push(value)
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

async function fetchSourceAtCommit(input: {
  repoFullName: string
  file: string
  commitSha: string
  token: string | null
}) {
  const repo = input.repoFullName.split('/')
  const file = input.file.replaceAll('\\', '/')
  if (repo.length !== 2 || repo.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part)) ||
      file.startsWith('/') || file.split('/').some((part) => !part || part === '.' || part === '..') ||
      /[\0\r\n]/.test(file) || !/^[a-f0-9]{40,64}$/i.test(input.commitSha)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Finding source location is not a safe GitHub path.' })
  }

  const [owner, name] = repo.map(encodeURIComponent)
  const filePath = file.split('/').map(encodeURIComponent).join('/')
  const url = `https://api.github.com/repos/${owner}/${name}/contents/${filePath}?ref=${encodeURIComponent(input.commitSha)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Arbor-App',
        ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
      },
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new TRPCError({
        code: response.status === 404 ? 'NOT_FOUND' : response.status === 403 ? 'FORBIDDEN' : 'BAD_GATEWAY',
        message: `GitHub could not return the file at the analyzed commit (HTTP ${response.status}).`,
      })
    }
    const text = await readBodyLimited(response)
    let payload: unknown
    try { payload = JSON.parse(text) } catch { throw new TRPCError({ code: 'BAD_GATEWAY', message: 'GitHub returned an invalid contents response.' }) }
    if (!payload || typeof payload !== 'object') throw new TRPCError({ code: 'BAD_GATEWAY', message: 'GitHub returned an invalid contents response.' })
    const content = (payload as { content?: unknown; encoding?: unknown; size?: unknown }).content
    const encoding = (payload as { encoding?: unknown }).encoding
    const size = (payload as { size?: unknown }).size
    if (encoding !== 'base64' || typeof content !== 'string') {
      throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'GitHub did not return a bounded text file.' })
    }
    if (typeof size === 'number' && size > MAX_SOURCE_BYTES) {
      throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'Patch suggestions are limited to files under 64 KB.' })
    }
    const decoded = Buffer.from(content.replace(/\s/g, ''), 'base64')
    if (decoded.byteLength > MAX_SOURCE_BYTES) throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'Patch suggestions are limited to files under 64 KB.' })
    try { return new TextDecoder('utf-8', { fatal: true }).decode(decoded) }
    catch { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Patch suggestions are only available for UTF-8 text files.' }) }
  } finally {
    clearTimeout(timer)
  }
}

function isFinding(value: unknown): value is Finding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const finding = value as Record<string, unknown>
  return typeof finding.id === 'string' && typeof finding.title === 'string' && typeof finding.detail === 'string'
}

export async function createPatchSuggestion(input: {
  userId: string
  slug: string
  analysisId: string
  findingFingerprint: string
}) {
  const { allowed } = await checkRateLimit(`rate:patch-suggestion:${input.userId}`, 5, 3600)
  if (!allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Patch suggestion limit reached for this hour.' })
  const project = await requireAccessibleProject(input.userId, input.slug)
  await requireProjectEditor(input.userId, project)
  const analysis = await prisma.analysis.findFirst({
    where: { id: input.analysisId, projectId: project.id, status: 'completed' },
    select: { id: true, commitSha: true, findings: true },
  })
  if (!analysis || !Array.isArray(analysis.findings)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Completed finding report not found.' })
  const rawFinding = analysis.findings.find((item) => isFinding(item) && item.fingerprint === input.findingFingerprint)
  if (!isFinding(rawFinding)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Finding is not part of this analysis.' })
  if (rawFinding.policySuppressed) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Suppressed findings do not receive patch proposals.' })
  if (!rawFinding.file || !analysis.commitSha) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This finding has no source file at a pinned commit to review.' })

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { openaiApiKey: true, anthropicApiKey: true, aiModel: true },
  })
  const model = user?.aiModel || 'gpt-4o'
  const provider = model.startsWith('claude-') ? 'anthropic' as const : 'openai' as const
  const encryptedKey = provider === 'anthropic' ? user?.anthropicApiKey : user?.openaiApiKey
  if (!encryptedKey) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: `Add a ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key in AI settings to request a patch proposal.` })
  const apiKey = decrypt(encryptedKey)
  const { token } = await resolveGitHubToken(project.userId, project.githubAccountId)
  const source = await fetchSourceAtCommit({
    repoFullName: project.repoFullName,
    file: rawFinding.file,
    commitSha: analysis.commitSha,
    token,
  })
  const result = await generateReviewPatch({
    finding: {
      ...rawFinding,
      title: rawFinding.title.slice(0, 240),
      detail: rawFinding.detail.slice(0, 4000),
      recommendation: rawFinding.recommendation?.slice(0, 4000),
    },
    file: rawFinding.file,
    source,
    apiKey,
    provider,
    model,
  })
  const suggestion = await prisma.patchSuggestion.create({
    data: {
      projectId: project.id,
      analysisId: analysis.id,
      userId: input.userId,
      findingFingerprint: input.findingFingerprint,
      provider: result.provider,
      model: result.model,
      summary: result.summary,
      diff: result.diff,
      validation: result.validation as unknown as object,
    },
    select: {
      id: true,
      projectId: true,
      analysisId: true,
      findingFingerprint: true,
      provider: true,
      model: true,
      summary: true,
      diff: true,
      validation: true,
      status: true,
      createdAt: true,
    },
  })
  return suggestion
}

export async function listPatchSuggestions(userId: string, slug: string) {
  const project = await requireAccessibleProject(userId, slug)
  return prisma.patchSuggestion.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      analysisId: true,
      findingFingerprint: true,
      provider: true,
      model: true,
      summary: true,
      diff: true,
      validation: true,
      status: true,
      createdAt: true,
    },
  })
}

export async function setPatchSuggestionStatus(input: {
  userId: string
  slug: string
  id: string
  status: 'accepted' | 'dismissed'
}) {
  const project = await requireAccessibleProject(input.userId, input.slug)
  await requireProjectEditor(input.userId, project)
  const result = await prisma.patchSuggestion.updateMany({
    where: { id: input.id, projectId: project.id, status: 'proposed' },
    data: { status: input.status },
  })
  return { updated: result.count === 1 }
}
