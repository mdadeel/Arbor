import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { resolveGitHubToken } from './github'
import type { Finding } from '@/server/analysis/types'
import { buildPullRequestAnnotations, changedLinesByFile, getPullRequestConclusion } from '@/lib/github-check-utils'

const GITHUB_API = 'https://api.github.com'
const REQUEST_TIMEOUT_MS = 8_000

type PullRequestCheckContext = {
  id: string
  number: number
  title: string
  baseSha: string
  headSha: string
  status: string
  checkRunId: string | null
  startedAt: Date | null
  project: {
    userId: string
    githubAccountId: string | null
    repoFullName: string
    slug: string
  }
}

type CheckResponse = { id?: number; html_url?: string }

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Arbor-App',
    'Content-Type': 'application/json',
  }
}

async function githubJson(url: string, token: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...headers(token), ...(init?.headers ?? {}) },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`GitHub API returned HTTP ${response.status}.`)
    }
    if (!response.body) return {}
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > 2_000_000) {
        await reader.cancel()
        throw new Error('GitHub response exceeded the Check Run size limit.')
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    const text = new TextDecoder().decode(bytes)
    return text ? JSON.parse(text) as unknown : {}
  } finally {
    clearTimeout(timer)
  }
}

async function getPullRequestContext(analysisId: string): Promise<PullRequestCheckContext | null> {
  const pr = await prisma.pullRequestAnalysis.findFirst({
    where: { analysisId },
    select: {
      id: true,
      number: true,
      title: true,
      baseSha: true,
      headSha: true,
      status: true,
      checkRunId: true,
      startedAt: true,
      project: {
        select: {
          userId: true,
          githubAccountId: true,
          repoFullName: true,
          slug: true,
        },
      },
    },
  })
  return pr as PullRequestCheckContext | null
}

async function setCheckError(prId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not publish the GitHub Check Run.'
  await prisma.pullRequestAnalysis.update({
    where: { id: prId },
    data: { checkError: message.slice(0, 500) },
  }).catch(() => {})
}

async function finishClosedCheckRun(pr: PullRequestCheckContext, token: string) {
  if (!pr.checkRunId) return
  const repo = pr.project.repoFullName.split('/')
  if (repo.length !== 2) return
  const endpoint = `${GITHUB_API}/repos/${repo.map(encodeURIComponent).join('/')}/check-runs/${encodeURIComponent(pr.checkRunId)}`
  await githubJson(endpoint, token, {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'Arbor Code Health',
      status: 'completed',
      conclusion: 'neutral',
      completed_at: new Date().toISOString(),
      output: {
        title: 'Pull request closed',
        summary: 'This pull request was closed. Arbor will not run additional checks for it; the last analysis remains available in the project report.',
      },
    }),
  })
}

async function startCheckRun(pr: PullRequestCheckContext, token: string): Promise<string | null> {
  const repo = pr.project.repoFullName.split('/')
  if (repo.length !== 2 || repo.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))) {
    throw new Error('Tracked repository name is invalid.')
  }
  const endpoint = `${GITHUB_API}/repos/${repo.map(encodeURIComponent).join('/')}/check-runs`
  const startedAt = new Date().toISOString()
  const body = {
    name: 'Arbor Code Health',
    head_sha: pr.headSha,
    external_id: pr.id,
    status: 'in_progress',
    started_at: startedAt,
    output: {
      title: 'Arbor is analyzing this pull request',
      summary: 'The repository scan is running. Results will be attached when it completes.',
    },
  }

  let response: CheckResponse
  if (pr.checkRunId) {
    response = await githubJson(`${endpoint}/${encodeURIComponent(pr.checkRunId)}`, token, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Arbor Code Health',
        status: 'in_progress',
        started_at: startedAt,
        output: body.output,
      }),
    }) as CheckResponse
    return String(response.id ?? pr.checkRunId)
  }

  response = await githubJson(endpoint, token, { method: 'POST', body: JSON.stringify(body) }) as CheckResponse
  if (!response.id) throw new Error('GitHub did not return a Check Run id.')
  await prisma.pullRequestAnalysis.update({
    where: { id: pr.id },
    data: { checkRunId: String(response.id), checkUrl: response.html_url ?? null, checkError: null },
  })
  return String(response.id)
}

async function fetchChangedLines(pr: PullRequestCheckContext, token: string): Promise<Map<string, Set<number>> | null> {
  const repo = pr.project.repoFullName.split('/')
  if (repo.length !== 2 || !/^[a-f0-9]{40,64}$/i.test(pr.baseSha) || !/^[a-f0-9]{40,64}$/i.test(pr.headSha)) return null
  const endpoint = `${GITHUB_API}/repos/${repo.map(encodeURIComponent).join('/')}/compare/${pr.baseSha}...${pr.headSha}`
  try {
    const response = await githubJson(endpoint, token) as { files?: Array<{ filename: string; patch?: string }> }
    if (!Array.isArray(response.files)) return null
    return changedLinesByFile(response.files.slice(0, 300))
  } catch {
    // A missing compare permission/rate limit must not fail the code analysis.
    return null
  }
}

async function completeCheckRun(
  pr: PullRequestCheckContext,
  token: string,
  conclusion: 'success' | 'failure' | 'neutral',
  findings: Finding[],
  overallScore: number | null,
  startedAt: Date
) {
  const checkRunId = pr.checkRunId ?? await startCheckRun(pr, token)
  if (!checkRunId) return
  const repo = pr.project.repoFullName.split('/')
  const endpoint = `${GITHUB_API}/repos/${repo.map(encodeURIComponent).join('/')}/check-runs/${encodeURIComponent(checkRunId)}`
  const [changedLines] = await Promise.all([fetchChangedLines(pr, token)])
  const activeFindings = findings.filter((finding) => !finding.policySuppressed)
  const annotations = buildPullRequestAnnotations(activeFindings, changedLines)
  const critical = activeFindings.filter((finding) => finding.severity === 'critical').length
  const warnings = activeFindings.filter((finding) => finding.severity === 'warning').length
  const detailsUrl = `${env.APP_URL.replace(/\/$/, '')}/projects/${encodeURIComponent(pr.project.slug)}?tab=findings`
  const summary = [
    `**Overall score:** ${overallScore ?? 'not available'}/100`,
    `**Findings:** ${critical} critical, ${warnings} warnings, ${findings.length} total.`,
    annotations.length
      ? `${annotations.length} annotation(s) point to findings on added pull-request lines.`
      : 'No finding could be confidently mapped to an added line in this pull request.',
    `This is a bounded static analysis; it is not a security certification or a replacement for tests and review. [Open the full Arbor report](${detailsUrl}).`,
  ].join('\n\n')

  await githubJson(endpoint, token, {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'Arbor Code Health',
      status: 'completed',
      conclusion,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      output: {
        title: `Arbor: ${critical} critical, ${warnings} warning finding(s)`,
        summary: summary.slice(0, 60_000),
        annotations,
      },
    }),
  })
}

export async function startPullRequestCheck(analysisId: string): Promise<void> {
  const pr = await getPullRequestContext(analysisId)
  if (!pr || pr.status === 'closed') return
  const claimed = await prisma.pullRequestAnalysis.updateMany({
    where: { id: pr.id, status: { in: ['queued', 'analyzing'] } },
    data: { status: 'analyzing', startedAt: new Date(), errorMessage: null },
  })
  if (claimed.count === 0) return

  try {
    const { token } = await resolveGitHubToken(pr.project.userId, pr.project.githubAccountId)
    if (!token) throw new Error('No connected GitHub token is available to publish a Check Run.')
    await startCheckRun(pr, token)
    const refreshed = await getPullRequestContext(analysisId)
    if (refreshed?.status === 'closed') await finishClosedCheckRun(refreshed, token)
    await prisma.pullRequestAnalysis.updateMany({ where: { id: pr.id, status: 'analyzing' }, data: { checkError: null } })
  } catch (error) {
    await setCheckError(pr.id, error)
  }
}

export async function closePullRequestCheck(analysisId: string): Promise<void> {
  const pr = await getPullRequestContext(analysisId)
  if (!pr || pr.status !== 'closed' || !pr.checkRunId) return
  try {
    const { token } = await resolveGitHubToken(pr.project.userId, pr.project.githubAccountId)
    if (token) await finishClosedCheckRun(pr, token)
  } catch (error) {
    await setCheckError(pr.id, error)
  }
}

export async function completePullRequestCheck(
  analysisId: string,
  input: { findings: Finding[]; overallScore: number | null }
): Promise<void> {
  const pr = await getPullRequestContext(analysisId)
  if (!pr || pr.status === 'closed') return
  const activeFindings = input.findings.filter((finding) => !finding.policySuppressed)
  const conclusion = getPullRequestConclusion(input.findings)

  try {
    const { token } = await resolveGitHubToken(pr.project.userId, pr.project.githubAccountId)
    if (!token) throw new Error('No connected GitHub token is available to publish a Check Run.')
    await completeCheckRun(pr, token, conclusion, activeFindings, input.overallScore, pr.startedAt ?? new Date())
    const refreshed = await getPullRequestContext(analysisId)
    if (refreshed?.status === 'closed') await finishClosedCheckRun(refreshed, token)
    await prisma.pullRequestAnalysis.updateMany({
      where: { id: pr.id, status: { in: ['queued', 'analyzing'] } },
      data: { status: 'completed', completedAt: new Date(), errorMessage: null, checkError: null },
    })
  } catch (error) {
    await prisma.pullRequestAnalysis.updateMany({
      where: { id: pr.id, status: { in: ['queued', 'analyzing'] } },
      data: { status: 'completed', completedAt: new Date(), errorMessage: null },
    }).catch(() => {})
    await setCheckError(pr.id, error)
  }
}

export async function failPullRequestAnalysis(analysisId: string, error: string): Promise<void> {
  const pr = await getPullRequestContext(analysisId)
  if (!pr || pr.status === 'closed') return
  try {
    const { token } = await resolveGitHubToken(pr.project.userId, pr.project.githubAccountId)
    if (token) {
      await completeCheckRun(pr, token, 'failure', [], null, pr.startedAt ?? new Date())
      const refreshed = await getPullRequestContext(analysisId)
      if (refreshed?.status === 'closed') await finishClosedCheckRun(refreshed, token)
    }
  } catch (checkError) {
    await setCheckError(pr.id, checkError)
  }
  await prisma.pullRequestAnalysis.updateMany({
    where: { id: pr.id, status: { in: ['queued', 'analyzing'] } },
    data: { status: 'failed', errorMessage: error.slice(0, 1000), completedAt: new Date() },
  }).catch(() => {})
}
