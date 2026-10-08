import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  explainFinding,
  generateDocSummary,
  generateReleaseNotes,
} from '@/server/services/ai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { checkRateLimit } from '@/lib/redis'

const FINDING_CATEGORIES = [
  'structure',
  'techDebt',
  'performance',
  'documentation',
  'security',
  'environment',
  'designSystem',
  'accessibility',
  'analysis',
] as const

async function enforceAiRateLimit(userId: string) {
  const { allowed } = await checkRateLimit(`rate:ai:${userId}`, 20, 3600)
  if (!allowed) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'AI request limit reached for this hour.' })
  }
}

export const aiRouter = router({
  explainFinding: protectedProcedure
    .input(
      z.object({
        finding: z.object({
          id: z.string().min(1).max(200),
          ruleId: z.string().max(160).optional(),
          category: z.enum(FINDING_CATEGORIES),
          severity: z.enum(['info', 'warning', 'critical']),
          title: z.string().min(1).max(240),
          detail: z.string().max(4_000),
          explanation: z.string().max(4_000).optional(),
          impact: z.string().max(4_000).optional(),
          recommendation: z.string().max(4_000).optional(),
          file: z.string().max(512).optional(),
          line: z.number().int().positive().max(10_000_000).optional(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      await enforceAiRateLimit(ctx.session.user.id)
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { openaiApiKey: true, anthropicApiKey: true, aiModel: true },
      })

      const model = user?.aiModel || 'gpt-4o'
      const provider = model.startsWith('claude-') ? 'anthropic' : 'openai'
      const encryptedKey = provider === 'anthropic' ? user?.anthropicApiKey : user?.openaiApiKey
      const apiKey = encryptedKey ? decrypt(encryptedKey) : undefined

      return explainFinding(input.finding, { apiKey, provider, model })
    }),

  generateSummary: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(50_000),
      })
    )
    .query(async ({ ctx, input }) => {
      await enforceAiRateLimit(ctx.session.user.id)
      return generateDocSummary(input.title, input.content)
    }),

  generateReleaseNotes: protectedProcedure
    .input(
      z.object({
        projectName: z.string().min(1).max(200),
        commits: z.array(
          z.object({
            message: z.string().max(2_000),
            author: z.string().max(200).optional(),
            sha: z.string().max(64).optional(),
          })
        ).max(100),
        prs: z.array(
          z.object({
            title: z.string().max(1_000),
            number: z.number().int().positive().max(1_000_000).optional(),
          })
        ).max(100),
      })
    )
    .query(async ({ ctx, input }) => {
      await enforceAiRateLimit(ctx.session.user.id)
      return generateReleaseNotes(input.projectName, input.commits, input.prs)
    }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        openaiApiKey: z.string().max(4_096).optional(),
        anthropicApiKey: z.string().max(4_096).optional(),
        aiModel: z.enum([
          'gpt-4o',
          'gpt-4o-mini',
          'claude-3-5-sonnet-20240620',
          'claude-3-haiku-20240307',
        ]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { encrypt } = await import('@/lib/crypto')
      const data: Record<string, string | null> = {}

      if (input.openaiApiKey !== undefined) {
        data.openaiApiKey = input.openaiApiKey.trim()
          ? encrypt(input.openaiApiKey.trim())
          : null
      }
      if (input.anthropicApiKey !== undefined) {
        data.anthropicApiKey = input.anthropicApiKey.trim()
          ? encrypt(input.anthropicApiKey.trim())
          : null
      }
      if (input.aiModel !== undefined) {
        data.aiModel = input.aiModel
      }

      await prisma.user.update({
        where: { id: ctx.session.user.id },
        data,
      })

      return { success: true }
    }),
})
