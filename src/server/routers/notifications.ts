import { z } from 'zod'
import { router, protectedProcedure } from '@/server/trpc'
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '@/server/services/notifications'

export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
    .query(({ ctx, input }) => listNotifications(ctx.session.user.id, input?.limit)),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(200) }))
    .mutation(({ ctx, input }) => markNotificationRead(ctx.session.user.id, input.id)),

  markAllRead: protectedProcedure.mutation(({ ctx }) => markAllNotificationsRead(ctx.session.user.id)),

  preferences: protectedProcedure.query(({ ctx }) => getNotificationPreferences(ctx.session.user.id)),

  updatePreferences: protectedProcedure
    .input(z.object({
      enabled: z.boolean(),
      minimumSeverity: z.enum(['critical', 'warning', 'info']),
      scoreRegressionThreshold: z.number().int().min(1).max(100),
    }))
    .mutation(({ ctx, input }) => updateNotificationPreferences({ ...input, userId: ctx.session.user.id })),
})
