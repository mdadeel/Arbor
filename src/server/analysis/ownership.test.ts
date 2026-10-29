import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { runAnalysis } from './index'
import { parseGitLogNumstat } from './hotspots'
import {
  analyzeOwnership,
  computeOwnershipReport,
  isBotContributor,
  resolveCodeownerIdentity,
} from './ownership'
import type { ProjectStructure } from './types'

describe('ownership map & bus-factor analyzer', () => {
  it('resolves GitHub noreply handles, preserves standard emails, and filters automated bots', () => {
    expect(
      resolveCodeownerIdentity('64582744+mdadeel@users.noreply.github.com', 'Adeel')
    ).toEqual({
      codeowner: '@mdadeel',
      displayName: 'Adeel',
      email: '64582744+mdadeel@users.noreply.github.com',
    })

    expect(
      resolveCodeownerIdentity('Octo-Cat@users.noreply.github.com', 'Octo Cat')
    ).toEqual({
      codeowner: '@octo-cat',
      displayName: 'Octo Cat',
      email: 'octo-cat@users.noreply.github.com',
    })

    expect(resolveCodeownerIdentity('alice@acme.dev', 'Alice Rivera')).toEqual({
      codeowner: 'alice@acme.dev',
      displayName: 'Alice Rivera',
      email: 'alice@acme.dev',
    })

    expect(isBotContributor('49699333+dependabot[bot]@users.noreply.github.com', 'dependabot[bot]')).toBe(true)
    expect(resolveCodeownerIdentity('renovate[bot]@users.noreply.github.com', 'renovate[bot]')).toBeNull()
    expect(resolveCodeownerIdentity('noreply@github.com', 'GitHub')).toBeNull()
  })

  it('computes per-directory bus factor without inflating single-commit multi-file formatting touches', () => {
    const rawLog = [
      // Alice: 1 bulk formatting commit touching 6 files in src/
      '__ARBOR_COMMIT__a1\t2026-10-01T10:00:00Z\t111+alice@users.noreply.github.com\tAlice',
      '2\t2\tsrc/f1.ts',
      '2\t2\tsrc/f2.ts',
      '2\t2\tsrc/f3.ts',
      '2\t2\tsrc/f4.ts',
      '2\t2\tsrc/f5.ts',
      '2\t2\tsrc/f6.ts',
      // Bob, Carol, Dan: 4 commits each in docs/ (balanced 3-way+ ownership -> busFactor >= 2)
      '__ARBOR_COMMIT__b1\t2026-10-02T10:00:00Z\t222+bob@users.noreply.github.com\tBob',
      '40\t5\tsrc/engine.ts',
      '25\t5\tdocs/arch.md',
      '__ARBOR_COMMIT__b2\t2026-10-03T10:00:00Z\tbob@users.noreply.github.com\tBob',
      '55\t10\tsrc/engine.ts',
      '__ARBOR_COMMIT__b3\t2026-10-04T10:00:00Z\t222+bob@users.noreply.github.com\tBob',
      '30\t8\tsrc/worker.ts',
      '__ARBOR_COMMIT__c1\t2026-10-05T10:00:00Z\t333+carol@users.noreply.github.com\tCarol',
      '25\t5\tdocs/api.md',
      '__ARBOR_COMMIT__d1\t2026-10-06T10:00:00Z\t444+dan@users.noreply.github.com\tDan',
      '25\t5\tdocs/setup.md',
      '__ARBOR_COMMIT__e1\t2026-10-07T10:00:00Z\t555+erin@users.noreply.github.com\tErin',
      '25\t5\tdocs/faq.md',
      // Dependabot commit in prisma/ should be ignored
      '__ARBOR_COMMIT__bot1\t2026-10-08T10:00:00Z\t49699333+dependabot[bot]@users.noreply.github.com\tdependabot[bot]',
      '10\t10\tprisma/schema.prisma',
    ].join('\n')

    const churn = parseGitLogNumstat(rawLog, 180)
    const structure: Pick<ProjectStructure, 'topLevelDirs' | 'tree' | 'fileCount'> = {
      fileCount: 12,
      topLevelDirs: ['src', 'docs', 'prisma'],
      tree: [
        {
          name: 'src',
          type: 'dir',
          children: [
            { name: 'engine.ts', type: 'file' },
            { name: 'worker.ts', type: 'file' },
            { name: 'f1.ts', type: 'file' },
          ],
        },
        {
          name: 'docs',
          type: 'dir',
          children: [
            { name: 'arch.md', type: 'file' },
            { name: 'api.md', type: 'file' },
            { name: 'setup.md', type: 'file' },
            { name: 'faq.md', type: 'file' },
          ],
        },
        {
          name: 'prisma',
          type: 'dir',
          children: [{ name: 'schema.prisma', type: 'file' }],
        },
      ],
    }

    const report = computeOwnershipReport(structure, churn, null)

    // 5 human contributors (@alice, @bob merged across 2 noreply aliases, @carol, @dan, @erin)
    expect(report.totalContributors).toBe(5)

    const srcEntry = report.directories.find((d) => d.directory === 'src')
    const docsEntry = report.directories.find((d) => d.directory === 'docs')
    const prismaEntry = report.directories.find((d) => d.directory === 'prisma')

    expect(srcEntry).toBeDefined()
    // Bob made 3 distinct commits in src/, Alice made only 1 commit (even though it touched 6 files)
    expect(srcEntry!.owners[0].codeowner).toBe('@bob')
    expect(srcEntry!.owners[0].commits).toBe(3)
    expect(srcEntry!.owners[1].codeowner).toBe('@alice')
    expect(srcEntry!.owners[1].commits).toBe(1)
    expect(srcEntry!.busFactor).toBe(1)
    expect(srcEntry!.risk).toBe('high')

    // docs/ has 4 equal contributors (25% each) -> takes 2 contributors to reach 50%
    expect(docsEntry).toBeDefined()
    expect(docsEntry!.busFactor).toBe(2)
    expect(docsEntry!.risk).toBe('medium')

    // prisma/ only had a bot commit -> 0 human commits -> busFactor 0 ('unknown')
    expect(prismaEntry).toBeDefined()
    expect(prismaEntry!.commits).toBe(0)
    expect(prismaEntry!.busFactor).toBe(0)
    expect(prismaEntry!.risk).toBe('unknown')

    expect(report.suggestedCodeowners).toContain('* @bob')
    expect(report.suggestedCodeowners).toContain('/src/')
    expect(report.suggestedCodeowners).toContain('@bob')
    expect(report.suggestedCodeowners).not.toContain('dependabot')
  })

  it('consolidates unambiguous local email + GitHub noreply aliases while preserving ambiguous shared names', () => {
    const rawLog = [
      '__ARBOR_COMMIT__m1\t2026-10-01T10:00:00Z\t64582744+mdadeel@users.noreply.github.com\tShahnawas Adeel',
      '20\t2\tsrc/app.ts',
      '__ARBOR_COMMIT__m2\t2026-10-02T10:00:00Z\tmdadeel125@example.com\tmdadeel',
      '15\t3\tsrc/app.ts',
      '__ARBOR_COMMIT__j1\t2026-10-03T10:00:00Z\t10+john-a@users.noreply.github.com\tJohn',
      '10\t1\tdocs/a.md',
      '__ARBOR_COMMIT__j2\t2026-10-04T10:00:00Z\t20+john-b@users.noreply.github.com\tJohn',
      '10\t1\tdocs/b.md',
      '__ARBOR_COMMIT__j3\t2026-10-05T10:00:00Z\tjohn@corp.io\tJohn',
      '10\t1\tdocs/c.md',
    ].join('\n')

    const churn = parseGitLogNumstat(rawLog, 180)
    const report = computeOwnershipReport(
      { fileCount: 4, topLevelDirs: ['src', 'docs'], tree: [] },
      churn
    )

    const srcEntry = report.directories.find((d) => d.directory === 'src')
    const docsEntry = report.directories.find((d) => d.directory === 'docs')

    // mdadeel125@example.com + 64582744+mdadeel@... merged into single contributor @mdadeel
    expect(srcEntry!.contributorCount).toBe(1)
    expect(srcEntry!.suggestedOwners).toEqual(['@mdadeel'])

    // Ambiguous "John" across @john-a and @john-b keeps john@corp.io separate (3 distinct contributors)
    expect(docsEntry!.contributorCount).toBe(3)
  })

  it('analyzes real simple-git commit history and detects existing .github/CODEOWNERS', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbor-ownership-test-'))
    try {
      execFileSync('git', ['init', '-b', 'main'], { cwd: tmpDir })
      fs.mkdirSync(path.join(tmpDir, '.github'), { recursive: true })
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true })
      fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true })

      fs.writeFileSync(path.join(tmpDir, '.github', 'CODEOWNERS'), '* @lead-dev\n', 'utf8')
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'service.ts'),
        'export function compute(x: number) { return x > 0 ? x * 2 : 0 }\n',
        'utf8'
      )
      execFileSync('git', ['add', '.'], { cwd: tmpDir })
      execFileSync(
        'git',
        [
          '-c',
          'user.name=Lead Dev',
          '-c',
          'user.email=12345+lead-dev@users.noreply.github.com',
          'commit',
          '-m',
          'feat: bootstrap service',
        ],
        { cwd: tmpDir }
      )

      fs.writeFileSync(
        path.join(tmpDir, 'scripts', 'seed.ts'),
        'export const seed = () => "ok"\n',
        'utf8'
      )
      execFileSync('git', ['add', '.'], { cwd: tmpDir })
      execFileSync(
        'git',
        [
          '-c',
          'user.name=Ops Engineer',
          '-c',
          'user.email=ops@company.io',
          'commit',
          '-m',
          'chore: add seed script',
        ],
        { cwd: tmpDir }
      )

      const analysis = runAnalysis(tmpDir)
      const ownership = await analyzeOwnership(tmpDir, analysis.structure)

      expect(ownership.existingCodeownersPath).toBe('.github/CODEOWNERS')
      expect(ownership.commitsAnalyzed).toBe(2)
      expect(ownership.totalContributors).toBe(2)

      const srcDir = ownership.directories.find((d) => d.directory === 'src')
      const scriptsDir = ownership.directories.find((d) => d.directory === 'scripts')
      expect(srcDir?.suggestedOwners).toEqual(['@lead-dev'])
      expect(scriptsDir?.suggestedOwners).toEqual(['ops@company.io'])
      expect(ownership.suggestedCodeowners).toContain('/src/')
      expect(ownership.suggestedCodeowners).toContain('@lead-dev')
      expect(ownership.suggestedCodeowners).toContain('ops@company.io')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
