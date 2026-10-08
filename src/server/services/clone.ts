import fs from 'node:fs'
import path from 'node:path'
import { simpleGit } from 'simple-git'
import { env } from '@/lib/env'
import { normalizeGitHubRepoUrl } from '@/lib/github-repo'

export interface CloneResult {
  sha: string
  message: string
}

export interface CloneRepoOptions {
  repoUrl: string
  repoFullName: string
  branch: string
  destination: string
  token?: string
  requestedCommitSha?: string
  pullRequestNumber?: number
}

async function assertRepositoryWithinSizeLimit(repoFullName: string, token?: string): Promise<void> {
  const repoPath = repoFullName.split('/').map(encodeURIComponent).join('/')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8_000)

  try {
    const requestMetadata = (accessToken?: string) => fetch(`https://api.github.com/repos/${repoPath}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Arbor-Repository-Analyzer',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      redirect: 'error',
      signal: controller.signal,
      cache: 'no-store',
    })
    let response = await requestMetadata(token)
    if (token && [401, 403, 404].includes(response.status)) {
      // Expired/under-scoped credentials may still analyze a public repository.
      await response.body?.cancel()
      response = await requestMetadata()
    }

    if (!response.ok) {
      throw new Error(`Could not verify repository size with GitHub (HTTP ${response.status}).`)
    }

    const metadata = (await response.json()) as { size?: unknown }
    if (typeof metadata.size !== 'number' || !Number.isFinite(metadata.size) || metadata.size < 0) {
      throw new Error('GitHub returned invalid repository size metadata.')
    }

    const maxKilobytes = env.MAX_REPO_SIZE_MB * 1024
    if (metadata.size > maxKilobytes) {
      throw new Error(
        `Repository is ${Math.ceil(metadata.size / 1024)} MiB, above Arbor's ${env.MAX_REPO_SIZE_MB} MiB analysis limit.`
      )
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function cloneRepo(opts: CloneRepoOptions): Promise<CloneResult> {
  if (!opts.branch || opts.branch.startsWith('-') || /[\s\0~^:?*\[\\]/.test(opts.branch)) {
    throw new Error(`Invalid branch name '${opts.branch}'`)
  }
  if (opts.pullRequestNumber !== undefined && (!Number.isInteger(opts.pullRequestNumber) || opts.pullRequestNumber < 1 || opts.pullRequestNumber > 1_000_000)) {
    throw new Error('Invalid pull request number.')
  }
  if (opts.requestedCommitSha && !/^[a-f0-9]{40,64}$/i.test(opts.requestedCommitSha)) {
    throw new Error('Invalid requested commit SHA.')
  }

  const repoUrl = normalizeGitHubRepoUrl(opts.repoUrl, opts.repoFullName)
  await assertRepositoryWithinSizeLimit(opts.repoFullName, opts.token)
  fs.rmSync(opts.destination, { recursive: true, force: true })
  fs.mkdirSync(opts.destination, { recursive: true })

  const timeoutOptions = {
    timeout: { block: env.CLONE_TIMEOUT * 1000 },
    maxConcurrentProcesses: 1,
  }
  const credentialEnv = opts.token
    ? {
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${opts.token}`).toString('base64')}`,
      }
    : { GIT_TERMINAL_PROMPT: '0' }

  const cloneAttempt = async (useCredential: boolean): Promise<string> => {
    fs.rmSync(opts.destination, { recursive: true, force: true })
    fs.mkdirSync(opts.destination, { recursive: true })
    const cloneGit = simpleGit(timeoutOptions).env(useCredential ? credentialEnv : { GIT_TERMINAL_PROMPT: '0' })

    if (opts.pullRequestNumber) {
      // GitHub exposes pull request heads through this fixed ref even when the PR
      // comes from a fork. The number and requested SHA were validated above.
      await cloneGit.clone(repoUrl, opts.destination, ['--depth', '1', '--no-tags'])
      const repoGit = simpleGit(opts.destination, timeoutOptions).env(
        useCredential ? credentialEnv : { GIT_TERMINAL_PROMPT: '0' }
      )
      await repoGit.fetch(['--depth=1', 'origin', `refs/pull/${opts.pullRequestNumber}/head`])
      await repoGit.checkout(['--detach', 'FETCH_HEAD'])

      let actualSha = (await repoGit.revparse(['HEAD'])).trim()
      if (opts.requestedCommitSha && actualSha.toLowerCase() !== opts.requestedCommitSha.toLowerCase()) {
        // The ref may have advanced between webhook receipt and worker start. Try
        // the immutable event SHA; never silently analyze a different commit.
        await repoGit.fetch(['--depth=1', 'origin', opts.requestedCommitSha])
        await repoGit.checkout(['--detach', 'FETCH_HEAD'])
        actualSha = (await repoGit.revparse(['HEAD'])).trim()
      }
      if (opts.requestedCommitSha && actualSha.toLowerCase() !== opts.requestedCommitSha.toLowerCase()) {
        throw new Error('The pull request head changed or is no longer fetchable; refusing to analyze a different commit.')
      }
      return actualSha
    }

    await cloneGit.clone(repoUrl, opts.destination, [
      '--depth', '1',
      '--single-branch',
      '--no-tags',
      '--branch', opts.branch,
    ])
    const repoGit = simpleGit(opts.destination, timeoutOptions).env(
      useCredential ? credentialEnv : { GIT_TERMINAL_PROMPT: '0' }
    )
    const actualSha = (await repoGit.revparse(['HEAD'])).trim()
    if (opts.requestedCommitSha && actualSha.toLowerCase() !== opts.requestedCommitSha.toLowerCase()) {
      throw new Error('The checked-out repository commit did not match the requested SHA.')
    }
    return actualSha
  }

  let sha: string
  try {
    sha = await cloneAttempt(Boolean(opts.token))
  } catch (error) {
    if (!opts.token) throw error
    // Public repositories remain analyzable with anonymous GitHub access when a
    // stored token has expired or lacks repository-read permissions.
    sha = await cloneAttempt(false)
  }

  fs.rmSync(path.join(opts.destination, '.git'), { recursive: true, force: true })
  return { sha: sha.slice(0, 40), message: 'cloned' }
}

/** A per-analysis path prevents overlapping workers from deleting each other's clone. */
export function repoDirFor(analysisId: string): string {
  const sanitized = analysisId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120)
  if (!sanitized) throw new Error('Invalid analysis id for clone directory.')
  return path.join(env.CLONE_BASE_DIR, sanitized)
}
