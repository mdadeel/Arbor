import { describe, expect, it } from 'vitest'
import { addedLinesForPatch, buildPullRequestAnnotations, changedLinesByFile, getPullRequestConclusion } from '@/lib/github-check-utils'
import type { Finding } from '@/server/analysis/types'

describe('pull request diff annotations', () => {
  it('concludes based on active policy findings and annotates only added lines', () => {
    const findings: Finding[] = [
      { id: 'critical', category: 'security', severity: 'critical', title: 'Critical issue', detail: 'Review this issue.', file: 'src/demo.ts', line: 21, recommendation: 'Use a safe API.' },
      { id: 'old-line', category: 'security', severity: 'critical', title: 'Old issue', detail: 'Outside the changed lines.', file: 'src/demo.ts', line: 20 },
      { id: 'suppressed', category: 'security', severity: 'critical', title: 'Suppressed', detail: 'Not gating.', policySuppressed: true },
    ]
    expect(getPullRequestConclusion(findings)).toBe('failure')
    expect(getPullRequestConclusion([{ ...findings[0], policySuppressed: true }])).toBe('success')
    expect(buildPullRequestAnnotations(findings, new Map([['src/demo.ts', new Set([21])]]))).toEqual([
      expect.objectContaining({ path: 'src/demo.ts', start_line: 21, annotation_level: 'failure', message: 'Critical issue: Use a safe API.' }),
    ])
  })

  it('maps added lines to line numbers in the new file', () => {
    const patch = [
      '@@ -3,4 +3,5 @@ function example() {',
      ' unchanged',
      '-old value',
      '+new value',
      '+second line',
      ' unchanged again',
    ].join('\n')
    expect([...addedLinesForPatch(patch)]).toEqual([4, 5])
  })

  it('handles multiple hunks and excludes file headers', () => {
    const patch = [
      '--- a/src/demo.ts',
      '+++ b/src/demo.ts',
      '@@ -1 +1,2 @@',
      '+first',
      ' context',
      '@@ -20,2 +21,3 @@',
      '-removed',
      '+added',
      '+added too',
    ].join('\n')
    expect([...addedLinesForPatch(patch)]).toEqual([1, 21, 22])
    expect(changedLinesByFile([{ filename: 'src/demo.ts', patch }]).get('src/demo.ts')).toEqual(new Set([1, 21, 22]))
  })
})
