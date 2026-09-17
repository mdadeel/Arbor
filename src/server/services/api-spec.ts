import SwaggerParser from '@apidevtools/swagger-parser'
import yaml from 'js-yaml'
import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import type { OpenAPI, OpenAPIV3 } from 'openapi-types'

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

export async function parseOpenApiSpec(rawSpec: string): Promise<ParsedSpec> {
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

  // Deep clone to avoid mutating input
  const parsedClone = JSON.parse(JSON.stringify(specObj))
  const api = (await SwaggerParser.validate(parsedClone as OpenAPI.Document)) as OpenAPIV3.Document

  const endpoints: ParsedEndpoint[] = []
  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem) continue
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = (pathItem as Record<string, unknown>)[method] as OpenAPIV3.OperationObject | undefined
      if (!op) continue
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

export async function proxyRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<ProxyResponse> {
  const start = Date.now()
  const resp = await fetch(url, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : body,
  })
  const durationMs = Date.now() - start
  const respBody = await resp.text()
  const respHeaders: Record<string, string> = {}
  resp.headers.forEach((v, k) => { respHeaders[k] = v })
  delete respHeaders['set-cookie']
  return { status: resp.status, statusText: resp.statusText, headers: respHeaders, body: respBody, durationMs }
}
