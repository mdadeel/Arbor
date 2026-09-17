import { Queue } from 'bullmq'
import { env } from '@/lib/env'

export interface AnalyzeJob {
  analysisId: string
}

let queue: Queue<AnalyzeJob> | null = null

export function getAnalysisQueue(): Queue<AnalyzeJob> {
  if (!queue) {
    queue = new Queue<AnalyzeJob>('analysis', {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5_000 },
        removeOnComplete: 1000,
        removeOnFail: 500,
      },
    })
  }
  return queue
}