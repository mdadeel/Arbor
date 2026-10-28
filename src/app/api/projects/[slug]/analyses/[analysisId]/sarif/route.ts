import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  SARIF_MEDIA_TYPE,
  buildSarifLog,
  type SarifInputFinding,
  type SarifSuppressionOverride,
} from '@/lib/sarif'
import { assertValidSarifLog } from '@/server/analysis/sarif-validator'
import { requireAccessibleProject } from '@/server/services/project-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseStoredFindings(raw: unknown): SarifInputFinding[] {
  if (!Array.isArray(raw)) return []
  const parsed: SarifInputFinding[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const severity =
      rec.severity === 'critical' || rec.severity === 'warning' || rec.severity === 'info'
        ? rec.severity
        : 'info'
    const confidence =
      rec.confidence === 'high' || rec.confidence === 'medium' || rec.confidence === 'low'
        ? rec.confidence
        : undefined

    parsed.push({
      id: typeof rec.id === 'string' && rec.id ? rec.id : 'arbor-finding',
      category: typeof rec.category === 'string' && rec.category ? rec.category : 'analysis',
      severity,
      title: typeof rec.title === 'string' && rec.title ? rec.title : 'Arbor static finding',
      detail: typeof rec.detail === 'string' ? rec.detail : '',
      ...(typeof rec.explanation === 'string' ? { explanation: rec.explanation } : {}),
      ...(typeof rec.impact === 'string' ? { impact: rec.impact } : {}),
      ...(typeof rec.recommendation === 'string' ? { recommendation: rec.recommendation } : {}),
      ...(confidence ? { confidence } : {}),
      ...(typeof rec.ruleId === 'string' ? { ruleId: rec.ruleId } : {}),
      ...(typeof rec.policyPack === 'string' ? { policyPack: rec.policyPack } : {}),
      ...(typeof rec.policyVersion === 'string' ? { policyVersion: rec.policyVersion } : {}),
      ...(typeof rec.policySuppressed === 'boolean'
        ? { policySuppressed: rec.policySuppressed }
        : {}),
      ...(typeof rec.fingerprint === 'string' ? { fingerprint: rec.fingerprint } : {}),
      ...(Array.isArray(rec.evidence)
        ? { evidence: rec.evidence.filter((e): e is string => typeof e === 'string') }
        : {}),
      ...(typeof rec.file === 'string' ? { file: rec.file } : {}),
      ...(typeof rec.line === 'number' ? { line: rec.line } : {}),
      ...(typeof rec.count === 'number' ? { count: rec.count } : {}),
      ...(Array.isArray(rec.paths)
        ? { paths: rec.paths.filter((p): p is string => typeof p === 'string') }
        : {}),
    })
  }

  return parsed
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; analysisId: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { slug, analysisId } = await params

  try {
    const project = await requireAccessibleProject(userId, slug)
    const [analysis, projectMeta, triages] = await Promise.all([
      prisma.analysis.findFirst({
        where: { id: analysisId, projectId: project.id, status: 'completed' },
        select: {
          id: true,
          branch: true,
          commitSha: true,
          findings: true,
        },
      }),
      prisma.project.findUnique({
        where: { id: project.id },
        select: { repoUrl: true },
      }),
      prisma.findingTriage.findMany({
        where: {
          projectId: project.id,
          status: { in: ['accepted_risk', 'false_positive'] },
        },
        select: {
          fingerprint: true,
          status: true,
          note: true,
        },
      }),
    ])

    if (!analysis) {
      return NextResponse.json(
        { error: 'Completed analysis not found for this project.' },
        { status: 404 }
      )
    }

    const triageMap = new Map<string, SarifSuppressionOverride>()
    for (const row of triages) {
      if (row.status === 'accepted_risk' || row.status === 'false_positive') {
        triageMap.set(row.fingerprint, { status: row.status, note: row.note })
      }
    }

    const findings = parseStoredFindings(analysis.findings)
    const sarifLog = buildSarifLog({
      findings,
      repoUrl: projectMeta?.repoUrl ?? null,
      branch: analysis.branch,
      commitSha: analysis.commitSha,
      triageSuppressionsByFingerprint: triageMap,
    })

    assertValidSarifLog(sarifLog)

    const safeSlug = project.slug.replace(/[^A-Za-z0-9_-]/g, '-') || 'project'
    const filename = `${safeSlug}-analysis.sarif`

    return new NextResponse(JSON.stringify(sarifLog, null, 2), {
      headers: {
        'Content-Type': `${SARIF_MEDIA_TYPE}; charset=utf-8`,
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Could not export SARIF report.' }, { status: 500 })
  }
}
