import { router } from '@/server/trpc'
import { healthRouter } from './health'
import { githubRouter } from './github'
import { projectRouter } from './project'

export const appRouter = router({
  health: healthRouter,
  github: githubRouter,
  project: projectRouter,
})

export type AppRouter = typeof appRouter
