import fs from 'node:fs'
import path from 'node:path'
import simpleGit from 'simple-git'
import { env } from '@/lib/env'

export interface CloneResult {
  sha: string
  message: string
}

export async function cloneRepo(opts: {
  repoUrl: string
  branch: string
  destination: string
  token?: string
}): Promise<CloneResult> {
  fs.rmSync(opts.destination, { recursive: true, force: true })
  fs.mkdirSync(opts.destination, { recursive: true })

  const git = simpleGit({
    timeout: { block: env.CLONE_TIMEOUT * 1000 },
    maxConcurrentProcesses: 1,
  })

  const authUrl = opts.token
    ? opts.repoUrl.replace('https://', `https://x-access-token:${opts.token}@`)
    : opts.repoUrl

  await git.clone(authUrl, opts.destination, [
    '--depth', '1',
    '--single-branch',
    '--branch', opts.branch,
  ])

  let sha = 'unknown'
  try {
    sha = (await simpleGit(opts.destination).revparse(['HEAD'])).trim()
  } catch {
    /* shallow clone may fail revparse; non-fatal */
  }

  // strip auth + history before analysis (size, and never persist the token)
  fs.rmSync(path.join(opts.destination, '.git'), { recursive: true, force: true })

  return { sha: sha.slice(0, 40), message: 'cloned' }
}

export function repoDirFor(projectId: string): string {
  return path.join(env.CLONE_BASE_DIR, projectId)
}