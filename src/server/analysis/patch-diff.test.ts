import { describe, expect, it } from 'vitest'
import { PatchValidationError, validateAndApplyUnifiedDiff } from './patch-diff'

const source = 'const greeting = "hello"\nconsole.log(greeting)\n'
const validDiff = [
  'diff --git a/src/greeting.ts b/src/greeting.ts',
  'index 1111111..2222222 100644',
  '--- a/src/greeting.ts',
  '+++ b/src/greeting.ts',
  '@@ -1,2 +1,2 @@',
  '-const greeting = "hello"',
  '+const greeting = "hello, Arbor"',
  ' console.log(greeting)',
].join('\n')

describe('review-only patch validation', () => {
  it('checks a single-file diff against the exact source without writing it', () => {
    const result = validateAndApplyUnifiedDiff(validDiff, 'src/greeting.ts', source)
    expect(result).toMatchObject({ file: 'src/greeting.ts', appliesCleanly: true, changedLines: 2 })
    expect(result.updatedContent).toBe('const greeting = "hello, Arbor"\nconsole.log(greeting)\n')
    expect(source).toContain('"hello"')
  })

  it('rejects inconsistent new-file hunk offsets and line counts', () => {
    expect(() => validateAndApplyUnifiedDiff(
      validDiff.replace('@@ -1,2 +1,2 @@', '@@ -1,2 +2,2 @@'),
      'src/greeting.ts',
      source
    )).toThrow(/Hunk offsets/)
    expect(() => validateAndApplyUnifiedDiff(
      validDiff.replace('@@ -1,2 +1,2 @@', '@@ -1,3 +1,2 @@'),
      'src/greeting.ts',
      source
    )).toThrow(/line counts/)
    expect(() => validateAndApplyUnifiedDiff(
      validDiff.replace(' console.log(greeting)', '\\ malformed marker\n console.log(greeting)'),
      'src/greeting.ts',
      source
    )).toThrow(/invalid hunk line/)
  })

  it('rejects path traversal, multi-file changes, and source context mismatches', () => {
    expect(() => validateAndApplyUnifiedDiff(validDiff.replaceAll('src/greeting.ts', '../secret'), 'src/greeting.ts', source))
      .toThrow(PatchValidationError)
    expect(() => validateAndApplyUnifiedDiff(validDiff, '../secret', source)).toThrow(PatchValidationError)
    expect(() => validateAndApplyUnifiedDiff(validDiff.replace('const greeting = "hello"', 'const greeting = "not the source"'), 'src/greeting.ts', source))
      .toThrow(/exact scanned source revision/)
  })
})
