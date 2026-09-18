import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import { resolveGitHubToken } from './github'

export type CommitCategory =
  | 'feat'
  | 'fix'
  | 'refactor'
  | 'perf'
  | 'docs'
  | 'test'
  | 'chore'
  | 'style'
  | 'ci'
  | 'build'
  | 'other'

export interface CommitAuthor {
  name: string
  email?: string
  login?: string
  avatarUrl?: string
}

export interface CommitItem {
  sha: string
  shortSha: string
  message: string
  body?: string
  author: CommitAuthor
  date: string
  category: CommitCategory
  url: string
}

export interface ContributorSummary {
  name: string
  login?: string
  avatarUrl?: string
  commitCount: number
  categories: Record<CommitCategory, number>
  primaryFocus: CommitCategory
  latestCommitDate: string
}

export interface ProjectCommitsResult {
  commits: CommitItem[]
  contributors: ContributorSummary[]
  summary: string
  defaultBranch: string
  lastSyncAt: string
}

export function categorizeCommitMessage(rawMessage: string): CommitCategory {
  if (!rawMessage || typeof rawMessage !== 'string') return 'other'
  const firstLine = rawMessage.split('\n')[0].trim()
  if (!firstLine) return 'other'

  // Conventional Commits regex: feat(scope)!: message
  const conventionalMatch = firstLine.match(
    /^(feat|fix|refactor|perf|docs|test|chore|style|ci|build)(?:\([^)]+\))?!?:/i
  )
  if (conventionalMatch) {
    return conventionalMatch[1].toLowerCase() as CommitCategory
  }

  // Natural language fallback
  const lower = firstLine.toLowerCase()
  if (/\b(readme|documentation|docs?)\b/i.test(lower)) return 'docs'
  if (/^(add|create|implement|feature|feat)\b/.test(lower)) return 'feat'
  if (/^(fix|bug|patch|resolve|hotfix)\b/.test(lower)) return 'fix'
  if (/^(refactor|clean|cleanup|reorganize)\b/.test(lower)) return 'refactor'
  if (/^(perf|optimize|performance)\b/.test(lower)) return 'perf'
  if (/^(doc|docs|readme)\b/.test(lower)) return 'docs'
  if (/^(test|tests|coverage|wip testing)\b/.test(lower)) return 'test'
  if (/^(chore|bump|version|release|initial commit)\b/.test(lower)) return 'chore'
  if (/^(style|format|lint)\b/.test(lower)) return 'style'
  if (/^(ci|workflow|pipeline|action)\b/.test(lower)) return 'ci'
  if (/^(build|deps|dependency|dependencies)\b/.test(lower)) return 'build'

  return 'other'
}

export function aggregateContributors(commits: CommitItem[]): ContributorSummary[] {
  const map = new Map<
    string,
    {
      name: string
      login?: string
      avatarUrl?: string
      commitCount: number
      categories: Record<CommitCategory, number>
      latestCommitDate: string
    }
  >()

  const emptyCategories = (): Record<CommitCategory, number> => ({
    feat: 0,
    fix: 0,
    refactor: 0,
    perf: 0,
    docs: 0,
    test: 0,
    chore: 0,
    style: 0,
    ci: 0,
    build: 0,
    other: 0,
  })

  for (const c of commits) {
    const key = c.author.login || c.author.name || 'Unknown'
    let entry = map.get(key)
    if (!entry) {
      entry = {
        name: c.author.name || key,
        login: c.author.login,
        avatarUrl: c.author.avatarUrl,
        commitCount: 0,
        categories: emptyCategories(),
        latestCommitDate: c.date,
      }
      map.set(key, entry)
    }

    entry.commitCount++
    entry.categories[c.category] = (entry.categories[c.category] || 0) + 1
    if (new Date(c.date) > new Date(entry.latestCommitDate)) {
      entry.latestCommitDate = c.date
    }
  }

  const summaries: ContributorSummary[] = []
  for (const entry of map.values()) {
    // Determine primary focus
    let primary: CommitCategory = 'other'
    let maxCount = -1
    for (const [cat, count] of Object.entries(entry.categories) as [CommitCategory, number][]) {
      if (count > maxCount) {
        maxCount = count
        primary = cat
      }
    }

    summaries.push({
      ...entry,
      primaryFocus: primary,
    })
  }

  return summaries.sort((a, b) => b.commitCount - a.commitCount)
}

export function generateTimelineSummary(
  commits: CommitItem[],
  contributors: ContributorSummary[]
): string {
  if (commits.length === 0) return 'No commit history available for this repository branch.'

  const totalCommits = commits.length
  const totalContributors = contributors.length

  // Category counts
  const catTotals: Partial<Record<CommitCategory, number>> = {}
  for (const c of commits) {
    catTotals[c.category] = (catTotals[c.category] || 0) + 1
  }

  const topCategories = Object.entries(catTotals)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 2)
    .map(([cat, count]) => `${cat} (${count})`)
    .join(', ')

  const topContributor = contributors[0]
  const leadStr = topContributor
    ? `Top contributor: ${topContributor.name} (${topContributor.commitCount} commits).`
    : ''

  return `${totalCommits} commits across ${totalContributors} contributor${
    totalContributors === 1 ? '' : 's'
  }. Top activity: ${topCategories || 'general'}. ${leadStr}`.trim()
}

export async function getProjectCommits(
  userId: string,
  projectSlugOrId: string,
  branch?: string
): Promise<ProjectCommitsResult> {
  const project = await prisma.project.findFirst({
    where: {
      AND: [
        { OR: [{ id: projectSlugOrId }, { slug: projectSlugOrId }] },
        {
          OR: [
            { userId },
            {
              workspace: {
                members: { some: { userId } },
              },
            },
          ],
        },
      ],
    },
    include: {
      user: true,
    },
  })

  if (!project) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Project not found or you do not have permission to view its commits.',
    })
  }

  const defaultBranch = branch || project.defaultBranch || 'main'
  const isPublic = !project.repoPrivate

  const { token: resolvedToken } = await resolveGitHubToken(
    project.userId,
    project.githubAccountId
  )
  const token = resolvedToken ?? undefined

  const branchParam = `&sha=${encodeURIComponent(defaultBranch)}`
  const url = `https://api.github.com/repos/${project.repoFullName}/commits?per_page=100${branchParam}`

  const fetchWithHeaders = async (useToken: boolean) => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Arbor-Commit-Timeline',
    }
    if (useToken && token) {
      headers.Authorization = `Bearer ${token}`
    }
    return fetch(url, { headers, cache: 'no-store' })
  }

  let res: Response | null = null
  try {
    if (token) {
      res = await fetchWithHeaders(true)
      if (res.status === 401 && isPublic) {
        res = await fetchWithHeaders(false)
      }
    } else if (isPublic) {
      res = await fetchWithHeaders(false)
    }
  } catch (err: any) {
    console.warn(`[commits] fetch error for ${project.repoFullName}: ${err.message}`)
  }

  const commits: CommitItem[] = []

  if (res && res.ok) {
    const data = await res.json()
    if (Array.isArray(data)) {
      for (const item of data) {
        const fullMessage = item.commit?.message || ''
        const lines = fullMessage.split('\n')
        const title = lines[0] || 'Untitled commit'
        const body = lines.slice(1).join('\n').trim() || undefined
        const date =
          item.commit?.committer?.date ||
          item.commit?.author?.date ||
          new Date().toISOString()
        const sha = item.sha || ''
        const shortSha = sha.slice(0, 7)
        const category = categorizeCommitMessage(title)

        const authorName =
          item.commit?.author?.name ||
          item.author?.login ||
          item.commit?.committer?.name ||
          'Unknown'

        commits.push({
          sha,
          shortSha,
          message: title,
          body,
          author: {
            name: authorName,
            email: item.commit?.author?.email,
            login: item.author?.login,
            avatarUrl: item.author?.avatar_url,
          },
          date,
          category,
          url:
            item.html_url ||
            `https://github.com/${project.repoFullName}/commit/${sha}`,
        })
      }
    }
  }

  const contributors = aggregateContributors(commits)
  const summary = generateTimelineSummary(commits, contributors)

  return {
    commits,
    contributors,
    summary,
    defaultBranch,
    lastSyncAt: new Date().toISOString(),
  }
}
