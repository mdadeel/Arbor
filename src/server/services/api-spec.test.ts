import { describe, it, expect } from 'vitest'
import { parseOpenApiSpec } from './api-spec'

const MINIMAL_SPEC = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: { summary: 'List users', operationId: 'listUsers', responses: { '200': { description: 'OK' } } },
      post: { summary: 'Create user', operationId: 'createUser', responses: { '201': { description: 'Created' } } },
    },
    '/users/{id}': {
      get: {
        summary: 'Get user',
        operationId: 'getUser',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
  },
})

describe('parseOpenApiSpec', () => {
  it('extracts endpoints from OpenAPI 3.0 spec', async () => {
    const result = await parseOpenApiSpec(MINIMAL_SPEC)
    expect(result.endpoints).toHaveLength(3)
    expect(result.endpoints[0]).toMatchObject({ method: 'GET', path: '/users', summary: 'List users' })
    expect(result.endpoints[1]).toMatchObject({ method: 'POST', path: '/users', summary: 'Create user' })
    expect(result.endpoints[2]).toMatchObject({ method: 'GET', path: '/users/{id}', summary: 'Get user' })
  })

  it('extracts schemas from components', async () => {
    const specWithSchema = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          User: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
        },
      },
    })
    const result = await parseOpenApiSpec(specWithSchema)
    expect(result.schemas).toHaveLength(1)
    expect(result.schemas[0].name).toBe('User')
  })

  it('parses valid YAML spec', async () => {
    const yamlSpec = `
openapi: "3.0.0"
info:
  title: "YAML API"
  version: "1.2.3"
paths:
  /items:
    get:
      summary: "List items"
      responses:
        "200":
          description: "OK"
`
    const result = await parseOpenApiSpec(yamlSpec)
    expect(result.title).toBe('YAML API')
    expect(result.version).toBe('1.2.3')
    expect(result.endpoints).toHaveLength(1)
    expect(result.endpoints[0].method).toBe('GET')
    expect(result.endpoints[0].path).toBe('/items')
  })

  it('rejects invalid spec', async () => {
    await expect(parseOpenApiSpec('not valid json at all: [ {')).rejects.toThrow()
  })
})
