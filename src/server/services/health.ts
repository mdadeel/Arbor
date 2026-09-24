import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import { resolveGitHubToken } from './github'
import { appCache, TTL_WORKSPACE_HEALTH } from './admin-cache'

export type Contributor = {
  login: string
  avatarUrl: string
  contributions: number
}

export type RepositoryMetrics = {
  openIssues: number
  openPRs: number
  staleIssues: number
  stalePRs: number
  lastCommitDate: string | null
  lastCommitMessage: string | null
  lastCommitAuthor: string | null
  commitFrequency: number
  contributors: Contributor[]
  branchCount: number
}

export type WorkflowRun = {
  id: number
  name: string
  status: 'completed' | 'in_progress' | 'queued'
  conclusion: 'success' | 'failure' | 'cancelled' | 'neutral' | null
  branch: string
  commitSha: string
  author: string
  createdAt: string
  durationMs: number | null
  htmlUrl: string
}

export type HealthFactor = {
  name: string
  impact: 'positive' | 'negative' | 'neutral'
  score: number
  detail: string
  recommendation?: string
}

export type ProjectHealth = {
  score: number
  status: 'healthy' | 'good' | 'warning' | 'critical'
  factors: HealthFactor[]
  repository: RepositoryMetrics
  workflows: WorkflowRun[]
  lastSyncAt: string
}

export type WorkspaceHealth = {
  totalProjects: number
  avgHealthScore: number
  totalOpenPRs: number
  totalOpenIssues: number
  stalePRs: number
  failingBuilds: number
  attentionList: {
    projectId: string
    name: string
    slug: string
    issues: string[]
    severity: 'critical' | 'warning'
  }[]
  recentWorkflows: {
    projectName: string
    projectSlug: string
    workflow: WorkflowRun
  }[]
}

export function calculateHealthScore(
  metrics: RepositoryMetrics,
  workflows: WorkflowRun[],
  analysisScore: number | null
): {
  score: number
  status: 'healthy' | 'good' | 'warning' | 'critical'
  factors: HealthFactor[]
} {
  const factors: HealthFactor[] = []

  // 1. Commit Activity (20%)
  let commitScore = 20
  if (metrics.commitFrequency >= 20) {
    commitScore = 100
    factors.push({
      name: 'Commit Activity',
      impact: 'positive',
      score: 100,
      detail: `${metrics.commitFrequency} commits in the last 30 days`,
    })
  } else if (metrics.commitFrequency >= 5) {
    commitScore = 80
    factors.push({
      name: 'Commit Activity',
      impact: 'positive',
      score: 80,
      detail: `${metrics.commitFrequency} commits in the last 30 days`,
    })
  } else if (metrics.commitFrequency >= 1) {
    commitScore = 50
    factors.push({
      name: 'Commit Activity',
      impact: 'neutral',
      score: 50,
      detail: `Low commit activity (${metrics.commitFrequency} commits in 30 days)`,
      recommendation: 'Ensure active development or maintenance schedule',
    })
  } else {
    commitScore = 15
    const lastDateStr = metrics.lastCommitDate
      ? new Date(metrics.lastCommitDate).toLocaleDateString()
      : null
    factors.push({
      name: 'Commit Activity',
      impact: 'negative',
      score: 15,
      detail: lastDateStr
        ? `No commits in the last 30 days (last commit: ${lastDateStr})`
        : 'No commits in the last 30 days',
      recommendation: 'Repository appears inactive. Verify development status',
    })
  }

  // 2. Pull Request Freshness (20%)
  let prScore = 100
  if (metrics.openPRs === 0) {
    prScore = 100
    factors.push({
      name: 'Pull Request Freshness',
      impact: 'positive',
      score: 100,
      detail: 'No backlog of open pull requests',
    })
  } else if (metrics.stalePRs === 0) {
    prScore = 95
    factors.push({
      name: 'Pull Request Freshness',
      impact: 'positive',
      score: 95,
      detail: `All ${metrics.openPRs} open pull requests are fresh (< 7 days)`,
    })
  } else if (metrics.stalePRs <= 2) {
    prScore = 70
    factors.push({
      name: 'Pull Request Freshness',
      impact: 'neutral',
      score: 70,
      detail: `${metrics.stalePRs} PR${metrics.stalePRs === 1 ? '' : 's'} older than 7 days`,
      recommendation: 'Review and merge or close pending pull requests',
    })
  } else {
    prScore = 30
    factors.push({
      name: 'Pull Request Freshness',
      impact: 'negative',
      score: 30,
      detail: `${metrics.stalePRs} of ${metrics.openPRs} open PRs are stale (> 7 days)`,
      recommendation: 'Prioritize reviewing aged pull requests to avoid merge conflicts',
    })
  }

  // 3. Issue Hygiene (15%)
  let issueScore = 100
  if (metrics.openIssues <= 10) {
    issueScore = 100
    factors.push({
      name: 'Issue Management',
      impact: 'positive',
      score: 100,
      detail: `${metrics.openIssues} open issues (healthy queue)`,
    })
  } else if (metrics.openIssues <= 30) {
    issueScore = 80
    factors.push({
      name: 'Issue Management',
      impact: 'neutral',
      score: 80,
      detail: `${metrics.openIssues} open issues`,
    })
  } else if (metrics.openIssues <= 60) {
    issueScore = 55
    factors.push({
      name: 'Issue Management',
      impact: 'neutral',
      score: 55,
      detail: `${metrics.openIssues} open issues accumulating`,
      recommendation: 'Triage and close resolved or duplicate issues',
    })
  } else {
    issueScore = 25
    factors.push({
      name: 'Issue Management',
      impact: 'negative',
      score: 25,
      detail: `High issue volume (${metrics.openIssues} open issues)`,
      recommendation: 'Conduct an issue backlog grooming session',
    })
  }

  // 4. CI Build Status (20%)
  let ciScore = 65
  const latestWorkflow = workflows[0]
  if (!latestWorkflow) {
    ciScore = 65
    factors.push({
      name: 'CI Build Status',
      impact: 'neutral',
      score: 65,
      detail: 'No GitHub Actions workflow runs found',
      recommendation: 'Set up automated CI testing with GitHub Actions',
    })
  } else if (latestWorkflow.conclusion === 'success') {
    ciScore = 100
    factors.push({
      name: 'CI Build Status',
      impact: 'positive',
      score: 100,
      detail: `Latest workflow "${latestWorkflow.name}" passed`,
    })
  } else if (latestWorkflow.conclusion === 'failure') {
    ciScore = 15
    factors.push({
      name: 'CI Build Status',
      impact: 'negative',
      score: 15,
      detail: `Latest workflow "${latestWorkflow.name}" failed on branch ${latestWorkflow.branch}`,
      recommendation: 'Inspect failing build logs and fix broken tests or steps',
    })
  } else {
    ciScore = 75
    factors.push({
      name: 'CI Build Status',
      impact: 'neutral',
      score: 75,
      detail: `Workflow "${latestWorkflow.name}" status is ${latestWorkflow.status}`,
    })
  }

  // 5. Code Audit Quality (25%)
  const auditScore = analysisScore ?? 70
  factors.push({
    name: 'Code Audit Quality',
    impact: auditScore >= 80 ? 'positive' : auditScore >= 60 ? 'neutral' : 'negative',
    score: auditScore,
    detail:
      analysisScore != null
        ? `Repository static analysis overall score: ${analysisScore}/100`
        : 'Audit score pending first analysis run',
    recommendation:
      auditScore < 60 ? 'Review architecture and technical debt findings in the report' : undefined,
  })

  // Weighted score calculation
  const weighted = Math.round(
    commitScore * 0.2 +
      prScore * 0.2 +
      issueScore * 0.15 +
      ciScore * 0.2 +
      auditScore * 0.25
  )
  const score = Math.max(0, Math.min(100, weighted))

  let status: 'healthy' | 'good' | 'warning' | 'critical' = 'healthy'
  if (score >= 80) status = 'healthy'
  else if (score >= 60) status = 'good'
  else if (score >= 40) status = 'warning'
  else status = 'critical'

  return { score, status, factors }
}

export async function syncProjectHealth(userId: string, projectId: string): Promise<ProjectHealth> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      analyses: {
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { overallScore: true, metrics: true },
      },
    },
  })
  if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })

  const { token } = await resolveGitHubToken(userId, project.githubAccountId)

  let repositoryMetrics: RepositoryMetrics = {
    openIssues: 0,
    openPRs: 0,
    staleIssues: 0,
    stalePRs: 0,
    lastCommitDate: null,
    lastCommitMessage: null,
    lastCommitAuthor: null,
    commitFrequency: 0,
    contributors: [],
    branchCount: 1,
  }
  let workflows: WorkflowRun[] = []
  let authFailed = false

  if (project.repoFullName) {
    const isPublic = !project.repoPrivate

    const githubFetch = async (endpoint: string): Promise<Response | null> => {
      const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`

      if (token) {
        try {
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'Arbor-Health-Dashboard',
            },
            cache: 'no-store',
          })
          if (res.status === 401) {
            authFailed = true
            // If token expired or unauthorized and repo is public, retry unauthenticated
            if (isPublic) {
              return await fetch(url, {
                headers: {
                  Accept: 'application/vnd.github+json',
                  'User-Agent': 'Arbor-Health-Dashboard',
                },
                cache: 'no-store',
              })
            }
          }
          return res
        } catch {
          return null
        }
      }

      if (isPublic) {
        try {
          return await fetch(url, {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'Arbor-Health-Dashboard',
            },
            cache: 'no-store',
          })
        } catch {
          return null
        }
      }

      authFailed = true
      return null
    }

    try {
      const branchParam = project.defaultBranch ? `&sha=${encodeURIComponent(project.defaultBranch)}` : ''
      const [repoRes, prsRes, commitsRes, actionsRes, contribRes] = await Promise.all([
        githubFetch(`/repos/${project.repoFullName}`),
        githubFetch(`/repos/${project.repoFullName}/pulls?state=open&per_page=100`),
        githubFetch(`/repos/${project.repoFullName}/commits?per_page=100${branchParam}`),
        githubFetch(`/repos/${project.repoFullName}/actions/runs?per_page=10`),
        githubFetch(`/repos/${project.repoFullName}/contributors?per_page=8`),
      ])

      // 1. Repo overview (issues, default branch)
      if (repoRes?.ok) {
        const repoData = await repoRes.json()
        repositoryMetrics.openIssues = repoData.open_issues_count ?? 0
      }

      // 2. Open Pull Requests
      if (prsRes?.ok) {
        const prs = await prsRes.json()
        if (Array.isArray(prs)) {
          repositoryMetrics.openPRs = prs.length
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
          repositoryMetrics.stalePRs = prs.filter(
            (p) => new Date(p.created_at).getTime() < sevenDaysAgo
          ).length
        }
      }

      // 3. Commits & Frequency
      if (commitsRes?.ok) {
        const commits = await commitsRes.json()
        if (Array.isArray(commits) && commits.length > 0) {
          const latest = commits[0]
          repositoryMetrics.lastCommitDate =
            latest.commit?.committer?.date || latest.commit?.author?.date || null
          repositoryMetrics.lastCommitMessage = latest.commit?.message?.split('\n')[0] ?? null
          repositoryMetrics.lastCommitAuthor =
            latest.commit?.author?.name ??
            latest.author?.login ??
            latest.commit?.committer?.name ??
            null

          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
          repositoryMetrics.commitFrequency = commits.filter((c: any) => {
            const date = c.commit?.committer?.date || c.commit?.author?.date
            return date && new Date(date).getTime() > thirtyDaysAgo
          }).length
        }
      }

      // 4. Actions Workflows
      if (actionsRes?.ok) {
        const actionsData = await actionsRes.json()
        if (Array.isArray(actionsData.workflow_runs)) {
          workflows = actionsData.workflow_runs.map((r: any) => ({
            id: r.id,
            name: r.name ?? 'CI',
            status: r.status,
            conclusion: r.conclusion,
            branch: r.head_branch ?? 'main',
            commitSha: (r.head_sha ?? '').slice(0, 7),
            author: r.actor?.login ?? 'unknown',
            createdAt: r.created_at,
            durationMs:
              r.updated_at && r.run_started_at
                ? new Date(r.updated_at).getTime() - new Date(r.run_started_at).getTime()
                : null,
            htmlUrl: r.html_url ?? '',
          }))
        }
      }

      // 5. Contributors
      if (contribRes?.ok) {
        const contribs = await contribRes.json()
        if (Array.isArray(contribs)) {
          repositoryMetrics.contributors = contribs.map((c: any) => ({
            login: c.login,
            avatarUrl: c.avatar_url,
            contributions: c.contributions ?? 0,
          }))
        }
      }
    } catch {
      // If network fails, use cached health data if available
      if (project.healthData) {
        return project.healthData as unknown as ProjectHealth
      }
    }
  }

  const analysisScore = project.analyses[0]?.overallScore ?? null
  const { score, status, factors } = calculateHealthScore(
    repositoryMetrics,
    workflows,
    analysisScore
  )

  // Surface authentication warning for private repos if token is invalid or missing
  if (authFailed && project.repoPrivate) {
    factors.unshift({
      name: 'GitHub Authentication',
      impact: 'negative',
      score: 0,
      detail: 'GitHub token is missing or expired (401 Unauthorized)',
      recommendation: 'Update your GitHub Personal Access Token or reconnect account in Settings',
    })
  }

  const healthResult: ProjectHealth = {
    score,
    status,
    factors,
    repository: repositoryMetrics,
    workflows,
    lastSyncAt: new Date().toISOString(),
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      healthData: healthResult as unknown as object,
      lastHealthSyncAt: new Date(),
    },
  })

  appCache.clearPrefix('health:')
  return healthResult
}

export async function getProjectHealth(
  userId: string,
  projectId: string,
  autoSync = true
): Promise<ProjectHealth> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { healthData: true, lastHealthSyncAt: true },
  })
  if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })

  if (project.healthData) {
    const cached = project.healthData as unknown as ProjectHealth
    // Auto-refresh if older than 30 minutes and autoSync is enabled
    const lastSync = project.lastHealthSyncAt ? new Date(project.lastHealthSyncAt).getTime() : 0
    if (autoSync && Date.now() - lastSync > 30 * 60 * 1000) {
      syncProjectHealth(userId, projectId).catch(() => {}) // background refresh
    }
    return cached
  }

  return syncProjectHealth(userId, projectId)
}

export async function getWorkspaceHealth(userId: string): Promise<WorkspaceHealth> {
  const cacheKey = `health:workspace:${userId}`
  const cached = appCache.get<WorkspaceHealth>(cacheKey)
  if (cached) return cached

  const projects = await prisma.project.findMany({
    where: { userId, status: 'active' },
    select: {
      id: true,
      name: true,
      slug: true,
      healthData: true,
      lastHealthSyncAt: true,
    },
  })

  let totalScoreSum = 0
  let totalOpenPRs = 0
  let totalOpenIssues = 0
  let stalePRs = 0
  let failingBuilds = 0
  const attentionList: WorkspaceHealth['attentionList'] = []
  const allWorkflows: WorkspaceHealth['recentWorkflows'] = []

  for (const project of projects) {
    const health = project.healthData as unknown as ProjectHealth | null
    if (!health) continue

    totalScoreSum += health.score
    totalOpenPRs += health.repository?.openPRs ?? 0
    totalOpenIssues += health.repository?.openIssues ?? 0
    stalePRs += health.repository?.stalePRs ?? 0

    const latestWorkflow = health.workflows?.[0]
    if (latestWorkflow?.conclusion === 'failure') {
      failingBuilds++
    }

    if (health.workflows) {
      for (const wf of health.workflows.slice(0, 3)) {
        allWorkflows.push({
          projectName: project.name,
          projectSlug: project.slug,
          workflow: wf,
        })
      }
    }

    // Identify attention items
    const issues: string[] = []
    if (latestWorkflow?.conclusion === 'failure') {
      issues.push(`CI build "${latestWorkflow.name}" failed`)
    }
    if ((health.repository?.stalePRs ?? 0) > 0) {
      issues.push(`${health.repository.stalePRs} stale pull requests (> 7 days)`)
    }
    if (health.score < 50) {
      issues.push(`Overall health score is critical (${health.score}/100)`)
    }

    if (issues.length > 0) {
      attentionList.push({
        projectId: project.id,
        name: project.name,
        slug: project.slug,
        issues,
        severity: health.score < 50 || latestWorkflow?.conclusion === 'failure' ? 'critical' : 'warning',
      })
    }
  }

  const validCount = projects.filter((p) => p.healthData).length
  const avgHealthScore = validCount > 0 ? Math.round(totalScoreSum / validCount) : 100

  // Sort workflows by date descending
  allWorkflows.sort(
    (a, b) => new Date(b.workflow.createdAt).getTime() - new Date(a.workflow.createdAt).getTime()
  )

  const result: WorkspaceHealth = {
    totalProjects: projects.length,
    avgHealthScore,
    totalOpenPRs,
    totalOpenIssues,
    stalePRs,
    failingBuilds,
    attentionList,
    recentWorkflows: allWorkflows.slice(0, 8),
  }
  appCache.set(cacheKey, result, TTL_WORKSPACE_HEALTH)
  return result
}
