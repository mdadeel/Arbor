import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRedisClient } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const PROBE_TIMEOUT_MS = 2_500

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Health check timed out')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function checkDatabase(): Promise<'ok' | 'error'> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, PROBE_TIMEOUT_MS)
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkRedis(): Promise<'ok' | 'error'> {
  try {
    const redis = getRedisClient()
    if (redis.status === 'wait') {
      await withTimeout(redis.connect(), PROBE_TIMEOUT_MS)
    }
    const pong = await withTimeout(redis.ping(), PROBE_TIMEOUT_MS)
    return pong === 'PONG' ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

export async function GET(req: NextRequest) {
  const probe = req.nextUrl.searchParams.get('probe')
  if (probe === 'liveness') {
    return NextResponse.json(
      {
        status: 'ok',
        service: 'arbor',
        mode: 'liveness',
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }

  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()])
  const healthy = database === 'ok' && redis === 'ok'

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'arbor',
      checks: {
        database,
        redis,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
