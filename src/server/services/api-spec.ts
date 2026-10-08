import SwaggerParser from '@apidevtools/swagger-parser'
import yaml from 'js-yaml'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import type { OpenAPI, OpenAPIV3 } from 'openapi-types'
import { resolveSafeUrl } from '@/lib/ssrf'
import type { SafeAddress } from '@/lib/ssrf'

export type ParsedEndpoint = {
  method: string
  path: string
  summary: string
  description: string
  operationId: string
  tags: string[]
  parameters: { name: string; in: string; required: boolean; schema: unknown }[]
  requestBody: unknown | null
  responses: { status: string; description: string; schema: unknown }[]
  deprecated: boolean
}

export type ParsedSchema = {
  name: string
  schema: unknown
}

export type ParsedSpec = {
  endpoints: ParsedEndpoint[]
  schemas: ParsedSchema[]
  title: string
  version: string
}

const MAX_RAW_SPEC_BYTES = 1_000_000
const MAX_SPEC_PATHS = 1_000
const MAX_SPEC_ENDPOINTS = 2_000
const MAX_SPEC_SCHEMAS = 2_000

export async function parseOpenApiSpec(rawSpec: string): Promise<ParsedSpec> {
  if (Buffer.byteLength(rawSpec, 'utf8') > MAX_RAW_SPEC_BYTES) {
    throw new Error(`OpenAPI spec exceeds the ${MAX_RAW_SPEC_BYTES.toLocaleString()} byte limit.`)
  }

  let specObj: unknown
  try {
    specObj = JSON.parse(rawSpec)
  } catch {
    try {
      specObj = yaml.load(rawSpec)
    } catch {
      throw new Error('Invalid OpenAPI spec: Failed to parse as JSON or YAML')
    }
  }

  if (!specObj || typeof specObj !== 'object') {
    throw new Error('Invalid OpenAPI spec: Content must be an object')
  }

  const rawPaths = (specObj as { paths?: unknown }).paths
  const rawSchemas = (specObj as { components?: { schemas?: unknown } }).components?.schemas
  if (rawPaths && typeof rawPaths === 'object' && Object.keys(rawPaths).length > MAX_SPEC_PATHS) {
    throw new Error(`OpenAPI spec exceeds the ${MAX_SPEC_PATHS} path limit.`)
  }
  if (rawSchemas && typeof rawSchemas === 'object' && Object.keys(rawSchemas).length > MAX_SPEC_SCHEMAS) {
    throw new Error(`OpenAPI spec exceeds the ${MAX_SPEC_SCHEMAS} schema limit.`)
  }

  // Deep clone to avoid mutating input. External $refs are disabled: validating
  // user-supplied specs must never fetch arbitrary URLs or local files.
  const parsedClone = JSON.parse(JSON.stringify(specObj))
  const api = (await SwaggerParser.validate(parsedClone as OpenAPI.Document, {
    resolve: { external: false },
  })) as OpenAPIV3.Document

  const endpoints: ParsedEndpoint[] = []
  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem) continue
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = (pathItem as Record<string, unknown>)[method] as OpenAPIV3.OperationObject | undefined
      if (!op) continue
      if (endpoints.length >= MAX_SPEC_ENDPOINTS) {
        throw new Error(`OpenAPI spec exceeds the ${MAX_SPEC_ENDPOINTS} operation limit.`)
      }
      endpoints.push({
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? '',
        description: op.description ?? '',
        operationId: op.operationId ?? '',
        tags: op.tags ?? [],
        parameters: ((op.parameters as OpenAPIV3.ParameterObject[]) ?? []).map((p) => ({
          name: p.name,
          in: p.in,
          required: p.required ?? false,
          schema: p.schema ?? {},
        })),
        requestBody: op.requestBody ?? null,
        responses: Object.entries(op.responses ?? {}).map(([status, resp]) => ({
          status,
          description: (resp as OpenAPIV3.ResponseObject).description ?? '',
          schema: (resp as OpenAPIV3.ResponseObject).content?.['application/json']?.schema ?? null,
        })),
        deprecated: op.deprecated ?? false,
      })
    }
  }

  const schemas: ParsedSchema[] = Object.entries(
    (api.components?.schemas as Record<string, unknown>) ?? {}
  ).map(([name, schema]) => ({ name, schema }))

  return {
    endpoints,
    schemas,
    title: api.info?.title ?? 'Untitled API',
    version: api.info?.version ?? '0.0.0',
  }
}

export type CreateApiSpecInput = {
  name: string
  version: string
  type?: 'rest' | 'graphql'
  specFormat?: 'openapi3' | 'openapi2' | 'graphql_schema' | 'manual'
  rawSpec: string
  baseUrls?: { development?: string; staging?: string; production?: string }
}

export async function createApiSpec(projectId: string, data: CreateApiSpecInput) {
  const parsed = await parseOpenApiSpec(data.rawSpec)
  return prisma.apiSpec.create({
    data: {
      projectId,
      name: data.name || parsed.title,
      version: data.version || parsed.version,
      type: data.type ?? 'rest',
      specFormat: data.specFormat ?? 'openapi3',
      rawSpec: data.rawSpec,
      parsedEndpoints: parsed.endpoints as unknown as object,
      parsedSchemas: parsed.schemas as unknown as object,
      baseUrls: (data.baseUrls ?? {}) as object,
      endpointCount: parsed.endpoints.length,
    },
  })
}

export async function updateApiSpec(projectId: string, specId: string, rawSpec: string) {
  const existing = await prisma.apiSpec.findFirst({ where: { id: specId, projectId } })
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
  const parsed = await parseOpenApiSpec(rawSpec)
  return prisma.apiSpec.update({
    where: { id: specId },
    data: {
      rawSpec,
      parsedEndpoints: parsed.endpoints as unknown as object,
      parsedSchemas: parsed.schemas as unknown as object,
      endpointCount: parsed.endpoints.length,
      version: parsed.version,
    },
  })
}

export async function getApiSpec(projectId: string, specId: string) {
  return prisma.apiSpec.findFirst({
    where: { id: specId, projectId },
  })
}

export async function listApiSpecs(projectId: string) {
  return prisma.apiSpec.findMany({
    where: { projectId },
    select: { id: true, name: true, version: true, type: true, endpointCount: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deleteApiSpec(projectId: string, specId: string) {
  const existing = await prisma.apiSpec.findFirst({ where: { id: specId, projectId } })
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
  await prisma.apiSpec.delete({ where: { id: specId } })
}

export type ProxyResponse = {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
}

const MAX_PROXY_REQUEST_BYTES = 1_000_000
const MAX_PROXY_RESPONSE_BYTES = 2_000_000
const MAX_PROXY_HEADERS = 50
const MAX_PROXY_HEADER_VALUE_LENGTH = 8_192
const PROXY_TIMEOUT_MS = 10_000

function pinnedLookup(addresses: SafeAddress[]) {
  return ((_: string, options: any, callback: (...args: any[]) => void) => {
    const requestedFamily = typeof options === 'number' ? options : options?.family ?? 0
    const matching = addresses.filter((record) => !requestedFamily || record.family === requestedFamily)
    if (!matching.length) {
      callback(Object.assign(new Error('No validated address matches the requested address family.'), { code: 'ENOTFOUND' }))
      return
    }
    if (typeof options === 'object' && options?.all) {
      callback(null, matching)
      return
    }
    callback(null, matching[0].address, matching[0].family)
  }) as any
}

function validateProxyHeaders(headers: Record<string, string>): Record<string, string> {
  const entries = Object.entries(headers)
  if (entries.length > MAX_PROXY_HEADERS) throw new Error(`At most ${MAX_PROXY_HEADERS} request headers are allowed.`)

  const blocked = new Set([
    'host', 'cookie', 'set-cookie', 'connection', 'proxy-authorization',
    'content-length', 'transfer-encoding', 'accept-encoding',
  ])
  const safe: Record<string, string> = { 'accept-encoding': 'identity' }
  for (const [name, value] of entries) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) throw new Error('Invalid request header name.')
    if (value.length > MAX_PROXY_HEADER_VALUE_LENGTH || /[\r\n]/.test(value)) {
      throw new Error(`Request header '${name}' is too long or contains invalid characters.`)
    }
    if (!blocked.has(name.toLowerCase())) safe[name] = value
  }
  return safe
}

export async function proxyRequest(
  rawUrl: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<ProxyResponse> {
  const normalizedMethod = method.toUpperCase()
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
    throw new Error('Unsupported proxy method.')
  }
  const bodyBuffer = body == null || normalizedMethod === 'GET' ? undefined : Buffer.from(body, 'utf8')
  if (bodyBuffer && bodyBuffer.byteLength > MAX_PROXY_REQUEST_BYTES) {
    throw new Error(`Request body exceeds the ${MAX_PROXY_REQUEST_BYTES.toLocaleString()} byte proxy limit.`)
  }

  const start = Date.now()
  let dnsTimeoutId: ReturnType<typeof setTimeout> | undefined
  const resolved = await Promise.race([
    resolveSafeUrl(rawUrl),
    new Promise<never>((_, reject) => {
      dnsTimeoutId = setTimeout(() => reject(new Error('DNS validation timed out.')), 5_000)
    }),
  ]).finally(() => {
    if (dnsTimeoutId) clearTimeout(dnsTimeoutId)
  })
  const requestHeaders = validateProxyHeaders(headers)
  if (bodyBuffer) requestHeaders['content-length'] = String(bodyBuffer.byteLength)

  return new Promise<ProxyResponse>((resolve, reject) => {
    let settled = false
    let responseBytes = 0
    const chunks: Buffer[] = []
    const timeoutId = setTimeout(() => request.destroy(new Error('Upstream request timed out.')), PROXY_TIMEOUT_MS)
    const finishError = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      reject(error)
    }

    const requestOptions = {
      protocol: resolved.url.protocol,
      hostname: resolved.hostname,
      port: resolved.url.port ? Number(resolved.url.port) : undefined,
      path: `${resolved.url.pathname}${resolved.url.search}`,
      method: normalizedMethod,
      headers: requestHeaders,
      lookup: pinnedLookup(resolved.addresses),
      servername: net.isIP(resolved.hostname) ? undefined : resolved.hostname,
      agent: false,
      maxHeaderSize: 32 * 1024,
    }
    const requestFn = resolved.url.protocol === 'https:' ? https.request : http.request
    const request = requestFn(requestOptions as any, (response) => {
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        responseBytes += buffer.byteLength
        if (responseBytes > MAX_PROXY_RESPONSE_BYTES) {
          const error = new Error(`Upstream response exceeds the ${MAX_PROXY_RESPONSE_BYTES.toLocaleString()} byte proxy limit.`)
          response.destroy(error)
          request.destroy(error)
          return
        }
        chunks.push(buffer)
      })
      response.on('end', () => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        const responseHeaders: Record<string, string> = {}
        for (const [name, value] of Object.entries(response.headers)) {
          if (name.toLowerCase() === 'set-cookie' || value == null) continue
          responseHeaders[name] = Array.isArray(value) ? value.join(', ') : String(value)
        }
        resolve({
          status: response.statusCode ?? 502,
          statusText: response.statusMessage ?? '',
          headers: responseHeaders,
          body: Buffer.concat(chunks).toString('utf8'),
          durationMs: Date.now() - start,
        })
      })
      response.on('aborted', () => finishError(new Error('Upstream response was interrupted.')))
      response.on('error', finishError)
    })

    request.on('error', finishError)
    request.end(bodyBuffer)
  })
}
