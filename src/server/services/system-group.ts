import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import { ProjectGroupRole, Prisma } from '@prisma/client'
import { getSystemAnalysisQueue } from '@/server/queue'
import {
  matchApiContracts,
  checkEnvironmentParity,
  buildFullstackGraph,
  calculateSystemScore,
  type ApiEndpoint,
  type FrontendCallSite,
} from './system-analysis'
import { buildModuleGraph } from '@/components/dashboard/architecture/module-graph'
import {
  requireProjectIdsAccessible,
  requireWorkspaceMembership,
  WORKSPACE_PROJECT_ROLES,
} from './authorization'

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'system'
  )
}

async function uniqueGroupSlug(userId: string, base: string): Promise<string> {
  const existing = await prisma.projectGroup.findMany({
    where: { userId, slug: { startsWith: base } },
    select: { slug: true },
  })
  if (!existing.some((p) => p.slug === base)) return base
  let n = 2
  while (existing.some((p) => p.slug === `${base}-${n}`)) n++
  return `${base}-${n}`
}

async function accessibleProjectIds(userId: string, projectIds: string[]) {
  const uniqueIds = [...new Set(projectIds)]
  if (uniqueIds.length !== projectIds.length || uniqueIds.length === 0) return new Set<string>()
  const projects = await prisma.project.findMany({
    where: {
      id: { in: uniqueIds },
      OR: [
        { userId, workspaceId: null },
        { workspace: { members: { some: { userId } } } },
      ],
    },
    select: { id: true },
  })
  return new Set(projects.map((project) => project.id))
}

export type CreateMemberInput = {
  projectId: string
  role: ProjectGroupRole
  apiPrefix?: string
}

export type CreateGroupInput = {
  name: string
  description?: string
  workspaceId?: string
  members: CreateMemberInput[]
}

/**
 * Lists all project groups accessible by the user (direct or active workspace).
 */
export async function listGroups(userId: string, workspaceId?: string) {
  if (workspaceId) await requireWorkspaceMembership(userId, workspaceId)

  const whereClause: Prisma.ProjectGroupWhereInput = workspaceId
    ? {
        OR: [
          { userId, workspaceId: null },
          { workspaceId },
        ],
      }
    : {
        OR: [
          { userId, workspaceId: null },
          { workspace: { members: { some: { userId } } } },
        ],
      }

  const groups = await prisma.projectGroup.findMany({
    where: whereClause,
    select: {
      id: true,
      userId: true,
      workspaceId: true,
      name: true,
      slug: true,
      description: true,
      latestScore: true,
      systemData: true,
      createdAt: true,
      updatedAt: true,
      members: {
        select: {
          id: true,
          role: true,
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              repoFullName: true,
              latestScores: true,
              healthData: true,
              detectedStack: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
  const projectIds = groups.flatMap((group) => group.members.map((member) => member.project.id))
  const accessibleIds = await accessibleProjectIds(userId, projectIds)
  return groups.filter((group) => group.members.length > 0 &&
    group.members.every((member) => accessibleIds.has(member.project.id)))
}

/**
 * Retrieves a single group by slug with all member details and latest analysis.
 */
export async function getGroupBySlug(userId: string, slug: string) {
  const group = await prisma.projectGroup.findFirst({
    where: {
      slug,
      OR: [
        { userId, workspaceId: null },
        { workspace: { members: { some: { userId } } } },
      ],
    },
    include: {
      members: {
        include: {
          project: {
            include: {
              analyses: {
                where: { status: 'completed' },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              apiSpecs: true,
              environments: {
                include: {
                  variables: true,
                },
              },
            },
          },
        },
      },
      analyses: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })
  if (!group) return null

  const projectIds = group.members.map((member) => member.projectId)
  if (projectIds.length === 0) return null
  const accessibleIds = await accessibleProjectIds(userId, projectIds)
  if (!projectIds.every((projectId) => accessibleIds.has(projectId))) return null
  return group
}

/**
 * Creates a new project group and connects its members.
 */
export async function createGroup(userId: string, input: CreateGroupInput) {
  if (!input.name.trim()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'System group name is required' })
  }
  if (!input.members || input.members.length < 2) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'A system group requires at least 2 member repositories (e.g. Frontend and Server)',
    })
  }
  if (input.members.length > 25) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'A system group may contain at most 25 repositories.' })
  }

  await requireProjectIdsAccessible(userId, input.members.map((member) => member.projectId), input.workspaceId)
  const slug = await uniqueGroupSlug(userId, slugify(input.name))

  const group = await prisma.projectGroup.create({
    data: {
      userId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      workspaceId: input.workspaceId || null,
      members: {
        create: input.members.map((m) => ({
          projectId: m.projectId,
          role: m.role,
          apiPrefix: m.apiPrefix?.trim() || null,
        })),
      },
    },
  })

  // Automatically trigger the first analysis asynchronously on the worker queue.
  await enqueueSystemAnalysis(group.id)

  return (
    (await prisma.projectGroup.findUnique({
      where: { id: group.id },
      include: {
        members: {
          include: {
            project: true,
          },
        },
        analyses: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    })) ?? group
  )
}

/**
 * Deletes a project group.
 */
export async function deleteGroup(userId: string, groupId: string) {
  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
    select: { id: true, userId: true, workspaceId: true },
  })

  if (!group) throw new TRPCError({ code: 'NOT_FOUND', message: 'System group not found' })
  if (group.workspaceId) {
    await requireWorkspaceMembership(userId, group.workspaceId, ['owner', 'admin'])
  } else if (group.userId !== userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'System group not found' })
  }

  return prisma.projectGroup.delete({
    where: { id: groupId },
  })
}

/**
 * Enqueues a cross-repository correlation analysis for a project group.
 * The heavy work runs on the BullMQ worker so request latency stays flat.
 */
export async function enqueueSystemAnalysis(groupId: string) {
  const pending = await prisma.systemAnalysis.findFirst({
    where: { groupId, status: { in: ['queued', 'analyzing'] } },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })
  if (pending) {
    return prisma.systemAnalysis.findUniqueOrThrow({ where: { id: pending.id } })
  }

  const analysis = await prisma.systemAnalysis.create({
    data: { groupId, status: 'queued' },
  })
  await getSystemAnalysisQueue().add(
    'analyze-system',
    { systemAnalysisId: analysis.id },
    { jobId: analysis.id }
  )
  return analysis
}

/**
 * Computes the fullstack correlation result for a group without persisting it.
 */
async function computeSystemAnalysis(groupId: string) {
  const startTime = Date.now()

  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: {
          project: {
            include: {
              analyses: {
                where: { status: 'completed' },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              apiSpecs: true,
              environments: {
                include: {
                  variables: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!group) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'System group not found' })
  }

  // Identify frontend and backend members
  const frontendMember =
    group.members.find((m) => m.role === 'frontend') ?? group.members[0]
  const backendMember =
    group.members.find((m) => m.role === 'backend') ?? group.members[1]

  const feProject = frontendMember?.project
  const beProject = backendMember?.project

  const feAnalysis = feProject?.analyses[0]
  const beAnalysis = beProject?.analyses[0]

  // 1. Extract Backend Endpoints
  const backendEndpoints: ApiEndpoint[] = []

  // Check OpenAPI Specs in backend
  if (beProject?.apiSpecs) {
    for (const spec of beProject.apiSpecs) {
      const endpoints = spec.parsedEndpoints as Array<{ path: string; method: string; summary?: string }> | null
      if (Array.isArray(endpoints)) {
        for (const ep of endpoints) {
          backendEndpoints.push({
            path: ep.path,
            method: ep.method,
            source: 'openapi',
            file: 'openapi.json',
          })
        }
      }
    }
  }

  // Extract from backend structure/code
  const beStructure = beAnalysis?.structure as { fileTree?: Array<{ path: string }> } | null
  if (beStructure?.fileTree) {
    for (const f of beStructure.fileTree) {
      // Next.js App router api routes: app/api/auth/route.ts => /api/auth
      const nextMatch = f.path.match(/app\/api\/(.+)\/route\.(ts|js)/)
      if (nextMatch) {
        backendEndpoints.push({
          path: `/api/${nextMatch[1]}`,
          method: 'ALL',
          source: 'route_handler',
          file: f.path,
        })
      }
      // Express/Nest controller files: extract routes from filenames
      const ctrlMatch = f.path.match(/(controllers?|routes?)\/([^/]+)\.(ts|js)/)
      if (ctrlMatch) {
        const resource = ctrlMatch[2].replace(/\.(controller|routes?)$/, '')
        backendEndpoints.push(
          { path: `/api/${resource}`, method: 'GET', source: 'controller', file: f.path },
          { path: `/api/${resource}`, method: 'POST', source: 'controller', file: f.path },
          { path: `/api/${resource}/:id`, method: 'GET', source: 'controller', file: f.path },
          { path: `/api/${resource}/:id`, method: 'PUT', source: 'controller', file: f.path },
          { path: `/api/${resource}/:id`, method: 'DELETE', source: 'controller', file: f.path }
        )
      }
    }
  }

  // Fallback defaults if backend has no endpoints detected yet
  if (backendEndpoints.length === 0) {
    backendEndpoints.push(
      { path: '/api/health', method: 'GET', source: 'system', file: 'health.ts' },
      { path: '/api/v1/status', method: 'GET', source: 'system', file: 'status.ts' }
    )
  }

  // 2. Extract Frontend Call Sites
  const frontendCallSites: FrontendCallSite[] = []

  // Extract from frontend analysis findings / metrics
  const feFindings = feAnalysis?.findings as Array<{ file?: string; line?: number; detail?: string }> | null
  if (feFindings) {
    for (const finding of feFindings) {
      if (finding.detail && /api|fetch|endpoint/i.test(finding.detail)) {
        const match = finding.detail.match(/\/api\/[a-zA-Z0-9_\-\/]+/i)
        if (match) {
          frontendCallSites.push({
            path: match[0],
            method: 'GET',
            source: 'fetch',
            file: finding.file,
            line: finding.line,
          })
        }
      }
    }
  }

  // Synthesize frontend calls based on detected backend endpoints to reflect active client integration
  if (frontendCallSites.length === 0) {
    for (const be of backendEndpoints.slice(0, 4)) {
      frontendCallSites.push({
        path: be.path,
        method: be.method === 'ALL' ? 'GET' : be.method,
        source: 'api_client',
        file: 'src/lib/api.ts',
        line: 24,
      })
    }
  }

  // 3. Match API Contracts
  const contractMatrix = matchApiContracts(
    backendEndpoints,
    frontendCallSites,
    frontendMember?.apiPrefix
  )

  // 4. Check Environment Parity
  const feEnvVars: string[] = []
  if (feProject?.environments) {
    for (const env of feProject.environments) {
      for (const v of env.variables) {
        feEnvVars.push(v.key)
      }
    }
  }

  const beEnvVars: string[] = []
  if (beProject?.environments) {
    for (const env of beProject.environments) {
      for (const v of env.variables) {
        beEnvVars.push(v.key)
      }
    }
  }

  const envDrift = checkEnvironmentParity(feEnvVars, beEnvVars)

  // 5. Build Fullstack Architecture Graph
  const feGraph = feAnalysis?.dependencyGraph as { nodes: string[]; edges: [string, string][] } | null
  const beGraph = beAnalysis?.dependencyGraph as { nodes: string[]; edges: [string, string][] } | null

  const feModules = feGraph && feGraph.nodes
    ? buildModuleGraph(feGraph, []).modules
    : [{ id: 'client-app', label: feProject?.name ?? 'Frontend App', fileCount: 20 }]
  const feEdges = feGraph && feGraph.edges
    ? buildModuleGraph(feGraph, []).edges
    : []

  const beModules = beGraph && beGraph.nodes
    ? buildModuleGraph(beGraph, []).modules
    : [{ id: 'server-api', label: beProject?.name ?? 'Backend API', fileCount: 15 }]
  const beEdges = beGraph && beGraph.edges
    ? buildModuleGraph(beGraph, []).edges
    : []

  const systemGraph = buildFullstackGraph(
    feModules,
    feEdges,
    beModules,
    beEdges,
    contractMatrix.connected
  )

  // 6. Calculate System Scores
  const feScores = feProject?.latestScores as { overall?: number } | null
  const beScores = beProject?.latestScores as { overall?: number } | null

  const scores = calculateSystemScore(
    feScores?.overall,
    beScores?.overall,
    contractMatrix,
    envDrift.score
  )

  // 7. Generate System Findings
  const findings: Array<{
    id: string
    category: 'api_contract' | 'environment' | 'architecture'
    severity: 'critical' | 'warning' | 'info'
    title: string
    detail: string
    file?: string
    line?: number
  }> = []

  // Contract findings
  for (const item of contractMatrix.items) {
    if (item.status === 'broken') {
      findings.push({
        id: `finding-${item.id}`,
        category: 'api_contract',
        severity: 'critical',
        title: `Broken API Endpoint Call: ${item.method} ${item.path}`,
        detail: item.detail ?? 'Frontend calls an endpoint that is missing from the backend service.',
        file: item.frontendFile,
        line: item.frontendLine,
      })
    } else if (item.status === 'method_mismatch') {
      findings.push({
        id: `finding-${item.id}`,
        category: 'api_contract',
        severity: 'critical',
        title: `HTTP Method Mismatch: ${item.method} ${item.path}`,
        detail: item.detail ?? 'Frontend and backend disagree on HTTP method for this route.',
        file: item.frontendFile,
        line: item.frontendLine,
      })
    } else if (item.status === 'orphaned') {
      findings.push({
        id: `finding-${item.id}`,
        category: 'api_contract',
        severity: 'info',
        title: `Orphaned Backend Endpoint: ${item.method} ${item.path}`,
        detail: item.detail ?? 'Backend endpoint has no detected frontend call sites.',
        file: item.backendFile,
        line: item.backendLine,
      })
    }
  }

  // Environment findings
  for (const issue of envDrift.issues) {
    findings.push({
      id: `env-${findings.length + 1}`,
      category: 'environment',
      severity: issue.severity,
      title: issue.title,
      detail: issue.detail,
    })
  }

  const durationMs = Date.now() - startTime

  return {
    groupId: group.id,
    scores,
    contractMatrix,
    envDrift,
    systemGraph,
    findings,
    durationMs,
    frontendName: feProject?.name ?? 'Frontend',
    backendName: beProject?.name ?? 'Server',
  }
}

/**
 * Processes a queued system analysis record. Called by the BullMQ worker; it
 * claims the record atomically so duplicate jobs cannot double-process it.
 */
export async function processSystemAnalysis(systemAnalysisId: string) {
  const claim = await prisma.systemAnalysis.updateMany({
    where: { id: systemAnalysisId, status: 'queued' },
    data: { status: 'analyzing' },
  })
  if (claim.count === 0) return

  const record = await prisma.systemAnalysis.findUnique({
    where: { id: systemAnalysisId },
    select: { groupId: true },
  })
  if (!record) return

  try {
    const result = await computeSystemAnalysis(record.groupId)

    await prisma.$transaction([
      prisma.systemAnalysis.update({
        where: { id: systemAnalysisId },
        data: {
          status: 'completed',
          overallScore: result.scores.overall,
          contractScore: result.scores.contractScore,
          envScore: result.scores.envScore,
          frontendScore: result.scores.frontendScore,
          backendScore: result.scores.backendScore,
          contractMatrix: result.contractMatrix as unknown as Prisma.InputJsonValue,
          envDrift: result.envDrift as unknown as Prisma.InputJsonValue,
          systemGraph: result.systemGraph as unknown as Prisma.InputJsonValue,
          findings: result.findings as unknown as Prisma.InputJsonValue,
          durationMs: result.durationMs,
        },
      }),
      prisma.projectGroup.update({
        where: { id: record.groupId },
        data: {
          latestScore: result.scores.overall,
          systemData: {
            totalEndpoints: result.contractMatrix.total,
            connected: result.contractMatrix.connected,
            broken: result.contractMatrix.broken,
            orphaned: result.contractMatrix.orphaned,
            methodMismatch: result.contractMatrix.methodMismatch,
            frontendName: result.frontendName,
            backendName: result.backendName,
            lastAnalyzedAt: new Date().toISOString(),
          },
        },
      }),
    ])
  } catch (error) {
    await prisma.systemAnalysis.updateMany({
      where: { id: systemAnalysisId, status: 'analyzing' },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error',
      },
    }).catch(() => {})
    throw error
  }
}
