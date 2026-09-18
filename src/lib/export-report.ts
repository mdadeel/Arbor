import type { FindingData } from '@/components/dashboard/finding-item'

export interface ExportableProject {
  id: string
  slug: string
  name: string
  repoFullName: string
  defaultBranch: string
  repoUrl: string
  description?: string | null
}

export interface ExportableAnalysis {
  id: string
  status: string
  branch: string
  commitSha?: string | null
  overallScore?: number | null
  architectureScore?: number | null
  techDebtScore?: number | null
  performanceScore?: number | null
  documentationScore?: number | null
  securityScore?: number | null
  designSystemScore?: number | null
  techStack?: {
    framework?: string | null
    languages?: string[]
    packageManager?: string | null
    databases?: string[]
    testing?: string[]
    ui?: string[]
    keyDeps?: string[]
  } | null
  structure?: Record<string, unknown> | null
  findings?: FindingData[] | null
  metrics?: Record<string, unknown> | null
  durationMs?: number | null
  createdAt: string
}

/**
 * Generates an exhaustive, beautifully structured GitHub Flavored Markdown report.
 */
export function generateMarkdownReport(
  project: ExportableProject,
  analysis: ExportableAnalysis
): string {
  const dateStr = new Date(analysis.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const durationSec = analysis.durationMs ? `${Math.round(analysis.durationMs / 1000)}s` : 'N/A'
  const sha = analysis.commitSha ? analysis.commitSha.slice(0, 7) : 'latest'

  const findings = analysis.findings ?? []
  const criticalFindings = findings.filter((f) => f.severity === 'critical')
  const warningFindings = findings.filter((f) => f.severity === 'warning')
  const infoFindings = findings.filter((f) => f.severity === 'info')

  const metrics = analysis.metrics ?? {}
  const totalLoc = (metrics.totalLoc as number) ?? (metrics.linesOfCode as number) ?? 'N/A'
  const totalFiles = (metrics.totalFiles as number) ?? (metrics.fileCount as number) ?? 'N/A'
  const circularDeps = (metrics.circularDeps as string[][]) ?? []

  const stack = analysis.techStack

  const md: string[] = [
    `# Arbor Architecture Audit Report`,
    ``,
    `> **Project:** [${project.name}](${project.repoUrl}) (${project.repoFullName})  `,
    `> **Audited On:** ${dateStr} | **Duration:** ${durationSec} | **Branch:** \`${analysis.branch}\` | **Commit:** \`${sha}\``,
    ``,
    `---`,
    ``,
    `## Executive Summary`,
    ``,
    `| Metric | Score | Grade | Status |`,
    `|---|---|---|---|`,
    `| **Overall Score** | **${analysis.overallScore ?? 'N/A'}/100** | ${getGrade(analysis.overallScore)} | ${getStatus(analysis.overallScore)} |`,
    `| Architecture | ${analysis.architectureScore ?? 'N/A'}/100 | ${getGrade(analysis.architectureScore)} | ${getStatus(analysis.architectureScore)} |`,
    `| Tech Debt | ${analysis.techDebtScore ?? 'N/A'}/100 | ${getGrade(analysis.techDebtScore)} | ${getStatus(analysis.techDebtScore)} |`,
    `| Performance | ${analysis.performanceScore ?? 'N/A'}/100 | ${getGrade(analysis.performanceScore)} | ${getStatus(analysis.performanceScore)} |`,
    `| Documentation | ${analysis.documentationScore ?? 'N/A'}/100 | ${getGrade(analysis.documentationScore)} | ${getStatus(analysis.documentationScore)} |`,
    `| Security | ${analysis.securityScore ?? 'N/A'}/100 | ${getGrade(analysis.securityScore)} | ${getStatus(analysis.securityScore)} |`,
    `| Design System | ${analysis.designSystemScore ?? 'N/A'}/100 | ${getGrade(analysis.designSystemScore)} | ${getStatus(analysis.designSystemScore)} |`,
    ``,
    `---`,
    ``,
    `## Codebase Metrics`,
    ``,
    `- **Total Lines of Code:** ${typeof totalLoc === 'number' ? totalLoc.toLocaleString() : totalLoc}`,
    `- **Analyzed Files:** ${typeof totalFiles === 'number' ? totalFiles.toLocaleString() : totalFiles}`,
    `- **Circular Dependencies:** ${circularDeps.length === 0 ? 'None detected (Clean)' : `${circularDeps.length} cycle(s) identified`}`,
    `- **Total Findings:** ${findings.length} (${criticalFindings.length} critical, ${warningFindings.length} warnings, ${infoFindings.length} suggestions)`,
    ``,
  ]

  if (stack) {
    md.push(
      `---`,
      ``,
      `## Detected Tech Stack`,
      ``,
      `- **Primary Framework:** ${stack.framework ?? 'Custom / Unspecified'}`,
      `- **Languages:** ${stack.languages?.join(', ') || 'N/A'}`,
      `- **Package Manager:** ${stack.packageManager ?? 'N/A'}`,
      `- **Databases & Stores:** ${stack.databases?.join(', ') || 'None detected'}`,
      `- **Testing Frameworks:** ${stack.testing?.join(', ') || 'None detected'}`,
      `- **UI & Styling:** ${stack.ui?.join(', ') || 'None detected'}`,
      ``
    )
  }

  if (circularDeps.length > 0) {
    md.push(
      `---`,
      ``,
      `## Circular Dependency Cycles`,
      ``,
      `Circular imports increase bundle size, cause initialization bugs, and complicate code reuse:`,
      ``
    )
    circularDeps.forEach((cycle, i) => {
      md.push(`${i + 1}. \`${cycle.join(' → ')}\``)
    })
    md.push(``)
  }

  md.push(`---`, ``, `## Audit Findings & Action Items`, ``)

  if (findings.length === 0) {
    md.push(`*No architectural debt or security issues found. Excellent work!*`, ``)
  } else {
    if (criticalFindings.length > 0) {
      md.push(`### 🔴 Critical Issues (${criticalFindings.length})`, ``)
      md.push(`| Category | File : Line | Description |`)
      md.push(`|---|---|---|`)
      criticalFindings.forEach((f) => {
        const fileRef = f.file ? `\`${f.file}${f.line ? `:${f.line}` : ''}\`` : 'Global'
        const rule = f.title || f.category || 'Critical'
        const desc = f.detail.replace(/\|/g, '\\|')
        md.push(`| **${rule}** | ${fileRef} | ${desc} |`)
      })
      md.push(``)
    }

    if (warningFindings.length > 0) {
      md.push(`### 🟡 Warnings (${warningFindings.length})`, ``)
      md.push(`| Category | File : Line | Description |`)
      md.push(`|---|---|---|`)
      warningFindings.forEach((f) => {
        const fileRef = f.file ? `\`${f.file}${f.line ? `:${f.line}` : ''}\`` : 'Global'
        const rule = f.title || f.category || 'Warning'
        const desc = f.detail.replace(/\|/g, '\\|')
        md.push(`| **${rule}** | ${fileRef} | ${desc} |`)
      })
      md.push(``)
    }

    if (infoFindings.length > 0) {
      md.push(`### 🔵 Architectural Suggestions (${infoFindings.length})`, ``)
      md.push(`| Category | File : Line | Description |`)
      md.push(`|---|---|---|`)
      infoFindings.forEach((f) => {
        const fileRef = f.file ? `\`${f.file}${f.line ? `:${f.line}` : ''}\`` : 'Global'
        const rule = f.title || f.category || 'Notice'
        const desc = f.detail.replace(/\|/g, '\\|')
        md.push(`| **${rule}** | ${fileRef} | ${desc} |`)
      })
      md.push(``)
    }
  }

  md.push(
    `---`,
    ``,
    `*Generated automatically by [Arbor](http://localhost:3000) — AST Architectural Code Analysis.*`
  )

  return md.join('\n')
}

/**
 * Generates raw indented JSON representation of project & analysis.
 */
export function generateJsonReport(
  project: ExportableProject,
  analysis: ExportableAnalysis
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      generator: 'Arbor AST Analysis Engine',
      version: '1.0.0',
      project: {
        id: project.id,
        slug: project.slug,
        name: project.name,
        repoFullName: project.repoFullName,
        repoUrl: project.repoUrl,
        defaultBranch: project.defaultBranch,
        description: project.description,
      },
      analysis,
    },
    null,
    2
  )
}

/**
 * Triggers a browser file download using Blob URL.
 */
export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function getGrade(score?: number | null): string {
  if (score == null) return 'N/A'
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}

function getStatus(score?: number | null): string {
  if (score == null) return 'Not Scored'
  if (score >= 80) return 'Healthy'
  if (score >= 60) return 'Warning'
  return 'Needs Attention'
}
