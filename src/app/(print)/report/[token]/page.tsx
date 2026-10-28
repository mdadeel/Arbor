import { notFound } from 'next/navigation'
import { getSharedReport } from '@/server/services/report-sharing'
import { ProjectReport, type ProjectReportRow } from '@/components/dashboard/project-report'
import type { FindingData } from '@/components/dashboard/finding-item'
import { PrintReportToolbar } from './print-toolbar'
import './print-report.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Arbor Audit Report',
  robots: { index: false, follow: false },
}

export default async function PrintableSharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const shared = await getSharedReport(token)
  if (!shared) notFound()

  const { analysis } = shared
  const createdAtIso = new Date(analysis.createdAt).toISOString()
  const sharedUntilIso = new Date(shared.sharedUntil).toISOString()

  const completedAnalysis = {
    id: analysis.id,
    status: 'completed',
    branch: analysis.branch,
    commitSha: analysis.commitSha,
    overallScore: analysis.scores.overall,
    architectureScore: analysis.scores.architecture,
    techDebtScore: analysis.scores.techDebt,
    performanceScore: analysis.scores.performance,
    documentationScore: analysis.scores.documentation,
    securityScore: analysis.scores.security,
    designSystemScore: analysis.scores.designSystem,
    techStack: analysis.techStack,
    structure: (analysis.structure as unknown as Record<string, unknown> | null) ?? null,
    findings: analysis.findings as FindingData[],
    metrics: (analysis.metrics as unknown as Record<string, unknown> | null) ?? null,
    dependencyGraph: analysis.dependencyGraph,
    designSystem: analysis.designSystem,
    durationMs: analysis.durationMs,
    errorMessage: null,
    createdAt: createdAtIso,
  }

  const projectForReport: ProjectReportRow = {
    id: `shared-${analysis.id}`,
    slug: analysis.projectSlug,
    name: analysis.projectName,
    repoFullName: analysis.repoFullName,
    defaultBranch: analysis.defaultBranch,
    repoPrivate: false,
    repoUrl: '',
    description: null,
    latestScores: analysis.scores,
    detectedStack: analysis.techStack,
    lastAnalyzedAt: createdAtIso,
    analyses: [
      {
        id: analysis.id,
        status: 'completed',
        branch: analysis.branch,
        commitSha: analysis.commitSha,
        overallScore: analysis.scores.overall,
        durationMs: analysis.durationMs,
        errorMessage: null,
        createdAt: createdAtIso,
      },
    ],
    latestCompletedAnalysis: completedAnalysis,
  }

  return (
    <main
      id="arbor-print-report"
      className="audit-print-page"
      data-repo-name={analysis.repoFullName}
      data-project-name={analysis.projectName}
      data-branch={analysis.branch}
      data-commit-sha={analysis.commitSha ?? 'unpinned'}
      data-scan-date={createdAtIso}
      data-policy-version={analysis.policy.summary}
      data-client-name={shared.clientName ?? ''}
    >
      <PrintReportToolbar
        repoName={analysis.repoFullName}
        sharedUntilIso={sharedUntilIso}
      />
      <div className="audit-print-shell">
        <ProjectReport
          slug={analysis.projectSlug}
          project={projectForReport}
          mode="print"
          printContext={{
            clientName: shared.clientName,
            sharedUntil: sharedUntilIso,
            policy: analysis.policy,
            dependencyRisk: analysis.dependencyRisk,
          }}
        />
      </div>
    </main>
  )
}
