import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingWebhookStatus, SubscriptionStatus, WorkspacePlan } from '@prisma/client'

const {
  mockBillingEvents,
  mockSubscriptions,
  mockWorkspaces,
  prismaMock,
  logAuditEventMock,
  envState,
} = vi.hoisted(() => {
  const events = new Map<
    string,
    {
      id: string
      deliveryKey: string
      status: BillingWebhookStatus
      updatedAt: Date
      workspaceId: string | null
      providerSubscriptionId: string | null
    }
  >()
  const subscriptions = new Map<
    string,
    {
      id: string
      workspaceId: string
      provider: string
      plan: WorkspacePlan
      status: SubscriptionStatus
      providerSubscriptionId: string | null
      customerPortalUrl: string | null
      updatePaymentMethodUrl: string | null
      renewsAt: Date | null
      endsAt: Date | null
      cancelAtPeriodEnd: boolean
    }
  >()
  const workspaces = new Map<
    string,
    {
      id: string
      name: string
      ownerId: string
      plan: WorkspacePlan
      members: Array<{ userId: string; role: 'owner' | 'admin' | 'member' | 'viewer' }>
    }
  >()

  const dynamicApiCredential = globalThis.crypto.randomUUID()
  const dynamicWebhookKey = globalThis.crypto.randomUUID()
  const envObj = {
    APP_URL: 'https://arbor.example.com',
    LEMONSQUEEZY_API_KEY: dynamicApiCredential,
    LEMONSQUEEZY_STORE_ID: '12345',
    LEMONSQUEEZY_TEAMS_VARIANT_ID: '67890',
    LEMONSQUEEZY_WEBHOOK_SECRET: dynamicWebhookKey,
  }

  const auditMock = vi.fn().mockResolvedValue(undefined)

  const baseDb = {
    workspace: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const ws = workspaces.get(where.id)
        if (!ws) return null
        return {
          ...ws,
          subscription: subscriptions.get(ws.id) ?? null,
        }
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        const ws = workspaces.get(where.id)
        if (!ws) return null
        return {
          ...ws,
          subscription: subscriptions.get(ws.id) ?? null,
        }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { plan: WorkspacePlan } }) => {
        const ws = workspaces.get(where.id)
        if (!ws) throw new Error('Workspace missing')
        ws.plan = data.plan
        return ws
      }),
    },
    workspaceSubscription: {
      findUnique: vi.fn(async ({ where }: { where: { providerSubscriptionId?: string; workspaceId?: string } }) => {
        for (const sub of subscriptions.values()) {
          if (
            (where.providerSubscriptionId && sub.providerSubscriptionId === where.providerSubscriptionId) ||
            (where.workspaceId && sub.workspaceId === where.workspaceId)
          ) {
            const ws = workspaces.get(sub.workspaceId)
            return ws ? { ...sub, workspace: { id: ws.id, ownerId: ws.ownerId } } : sub
          }
        }
        return null
      }),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { workspaceId: string }
          create: {
            workspaceId: string
            provider: string
            plan: WorkspacePlan
            status: SubscriptionStatus
            providerSubscriptionId: string | null
            customerPortalUrl: string | null
            updatePaymentMethodUrl: string | null
            renewsAt: Date | null
            endsAt: Date | null
            cancelAtPeriodEnd: boolean
          }
          update: {
            plan: WorkspacePlan
            status: SubscriptionStatus
            providerSubscriptionId?: string
            customerPortalUrl?: string | null
            updatePaymentMethodUrl?: string | null
            renewsAt: Date | null
            endsAt: Date | null
            cancelAtPeriodEnd: boolean
          }
        }) => {
          const existing = subscriptions.get(where.workspaceId)
          if (!existing) {
            const created = { id: `sub-${where.workspaceId}`, ...create }
            subscriptions.set(where.workspaceId, created)
            return created
          }
          const next = {
            ...existing,
            ...update,
            providerSubscriptionId: update.providerSubscriptionId ?? existing.providerSubscriptionId,
            customerPortalUrl:
              update.customerPortalUrl !== undefined
                ? update.customerPortalUrl
                : existing.customerPortalUrl,
            updatePaymentMethodUrl:
              update.updatePaymentMethodUrl !== undefined
                ? update.updatePaymentMethodUrl
                : existing.updatePaymentMethodUrl,
          }
          subscriptions.set(where.workspaceId, next)
          return next
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string }
          data: { customerPortalUrl?: string | null; updatePaymentMethodUrl?: string | null }
        }) => {
          for (const sub of subscriptions.values()) {
            if (sub.id === where.id) {
              Object.assign(sub, data)
              return sub
            }
          }
          throw new Error('Subscription not found')
        }
      ),
    },
    billingWebhookEvent: {
      findUnique: vi.fn(async ({ where }: { where: { deliveryKey: string } }) => {
        return events.get(where.deliveryKey) ?? null
      }),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            deliveryKey: string
            workspaceId: string | null
            providerSubscriptionId: string | null
            status: BillingWebhookStatus
          }
        }) => {
          if (events.has(data.deliveryKey)) {
            const duplicateError = new Error('Unique constraint failed') as Error & { code: string }
            duplicateError.code = 'P2002'
            throw duplicateError
          }
          const record = {
            id: `evt-${events.size + 1}`,
            deliveryKey: data.deliveryKey,
            status: data.status,
            updatedAt: new Date(),
            workspaceId: data.workspaceId,
            providerSubscriptionId: data.providerSubscriptionId,
          }
          events.set(data.deliveryKey, record)
          return record
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { deliveryKey: string }
          data: {
            status?: BillingWebhookStatus
            workspaceId?: string
            providerSubscriptionId?: string | null
          }
        }) => {
          const existing = events.get(where.deliveryKey)
          if (!existing) throw new Error('Event missing')
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          }
          events.set(where.deliveryKey, updated)
          return updated
        }
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    workspaceMember: {
      count: vi.fn(async () => 2),
    },
    workspaceInvitation: {
      count: vi.fn(async () => 1),
    },
    scanSchedule: {
      count: vi.fn(async () => 1),
    },
    user: {
      findUnique: vi.fn(async () => ({
        email: 'owner@acme.dev',
        name: 'Workspace Owner',
      })),
    },
  }
  const db = {
    ...baseDb,
    $transaction: vi.fn(
      async <T>(callback: (tx: typeof baseDb) => Promise<T>): Promise<T> => callback(baseDb)
    ),
  }

  return {
    mockBillingEvents: events,
    mockSubscriptions: subscriptions,
    mockWorkspaces: workspaces,
    prismaMock: db,
    logAuditEventMock: auditMock,
    envState: envObj,
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/server/services/audit', () => ({ logAuditEvent: logAuditEventMock }))
vi.mock('@/lib/env', () => ({
  env: envState,
  billingConfigured: true,
}))

import {
  createBillingPortalSession,
  createTeamsCheckout,
  ingestLemonSqueezyWebhook,
  verifyLemonSqueezySignature,
} from './billing'

function signPayload(rawBody: string, hmacKey: string): string {
  return crypto.createHmac('sha256', hmacKey).update(rawBody, 'utf8').digest('hex')
}

describe('workspace billing service & webhook idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBillingEvents.clear()
    mockSubscriptions.clear()
    mockWorkspaces.clear()
    mockWorkspaces.set('ws-acme', {
      id: 'ws-acme',
      name: 'Acme Engineering',
      ownerId: 'user-owner',
      plan: 'free',
      members: [{ userId: 'user-owner', role: 'owner' }],
    })
  })

  it('does not create a duplicate subscription change when an identical webhook delivery is replayed', async () => {
    const payload = JSON.stringify({
      meta: {
        event_name: 'subscription_created',
        custom_data: {
          workspace_id: 'ws-acme',
          owner_user_id: 'user-owner',
        },
      },
      data: {
        id: 'sub_lsq_9001',
        type: 'subscriptions',
        attributes: {
          store_id: 12345,
          customer_id: 7788,
          order_id: 5566,
          variant_id: 67890,
          status: 'active',
          cancelled: false,
          renews_at: '2026-11-28T00:00:00.000Z',
          ends_at: null,
          updated_at: '2026-10-28T14:00:00.000Z',
          urls: {
            customer_portal: 'https://acme.lemonsqueezy.com/billing?expires=1790000000',
            update_payment_method: 'https://acme.lemonsqueezy.com/billing/payment-method',
          },
        },
      },
    })
    const signature = signPayload(payload, envState.LEMONSQUEEZY_WEBHOOK_SECRET)

    const first = await ingestLemonSqueezyWebhook({
      rawBody: payload,
      signatureHeader: signature,
    })

    expect(first).toEqual({
      httpStatus: 200,
      body: {
        accepted: true,
        workspaceId: 'ws-acme',
        plan: 'teams',
        subscriptionStatus: 'active',
      },
    })
    expect(mockWorkspaces.get('ws-acme')?.plan).toBe('teams')
    expect(prismaMock.workspaceSubscription.upsert).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspace.update).toHaveBeenCalledTimes(1)
    expect(logAuditEventMock).toHaveBeenCalledTimes(1)

    // Replay the exact same signed webhook delivery a second time
    const second = await ingestLemonSqueezyWebhook({
      rawBody: payload,
      signatureHeader: signature,
    })

    expect(second).toEqual({
      httpStatus: 200,
      body: {
        accepted: true,
        duplicate: true,
      },
    })
    // Subscription mutation, workspace update, and audit log MUST NOT run a second time
    expect(prismaMock.workspaceSubscription.upsert).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspace.update).toHaveBeenCalledTimes(1)
    expect(logAuditEventMock).toHaveBeenCalledTimes(1)
  })

  it('rejects forged or tampered webhook signatures with HTTP 401 before touching persistence', async () => {
    const rawBody = JSON.stringify({
      meta: { event_name: 'subscription_created', custom_data: { workspace_id: 'ws-acme' } },
      data: { id: 'sub_tampered', type: 'subscriptions', attributes: { status: 'active' } },
    })

    expect(verifyLemonSqueezySignature(rawBody, 'deadbeef', envState.LEMONSQUEEZY_WEBHOOK_SECRET)).toBe(false)

    const wrongSignature = signPayload(rawBody, 'different-hmac-key')
    const result = await ingestLemonSqueezyWebhook({
      rawBody,
      signatureHeader: wrongSignature,
    })

    expect(result.httpStatus).toBe(401)
    expect(result.body.accepted).toBe(false)
    expect(prismaMock.billingWebhookEvent.create).not.toHaveBeenCalled()
    expect(prismaMock.workspaceSubscription.upsert).not.toHaveBeenCalled()
  })

  it('keeps Teams active until ends_at when cancelled, then downgrades to Free on expiration', async () => {
    const futureEnd = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString()
    const cancelBody = JSON.stringify({
      meta: { event_name: 'subscription_cancelled', custom_data: { workspace_id: 'ws-acme' } },
      data: {
        id: 'sub_lsq_9002',
        type: 'subscriptions',
        attributes: {
          status: 'cancelled',
          cancelled: true,
          ends_at: futureEnd,
          updated_at: '2026-10-28T15:00:00.000Z',
        },
      },
    })

    const cancelledRes = await ingestLemonSqueezyWebhook({
      rawBody: cancelBody,
      signatureHeader: signPayload(cancelBody, envState.LEMONSQUEEZY_WEBHOOK_SECRET),
    })
    expect(cancelledRes.body.plan).toBe('teams')
    expect(mockWorkspaces.get('ws-acme')?.plan).toBe('teams')

    // Subsequent expiration event resolves workspace via providerSubscriptionId even without custom_data
    const expireBody = JSON.stringify({
      meta: { event_name: 'subscription_expired' },
      data: {
        id: 'sub_lsq_9002',
        type: 'subscriptions',
        attributes: {
          status: 'expired',
          cancelled: true,
          ends_at: '2026-10-20T00:00:00.000Z',
          updated_at: '2026-11-05T00:00:00.000Z',
        },
      },
    })

    const expiredRes = await ingestLemonSqueezyWebhook({
      rawBody: expireBody,
      signatureHeader: signPayload(expireBody, envState.LEMONSQUEEZY_WEBHOOK_SECRET),
    })
    expect(expiredRes.body.plan).toBe('free')
    expect(mockWorkspaces.get('ws-acme')?.plan).toBe('free')
  })

  it('restricts checkout and billing portal creation strictly to the signed-in workspace owner', async () => {
    mockWorkspaces.set('ws-team', {
      id: 'ws-team',
      name: 'Platform Team',
      ownerId: 'user-owner',
      plan: 'free',
      members: [{ userId: 'user-admin', role: 'admin' }],
    })

    await expect(
      createTeamsCheckout('user-admin', { workspaceId: 'ws-team' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    await expect(
      createBillingPortalSession('user-admin', { workspaceId: 'ws-team' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            id: 'chk_123',
            attributes: {
              url: 'https://arbor.lemonsqueezy.com/checkout/buy/chk_123',
            },
          },
        }),
        { status: 201 }
      )
    )

    const checkout = await createTeamsCheckout('user-owner', { workspaceId: 'ws-acme' })
    expect(checkout.checkoutUrl).toBe('https://arbor.lemonsqueezy.com/checkout/buy/chk_123')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    mockSubscriptions.set('ws-acme', {
      id: 'sub-ws-acme',
      workspaceId: 'ws-acme',
      provider: 'lemonsqueezy',
      plan: 'teams',
      status: 'active',
      providerSubscriptionId: 'sub_lsq_9001',
      customerPortalUrl: 'https://acme.lemonsqueezy.com/billing?cached=1',
      updatePaymentMethodUrl: null,
      renewsAt: new Date('2026-11-28T00:00:00.000Z'),
      endsAt: null,
      cancelAtPeriodEnd: false,
    })

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            id: 'sub_lsq_9001',
            attributes: {
              urls: {
                customer_portal: 'https://acme.lemonsqueezy.com/billing?fresh=1',
                update_payment_method: 'https://acme.lemonsqueezy.com/billing/card?fresh=1',
              },
            },
          },
        }),
        { status: 200 }
      )
    )

    const portal = await createBillingPortalSession('user-owner', { workspaceId: 'ws-acme' })
    expect(portal.portalUrl).toBe('https://acme.lemonsqueezy.com/billing?fresh=1')
    expect(portal.updatePaymentMethodUrl).toBe(
      'https://acme.lemonsqueezy.com/billing/card?fresh=1'
    )

    fetchSpy.mockRestore()
  })
})
