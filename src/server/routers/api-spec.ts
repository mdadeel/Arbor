import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/server/trpc'
import { checkRateLimit } from '@/lib/redis'
import { requireAccessibleProject, requireProjectEditor } from '@/server/services/project-access'
import {
  createApiSpec,
  updateApiSpec,
  getApiSpec,
  listApiSpecs,
  deleteApiSpec,
  proxyRequest,
} from '@/server/services/api-spec'

async function requireProjectId(userId: string, slug: string, write = false) {
  const project = await requireAccessibleProject(userId, slug)
  if (write) await requireProjectEditor(userId, project)
  return project.id
}

async function enforceSpecUploadLimit(userId: string): Promise<void> {
  const { allowed } = await checkRateLimit(`rate:api-spec:${userId}`, 30, 3600)
  if (!allowed) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'OpenAPI import limit reached for this hour.' })
  }
}

export const apiSpecRouter = router({
  list: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const projectId = await requireProjectId(ctx.session.user.id, input.slug)
      return listApiSpecs(projectId)
    }),

  get: protectedProcedure
    .input(z.object({ slug: z.string(), specId: z.string() }))
    .query(async ({ ctx, input }) => {
      const projectId = await requireProjectId(ctx.session.user.id, input.slug)
      return getApiSpec(projectId, input.specId)
    }),

  create: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        name: z.string().min(1).max(200),
        version: z.string().max(50).default('1.0.0'),
        rawSpec: z.string().min(1).max(1_000_000),
        type: z.enum(['rest', 'graphql']).default('rest'),
        specFormat: z.enum(['openapi3', 'openapi2', 'graphql_schema', 'manual']).default('openapi3'),
        baseUrls: z
          .object({
            development: z.string().url().optional(),
            staging: z.string().url().optional(),
            production: z.string().url().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProjectId(ctx.session.user.id, input.slug, true)
      await enforceSpecUploadLimit(ctx.session.user.id)
      return createApiSpec(projectId, input)
    }),

  update: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        specId: z.string(),
        rawSpec: z.string().min(1).max(1_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProjectId(ctx.session.user.id, input.slug, true)
      await enforceSpecUploadLimit(ctx.session.user.id)
      return updateApiSpec(projectId, input.specId, input.rawSpec)
    }),

  delete: protectedProcedure
    .input(z.object({ slug: z.string(), specId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProjectId(ctx.session.user.id, input.slug, true)
      return deleteApiSpec(projectId, input.specId)
    }),

  proxy: protectedProcedure
    .input(
      z.object({
        url: z.string().url().max(2048),
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
        headers: z.record(z.string().max(8192)).default({}).refine((headers) => Object.keys(headers).length <= 50, {
          message: 'At most 50 request headers are allowed.',
        }),
        body: z.string().max(1_000_000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { allowed } = await checkRateLimit(`rate:api-proxy:${ctx.session.user.id}`, 60, 3600)
      if (!allowed) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'API proxy request limit reached for this hour.' })
      }
      return proxyRequest(input.url, input.method, input.headers, input.body)
    }),
})
