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
})

export type AppRouter = typeof appRouter
