import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { POLICY_PACKS } from '@/server/analysis/policies'
import { getProjectPolicyState, updatePolicyPack } from '@/server/services/policy'
import { FINDING_TRIAGE_STATUSES, getFindingTriageHistory, listFindingTriage, updateFindingTriage } from '@/server/services/finding-triage'

const packKeySchema = z.enum(['security', 'maintainability', 'accessibility'])
const findingReferenceSchema = z.object({
  id: z.string().min(1).max(200),
  ruleId: z.string().max(160).optional(),
  file: z.string().max(512).optional(),
  title: z.string().min(1).max(240),
})
const overridesSchema = z.record(
  z.string().min(1).max(160),
  z.object({
    enabled: z.boolean().optional(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
  }).strict()
).superRefine((overrides, ctx) => {
  if (Object.keys(overrides).length > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At most 100 rule overrides are allowed.' })
  }
})

export const policyRouter = router({
  available: protectedProcedure.query(() => POLICY_PACKS),

  forProject: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => getProjectPolicyState(ctx.session.user.id, input.slug)),

  update: protectedProcedure
    .input(z.object({
      slug: z.string().min(1).max(100),
      packKey: packKeySchema,
      scope: z.enum(['project', 'workspace']),
      enabled: z.boolean(),
      overrides: overridesSchema,
    }))
    .mutation(({ ctx, input }) => updatePolicyPack({ ...input, userId: ctx.session.user.id })),

  triageList: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => listFindingTriage(ctx.session.user.id, input.slug)),

  triage: protectedProcedure
    .input(z.object({
      slug: z.string().min(1).max(100),
      finding: findingReferenceSchema,
      status: z.enum(FINDING_TRIAGE_STATUSES),
      assigneeId: z.string().max(200).nullable().optional(),
      note: z.string().max(4000).nullable().optional(),
    }))
    .mutation(({ ctx, input }) => updateFindingTriage({ ...input, userId: ctx.session.user.id })),

  triageHistory: protectedProcedure
    .input(z.object({
      slug: z.string().min(1).max(100),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
    }))
    .query(({ ctx, input }) => getFindingTriageHistory(ctx.session.user.id, input.slug, input.fingerprint)),
})
