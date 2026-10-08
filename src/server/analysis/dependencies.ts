import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export type DependencyEcosystem = 'npm' | 'pypi'
export type DependencyRecord = {
  name: string
  version: string
  ecosystem: DependencyEcosystem
  direct: boolean
  dependencyType: 'prod' | 'dev' | 'optional' | 'peer' | 'transitive'
  purl: string
  dependencyPath: string[]
  license?: string
  resolved: boolean
}
export type DependencyAdvisory = {
  id: string
  packageName: string
  ecosystem: DependencyEcosystem
  severity: string
  summary: string
  vulnerableRange: string | null
  patchedVersion: string | null
  url: string | null
}
export type DependencyInventory = {
  version: 1
  packages: DependencyRecord[]
  ecosystems: DependencyEcosystem[]
  lockfiles: string[]
  directCount: number
  transitiveCount: number
  complete: boolean
  truncated: boolean
}
export type DependencyAdvisoryReport = {
  status: 'complete' | 'partial' | 'unavailable' | 'not_applicable'
  source: 'GitHub Advisory Database'
  checkedAt: string
  queriedCount: number
  advisoryCount: number
  advisories: DependencyAdvisory[]
  error?: string
}

const MAX_MANIFEST_BYTES = 5 * 1024 * 1024
const MAX_INVENTORY_PACKAGES = 5_000
const MAX_DEPENDENCY_NAME_LENGTH = 120
const MAX_DEPENDENCY_VERSION_LENGTH = 100
const MAX_ADVISORY_PACKAGES = 25
const MAX_ADVISORY_RESPONSE_BYTES = 2 * 1024 * 1024
const EXACT_VERSION = /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

type JsonRecord = Record<string, unknown>

function readBoundedFile(repoDir: string, relativePath: string): string | null {
  const absolutePath = path.join(repoDir, relativePath)
  try {
    const stat = fs.statSync(absolutePath)
    if (!stat.isFile() || stat.size > MAX_MANIFEST_BYTES) return null
    return fs.readFileSync(absolutePath, 'utf8')
  } catch {
    return null
  }
}

function parseJson(text: string | null): JsonRecord | null {
  if (!text) return null
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
  } catch {
    return null
  }
}

function dependencyTypeFor(name: string, manifest: JsonRecord): DependencyRecord['dependencyType'] {
  for (const [field, type] of [
    ['dependencies', 'prod'],
    ['devDependencies', 'dev'],
    ['optionalDependencies', 'optional'],
    ['peerDependencies', 'peer'],
  ] as const) {
    const section = manifest[field]
    if (section && typeof section === 'object' && name in section) return type
  }
  return 'transitive'
}

function purl(ecosystem: DependencyEcosystem, name: string, version: string) {
  const normalizedName = ecosystem === 'pypi' ? name.toLowerCase().replace(/_/g, '-') : name
  const encodedName = encodeURIComponent(normalizedName)
    .replace(/%2F/gi, '/')
    .replace(/^@/, '%40')
  return `pkg:${ecosystem}/${encodedName}@${encodeURIComponent(version)}`
}

function npmPathChain(packagePath: string, fallbackName: string): string[] {
  const segments = packagePath.split('/')
  const chain: string[] = []
  for (let index = 0; index < segments.length; index++) {
    if (segments[index] !== 'node_modules' || !segments[index + 1]) continue
    let name = segments[++index]
    if (name.startsWith('@') && segments[index + 1]) name += `/${segments[++index]}`
    chain.push(name)
  }
  return chain.length ? chain : [fallbackName]
}

function npmPackages(manifest: JsonRecord | null, lock: JsonRecord | null) {
  const records = new Map<string, DependencyRecord>()
  if (!manifest) return { records, complete: false }
  const directSections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
  const directVersions = new Map<string, string>()
  for (const sectionName of directSections) {
    const section = manifest[sectionName]
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue
    for (const [name, version] of Object.entries(section)) {
      if (typeof version === 'string') directVersions.set(name, version)
    }
  }

  const lockedPackages = lock?.packages
  if (lockedPackages && typeof lockedPackages === 'object' && !Array.isArray(lockedPackages)) {
    for (const [packagePath, raw] of Object.entries(lockedPackages as JsonRecord)) {
      if (!packagePath || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue
      const pkg = raw as JsonRecord
      const pathName = packagePath.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/)?.[1]
      const name = typeof pkg.name === 'string' ? pkg.name : pathName
      const version = typeof pkg.version === 'string' ? pkg.version : null
      if (!name || !version || packagePath.endsWith('/node_modules') ||
          name.length > MAX_DEPENDENCY_NAME_LENGTH || version.length > MAX_DEPENDENCY_VERSION_LENGTH ||
          /[\0\r\n]/.test(name) || /[\0\r\n]/.test(version)) continue
      const dependencyPath = npmPathChain(packagePath, name)
      const isRootInstall = /^node_modules\/(?:@[^/]+\/)?[^/]+$/.test(packagePath)
      const directType = isRootInstall ? dependencyTypeFor(pathName ?? name, manifest) : 'transitive'
      const direct = directType !== 'transitive'
      const record: DependencyRecord = {
        name,
        version,
        ecosystem: 'npm',
        direct,
        dependencyType: direct ? directType : 'transitive',
        purl: purl('npm', name, version),
        dependencyPath,
        ...(typeof pkg.license === 'string' ? { license: pkg.license.slice(0, 120) } : {}),
        resolved: true,
      }
      const key = `${name}@${version}`
      const existing = records.get(key)
      if (!existing?.direct || record.direct) records.set(key, record)
    }
  } else if (lock?.dependencies && typeof lock.dependencies === 'object') {
    const visit = (dependencies: unknown, depth: number, parents: string[] = []) => {
      if (depth > 100 || !dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) return
      for (const [name, raw] of Object.entries(dependencies as JsonRecord)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
        const pkg = raw as JsonRecord
        const version = typeof pkg.version === 'string' ? pkg.version : null
        const dependencyPath = [...parents, name]
        if (version) {
          const directType = depth === 0 ? dependencyTypeFor(name, manifest) : 'transitive'
          const key = `${name}@${version}`
          const existing = records.get(key)
          const record: DependencyRecord = {
            name,
            version,
            ecosystem: 'npm',
            direct: directType !== 'transitive',
            dependencyType: directType,
            purl: purl('npm', name, version),
            dependencyPath,
            resolved: true,
          }
          if (!existing?.direct || record.direct) records.set(key, record)
        }
        visit(pkg.dependencies, depth + 1, dependencyPath)
      }
    }
    visit(lock.dependencies, 0)
  }

  for (const [name, spec] of directVersions) {
    if (name.length > MAX_DEPENDENCY_NAME_LENGTH || spec.length > MAX_DEPENDENCY_VERSION_LENGTH || /[\0\r\n]/.test(name)) continue
    if ([...records.values()].some((record) => record.name === name && record.direct)) continue
    records.set(`${name}@${spec}`, {
      name,
      version: spec,
      ecosystem: 'npm',
      direct: true,
      dependencyType: dependencyTypeFor(name, manifest),
      purl: purl('npm', name, spec),
      dependencyPath: [name],
      resolved: false,
    })
  }
  return { records, complete: Boolean(lock && (lock.packages || lock.dependencies)) }
}

function parsePythonRequirements(text: string, file: string): DependencyRecord[] {
  const result: DependencyRecord[] = []
  for (const rawLine of text.split(/\r?\n/).slice(0, 10_000)) {
    const line = rawLine.trim()
    if (!line || line.length > 512 || line.startsWith('#') || line.startsWith('-')) continue
    const match = line.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*(===|==)\s*([A-Za-z0-9_.+!-]+)(?:\s*#.*)?$/)
    if (!match) continue
    const name = match[1].toLowerCase().replace(/_/g, '-')
    const version = match[3]
    if (name.length > MAX_DEPENDENCY_NAME_LENGTH || version.length > MAX_DEPENDENCY_VERSION_LENGTH) continue
    result.push({
      name,
      version,
      ecosystem: 'pypi',
      direct: true,
      dependencyType: file.includes('dev') ? 'dev' : 'prod',
      purl: purl('pypi', name, version),
      dependencyPath: [name],
      resolved: EXACT_VERSION.test(version),
    })
  }
  return result
}

function parsePipfileLock(lock: JsonRecord | null, manifest: JsonRecord | null): DependencyRecord[] {
  if (!lock) return []
  const declared = new Map<string, 'prod' | 'dev'>()
  for (const [sectionName, dependencyType] of [['packages', 'prod'], ['dev-packages', 'dev']] as const) {
    const section = manifest?.[sectionName]
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue
    for (const name of Object.keys(section as JsonRecord)) {
      declared.set(name.toLowerCase().replace(/_/g, '-'), dependencyType)
    }
  }

  const result: DependencyRecord[] = []
  for (const sectionName of ['default', 'develop'] as const) {
    const section = lock[sectionName]
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue
    for (const [name, raw] of Object.entries(section as JsonRecord)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
      const versionSpec = (raw as JsonRecord).version
      if (typeof versionSpec !== 'string') continue
      const version = versionSpec.replace(/^===?/, '')
      if (name.length > MAX_DEPENDENCY_NAME_LENGTH || version.length > MAX_DEPENDENCY_VERSION_LENGTH || /[\0\r\n]/.test(name)) continue
      const normalizedName = name.toLowerCase().replace(/_/g, '-')
      const declaredType = declared.get(normalizedName)
      const dependencyType = declaredType ?? 'transitive'
      result.push({
        name: normalizedName,
        version,
        ecosystem: 'pypi',
        direct: Boolean(declaredType),
        dependencyType: declaredType ?? 'transitive',
        purl: purl('pypi', normalizedName, version),
        dependencyPath: [normalizedName],
        resolved: EXACT_VERSION.test(version),
      })
    }
  }
  return result
}

export function collectDependencyInventory(repoDir: string): DependencyInventory {
  const packages = new Map<string, DependencyRecord>()
  const lockfiles: string[] = []
  let complete = true

  const packageManifest = parseJson(readBoundedFile(repoDir, 'package.json'))
  const packageLockPath = ['package-lock.json', 'npm-shrinkwrap.json'].find((file) => fs.existsSync(path.join(repoDir, file)))
  const packageLock = packageLockPath ? parseJson(readBoundedFile(repoDir, packageLockPath)) : null
  if (packageManifest) {
    if (packageLockPath) lockfiles.push(packageLockPath)
    const npm = npmPackages(packageManifest, packageLock)
    npm.records.forEach((record, key) => packages.set(key, record))
    complete &&= npm.complete
  } else if (packageLockPath) {
    complete = false
  }

  for (const file of ['requirements.txt', 'requirements-dev.txt']) {
    const text = readBoundedFile(repoDir, file)
    if (text == null) continue
    lockfiles.push(file)
    complete = false // Requirements files declare constraints; they do not resolve the full transitive tree.
    for (const record of parsePythonRequirements(text, file)) packages.set(`${record.ecosystem}:${record.name}@${record.version}`, record)
  }
  const pipfileManifest = parseJson(readBoundedFile(repoDir, 'Pipfile'))
  const pipfileLock = parseJson(readBoundedFile(repoDir, 'Pipfile.lock'))
  if (pipfileLock) {
    lockfiles.push('Pipfile.lock')
    for (const record of parsePipfileLock(pipfileLock, pipfileManifest)) packages.set(`${record.ecosystem}:${record.name}@${record.version}`, record)
  }

  const allPackages = [...packages.values()].sort((a, b) =>
    a.ecosystem.localeCompare(b.ecosystem) || a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
  )
  const truncated = allPackages.length > MAX_INVENTORY_PACKAGES
  const packageList = allPackages.slice(0, MAX_INVENTORY_PACKAGES)
  return {
    version: 1,
    packages: packageList,
    ecosystems: [...new Set(packageList.map((record) => record.ecosystem))],
    lockfiles,
    directCount: packageList.filter((record) => record.direct).length,
    transitiveCount: packageList.filter((record) => !record.direct).length,
    complete: complete && lockfiles.length > 0 && !truncated,
    truncated,
  }
}

async function readResponseLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('Advisory response exceeded the size budget.')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

function mapAdvisories(raw: JsonRecord): DependencyAdvisory[] {
  const vulnerabilities = Array.isArray(raw.vulnerabilities) ? raw.vulnerabilities as JsonRecord[] : []
  const id = typeof raw.ghsa_id === 'string' ? raw.ghsa_id : typeof raw.id === 'string' ? raw.id : ''
  if (!id) return []
  const references = Array.isArray(raw.references) ? raw.references as JsonRecord[] : []
  const firstUrl = references.find((reference) => typeof reference.url === 'string')?.url
  const rawSeverity = typeof raw.severity === 'string' ? raw.severity.toLowerCase() : 'unknown'
  const severity = rawSeverity === 'moderate' ? 'medium' : rawSeverity

  return vulnerabilities.flatMap((vulnerability) => {
    const packageData = vulnerability.package && typeof vulnerability.package === 'object'
      ? vulnerability.package as JsonRecord
      : null
    const name = typeof packageData?.name === 'string' ? packageData.name : ''
    const ecosystemName = typeof packageData?.ecosystem === 'string' ? packageData.ecosystem.toLowerCase() : ''
    const ecosystem: DependencyEcosystem | null = ecosystemName === 'npm' ? 'npm' : ecosystemName === 'pip' || ecosystemName === 'pypi' ? 'pypi' : null
    if (!name || !ecosystem) return []
    const firstPatched = vulnerability.first_patched_version
    const patched = typeof firstPatched === 'string'
      ? firstPatched
      : firstPatched && typeof firstPatched === 'object'
        ? (firstPatched as JsonRecord).identifier
        : null
    return [{
      id,
      packageName: name,
      ecosystem,
      severity,
      summary: (typeof raw.summary === 'string' ? raw.summary : 'Security advisory')
        .replace(/[\r\n\t]+/g, ' ')
        .slice(0, 1000),
      vulnerableRange: typeof vulnerability.vulnerable_version_range === 'string'
        ? vulnerability.vulnerable_version_range.slice(0, 300)
        : null,
      patchedVersion: typeof patched === 'string' ? patched.slice(0, 100) : null,
      url: typeof firstUrl === 'string' ? firstUrl.slice(0, 500) : null,
    }]
  })
}

export async function lookupDependencyAdvisories(
  packages: DependencyRecord[],
  options: { fetcher?: typeof fetch; timeoutMs?: number; maxPackages?: number } = {}
): Promise<DependencyAdvisoryReport> {
  const checkedAt = new Date().toISOString()
  const exactPackages = packages.filter((pkg) => pkg.resolved && EXACT_VERSION.test(pkg.version))
  if (exactPackages.length === 0) {
    return {
      status: packages.length ? 'unavailable' : 'not_applicable',
      source: 'GitHub Advisory Database',
      checkedAt,
      queriedCount: 0,
      advisoryCount: 0,
      advisories: [],
      ...(packages.length ? { error: 'No exact resolved package versions were available for advisory matching.' } : {}),
    }
  }

  const maxPackages = Math.min(MAX_ADVISORY_PACKAGES, Math.max(1, options.maxPackages ?? MAX_ADVISORY_PACKAGES))
  const selected = exactPackages.slice(0, maxPackages)
  const ecosystems = [...new Set(selected.map((pkg) => pkg.ecosystem))]
  const requestedPackages = new Set(selected.map((pkg) => `${pkg.ecosystem}:${pkg.name.toLowerCase()}`))
  const advisories = new Map<string, DependencyAdvisory>()
  const fetcher = options.fetcher ?? fetch
  const timeoutMs = Math.min(15_000, Math.max(1000, options.timeoutMs ?? 6_000))
  let errors: string[] = []

  for (const ecosystem of ecosystems) {
    const subset = selected.filter((pkg) => pkg.ecosystem === ecosystem)
    const url = new URL(`${'https://api.github.com'}/advisories`)
    url.searchParams.set('ecosystem', ecosystem === 'pypi' ? 'pip' : 'npm')
    url.searchParams.set('per_page', '100')
    for (const pkg of subset) url.searchParams.append('affects[]', `${pkg.name}@${pkg.version}`)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(url.toString(), {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Arbor-App', 'X-GitHub-Api-Version': '2022-11-28' },
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`GitHub Advisory Database returned HTTP ${response.status}.`)
      const rawText = await readResponseLimited(response, MAX_ADVISORY_RESPONSE_BYTES)
      const raw: unknown = rawText ? JSON.parse(rawText) : []
      if (!Array.isArray(raw)) throw new Error('GitHub Advisory Database returned an unexpected response.')
      for (const entry of raw as JsonRecord[]) {
        for (const advisory of mapAdvisories(entry)) {
          if (!requestedPackages.has(`${advisory.ecosystem}:${advisory.packageName.toLowerCase()}`)) continue
          advisories.set(`${advisory.id}:${advisory.ecosystem}:${advisory.packageName}`, advisory)
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message.slice(0, 240) : 'Advisory lookup failed.')
    } finally {
      clearTimeout(timer)
    }
  }

  const results = [...advisories.values()].sort((a, b) => a.severity.localeCompare(b.severity) || a.id.localeCompare(b.id))
  const partial = selected.length < exactPackages.length || exactPackages.length < packages.length
  const failed = errors.length > 0
  return {
    status: failed ? (results.length ? 'partial' : 'unavailable') : partial ? 'partial' : 'complete',
    source: 'GitHub Advisory Database',
    checkedAt,
    queriedCount: selected.length,
    advisoryCount: results.length,
    advisories: results.slice(0, 500),
    ...(errors.length ? { error: errors.join(' ').slice(0, 500) } : {}),
  }
}

export function buildCycloneDxSbom(
  inventory: DependencyInventory,
  advisories: DependencyAdvisoryReport,
  timestamp = new Date().toISOString()
) {
  const advisoriesByPackage = new Map<string, DependencyAdvisory[]>()
  for (const advisory of advisories.advisories) {
    const items = advisoriesByPackage.get(advisory.packageName) ?? []
    items.push(advisory)
    advisoriesByPackage.set(advisory.packageName, items)
  }
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp,
      tools: [{ vendor: 'Arbor', name: 'Arbor Code Health', version: '0.1.0' }],
      properties: [
        { name: 'arbor:dependency-inventory-complete', value: String(inventory.complete) },
        { name: 'arbor:dependency-inventory-truncated', value: String(inventory.truncated) },
        { name: 'arbor:advisory-source', value: advisories.source },
        { name: 'arbor:advisory-status', value: advisories.status },
      ],
    },
    components: inventory.packages.map((pkg) => ({
      type: 'library',
      'bom-ref': pkg.purl,
      name: pkg.name,
      version: pkg.version,
      purl: pkg.purl,
      scope: pkg.direct ? 'required' : 'optional',
      ...(pkg.license ? { licenses: [{ license: { name: pkg.license } }] } : {}),
      properties: [
        { name: 'arbor:ecosystem', value: pkg.ecosystem },
        { name: 'arbor:direct', value: String(pkg.direct) },
        { name: 'arbor:resolved', value: String(pkg.resolved) },
        { name: 'arbor:dependency-type', value: pkg.dependencyType },
        { name: 'arbor:dependency-path', value: pkg.dependencyPath.join(' -> ') },
      ],
    })),
    ...(advisories.advisories.length ? {
      vulnerabilities: advisories.advisories.map((advisory) => ({
        id: advisory.id,
        source: { name: advisories.source, ...(advisory.url ? { url: advisory.url } : {}) },
        ratings: [{ severity: advisory.severity }],
        description: advisory.summary,
        affects: inventory.packages
          .filter((pkg) => pkg.name === advisory.packageName && pkg.ecosystem === advisory.ecosystem)
          .map((pkg) => ({
            ref: pkg.purl,
            versions: [{
              version: pkg.version,
              ...(advisory.vulnerableRange ? { range: { range: advisory.vulnerableRange } } : {}),
              status: 'affected',
            }],
          })),
        ...(advisory.patchedVersion ? { recommendation: `Upgrade to ${advisory.patchedVersion} or a later fixed version.` } : {}),
      })),
    } : {}),
  }
}

export function validateCycloneDxSbom(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const root = value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
  if (!root) return { valid: false, errors: ['SBOM must be a JSON object.'] }
  if (root.bomFormat !== 'CycloneDX' || root.specVersion !== '1.5') errors.push('SBOM format/version must be CycloneDX 1.5.')
  if (!Number.isInteger(root.version) || Number(root.version) < 1) errors.push('SBOM version must be a positive integer.')
  if (typeof root.serialNumber !== 'string' || !/^urn:uuid:[a-f0-9-]{36}$/i.test(root.serialNumber)) errors.push('SBOM serialNumber must be a UUID URN.')
  const metadata = root.metadata && typeof root.metadata === 'object' && !Array.isArray(root.metadata) ? root.metadata as JsonRecord : null
  if (!metadata || typeof metadata.timestamp !== 'string' || !Number.isFinite(Date.parse(metadata.timestamp))) errors.push('SBOM metadata must include an ISO timestamp.')

  const components = Array.isArray(root.components) ? root.components : []
  const refs = new Set<string>()
  for (const [index, raw] of components.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`Component ${index} must be an object.`)
      continue
    }
    const component = raw as JsonRecord
    if (component.type !== 'library' || typeof component.name !== 'string' || !component.name || typeof component.version !== 'string' || !component.version) {
      errors.push(`Component ${index} must have library type, name, and version.`)
    }
    if (typeof component['bom-ref'] !== 'string' || !component['bom-ref'] || refs.has(component['bom-ref'])) {
      errors.push(`Component ${index} must have a unique bom-ref.`)
    } else {
      refs.add(component['bom-ref'])
    }
    if (typeof component.purl !== 'string' || !component.purl.startsWith('pkg:')) errors.push(`Component ${index} must include a package URL.`)
  }

  if (root.vulnerabilities !== undefined && !Array.isArray(root.vulnerabilities)) errors.push('SBOM vulnerabilities must be an array when present.')
  if (Array.isArray(root.vulnerabilities)) {
    for (const [index, raw] of root.vulnerabilities.entries()) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        errors.push(`Vulnerability ${index} must be an object.`)
        continue
      }
      const vulnerability = raw as JsonRecord
      if (typeof vulnerability.id !== 'string' || !vulnerability.id) errors.push(`Vulnerability ${index} must have an identifier.`)
      const affects = Array.isArray(vulnerability.affects) ? vulnerability.affects : []
      if (affects.length === 0) errors.push(`Vulnerability ${index} must reference an affected component.`)
      for (const affected of affects) {
        if (!affected || typeof affected !== 'object' || Array.isArray(affected)) {
          errors.push(`Vulnerability ${index} has an invalid affected component.`)
          continue
        }
        const ref = (affected as JsonRecord).ref
        if (typeof ref !== 'string' || !refs.has(ref)) errors.push(`Vulnerability ${index} references an unknown component.`)
      }
    }
  }
  return { valid: errors.length === 0, errors }
}

export async function analyzeDependencies(
  repoDir: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {}
) {
  const inventory = collectDependencyInventory(repoDir)
  const advisories = await lookupDependencyAdvisories(inventory.packages, options)
  const sbom = buildCycloneDxSbom(inventory, advisories)
  const validation = validateCycloneDxSbom(sbom)
  if (!validation.valid) throw new Error(`Generated CycloneDX SBOM failed structural validation: ${validation.errors.join('; ')}`)
  return { inventory, advisories, sbom }
}
