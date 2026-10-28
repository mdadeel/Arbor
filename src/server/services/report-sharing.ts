import { createHash, randomBytes } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { requireAccessibleProject, requireProjectEditor } from './project-access'
import { logAuditEvent } from './audit'
import { POLICY_PACKS } from '@/server/analysis/policies'
import type {
  AnalysisMetrics,
  DesignSystemAudit,
  DetectedTechStack,
  Finding,
  FindingCategory,
  FindingSeverity,
  ImportGraph,
  ProjectStructure,
} from '@/server/analysis/types'

type FindingConfidence = NonNullable<Finding['confidence']>
import type {
  DependencyAdvisory,
  DependencyAdvisoryReport,
  DependencyEcosystem,
  DependencyInventory,
  DependencyRecord,
} from '@/server/analysis/dependencies'

const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const MAX_SHARED_DIRECT_PACKAGES = 40
const MAX_SHARED_ADVISORIES = 50

const SAFE_FINDING_FIELDS = [
  'id',
  'ruleId',
  'title',
  'category',
  'severity',
  'detail',
  'explanation',
  'impact',
  'recommendation',
  'confidence',
  'evidence',
  'file',
  'line',
  'count',
  'paths',
  'policyPack',
  'policyVersion',
  'policySuppressed',
] as const

export type SharedReportFinding = {
  id: string
  ruleId?: string
  title: string
  category: FindingCategory
  severity: FindingSeverity
  detail: string
  explanation?: string
  impact?: string
  recommendation?: string
  confidence?: FindingConfidence
  evidence?: string[]
  file?: string
  line?: number
  count?: number
  paths?: string[]
  policyPack?: string
  policyVersion?: string
  policySuppressed?: boolean
}

export type SharedPolicyPackSummary = {
  packKey: string
  version: string
  enabled: boolean
}

export type SharedPolicySummary = {
  schemaVersion: number
  summary: string
  packs: SharedPolicyPackSummary[]
}

export type SharedDependencyPackage = {
  name: string
  version: string
  ecosystem: DependencyEcosystem
  dependencyType: DependencyRecord['dependencyType']
  license?: string
}

export type SharedDependencyRisk = {
  directCount: number
  transitiveCount: number
  ecosystems: DependencyEcosystem[]
  lockfiles: string[]
  complete: boolean
  truncated: boolean
  advisoryStatus: DependencyAdvisoryReport['status']
  advisorySource: string
  advisoryCheckedAt: string | null
  queriedCount: number
  advisoryCount: number
  advisories: DependencyAdvisory[]
  directPackages: SharedDependencyPackage[]
}

export function isWellFormedShareToken(token: string) {
  return SHARE_TOKEN_PATTERN.test(token)
}

export function hashShareToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createReportShareLink(input: {
  userId: string
  slug: string
  analysisId: string
  expiresInDays: number
  clientName?: string
}) {
  const project = await requireAccessibleProject(input.userId, input.slug)
  await requireProjectEditor(input.userId, project)
  const analysis = await prisma.analysis.findFirst({
    where: { id: input.analysisId, projectId: project.id, status: 'completed' },
    select: { id: true },
  })
  if (!analysis) throw new TRPCError({ code: 'NOT_FOUND', message: 'Completed analysis not found.' })

  const normalizedClientName = input.clientName?.trim() ? input.clientName.trim().slice(0, 120) : null
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
  const link = await prisma.reportShareLink.create({
    data: {
      tokenHash: hashShareToken(token),
      analysisId: analysis.id,
      projectId: project.id,
      createdById: input.userId,
      ...(normalizedClientName ? { clientName: normalizedClientName } : {}),
      expiresAt,
    },
    select: { id: true, clientName: true, createdAt: true, expiresAt: true },
  })
  await logAuditEvent({
    userId: input.userId,
    projectId: project.id,
    workspaceId: project.workspaceId,
    action: 'report_share.created',
    entityType: 'report_share_link',
    entityId: link.id,
    metadata: {
      analysisId: analysis.id,
      expiresAt: expiresAt.toISOString(),
      ...(normalizedClientName ? { clientName: normalizedClientName } : {}),
    },
  })
  return { ...link, token }
}

export async function listReportShareLinks(userId: string, slug: string) {
  const project = await requireAccessibleProject(userId, slug)
  await requireProjectEditor(userId, project)
  return prisma.reportShareLink.findMany({
    where: { projectId: project.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      analysisId: true,
      clientName: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  })
}

export async function revokeReportShareLink(userId: string, slug: string, id: string) {
  const project = await requireAccessibleProject(userId, slug)
  await requireProjectEditor(userId, project)
  const result = await prisma.reportShareLink.updateMany({
    where: { id, projectId: project.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (result.count === 1) {
    await logAuditEvent({
      userId,
      projectId: project.id,
      workspaceId: project.workspaceId,
      action: 'report_share.revoked',
      entityType: 'report_share_link',
      entityId: id,
    })
  }
  return { revoked: result.count === 1 }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeFindings(rawFindings: unknown): SharedReportFinding[] {
  if (!Array.isArray(rawFindings)) return []
  return rawFindings
    .slice(0, 200)
    .map((raw, idx): SharedReportFinding | null => {
      if (!isObjectRecord(raw)) return null
      const projected = Object.fromEntries(
        SAFE_FINDING_FIELDS.filter((key) => key in raw).map((key) => [key, raw[key]])
      )
      return {
        id: typeof projected.id === 'string' ? projected.id : `finding-${idx + 1}`,
        ...(typeof projected.ruleId === 'string' ? { ruleId: projected.ruleId } : {}),
        title: typeof projected.title === 'string' ? projected.title : 'Finding',
        category: (typeof projected.category === 'string'
          ? projected.category
          : 'structure') as FindingCategory,
        severity: (typeof projected.severity === 'string'
          ? projected.severity
          : 'info') as FindingSeverity,
        detail: typeof projected.detail === 'string' ? projected.detail : '',
        ...(typeof projected.explanation === 'string' ? { explanation: projected.explanation } : {}),
        ...(typeof projected.impact === 'string' ? { impact: projected.impact } : {}),
        ...(typeof projected.recommendation === 'string'
          ? { recommendation: projected.recommendation }
          : {}),
        ...(typeof projected.confidence === 'string'
          ? { confidence: projected.confidence as FindingConfidence }
          : {}),
        ...(Array.isArray(projected.evidence)
          ? {
              evidence: projected.evidence
                .filter((entry): entry is string => typeof entry === 'string')
                .slice(0, 10),
            }
          : {}),
        ...(typeof projected.file === 'string' ? { file: projected.file } : {}),
        ...(typeof projected.line === 'number' ? { line: projected.line } : {}),
        ...(typeof projected.count === 'number' ? { count: projected.count } : {}),
        ...(Array.isArray(projected.paths)
          ? {
              paths: projected.paths
                .filter((entry): entry is string => typeof entry === 'string')
                .slice(0, 25),
            }
          : {}),
        ...(typeof projected.policyPack === 'string' ? { policyPack: projected.policyPack } : {}),
        ...(typeof projected.policyVersion === 'string'
          ? { policyVersion: projected.policyVersion }
          : {}),
        ...(typeof projected.policySuppressed === 'boolean'
          ? { policySuppressed: projected.policySuppressed }
          : {}),
      }
    })
    .filter((entry): entry is SharedReportFinding => entry !== null)
}

function summarizePolicySnapshot(raw: unknown, findings: SharedReportFinding[]): SharedPolicySummary {
  if (isObjectRecord(raw) && Array.isArray(raw.packs)) {
    const schemaVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1
    const packs: SharedPolicyPackSummary[] = raw.packs
      .filter(isObjectRecord)
      .map((entry) => ({
        packKey:
          typeof entry.packKey === 'string'
            ? entry.packKey
            : typeof entry.key === 'string'
              ? entry.key
              : 'policy',
        version: typeof entry.version === 'string' ? entry.version : '1.0.0',
        enabled: typeof entry.enabled === 'boolean' ? entry.enabled : true,
      }))

    if (packs.length > 0) {
      const activeSummary = packs
        .filter((pack) => pack.enabled)
        .map((pack) => `${pack.packKey}@${pack.version}`)
        .join(', ')
      return {
        schemaVersion,
        summary: activeSummary || 'No active policy packs',
        packs,
      }
    }
  }

  const fromFindings = new Map<string, string>()
  for (const finding of findings) {
    if (finding.policyPack && finding.policyVersion) {
      fromFindings.set(finding.policyPack, finding.policyVersion)
    }
  }

  const packs: SharedPolicyPackSummary[] = POLICY_PACKS.map((pack) => ({
    packKey: pack.key,
    version: fromFindings.get(pack.key) ?? pack.version,
    enabled: true,
  }))

  return {
    schemaVersion: 1,
    summary: packs.map((pack) => `${pack.packKey}@${pack.version}`).join(', '),
    packs,
  }
}

function sanitizeDependencyRisk(
  rawInventory: unknown,
  rawAdvisories: unknown
): SharedDependencyRisk | null {
  if (!isObjectRecord(rawInventory) && !isObjectRecord(rawAdvisories)) return null

  const inv = isObjectRecord(rawInventory) ? (rawInventory as Partial<DependencyInventory>) : {}
  const adv = isObjectRecord(rawAdvisories) ? (rawAdvisories as Partial<DependencyAdvisoryReport>) : {}

  const packages = Array.isArray(inv.packages) ? inv.packages.filter(isObjectRecord) : []
  const directPackages: SharedDependencyPackage[] = packages
    .filter((pkg) => pkg.direct === true && typeof pkg.name === 'string' && typeof pkg.version === 'string')
    .slice(0, MAX_SHARED_DIRECT_PACKAGES)
    .map((pkg) => ({
      name: String(pkg.name),
      version: String(pkg.version),
      ecosystem: (pkg.ecosystem === 'pypi' ? 'pypi' : 'npm') as DependencyEcosystem,
      dependencyType: (
        pkg.dependencyType === 'dev' ||
        pkg.dependencyType === 'optional' ||
        pkg.dependencyType === 'peer' ||
        pkg.dependencyType === 'transitive'
          ? pkg.dependencyType
          : 'prod'
      ) as DependencyRecord['dependencyType'],
      ...(typeof pkg.license === 'string' ? { license: pkg.license } : {}),
    }))

  const advisories: DependencyAdvisory[] = Array.isArray(adv.advisories)
    ? adv.advisories
        .filter(isObjectRecord)
        .slice(0, MAX_SHARED_ADVISORIES)
        .map((entry, idx) => ({
          id: typeof entry.id === 'string' ? entry.id : `ADV-${idx + 1}`,
          packageName: typeof entry.packageName === 'string' ? entry.packageName : 'unknown',
          ecosystem: (entry.ecosystem === 'pypi' ? 'pypi' : 'npm') as DependencyEcosystem,
          severity: typeof entry.severity === 'string' ? entry.severity : 'moderate',
          summary: typeof entry.summary === 'string' ? entry.summary : '',
          vulnerableRange: typeof entry.vulnerableRange === 'string' ? entry.vulnerableRange : null,
          patchedVersion: typeof entry.patchedVersion === 'string' ? entry.patchedVersion : null,
          url: typeof entry.url === 'string' ? entry.url : null,
        }))
    : []

  return {
    directCount: typeof inv.directCount === 'number' ? inv.directCount : directPackages.length,
    transitiveCount: typeof inv.transitiveCount === 'number' ? inv.transitiveCount : 0,
    ecosystems: Array.isArray(inv.ecosystems)
      ? inv.ecosystems.filter((eco): eco is DependencyEcosystem => eco === 'npm' || eco === 'pypi')
      : [],
    lockfiles: Array.isArray(inv.lockfiles)
      ? inv.lockfiles.filter((lf): lf is string => typeof lf === 'string').slice(0, 20)
      : [],
    complete: typeof inv.complete === 'boolean' ? inv.complete : false,
    truncated: typeof inv.truncated === 'boolean' ? inv.truncated : false,
    advisoryStatus:
      adv.status === 'complete' ||
      adv.status === 'partial' ||
      adv.status === 'unavailable' ||
      adv.status === 'not_applicable'
        ? adv.status
        : 'not_applicable',
    advisorySource: typeof adv.source === 'string' ? adv.source : 'GitHub Advisory Database',
    advisoryCheckedAt: typeof adv.checkedAt === 'string' ? adv.checkedAt : null,
    queriedCount: typeof adv.queriedCount === 'number' ? adv.queriedCount : 0,
    advisoryCount: typeof adv.advisoryCount === 'number' ? adv.advisoryCount : advisories.length,
    advisories,
    directPackages,
  }
}

export async function getSharedReport(token: string) {
  if (!isWellFormedShareToken(token)) return null
  const link = await prisma.reportShareLink.findFirst({
    where: { tokenHash: hashShareToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      clientName: true,
      expiresAt: true,
      analysis: {
        select: {
          id: true,
          status: true,
          analysisVersion: true,
          branch: true,
          commitSha: true,
          durationMs: true,
          overallScore: true,
          architectureScore: true,
          techDebtScore: true,
          performanceScore: true,
          documentationScore: true,
          securityScore: true,
          designSystemScore: true,
          techStack: true,
          structure: true,
          findings: true,
          dependencyGraph: true,
          metrics: true,
          designSystem: true,
          dependencyInventory: true,
          dependencyAdvisories: true,
          policySnapshot: true,
          createdAt: true,
          project: {
            select: {
              name: true,
              slug: true,
              repoFullName: true,
              defaultBranch: true,
            },
          },
        },
      },
    },
  })
  if (!link || link.analysis.status !== 'completed') return null

  const findings = sanitizeFindings(link.analysis.findings)
  const policy = summarizePolicySnapshot(link.analysis.policySnapshot, findings)
  const dependencyRisk = sanitizeDependencyRisk(
    link.analysis.dependencyInventory,
    link.analysis.dependencyAdvisories
  )

  return {
    sharedUntil: link.expiresAt,
    clientName: link.clientName ?? null,
    analysis: {
      id: link.analysis.id,
      projectName: link.analysis.project.name,
      projectSlug: link.analysis.project.slug ?? 'shared-report',
      repoFullName: link.analysis.project.repoFullName ?? link.analysis.project.name,
      defaultBranch: link.analysis.project.defaultBranch ?? link.analysis.branch,
      branch: link.analysis.branch,
      commitSha: link.analysis.commitSha,
      analysisVersion: link.analysis.analysisVersion ?? 1,
      durationMs: link.analysis.durationMs ?? null,
      scores: {
        overall: link.analysis.overallScore,
        architecture: link.analysis.architectureScore,
        techDebt: link.analysis.techDebtScore,
        performance: link.analysis.performanceScore,
        documentation: link.analysis.documentationScore,
        security: link.analysis.securityScore,
        designSystem: link.analysis.designSystemScore,
      },
      techStack: isObjectRecord(link.analysis.techStack)
        ? (link.analysis.techStack as unknown as DetectedTechStack)
        : null,
      structure: isObjectRecord(link.analysis.structure)
        ? (link.analysis.structure as unknown as ProjectStructure)
        : null,
      metrics: isObjectRecord(link.analysis.metrics)
        ? (link.analysis.metrics as unknown as AnalysisMetrics)
        : null,
      dependencyGraph: isObjectRecord(link.analysis.dependencyGraph)
        ? (link.analysis.dependencyGraph as unknown as ImportGraph)
        : null,
      designSystem: isObjectRecord(link.analysis.designSystem)
        ? (link.analysis.designSystem as unknown as DesignSystemAudit)
        : null,
      dependencyRisk,
      policy,
      findings,
      createdAt: link.analysis.createdAt,
    },
  }
}

export type SharedReportPayload = NonNullable<Awaited<ReturnType<typeof getSharedReport>>>
