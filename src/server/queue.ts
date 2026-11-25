import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { env } from '@/lib/env'

export interface AnalyzeJob {
  analysisId: string
}

export interface SystemAnalysisJob {
  systemAnalysisId: string
}

// Producers are used in HTTP requests and reconciliation, so a disconnected
// Redis must fail promptly. Workers retain their separate blocking connections.
function createProducer<T>(name: string, invalidate: () => void): Queue<T> {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2_500,
    commandTimeout: 5_000,
    retryStrategy: (attempt) => attempt <= 3 ? attempt * 250 : null,
  })
  const producer = new Queue<T>(name, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5_000 },
      removeOnComplete: 1000,
      removeOnFail: 500,
    },
  })
  producer.on('error', () => {
    console.warn(`[queue] ${name} Redis connection unavailable`)
    // Disconnect the underlying client directly: Queue.disconnect() waits for
    // initialization and can itself hang during a failed initial connection.
    connection.disconnect()
    invalidate()
  })
  return producer
}

let queue: Queue<AnalyzeJob> | null = null
export function getAnalysisQueue(): Queue<AnalyzeJob> {
  if (!queue) {
    const producer = createProducer<AnalyzeJob>('analysis', () => {
      if (queue === producer) queue = null
    })
    queue = producer
  }
  return queue
}

let systemQueue: Queue<SystemAnalysisJob> | null = null
export function getSystemAnalysisQueue(): Queue<SystemAnalysisJob> {
  if (!systemQueue) {
    const producer = createProducer<SystemAnalysisJob>('system-analysis', () => {
      if (systemQueue === producer) systemQueue = null
    })
    systemQueue = producer
  }
  return systemQueue
}
