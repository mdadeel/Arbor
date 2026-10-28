-- CreateEnum
CREATE TYPE "WorkspacePlan" AS ENUM ('free', 'teams');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('inactive', 'on_trial', 'active', 'past_due', 'unpaid', 'cancelled', 'expired', 'paused');

-- CreateEnum
CREATE TYPE "BillingWebhookStatus" AS ENUM ('received', 'processing', 'processed', 'ignored', 'failed');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "plan" "WorkspacePlan" NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "WorkspaceSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'lemonsqueezy',
    "plan" "WorkspacePlan" NOT NULL DEFAULT 'free',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'inactive',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "providerOrderId" TEXT,
    "providerVariantId" TEXT,
    "customerPortalUrl" TEXT,
    "updatePaymentMethodUrl" TEXT,
    "renewsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "deliveryKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'lemonsqueezy',
    "eventName" TEXT NOT NULL,
    "workspaceId" TEXT,
    "providerSubscriptionId" TEXT,
    "status" "BillingWebhookStatus" NOT NULL DEFAULT 'received',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSubscription_workspaceId_key" ON "WorkspaceSubscription"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSubscription_providerSubscriptionId_key" ON "WorkspaceSubscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "WorkspaceSubscription_status_idx" ON "WorkspaceSubscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingWebhookEvent_deliveryKey_key" ON "BillingWebhookEvent"("deliveryKey");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_workspaceId_createdAt_idx" ON "BillingWebhookEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_providerSubscriptionId_idx" ON "BillingWebhookEvent"("providerSubscriptionId");

-- AddForeignKey
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingWebhookEvent" ADD CONSTRAINT "BillingWebhookEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
