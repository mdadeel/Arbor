import type { Finding } from '@/server/analysis/types'

export interface FindingExplanation {
  summary: string
  impact: string
  recommendation: string
  suggestedPatch?: string
  confidenceScore: number
}

export interface DocSummary {
  readingTimeMinutes: number
  keyPoints: string[]
  suggestedTags: string[]
  executiveSummary: string
}

export interface ReleaseNotes {
  title: string
  version: string
  summary: string
  features: string[]
  fixes: string[]
  improvements: string[]
  markdown: string
}

export async function explainFinding(
  finding: Finding,
  options: {
    apiKey?: string
    provider?: 'openai' | 'anthropic'
    model?: string
  } = {}
): Promise<FindingExplanation> {
  // If external BYOK API key is supplied, we can forward to external LLM provider
  if (options.apiKey) {
    try {
      if (options.provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': options.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: options.model || 'claude-3-5-sonnet-20240620',
            max_tokens: 1000,
            messages: [
              {
                role: 'user',
                content: `You are an expert static code analysis assistant. Explain this code finding and provide a remediation patch in JSON format with fields: summary, impact, recommendation, suggestedPatch.\nFinding: ${JSON.stringify(finding)}`,
              },
            ],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const text = data.content?.[0]?.text
          if (text) {
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                return {
                  summary: parsed.summary || finding.title,
                  impact: parsed.impact || 'Identified potential risk during static code audit.',
                  recommendation: parsed.recommendation || finding.detail,
                  suggestedPatch: parsed.suggestedPatch,
                  confidenceScore: 0.95,
                }
              }
            } catch {
              // fallback to rule-based engine
            }
          }
        }
      }
    } catch {
      // Fallback to internal reasoning engine
    }
  }

  // Rule-based deterministic expert reasoning engine
  let impact = 'Could degrade code health, maintainability, or consistency.'
  let recommendation = finding.detail
  let patch: string | undefined

  switch (finding.category) {
    case 'security':
      impact =
        'Potential security exposure. Unsanitized inputs, exposed secrets, or missing authorization can lead to critical compromise.'
      recommendation = `Review ${finding.file ? `file \`${finding.file}\`` : 'the flagged code'}. Ensure sensitive values are moved to environment variables and trust boundaries validate input.`
      patch = finding.file?.includes('.env')
        ? `# Move secret to secure environment manager\n# ${finding.title}\nSECRET_KEY=\${ENVIRONMENT_VARIABLE}`
        : undefined
      break

    case 'techDebt':
      impact =
        'High technical debt increases change failure rates, slows developer velocity, and complicates refactoring.'
      recommendation = `Decouple tight dependencies in ${finding.file ? `\`${finding.file}\`` : 'the module'}. Extract subroutines or split oversized components.`
      break

    case 'performance':
      impact =
        'Performance bottlenecks may lead to elevated server latency or poor client interaction speed (CLS/FID/INP).'
      recommendation =
        'Implement memoization, dynamic code splitting, or batch asynchronous operations to prevent blocking main thread.'
      break

    case 'designSystem':
      impact =
        'Inconsistent design tokens lead to visual bugs, poor contrast accessibility, and disjointed brand perception.'
      recommendation =
        'Replace arbitrary hardcoded colors or sizing with standardized Tailwind utility tokens or design tokens.'
      break

    default:
      impact = 'Identified architectural irregularity during AST static audit.'
      recommendation = finding.detail
  }

  return {
    summary: `${finding.title} — ${finding.category.toUpperCase()} rule violation`,
    impact,
    recommendation,
    suggestedPatch: patch,
    confidenceScore: 0.88,
  }
}

export function generateDocSummary(title: string, content: string): DocSummary {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200))

  // Extract headings or paragraphs for key points
  const lines = content.split('\n')
  const headings = lines
    .filter((l) => l.startsWith('#') && !l.startsWith('###'))
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .filter(Boolean)

  const keyPoints =
    headings.length > 0
      ? headings.slice(0, 5)
      : [
          `Overview of ${title}`,
          'Implementation and workflow patterns',
          'Key constraints and architecture notes',
        ]

  const suggestedTags: string[] = []
  if (content.toLowerCase().includes('api') || content.toLowerCase().includes('endpoint')) {
    suggestedTags.push('API')
  }
  if (content.toLowerCase().includes('auth') || content.toLowerCase().includes('token')) {
    suggestedTags.push('Security')
  }
  if (content.toLowerCase().includes('database') || content.toLowerCase().includes('prisma')) {
    suggestedTags.push('Database')
  }
  if (content.toLowerCase().includes('docker') || content.toLowerCase().includes('deploy')) {
    suggestedTags.push('DevOps')
  }
  if (suggestedTags.length === 0) suggestedTags.push('General')

  return {
    readingTimeMinutes,
    keyPoints,
    suggestedTags,
    executiveSummary: `Documentation covering ${title} (${words} words, ~${readingTimeMinutes} min read). Key sections include: ${keyPoints.slice(0, 3).join(', ')}.`,
  }
}

export function generateReleaseNotes(
  projectName: string,
  commits: Array<{ message: string; author?: string; sha?: string }>,
  prs: Array<{ title: string; number?: number }>
): ReleaseNotes {
  const features: string[] = []
  const fixes: string[] = []
  const improvements: string[] = []

  // Classify PRs
  for (const pr of prs) {
    const title = pr.title
    const num = pr.number ? ` (#${pr.number})` : ''
    const lower = title.toLowerCase()

    if (lower.startsWith('feat') || lower.includes('add ') || lower.includes('implement')) {
      features.push(`${title}${num}`)
    } else if (lower.startsWith('fix') || lower.includes('bug') || lower.includes('patch')) {
      fixes.push(`${title}${num}`)
    } else {
      improvements.push(`${title}${num}`)
    }
  }

  // Classify Commits if PRs were empty
  if (prs.length === 0) {
    for (const c of commits.slice(0, 15)) {
      const msg = c.message.split('\n')[0]
      const sha = c.sha ? ` (${c.sha.slice(0, 7)})` : ''
      const lower = msg.toLowerCase()

      if (lower.startsWith('feat') || lower.includes('add ')) {
        features.push(`${msg}${sha}`)
      } else if (lower.startsWith('fix')) {
        fixes.push(`${msg}${sha}`)
      } else {
        improvements.push(`${msg}${sha}`)
      }
    }
  }

  const dateStr = new Date().toISOString().split('T')[0]
  const version = `v1.${commits.length || 1}.0`

  let markdown = `# ${projectName} — Release ${version} (${dateStr})\n\n`
  markdown += `Automated release summary compiled across ${commits.length} commits and ${prs.length} pull requests.\n\n`

  if (features.length > 0) {
    markdown += `### 🚀 New Features\n`
    for (const f of features) markdown += `- ${f}\n`
    markdown += '\n'
  }

  if (fixes.length > 0) {
    markdown += `### 🐛 Bug Fixes\n`
    for (const fix of fixes) markdown += `- ${fix}\n`
    markdown += '\n'
  }

  if (improvements.length > 0) {
    markdown += `### 🛠️ Improvements & Maintenance\n`
    for (const imp of improvements) markdown += `- ${imp}\n`
    markdown += '\n'
  }

  return {
    title: `${projectName} ${version}`,
    version,
    summary: `Release ${version} brings ${features.length} features, ${fixes.length} fixes, and ${improvements.length} improvements.`,
    features,
    fixes,
    improvements,
    markdown,
  }
}
