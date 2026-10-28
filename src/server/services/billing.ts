import crypto from 'node:crypto'
import { TRPCError } from '@trpc/server'
import type { Prisma, SubscriptionStatus, WorkspacePlan } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { billingConfigured, env } from '@/lib/env'
import { logAuditEvent } from '@/server/services/audit'
import {
  TEAMS_MONTHLY_PRICE_USD,
  getPlanLimits,
  isSubscriptionEntitled,
  resolveEffectiveWorkspacePlanFromRecord,
} from '@/server/services/plan-limits'

const LEMON_SQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1'
const STALE_PROCESSING_MS = 5 * 60_000

const checkoutResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    attributes: z.object({
      url: z.string().url(),
    }),
  }),
})

const subscriptionResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    attributes: z.object({
      urls: z
        .object({
          customer_portal: z.string().url().nullable().optional(),
          update_payment_method: z.string().url().nullable().optional(),
        })
        .optional(),
    }),
  }),
})

const lemonSqueezyWebhookSchema = z.object({
  meta: z.object({
    event_name: z.string().min(1),
    custom_data: z
      .object({
        workspace_id: z.string().min(1).optional(),
        owner_user_id: z.string().min(1).optional(),
      })
      .passthrough()
      .optional(),
  }),
  data: z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    type: z.string(),
    attributes: z
      .object({
        store_id: z.union([z.number(), z.string()]).optional(),
        customer_id: z.union([z.number(), z.string()]).nullable().optional(),
        order_id: z.union([z.number(), z.string()]).nullable().optional(),
        subscription_id: z.union([z.number(), z.string()]).nullable().optional(),
        variant_id: z.union([z.number(), z.string()]).nullable().optional(),
        status: z.string().optional(),
        cancelled: z.boolean().optional(),
        renews_at: z.string().nullable().optional(),
        ends_at: z.string().nullable().optional(),
        updated_at: z.string().nullable().optional(),
        urls: z
          .object({
            customer_portal: z.string().nullable().optional(),
            update_payment_method: z.string().nullable().optional(),
          })
          .optional(),
      })
      .passthrough(),
  }),
})

const SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
  'subscription_payment_success',
  'subscription_payment_failed',
  'subscription_payment_recovered',
])

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function mapLemonSqueezyStatus(
  rawStatus: string | undefined,
  eventName: string
): SubscriptionStatus {
  switch (rawStatus) {
    case 'on_trial':
      return 'on_trial'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'unpaid':
      return 'unpaid'
    case 'cancelled':
      return 'cancelled'
    case 'expired':
      return 'expired'
    case 'paused':
      return 'paused'
    default: {
      if (eventName === 'subscription_payment_failed') return 'past_due'
      if (eventName === 'subscription_payment_success' || eventName === 'subscription_payment_recovered') {
        return 'active'
      }
      if (eventName === 'subscription_expired') return 'expired'
      if (eventName === 'subscription_cancelled') return 'cancelled'
      if (eventName === 'subscription_paused') return 'paused'
      return 'inactive'
    }
  }
}

export async function requireWorkspaceOwner(userId: string, workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      subscription: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  })

  if (!workspace) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Workspace not found.',
    })
  }

  const isOwner =
    workspace.ownerId === userId || workspace.members.some((member) => member.role === 'owner')

  if (!isOwner) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only the workspace owner can manage billing and subscriptions.',
    })
  }

  return workspace
}

export async function getWorkspaceBilling(userId: string, workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: {
      subscription: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  })

  if (!workspace) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Workspace not found or you do not have access to it.',
    })
  }

  const isOwner =
    workspace.ownerId === userId || workspace.members.some((member) => member.role === 'owner')
  const effectivePlan: WorkspacePlan = resolveEffectiveWorkspacePlanFromRecord(workspace)
  const limits = getPlanLimits(effectivePlan)

  const [memberCount, pendingInviteCount, enabledScheduledScans] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId: workspace.id } }),
    prisma.workspaceInvitation.count({
      where: {
        workspaceId: workspace.id,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.scanSchedule.count({
      where: {
        enabled: true,
        project: {
          workspaceId: workspace.id,
          status: 'active',
        },
      },
    }),
  ])

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    plan: effectivePlan,
    monthlyPriceUsd: TEAMS_MONTHLY_PRICE_USD,
    billingConfigured,
    canManageBilling: isOwner,
    limits,
    usage: {
      members: memberCount,
      pendingInvites: pendingInviteCount,
      enabledScheduledScans,
    },
    subscription: workspace.subscription
      ? {
          provider: workspace.subscription.provider,
          status: workspace.subscription.status,
          renewsAt: workspace.subscription.renewsAt,
          endsAt: workspace.subscription.endsAt,
          cancelAtPeriodEnd: workspace.subscription.cancelAtPeriodEnd,
          hasPortal: Boolean(
            isOwner &&
              (workspace.subscription.providerSubscriptionId ||
                workspace.subscription.customerPortalUrl)
          ),
        }
      : null,
  }
}

export async function createTeamsCheckout(
  userId: string,
  input: { workspaceId: string }
): Promise<{ checkoutUrl: string }> {
  const workspace = await requireWorkspaceOwner(userId, input.workspaceId)

  if (!billingConfigured) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'Workspace billing is not configured on this deployment (missing Lemon Squeezy store or variant credentials).',
    })
  }

  const currentPlan = resolveEffectiveWorkspacePlanFromRecord(workspace)
  if (currentPlan === 'teams' && workspace.subscription && !workspace.subscription.cancelAtPeriodEnd) {
    throw new TRPCError({
      code: 'CONFLICT',
      message:
        'This workspace already has an active Teams subscription. Open the billing portal to manage it.',
    })
  }

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  })

  const redirectBase = env.APP_URL.replace(/\/+$/, '')
  const checkoutPayload = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          ...(owner?.email ? { email: owner.email } : {}),
          ...(owner?.name ? { name: owner.name } : {}),
          custom: {
            workspace_id: workspace.id,
            owner_user_id: userId,
          },
        },
        product_options: {
          redirect_url: `${redirectBase}/settings?tab=workspaces&billing=success`,
          receipt_button_text: 'Return to Arbor Workspace',
          receipt_link_url: `${redirectBase}/settings?tab=workspaces`,
        },
      },
      relationships: {
        store: {
          data: {
            type: 'stores',
            id: String(env.LEMONSQUEEZY_STORE_ID),
          },
        },
        variant: {
          data: {
            type: 'variants',
            id: String(env.LEMONSQUEEZY_TEAMS_VARIANT_ID),
          },
        },
      },
    },
  }

  let response: Response
  try {
    response = await fetch(`${LEMON_SQUEEZY_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
      },
      body: JSON.stringify(checkoutPayload),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new TRPCError({
      code: 'BAD_GATEWAY',
      message: 'Unable to reach Lemon Squeezy checkout service. Please try again shortly.',
    })
  }

  if (!response.ok) {
    throw new TRPCError({
      code: 'BAD_GATEWAY',
      message: `Lemon Squeezy rejected checkout creation (HTTP ${response.status}).`,
    })
  }

  const json: unknown = await response.json()
  const parsed = checkoutResponseSchema.safeParse(json)
  if (!parsed.success || !parsed.data.data.attributes.url.startsWith('https://')) {
    throw new TRPCError({
      code: 'BAD_GATEWAY',
      message: 'Received an invalid checkout URL from Lemon Squeezy.',
    })
  }

  const checkoutUrl = parsed.data.data.attributes.url

  await logAuditEvent({
    userId,
    workspaceId: workspace.id,
    action: 'billing.checkout_created',
    entityType: 'workspace',
    entityId: workspace.id,
    metadata: {
      provider: 'lemonsqueezy',
      plan: 'teams',
      monthlyPriceUsd: TEAMS_MONTHLY_PRICE_USD,
    },
  })

  return { checkoutUrl }
}

export async function createBillingPortalSession(
  userId: string,
  input: { workspaceId: string }
): Promise<{ portalUrl: string; updatePaymentMethodUrl: string | null }> {
  const workspace = await requireWorkspaceOwner(userId, input.workspaceId)
  const subscription = workspace.subscription

  if (!subscription) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No subscription is linked to this workspace yet.',
    })
  }

  let portalUrl = subscription.customerPortalUrl ?? null
  let updatePaymentMethodUrl = subscription.updatePaymentMethodUrl ?? null

  if (env.LEMONSQUEEZY_API_KEY && subscription.providerSubscriptionId) {
    try {
      const response = await fetch(
        `${LEMON_SQUEEZY_API_BASE}/subscriptions/${encodeURIComponent(subscription.providerSubscriptionId)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.api+json',
            Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
          },
          signal: AbortSignal.timeout(15_000),
        }
      )

      if (response.ok) {
        const json: unknown = await response.json()
        const parsed = subscriptionResponseSchema.safeParse(json)
        if (parsed.success) {
          const freshPortal = parsed.data.data.attributes.urls?.customer_portal ?? null
          const freshUpdate = parsed.data.data.attributes.urls?.update_payment_method ?? null
          if (freshPortal) {
            portalUrl = freshPortal
            updatePaymentMethodUrl = freshUpdate
            await prisma.workspaceSubscription.update({
              where: { id: subscription.id },
              data: {
                customerPortalUrl: freshPortal,
                updatePaymentMethodUrl: freshUpdate,
              },
            })
          }
        }
      }
    } catch {
      // Fall back to cached portal URL if live refresh times out.
    }
  }

  if (!portalUrl || !portalUrl.startsWith('https://')) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Billing portal URL is unavailable. Ensure Lemon Squeezy API credentials are configured.',
    })
  }

  await logAuditEvent({
    userId,
    workspaceId: workspace.id,
    action: 'billing.portal_opened',
    entityType: 'workspace_subscription',
    entityId: subscription.id,
    metadata: { provider: subscription.provider },
  })

  return {
    portalUrl,
    updatePaymentMethodUrl:
      updatePaymentMethodUrl && updatePaymentMethodUrl.startsWith('https://')
        ? updatePaymentMethodUrl
        : null,
  }
}

export function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): boolean {
  if (!webhookSecret || !signatureHeader) return false
  const candidate = signatureHeader.trim()
  if (!/^[0-9a-f]{64}$/i.test(candidate)) return false

  const expectedHex = crypto.createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('hex')
  const expectedBuf = Buffer.from(expectedHex, 'hex')
  const candidateBuf = Buffer.from(candidate, 'hex')

  if (expectedBuf.length !== candidateBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, candidateBuf)
}

export function computeWebhookDeliveryKey(
  rawBody: string,
  eventIdHeader?: string | null
): string {
  const trimmedId = eventIdHeader?.trim()
  if (trimmedId && trimmedId.length <= 200) {
    return `id:${trimmedId}`
  }
  const digest = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex')
  return `sha256:${digest}`
}

async function claimBillingWebhookEvent(params: {
  deliveryKey: string
  eventName: string
  workspaceId: string | null
  providerSubscriptionId: string | null
  payload: Prisma.InputJsonValue
}): Promise<'claimed' | 'duplicate'> {
  const existing = await prisma.billingWebhookEvent.findUnique({
    where: { deliveryKey: params.deliveryKey },
    select: { status: true, updatedAt: true },
  })

  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS)

  if (!existing) {
    try {
      await prisma.billingWebhookEvent.create({
        data: {
          deliveryKey: params.deliveryKey,
          provider: 'lemonsqueezy',
          eventName: params.eventName,
          workspaceId: params.workspaceId,
          providerSubscriptionId: params.providerSubscriptionId,
          status: 'processing',
          payload: params.payload,
        },
      })
      return 'claimed'
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        return 'duplicate'
      }
      throw error
    }
  }

  if (existing.status === 'processed' || existing.status === 'ignored') {
    return 'duplicate'
  }
  if (existing.status === 'processing' && existing.updatedAt > staleBefore) {
    return 'duplicate'
  }

  const reclaimed = await prisma.billingWebhookEvent.updateMany({
    where: {
      deliveryKey: params.deliveryKey,
      OR: [
        { status: 'failed' },
        { status: 'received' },
        { status: 'processing', updatedAt: { lte: staleBefore } },
      ],
    },
    data: {
      status: 'processing',
      errorMessage: null,
    },
  })

  return reclaimed.count === 1 ? 'claimed' : 'duplicate'
}

export interface IngestBillingWebhookResult {
  accepted: boolean
  duplicate?: boolean
  ignored?: boolean
  reason?: string
  workspaceId?: string
  plan?: WorkspacePlan
  subscriptionStatus?: SubscriptionStatus
}

export async function ingestLemonSqueezyWebhook(params: {
  rawBody: string
  signatureHeader: string | null
  eventIdHeader?: string | null
  webhookSecret?: string
}): Promise<{ httpStatus: number; body: IngestBillingWebhookResult }> {
  const secret = params.webhookSecret ?? env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    return {
      httpStatus: 503,
      body: { accepted: false, reason: 'Billing webhook secret is not configured.' },
    }
  }

  if (!verifyLemonSqueezySignature(params.rawBody, params.signatureHeader, secret)) {
    return {
      httpStatus: 401,
      body: { accepted: false, reason: 'Invalid webhook signature.' },
    }
  }

  let rawJson: unknown
  try {
    rawJson = JSON.parse(params.rawBody)
  } catch {
    return {
      httpStatus: 400,
      body: { accepted: false, reason: 'Webhook body is not valid JSON.' },
    }
  }

  const parsed = lemonSqueezyWebhookSchema.safeParse(rawJson)
  if (!parsed.success) {
    return {
      httpStatus: 400,
      body: { accepted: false, reason: 'Webhook payload failed schema validation.' },
    }
  }

  const envelope = parsed.data
  const eventName = envelope.meta.event_name
  const attrs = envelope.data.attributes
  const providerSubscriptionId =
    envelope.data.type === 'subscriptions'
      ? envelope.data.id
      : attrs.subscription_id != null
        ? String(attrs.subscription_id)
        : null
  const customWorkspaceId = envelope.meta.custom_data?.workspace_id ?? null
  const deliveryKey = computeWebhookDeliveryKey(params.rawBody, params.eventIdHeader)

  const claim = await claimBillingWebhookEvent({
    deliveryKey,
    eventName,
    workspaceId: customWorkspaceId,
    providerSubscriptionId,
    payload: rawJson as Prisma.InputJsonValue,
  })

  if (claim === 'duplicate') {
    return {
      httpStatus: 200,
      body: { accepted: true, duplicate: true },
    }
  }

  try {
    if (!SUBSCRIPTION_EVENTS.has(eventName)) {
      await prisma.billingWebhookEvent.update({
        where: { deliveryKey },
        data: { status: 'ignored', processedAt: new Date() },
      })
      return {
        httpStatus: 202,
        body: { accepted: true, ignored: true, reason: `Unhandled event ${eventName}` },
      }
    }

    let workspace = customWorkspaceId
      ? await prisma.workspace.findUnique({
          where: { id: customWorkspaceId },
          select: { id: true, ownerId: true },
        })
      : null

    if (!workspace && providerSubscriptionId) {
      const existingSub = await prisma.workspaceSubscription.findUnique({
        where: { providerSubscriptionId },
        select: {
          workspace: {
            select: { id: true, ownerId: true },
          },
        },
      })
      workspace = existingSub?.workspace ?? null
    }

    if (!workspace) {
      await prisma.billingWebhookEvent.update({
        where: { deliveryKey },
        data: {
          status: 'ignored',
          processedAt: new Date(),
          errorMessage: 'Target workspace could not be resolved for webhook event.',
        },
      })
      return {
        httpStatus: 202,
        body: { accepted: true, ignored: true, reason: 'Workspace not found for subscription event.' },
      }
    }

    const mappedStatus = mapLemonSqueezyStatus(attrs.status, eventName)
    const renewsAt = parseOptionalDate(attrs.renews_at)
    const endsAt = parseOptionalDate(attrs.ends_at)
    const lastEventAt = parseOptionalDate(attrs.updated_at) ?? new Date()
    const cancelAtPeriodEnd = Boolean(attrs.cancelled) || mappedStatus === 'cancelled'
    const effectivePlan: WorkspacePlan = isSubscriptionEntitled(mappedStatus, endsAt)
      ? 'teams'
      : 'free'

    const portalUrl = attrs.urls?.customer_portal ?? undefined
    const updatePaymentMethodUrl = attrs.urls?.update_payment_method ?? undefined

    await prisma.$transaction(async (tx) => {
      await tx.workspaceSubscription.upsert({
        where: { workspaceId: workspace.id },
        create: {
          workspaceId: workspace.id,
          provider: 'lemonsqueezy',
          plan: effectivePlan,
          status: mappedStatus,
          providerCustomerId: attrs.customer_id != null ? String(attrs.customer_id) : null,
          providerSubscriptionId,
          providerOrderId: attrs.order_id != null ? String(attrs.order_id) : null,
          providerVariantId: attrs.variant_id != null ? String(attrs.variant_id) : null,
          customerPortalUrl: portalUrl ?? null,
          updatePaymentMethodUrl: updatePaymentMethodUrl ?? null,
          renewsAt,
          endsAt,
          cancelAtPeriodEnd,
          lastEventAt,
        },
        update: {
          plan: effectivePlan,
          status: mappedStatus,
          ...(attrs.customer_id != null ? { providerCustomerId: String(attrs.customer_id) } : {}),
          ...(providerSubscriptionId ? { providerSubscriptionId } : {}),
          ...(attrs.order_id != null ? { providerOrderId: String(attrs.order_id) } : {}),
          ...(attrs.variant_id != null ? { providerVariantId: String(attrs.variant_id) } : {}),
          ...(portalUrl !== undefined ? { customerPortalUrl: portalUrl } : {}),
          ...(updatePaymentMethodUrl !== undefined
            ? { updatePaymentMethodUrl }
            : {}),
          renewsAt,
          endsAt,
          cancelAtPeriodEnd,
          lastEventAt,
        },
      })

      await tx.workspace.update({
        where: { id: workspace.id },
        data: { plan: effectivePlan },
      })

      await tx.billingWebhookEvent.update({
        where: { deliveryKey },
        data: {
          workspaceId: workspace.id,
          providerSubscriptionId,
          status: 'processed',
          processedAt: new Date(),
          errorMessage: null,
        },
      })
    })

    await logAuditEvent({
      userId: workspace.ownerId,
      workspaceId: workspace.id,
      action: 'billing.subscription_synced',
      entityType: 'workspace_subscription',
      entityId: providerSubscriptionId ?? workspace.id,
      metadata: {
        eventName,
        plan: effectivePlan,
        status: mappedStatus,
        cancelAtPeriodEnd,
      },
    }).catch(() => {})

    return {
      httpStatus: 200,
      body: {
        accepted: true,
        workspaceId: workspace.id,
        plan: effectivePlan,
        subscriptionStatus: mappedStatus,
      },
    }
  } catch (error) {
    await prisma.billingWebhookEvent
      .update({
        where: { deliveryKey },
        data: {
          status: 'failed',
          errorMessage: (error instanceof Error ? error.message : 'Billing webhook processing failed.').slice(
            0,
            500
          ),
        },
      })
      .catch(() => {})
    throw error
  }
}
