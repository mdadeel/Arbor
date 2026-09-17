import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import { listAuditLogs } from '@/server/services/audit'

export const auditRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return listAuditLogs(ctx.session.user.id, input)
    }),
})
