import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingWebhookStatus, SubscriptionStatus, WorkspacePlan } from '@prisma/client'

const { eventsStore, upsertSpy, envMock } = vi.hoisted(() => {
  const events = new Map<string, { status: BillingWebhookStatus; updatedAt: Date }>()
  const upsert = vi.fn().mockResolvedValue({ id: 'sub-1' })
  const dynamicWebhookKey = globalThis.crypto.randomUUID()
  return {
    eventsStore: events,
    upsertSpy: upsert,
    envMock: {
      APP_URL: 'https://arbor.example.com',
      LEMONSQUEEZY_API_KEY: '',
      LEMONSQUEEZY_STORE_ID: '',
      LEMONSQUEEZY_TEAMS_VARIANT_ID: '',
      LEMONSQUEEZY_WEBHOOK_SECRET: dynamicWebhookKey,
    },
  }
})

vi.mock('@/lib/env', () => ({
  env: envMock,
  billingConfigured: false,
}))

vi.mock('@/server/services/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/prisma', () => {
  const baseDb = {
    billingWebhookEvent: {
      findUnique: vi.fn(async ({ where }: { where: { deliveryKey: string } }) => {
        return eventsStore.get(where.deliveryKey) ?? null
      }),
      create: vi.fn(async ({ data }: { data: { deliveryKey: string; status: BillingWebhookStatus } }) => {
        eventsStore.set(data.deliveryKey, { status: data.status, updatedAt: new Date() })
        return { id: 'evt-1', ...data }
      }),
      update: vi.fn(async ({ where, data }: { where: { deliveryKey: string }; data: { status: BillingWebhookStatus } }) => {
        eventsStore.set(where.deliveryKey, { status: data.status, updatedAt: new Date() })
        return { id: 'evt-1', ...data }
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    workspace: {
      findUnique: vi.fn(async () => ({ id: 'ws-route-1', ownerId: 'owner-1' })),
      update: vi.fn(async ({ data }: { data: { plan: WorkspacePlan } }) => ({ id: 'ws-route-1', plan: data.plan })),
    },
    workspaceSubscription: {
      findUnique: vi.fn(async () => null),
      upsert: upsertSpy,
    },
  }
  const db = {
    ...baseDb,
    $transaction: vi.fn(async <T>(cb: (tx: typeof baseDb) => Promise<T>): Promise<T> => cb(baseDb)),
  }
  return { prisma: db }
})

import { POST } from './route'

describe('POST /api/webhooks/lemonsqueezy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventsStore.clear()
  })

  it('processes valid signed webhook once and treats second identical POST as idempotent duplicate', async () => {
    const body = JSON.stringify({
      meta: {
        event_name: 'subscription_created',
        custom_data: { workspace_id: 'ws-route-1' },
      },
      data: {
        id: 'sub_route_42',
        type: 'subscriptions',
        attributes: {
          status: 'active' satisfies SubscriptionStatus,
          cancelled: false,
          renews_at: '2026-11-28T00:00:00.000Z',
        },
      },
    })
    const signature = crypto
      .createHmac('sha256', envMock.LEMONSQUEEZY_WEBHOOK_SECRET)
      .update(body, 'utf8')
      .digest('hex')

    const req1 = new Request('http://localhost:3000/api/webhooks/lemonsqueezy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature': signature,
      },
      body,
    })

    const res1 = await POST(req1)
    expect(res1.status).toBe(200)
    const json1: unknown = await res1.json()
    expect(json1).toMatchObject({ accepted: true, plan: 'teams', subscriptionStatus: 'active' })
    expect(upsertSpy).toHaveBeenCalledTimes(1)

    const req2 = new Request('http://localhost:3000/api/webhooks/lemonsqueezy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature': signature,
      },
      body,
    })

    const res2 = await POST(req2)
    expect(res2.status).toBe(200)
    const json2: unknown = await res2.json()
    expect(json2).toEqual({ accepted: true, duplicate: true })
    expect(upsertSpy).toHaveBeenCalledTimes(1)
  })

  it('returns 401 when X-Signature header is missing or invalid', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/lemonsqueezy', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': 'invalid' },
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('returns 413 when content-length exceeds 256 KB', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/lemonsqueezy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(300 * 1024),
      },
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(413)
  })
})
