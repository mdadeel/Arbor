import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/server/trpc'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/server/services/project'
import {
  createApiSpec,
  updateApiSpec,
  getApiSpec,
  listApiSpecs,
  deleteApiSpec,
  proxyRequest,
} from '@/server/services/api-spec'

async function requireProject(userId: string, slug: string) {
  const project = await prisma.project.findUnique({
    where: { userId_slug: { userId, slug: slugify(slug) } },
    select: { id: true },
  })
  if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
  return project.id
}

export const apiSpecRouter = router({
  list: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return listApiSpecs(projectId)
    }),

  get: protectedProcedure
    .input(z.object({ slug: z.string(), specId: z.string() }))
    .query(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return getApiSpec(projectId, input.specId)
    }),

  create: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        name: z.string().min(1).max(200),
        version: z.string().max(50).default('1.0.0'),
        rawSpec: z.string().min(1).max(5_000_000),
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
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return createApiSpec(projectId, input)
    }),

  update: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        specId: z.string(),
        rawSpec: z.string().min(1).max(5_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return updateApiSpec(projectId, input.specId, input.rawSpec)
    }),

  delete: protectedProcedure
    .input(z.object({ slug: z.string(), specId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await requireProject(ctx.session.user.id, input.slug)
      return deleteApiSpec(projectId, input.specId)
    }),

  proxy: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
        headers: z.record(z.string()).default({}),
        body: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return proxyRequest(input.url, input.method, input.headers, input.body)
    }),
})
