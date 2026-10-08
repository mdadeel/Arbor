import type { Finding } from '@/server/analysis/types'

export function addedLinesForPatch(patch: string): Set<number> {
  const added = new Set<number>()
  let newLine = 0
  for (const line of patch.split(/\r?\n/)) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunk) {
      newLine = Number(hunk[1])
      continue
    }
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('\\')) continue
    if (line.startsWith('+')) {
      added.add(newLine++)
    } else if (line.startsWith('-')) {
      // Removed lines do not consume a line number in the new file.
    } else if (newLine > 0) {
      newLine++
    }
  }
  return added
}

export function changedLinesByFile(files: Array<{ filename: string; patch?: string }>) {
  return new Map(files.map((file) => [file.filename, addedLinesForPatch(file.patch ?? '')]))
}

export function getPullRequestConclusion(findings: Finding[]): 'success' | 'failure' | 'neutral' {
  const active = findings.filter((finding) => !finding.policySuppressed)
  if (active.some((finding) => finding.severity === 'critical')) return 'failure'
  if (active.some((finding) => finding.severity === 'warning')) return 'neutral'
  return 'success'
}

export function buildPullRequestAnnotations(
  findings: Finding[],
  changedLines: Map<string, Set<number>> | null
) {
  if (!changedLines) return []
  const annotations: Array<Record<string, string | number>> = []
  for (const finding of findings) {
    if (finding.policySuppressed || !finding.file || !finding.line || finding.line < 1) continue
    const file = finding.file.replaceAll('\\', '/')
    if (file.startsWith('/') || file.split('/').some((part) => part === '..' || !part)) continue
    if (!changedLines.get(file)?.has(finding.line)) continue
    const level = finding.severity === 'critical' ? 'failure' : finding.severity === 'warning' ? 'warning' : 'notice'
    const message = `${finding.title}: ${finding.recommendation ?? finding.detail}`.slice(0, 1800)
    annotations.push({
      path: file,
      start_line: finding.line,
      end_line: finding.line,
      annotation_level: level,
      title: finding.title.slice(0, 100),
      message,
    })
    if (annotations.length === 50) break
  }
  return annotations
}
