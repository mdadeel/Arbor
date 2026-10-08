import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseFile } from './ast'

let tempRoot: string | null = null

afterEach(() => {
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true })
  tempRoot = null
})

describe('AST repository-root resolution', () => {
  it('uses the supplied repoDir for aliases, and guesses only when it is absent', () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arbor-ast-root-'))
    const repoDir = path.join(tempRoot, 'repo')
    const nestedApp = path.join(repoDir, 'packages', 'app')
    const entry = path.join(nestedApp, 'src', 'entry.ts')
    fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true })
    fs.mkdirSync(path.dirname(entry), { recursive: true })
    fs.writeFileSync(path.join(repoDir, 'package.json'), '{}')
    fs.writeFileSync(path.join(nestedApp, 'package.json'), '{}')
    fs.writeFileSync(path.join(repoDir, 'src', 'shared.ts'), 'export const rootShared = true')
    const source = "import { shared } from '@/shared'\nexport { shared }\n"

    expect(parseFile(entry, source, repoDir).localTargets).toEqual(['src/shared.ts'])
    expect(parseFile(entry, source).localTargets).toEqual([])
  })
})
