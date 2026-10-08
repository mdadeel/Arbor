export class PatchValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PatchValidationError'
  }
}

function normalizeRepoPath(file: string) {
  const normalized = file.replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || normalized.length > 512 ||
      normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
      /[\0\r\n]/.test(normalized)) {
    throw new PatchValidationError('The target file path is not a safe repository-relative path.')
  }
  return normalized
}

/** Apply-check a single-file unified diff in memory. This never writes to disk. */
export function validateAndApplyUnifiedDiff(diff: string, file: string, originalContent: string) {
  const target = normalizeRepoPath(file)
  if (Buffer.byteLength(diff, 'utf8') > 8_000) throw new PatchValidationError('The proposed diff exceeds 8 KB.')
  if (Buffer.byteLength(originalContent, 'utf8') > 64 * 1024) throw new PatchValidationError('The source file exceeds the 64 KB patch context limit.')
  if (diff.includes('\0') || diff.includes('```')) throw new PatchValidationError('The response is not a plain unified diff.')

  const lines = diff.replace(/\r\n/g, '\n').split('\n')
  if (lines[0] !== `diff --git a/${target} b/${target}`) {
    throw new PatchValidationError('The diff must target exactly the finding file.')
  }
  let cursor = 1
  if (lines[cursor]?.startsWith('index ')) cursor++
  if (lines[cursor++] !== `--- a/${target}` || lines[cursor++] !== `+++ b/${target}`) {
    throw new PatchValidationError('The diff headers do not match the finding file.')
  }

  const original = originalContent.replace(/\r\n/g, '\n')
  const finalNewline = original.endsWith('\n')
  const oldLines = original.split('\n')
  if (finalNewline) oldLines.pop()
  const output: string[] = []
  let oldCursor = 0
  let hunkCount = 0
  let changeCount = 0
  let addedLines = 0
  let removedLines = 0

  while (cursor < lines.length) {
    const hunk = lines[cursor].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/)
    if (!hunk) throw new PatchValidationError('Only standard unified diff hunks are allowed.')
    cursor++
    hunkCount++
    const oldStart = Number(hunk[1])
    const newStart = Number(hunk[3])
    const expectedOld = hunk[2] === undefined ? 1 : Number(hunk[2])
    const expectedNew = hunk[4] === undefined ? 1 : Number(hunk[4])
    const targetIndex = expectedOld === 0 ? oldStart : Math.max(0, oldStart - 1)
    const targetNewIndex = expectedNew === 0 ? newStart : Math.max(0, newStart - 1)
    if (targetIndex < oldCursor || targetIndex > oldLines.length || targetNewIndex !== output.length) {
      throw new PatchValidationError('Hunk offsets are invalid.')
    }
    while (oldCursor < targetIndex) output.push(oldLines[oldCursor++])

    let usedOld = 0
    let usedNew = 0
    while (cursor < lines.length && !lines[cursor].startsWith('@@ ')) {
      const line = lines[cursor++]
      if (line === '\\ No newline at end of file') continue
      if (line.startsWith(' ')) {
        const context = line.slice(1)
        if (oldLines[oldCursor] !== context) throw new PatchValidationError('Context does not match the exact scanned source revision.')
        output.push(context)
        oldCursor++
        usedOld++
        usedNew++
      } else if (line.startsWith('-')) {
        if (oldLines[oldCursor] !== line.slice(1)) throw new PatchValidationError('Removed text does not match the exact scanned source revision.')
        oldCursor++
        usedOld++
        changeCount++
        removedLines++
      } else if (line.startsWith('+')) {
        output.push(line.slice(1))
        usedNew++
        changeCount++
        addedLines++
      } else if (line === '' && cursor === lines.length) {
        break
      } else {
        throw new PatchValidationError('The diff contains an invalid hunk line.')
      }
    }
    if (usedOld !== expectedOld || usedNew !== expectedNew) {
      throw new PatchValidationError('The hunk line counts do not match its header.')
    }
  }

  if (hunkCount === 0 || changeCount === 0) throw new PatchValidationError('The diff contains no changes.')
  while (oldCursor < oldLines.length) output.push(oldLines[oldCursor++])
  const updatedContent = output.join('\n') + (finalNewline ? '\n' : '')
  return { file: target, appliesCleanly: true as const, updatedContent, changedLines: changeCount, addedLines, removedLines }
}
