import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export type GitHubRepo = {
  id: number
  name: string
  fullName: string
  url: string
  defaultBranch: string
  private: boolean
  description: string | null
  language: string | null
  updatedAt: string
}

type RawRepo = {
  id: number
  name: string
  full_name: string
  html_url: string
  default_branch: string
  private: boolean
  description: string | null
  language: string | null
  updated_at: string
}

export async function listUserRepos(userId: string): Promise<GitHubRepo[]> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.githubAccessToken) {
    throw new Error('GitHub account not connected')
  }

  const res = await fetch(
    'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator',
    {
      headers: {
        Authorization: `Bearer ${decrypt(user.githubAccessToken)}`,
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}`)
  }

  const repos = (await res.json()) as RawRepo[]
  return repos.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    url: r.html_url,
    defaultBranch: r.default_branch,
    private: r.private,
    description: r.description,
    language: r.language,
    updatedAt: r.updated_at,
  }))
}
