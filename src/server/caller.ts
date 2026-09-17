import { appRouter } from '@/server/routers/_app'
import { createTRPCContext } from '@/server/trpc'

export async function getServerCaller() {
  const ctx = await createTRPCContext()
  return appRouter.createCaller(ctx)
}
