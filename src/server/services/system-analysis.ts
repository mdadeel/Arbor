/**
 * System Analysis Engine — Cross-Repository Correlation & Contract Matching
 *
 * Correlates multiple member repositories (e.g. Frontend + Backend)
 * to evaluate API contract integrity, route drift, environment parity,
 * and unified fullstack architecture graphs.
 */

export interface ApiEndpoint {
  path: string
  method: string
  source: string // e.g. "openapi" | "route_handler" | "controller"
  file?: string
  line?: number
}

export interface FrontendCallSite {
  path: string
  method: string
  source: string // e.g. "fetch" | "axios" | "trpc" | "api_client"
  file?: string
  line?: number
}

export type ContractStatus = 'connected' | 'broken' | 'orphaned' | 'method_mismatch'

export interface ContractItem {
  id: string
  path: string
  method: string
  status: ContractStatus
  frontendFile?: string
  frontendLine?: number
  backendFile?: string
  backendLine?: number
  detail?: string
}

export interface EnvParityIssue {
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
}

export interface EnvParityResult {
  score: number
  issues: EnvParityIssue[]
  frontendApiUrl?: string | null
  backendPort?: string | null
  backendCorsOrigins?: string[]
}

export interface SystemGraphNode {
  id: string
  label: string
  type: 'frontend' | 'backend' | 'gateway'
  fileCount: number
}

export interface SystemGraphEdge {
  id: string
  source: string
  target: string
  label?: string
  isCrossBoundary?: boolean
}

export interface SystemGraphResult {
  nodes: SystemGraphNode[]
  edges: SystemGraphEdge[]
}

export interface SystemScoreResult {
  overall: number
  frontendScore: number
  backendScore: number
  contractScore: number
  envScore: number
}

export interface SystemAnalysisReport {
  overallScore: number
  contractScore: number
  envScore: number
  frontendScore: number
  backendScore: number
  contractMatrix: {
    total: number
    connected: number
    broken: number
    orphaned: number
    methodMismatch: number
    items: ContractItem[]
  }
  envDrift: EnvParityResult
  systemGraph: SystemGraphResult
  findings: Array<{
    id: string
    category: 'api_contract' | 'environment' | 'architecture'
    severity: 'critical' | 'warning' | 'info'
    title: string
    detail: string
    file?: string
    line?: number
  }>
}

/**
 * Normalizes an API path for robust cross-repo matching.
 * Handles parameters: /users/:id or /users/[id] => /users/{param}
 * Trims leading/trailing slashes and strips query parameters.
 */
export function normalizeApiPath(rawPath: string): string {
  if (!rawPath) return '/'

  // Strip query string and fragment
  let path = rawPath.split('?')[0].split('#')[0].trim()

  // Ensure leading slash
  if (!path.startsWith('/')) {
    path = '/' + path
  }

  // Remove trailing slash if length > 1
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  // Normalize path parameters:
  // :id -> {param}
  // [id] or [...id] -> {param}
  // {id} -> {param}
  // Concrete numeric/UUID/mongo IDs -> {param}
  path = path
    .replace(/\/:\w+/g, '/{param}')
    .replace(/\/\[\.{0,3}\w+\]/g, '/{param}')
    .replace(/\/\{[^\}]+\}/g, '/{param}')
    .replace(
      /\/([0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)(?=\/|$)/gi,
      '/{param}'
    )

  return path.toLowerCase()
}

/**
 * Normalizes HTTP method to uppercase (default GET).
 */
export function normalizeMethod(method?: string): string {
  return (method ?? 'GET').trim().toUpperCase()
}

/**
 * Matches backend endpoints with frontend API call sites.
 */
export function matchApiContracts(
  backendEndpoints: ApiEndpoint[],
  frontendCallSites: FrontendCallSite[],
  apiPrefix?: string | null
): {
  total: number
  connected: number
  broken: number
  orphaned: number
  methodMismatch: number
  items: ContractItem[]
} {
  const items: ContractItem[] = []
  const normalizedPrefix = apiPrefix ? normalizeApiPath(apiPrefix) : null

  // Map of normalized backend endpoints
  // Key: normalizedPath
  const backendMap = new Map<string, ApiEndpoint[]>()
  for (const ep of backendEndpoints) {
    const norm = normalizeApiPath(ep.path)
    const list = backendMap.get(norm) ?? []
    list.push(ep)
    backendMap.set(norm, list)
  }

  // Track which backend endpoints get matched
  const matchedBackendSet = new Set<string>()

  // 1. Process Frontend Call Sites
  const processedFrontendKeys = new Set<string>()

  for (const call of frontendCallSites) {
    const normCallPath = normalizeApiPath(call.path)
    const callMethod = normalizeMethod(call.method)
    const key = `${callMethod} ${normCallPath}`

    if (processedFrontendKeys.has(key)) continue
    processedFrontendKeys.add(key)

    // Check direct match or prefixed match
    let candidates = backendMap.get(normCallPath)

    if (!candidates && normalizedPrefix && normCallPath.startsWith(normalizedPrefix)) {
      // Try stripping prefix: /api/v1/users -> /users
      const stripped = normCallPath.slice(normalizedPrefix.length) || '/'
      candidates = backendMap.get(stripped)
    } else if (!candidates && normalizedPrefix && !normCallPath.startsWith(normalizedPrefix)) {
      // Try adding prefix: /users -> /api/users
      const prefixed = `${normalizedPrefix}${normCallPath}`
      candidates = backendMap.get(prefixed)
    }

    if (!candidates || candidates.length === 0) {
      // BROKEN CALL: Frontend calls route that does not exist in backend
      items.push({
        id: `broken-${items.length + 1}`,
        path: call.path,
        method: callMethod,
        status: 'broken',
        frontendFile: call.file,
        frontendLine: call.line,
        detail: `Frontend calls '${callMethod} ${call.path}', but this endpoint is not found in backend.`,
      })
    } else {
      // Path candidate found, check method
      const exactMethodMatch = candidates.find(
        (c) => normalizeMethod(c.method) === callMethod
      )

      if (exactMethodMatch) {
        // CONNECTED
        matchedBackendSet.add(`${normalizeMethod(exactMethodMatch.method)} ${normalizeApiPath(exactMethodMatch.path)}`)
        items.push({
          id: `conn-${items.length + 1}`,
          path: exactMethodMatch.path,
          method: callMethod,
          status: 'connected',
          frontendFile: call.file,
          frontendLine: call.line,
          backendFile: exactMethodMatch.file,
          backendLine: exactMethodMatch.line,
          detail: 'Contract verified: route defined and actively called.',
        })
      } else {
        // METHOD MISMATCH
        items.push({
          id: `mismatch-${items.length + 1}`,
          path: call.path,
          method: callMethod,
          status: 'method_mismatch',
          frontendFile: call.file,
          frontendLine: call.line,
          backendFile: candidates[0].file,
          backendLine: candidates[0].line,
          detail: `Frontend sends '${callMethod}', but backend expects '${candidates.map((c) => c.method).join(', ')}'.`,
        })
      }
    }
  }

  // 2. Identify ORPHANED Backend Endpoints (Defined in backend, never called by frontend)
  for (const ep of backendEndpoints) {
    const norm = normalizeApiPath(ep.path)
    const method = normalizeMethod(ep.method)
    const key = `${method} ${norm}`

    if (!matchedBackendSet.has(key)) {
      items.push({
        id: `orph-${items.length + 1}`,
        path: ep.path,
        method,
        status: 'orphaned',
        backendFile: ep.file,
        backendLine: ep.line,
        detail: 'Backend endpoint is defined but has no detected frontend call sites (dead or external route).',
      })
    }
  }

  const connected = items.filter((i) => i.status === 'connected').length
  const broken = items.filter((i) => i.status === 'broken').length
  const orphaned = items.filter((i) => i.status === 'orphaned').length
  const methodMismatch = items.filter((i) => i.status === 'method_mismatch').length

  return {
    total: items.length,
    connected,
    broken,
    orphaned,
    methodMismatch,
    items,
  }
}

/**
 * Checks environment variable parity between frontend and backend.
 */
export function checkEnvironmentParity(
  frontendEnvKeys: string[],
  backendEnvKeys: string[]
): EnvParityResult {
  const issues: EnvParityIssue[] = []
  let score = 100

  const hasFrontendApiUrl = frontendEnvKeys.some((k) =>
    /(api.*url|api.*endpoint|backend.*url|server.*url|^api_url$|(^|_)base_url)/i.test(k)
  )

  if (!hasFrontendApiUrl) {
    score -= 20
    issues.push({
      severity: 'warning',
      title: 'Missing Frontend API Base URL Variable',
      detail:
        'Frontend does not declare an API URL environment variable (e.g. NEXT_PUBLIC_API_URL or VITE_API_URL). Hardcoded URLs risk breaking in production.',
    })
  }

  const hasBackendCors = backendEnvKeys.some((k) =>
    /cors|origin|client.*url/i.test(k)
  )

  if (!hasBackendCors) {
    score -= 15
    issues.push({
      severity: 'info',
      title: 'No CORS Origin Configuration Variable',
      detail:
        'Backend has no explicit CORS origin configuration variable (e.g. CORS_ORIGIN, ALLOWED_ORIGINS). Verify that browser cross-origin requests are permitted.',
    })
  }

  return {
    score: Math.max(20, score),
    issues,
  }
}

/**
 * Builds a unified fullstack React Flow architecture graph combining frontend and backend modules.
 */
export function buildFullstackGraph(
  frontendModules: Array<{ id: string; label: string; fileCount: number }>,
  frontendEdges: Array<{ id: string; source: string; target: string; count: number }>,
  backendModules: Array<{ id: string; label: string; fileCount: number }>,
  backendEdges: Array<{ id: string; source: string; target: string; count: number }>,
  connectedRouteCount: number
): SystemGraphResult {
  const nodes: SystemGraphNode[] = []
  const edges: SystemGraphEdge[] = []

  // Add frontend modules
  for (const m of frontendModules) {
    nodes.push({
      id: `fe:${m.id}`,
      label: `[Client] ${m.label}`,
      type: 'frontend',
      fileCount: m.fileCount,
    })
  }

  for (const e of frontendEdges) {
    edges.push({
      id: `fe:${e.id}`,
      source: `fe:${e.source}`,
      target: `fe:${e.target}`,
      label: e.count > 1 ? String(e.count) : undefined,
    })
  }

  // Add backend modules
  for (const m of backendModules) {
    nodes.push({
      id: `be:${m.id}`,
      label: `[Server] ${m.label}`,
      type: 'backend',
      fileCount: m.fileCount,
    })
  }

  for (const e of backendEdges) {
    edges.push({
      id: `be:${e.id}`,
      source: `be:${e.source}`,
      target: `be:${e.target}`,
      label: e.count > 1 ? String(e.count) : undefined,
    })
  }

  // Find bridge modules for cross-repo connection
  const frontendApiNode =
    frontendModules.find((m) => /api|service|lib|client|fetch/i.test(m.label)) ??
    frontendModules[0]

  const backendRouteNode =
    backendModules.find((m) => /route|controller|api|handler/i.test(m.label)) ??
    backendModules[0]

  if (frontendApiNode && backendRouteNode) {
    edges.push({
      id: 'bridge:http-network-boundary',
      source: `fe:${frontendApiNode.id}`,
      target: `be:${backendRouteNode.id}`,
      label: `${connectedRouteCount} API Routes (HTTP)`,
      isCrossBoundary: true,
    })
  }

  return { nodes, edges }
}

/**
 * Calculates composite system scores and findings.
 */
export function calculateSystemScore(
  frontendOverall: number | null | undefined,
  backendOverall: number | null | undefined,
  contractResult: { total: number; connected: number; broken: number; methodMismatch: number },
  envScore: number
): SystemScoreResult {
  const feScore = frontendOverall ?? 70
  const beScore = backendOverall ?? 70

  let contractScore = 100
  if (contractResult.total > 0) {
    // Heavy penalty for broken calls (-15 per broken, -10 per mismatch)
    const penalties =
      contractResult.broken * 15 + contractResult.methodMismatch * 10
    const ratio = (contractResult.connected / contractResult.total) * 100
    contractScore = Math.max(10, Math.round(ratio - penalties))
  }

  // Composite weighted formula:
  // 35% Frontend + 35% Backend + 20% Contract Integrity + 10% Env Parity
  const overall = Math.round(
    feScore * 0.35 + beScore * 0.35 + contractScore * 0.2 + envScore * 0.1
  )

  return {
    overall: Math.min(100, Math.max(10, overall)),
    frontendScore: feScore,
    backendScore: beScore,
    contractScore,
    envScore,
  }
}
