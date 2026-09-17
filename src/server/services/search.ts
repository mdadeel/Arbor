import { prisma } from '@/lib/prisma'
import type { Finding } from '@/server/analysis/types'
import type { ParsedEndpoint } from '@/server/services/api-spec'

export type SearchResultType = 'project' | 'finding' | 'endpoint' | 'document' | 'action'

export interface SearchResultItem {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  href: string
  badge?: string
  badgeColor?: 'emerald' | 'amber' | 'red' | 'blue' | 'muted'
  meta?: Record<string, unknown>
}

export interface SearchResults {
  projects: SearchResultItem[]
  findings: SearchResultItem[]
  endpoints: SearchResultItem[]
  documents: SearchResultItem[]
  actions: SearchResultItem[]
  totalMatches: number
}

export const STATIC_ACTIONS: SearchResultItem[] = [
  {
    id: 'action-dashboard',
    type: 'action',
    title: 'Developer Workbench Dashboard',
    subtitle: 'Overview of repository health and recent analyses',
    href: '/dashboard',
    badge: 'Navigation',
    badgeColor: 'muted',
  },
  {
    id: 'action-all-projects',
    type: 'action',
    title: 'All Projects',
    subtitle: 'Browse all connected repositories',
    href: '/projects',
    badge: 'Navigation',
    badgeColor: 'muted',
  },
  {
    id: 'action-new-project',
    type: 'action',
    title: 'Connect New Repository',
    subtitle: 'Import a GitHub repository and trigger an audit',
    href: '/projects/new',
    badge: 'Action',
    badgeColor: 'emerald',
  },
  {
    id: 'action-settings',
    type: 'action',
    title: 'Workspace Settings',
    subtitle: 'Manage profile and GitHub connection',
    href: '/settings',
    badge: 'Settings',
    badgeColor: 'muted',
  },
]

export async function globalSearch(userId: string, rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim().toLowerCase()

  if (!query) {
    return {
      projects: [],
      findings: [],
      endpoints: [],
      documents: [],
      actions: STATIC_ACTIONS,
      totalMatches: STATIC_ACTIONS.length,
    }
  }

  // 1. Search Projects
  const matchingProjects = await prisma.project.findMany({
    where: {
      userId,
      status: 'active',
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { repoFullName: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 6,
    select: {
      id: true,
      name: true,
      slug: true,
      repoFullName: true,
      latestScores: true,
      healthData: true,
    },
  })

  const projectResults: SearchResultItem[] = matchingProjects.map((p) => {
    const scores = p.latestScores as { overall?: number } | null
    const health = p.healthData as { score?: number } | null
    const score = health?.score ?? scores?.overall

    return {
      id: `project-${p.id}`,
      type: 'project',
      title: p.name,
      subtitle: p.repoFullName,
      href: `/projects/${p.slug}`,
      badge: score != null ? `${score}/100` : undefined,
      badgeColor:
        score != null
          ? score >= 80
            ? 'emerald'
            : score >= 50
              ? 'amber'
              : 'red'
          : 'muted',
    }
  })

  // 2. Search Findings from Latest Analysis of user's projects
  const activeProjects = await prisma.project.findMany({
    where: { userId, status: 'active' },
    select: {
      id: true,
      name: true,
      slug: true,
      analyses: {
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { findings: true },
      },
    },
  })

  const findingResults: SearchResultItem[] = []
  for (const proj of activeProjects) {
    const latestAnalysis = proj.analyses[0]
    if (!latestAnalysis?.findings || !Array.isArray(latestAnalysis.findings)) continue

    const findings = latestAnalysis.findings as unknown as Finding[]
    for (const f of findings) {
      const matchTitle = f.title?.toLowerCase().includes(query)
      const matchDetail = f.detail?.toLowerCase().includes(query)
      const matchFile = f.file?.toLowerCase().includes(query)
      const matchCategory = f.category?.toLowerCase().includes(query)

      if (matchTitle || matchDetail || matchFile || matchCategory) {
        findingResults.push({
          id: `finding-${f.id}`,
          type: 'finding',
          title: f.title,
          subtitle: `${proj.name} · ${f.file ? `${f.file}:${f.line ?? 1}` : f.category}`,
          href: `/projects/${proj.slug}`,
          badge: f.severity,
          badgeColor:
            f.severity === 'critical'
              ? 'red'
              : f.severity === 'warning'
                ? 'amber'
                : 'blue',
        })
        if (findingResults.length >= 6) break
      }
    }
    if (findingResults.length >= 6) break
  }

  // 3. Search API Endpoints
  const apiSpecs = await prisma.apiSpec.findMany({
    where: { project: { userId, status: 'active' } },
    select: {
      id: true,
      parsedEndpoints: true,
      project: { select: { name: true, slug: true } },
    },
    take: 10,
  })

  const endpointResults: SearchResultItem[] = []
  for (const spec of apiSpecs) {
    if (!spec.parsedEndpoints || !Array.isArray(spec.parsedEndpoints)) continue
    const endpoints = spec.parsedEndpoints as unknown as ParsedEndpoint[]
    for (const ep of endpoints) {
      const matchPath = ep.path?.toLowerCase().includes(query)
      const matchSummary = ep.summary?.toLowerCase().includes(query)
      const matchDesc = ep.description?.toLowerCase().includes(query)
      const matchMethod = ep.method?.toLowerCase() === query

      if (matchPath || matchSummary || matchDesc || matchMethod) {
        endpointResults.push({
          id: `endpoint-${spec.id}-${ep.method}-${ep.path}`,
          type: 'endpoint',
          title: `${ep.method} ${ep.path}`,
          subtitle: `${spec.project.name} · ${ep.summary || ep.description || 'API Endpoint'}`,
          href: `/projects/${spec.project.slug}?tab=api`,
          badge: ep.method,
          badgeColor:
            ep.method === 'GET'
              ? 'emerald'
              : ep.method === 'POST'
                ? 'blue'
                : ep.method === 'DELETE'
                  ? 'red'
                  : 'amber',
        })
        if (endpointResults.length >= 6) break
      }
    }
    if (endpointResults.length >= 6) break
  }

  // 4. Search Documentation
  const documents = await prisma.document.findMany({
    where: {
      project: { userId, status: 'active' },
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      project: { select: { name: true, slug: true } },
    },
    take: 6,
  })

  const documentResults: SearchResultItem[] = documents.map((doc: any) => ({
    id: `doc-${doc.id}`,
    type: 'document',
    title: doc.title,
    subtitle: `${doc.project.name} · ${doc.category}`,
    href: `/projects/${doc.project.slug}?tab=docs&doc=${doc.slug}`,
    badge: doc.category,
    badgeColor: 'muted',
  }))

  // 5. Matching Quick Actions
  const actionResults = STATIC_ACTIONS.filter(
    (action) =>
      action.title.toLowerCase().includes(query) ||
      action.subtitle?.toLowerCase().includes(query)
  )

  const totalMatches =
    projectResults.length +
    findingResults.length +
    endpointResults.length +
    documentResults.length +
    actionResults.length

  return {
    projects: projectResults,
    findings: findingResults,
    endpoints: endpointResults,
    documents: documentResults,
    actions: actionResults,
    totalMatches,
  }
}
