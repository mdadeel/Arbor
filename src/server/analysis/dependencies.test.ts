import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCycloneDxSbom,
  collectDependencyInventory,
  lookupDependencyAdvisories,
  validateCycloneDxSbom,
} from './dependencies'

const tempDirs: string[] = []
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbor-dependencies-'))
  tempDirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('dependency inventory and SBOM', () => {
  it('collects resolved npm direct/transitive packages and Python pins', () => {
    const repo = makeRepo()
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ dependencies: { react: '^18.2.0', foo: '^1.0.0' }, devDependencies: { vitest: '^1.0.0', '@types/node': '^20.0.0' } }))
    fs.writeFileSync(path.join(repo, 'package-lock.json'), JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'demo' },
        'node_modules/react': { version: '18.3.1', license: 'MIT' },
        'node_modules/react/node_modules/scheduler': { version: '0.23.2' },
        'node_modules/foo': { version: '1.1.0' },
        'node_modules/react/node_modules/foo': { version: '1.0.0' },
        'node_modules/vitest': { version: '1.6.1', dev: true },
        'node_modules/@types/node': { version: '20.19.43', dev: true },
      },
    }))
    fs.writeFileSync(path.join(repo, 'requirements.txt'), 'Flask==3.0.2\nrequests>=2.0\n')

    const inventory = collectDependencyInventory(repo)
    expect(inventory.packages).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'react', version: '18.3.1', direct: true, resolved: true }),
      expect.objectContaining({ name: '@types/node', purl: 'pkg:npm/%40types/node@20.19.43' }),
      expect.objectContaining({ name: 'scheduler', version: '0.23.2', direct: false, dependencyPath: ['react', 'scheduler'] }),
      expect.objectContaining({ name: 'foo', version: '1.1.0', direct: true }),
      expect.objectContaining({ name: 'foo', version: '1.0.0', direct: false }),
      expect.objectContaining({ name: 'flask', version: '3.0.2', ecosystem: 'pypi', direct: true }),
    ]))
    expect(inventory.lockfiles).toEqual(expect.arrayContaining(['package-lock.json', 'requirements.txt']))
    expect(inventory.complete).toBe(false)
  })

  it('distinguishes Pipenv direct requirements from resolved transitives', () => {
    const repo = makeRepo()
    fs.writeFileSync(path.join(repo, 'Pipfile'), JSON.stringify({ packages: { flask: '*' }, 'dev-packages': { pytest: '*' } }))
    fs.writeFileSync(path.join(repo, 'Pipfile.lock'), JSON.stringify({
      default: { flask: { version: '==3.0.2' }, werkzeug: { version: '==3.0.3' } },
      develop: { pytest: { version: '==8.0.0' }, pluggy: { version: '==1.4.0' } },
    }))

    const inventory = collectDependencyInventory(repo)
    expect(inventory.packages).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'flask', direct: true, dependencyType: 'prod' }),
      expect.objectContaining({ name: 'werkzeug', direct: false, dependencyType: 'transitive' }),
      expect.objectContaining({ name: 'pytest', direct: true, dependencyType: 'dev' }),
      expect.objectContaining({ name: 'pluggy', direct: false, dependencyType: 'transitive' }),
    ]))
  })

  it('reports advisory-provider failure as unavailable without failing inventory', async () => {
    const report = await lookupDependencyAdvisories([
      { name: 'lodash', version: '4.17.20', ecosystem: 'npm', direct: true, dependencyType: 'prod', purl: 'pkg:npm/lodash@4.17.20', dependencyPath: ['lodash'], resolved: true },
    ], { fetcher: vi.fn().mockRejectedValue(new Error('offline')) })
    expect(report).toMatchObject({ status: 'unavailable', queriedCount: 1, advisoryCount: 0 })
    expect(report.error).toContain('offline')
  })

  it('matches affected packages, normalizes severity, and emits a CycloneDX 1.5 vulnerability section', async () => {
    const packageRecord = {
      name: 'lodash', version: '4.17.20', ecosystem: 'npm' as const,
      direct: true, dependencyType: 'prod' as const, purl: 'pkg:npm/lodash@4.17.20', dependencyPath: ['lodash'], resolved: true,
    }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      ghsa_id: 'GHSA-test-1234-abcd',
      summary: 'Prototype pollution issue',
      severity: 'moderate',
      references: [{ url: 'https://github.com/advisories/GHSA-test-1234-abcd' }],
      vulnerabilities: [{
        package: { name: 'lodash', ecosystem: 'npm' },
        vulnerable_version_range: '<4.17.21',
        first_patched_version: '4.17.21',
      }],
    }]), { status: 200 }))
    const advisories = await lookupDependencyAdvisories([packageRecord], { fetcher })
    const inventory = {
      version: 1 as const, packages: [packageRecord], ecosystems: ['npm' as const],
      lockfiles: ['package-lock.json'], directCount: 1, transitiveCount: 0, complete: true, truncated: false,
    }
    const sbom = buildCycloneDxSbom(inventory, advisories, '2026-10-07T00:00:00.000Z')
    expect(advisories.advisories[0]).toMatchObject({ id: 'GHSA-test-1234-abcd', severity: 'medium', patchedVersion: '4.17.21' })
    expect(sbom).toMatchObject({ bomFormat: 'CycloneDX', specVersion: '1.5' })
    expect(sbom.vulnerabilities?.[0].affects[0]).toMatchObject({
      ref: packageRecord.purl,
      versions: [{ version: '4.17.20', range: { range: '<4.17.21' }, status: 'affected' }],
    })
    expect(validateCycloneDxSbom(sbom)).toEqual({ valid: true, errors: [] })
    expect(validateCycloneDxSbom({ ...sbom, components: [{ 'bom-ref': 'unknown' }], vulnerabilities: [{ id: 'GHSA', affects: [{ ref: 'missing' }] }] }).valid).toBe(false)
  })
})
