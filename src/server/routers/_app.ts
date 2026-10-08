import { router } from '@/server/trpc'
import { healthRouter } from './health'
import { githubRouter } from './github'
import { projectRouter } from './project'
import { environmentRouter } from './environment'
import { apiSpecRouter } from './api-spec'
import { documentRouter } from './document'
import { searchRouter } from './search'
import { workspaceRouter } from './workspace'
import { auditRouter } from './audit'
import { aiRouter } from './ai'
import { systemRouter } from './system'
import { adminRouter } from './admin'
import { policyRouter } from './policy'
import { insightsRouter } from './insights'
import { notificationsRouter } from './notifications'
import { shareRouter } from './share'
import { patchSuggestionRouter } from './patch-suggestions'

export const appRouter = router({
  health: healthRouter,
  github: githubRouter,
  project: projectRouter,
  environment: environmentRouter,
  apiSpec: apiSpecRouter,
  document: documentRouter,
  search: searchRouter,
  workspace: workspaceRouter,
  audit: auditRouter,
  ai: aiRouter,
  system: systemRouter,
  admin: adminRouter,
  policy: policyRouter,
  insights: insightsRouter,
  notifications: notificationsRouter,
  share: shareRouter,
  patchSuggestion: patchSuggestionRouter,
})

export type AppRouter = typeof appRouter
