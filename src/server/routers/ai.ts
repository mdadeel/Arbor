import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  explainFinding,
  generateDocSummary,
  generateReleaseNotes,
} from '@/server/services/ai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export const aiRouter = router({
  explainFinding: protectedProcedure
    .input(
      z.object({
        finding: z.object({
          id: z.string(),
          category: z.any(),
          severity: z.any(),
          title: z.string(),
          detail: z.string(),
          file: z.string().optional(),
          line: z.number().optional(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { openaiApiKey: true, anthropicApiKey: true, aiModel: true },
      })

      const apiKey = user?.anthropicApiKey
        ? decrypt(user.anthropicApiKey)
        : user?.openaiApiKey
          ? decrypt(user.openaiApiKey)
          : undefined

      const provider = user?.anthropicApiKey ? 'anthropic' : 'openai'

      return explainFinding(input.finding as any, {
        apiKey,
        provider,
        model: user?.aiModel || undefined,
      })
    }),

  generateSummary: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        content: z.string(),
      })
    )
    .query(async ({ input }) => {
      return generateDocSummary(input.title, input.content)
    }),

  generateReleaseNotes: protectedProcedure
    .input(
      z.object({
        projectName: z.string(),
        commits: z.array(
          z.object({
            message: z.string(),
            author: z.string().optional(),
            sha: z.string().optional(),
          })
        ),
        prs: z.array(
          z.object({
            title: z.string(),
            number: z.number().optional(),
          })
        ),
      })
    )
    .query(async ({ input }) => {
      return generateReleaseNotes(input.projectName, input.commits, input.prs)
    }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        openaiApiKey: z.string().optional(),
        anthropicApiKey: z.string().optional(),
        aiModel: z.string().optional(),
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
