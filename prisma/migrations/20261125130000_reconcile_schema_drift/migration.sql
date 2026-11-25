-- Reconcile schema drift.
--
-- These objects are declared in prisma/schema.prisma but were previously created
-- with `prisma db push` and never recorded in migration history:
--   * enums ProjectGroupRole and SystemAnalysisStatus
--   * User.benefits / permissions / plan / role / status
--   * ProjectGroup, ProjectGroupMember, SystemAnalysis, WaitlistLead, AdminEmail
--
-- The DDL is intentionally idempotent. Fresh databases are missing these objects,
-- while databases that were kept in sync with `db push` already have them and may
-- only be missing this migration's history row. Every statement therefore tolerates
-- an existing object instead of failing the deploy.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ProjectGroupRole" AS ENUM ('frontend', 'backend', 'service', 'shared_lib');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SystemAnalysisStatus" AS ENUM ('queued', 'analyzing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "benefits" JSONB,
  ADD COLUMN IF NOT EXISTS "permissions" JSONB,
  ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "latestScore" INTEGER,
    "systemData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "ProjectGroupRole" NOT NULL DEFAULT 'service',
    "apiPrefix" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemAnalysis" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "status" "SystemAnalysisStatus" NOT NULL DEFAULT 'queued',
    "overallScore" INTEGER,
    "contractScore" INTEGER,
    "envScore" INTEGER,
    "frontendScore" INTEGER,
    "backendScore" INTEGER,
    "contractMatrix" JSONB,
    "envDrift" JSONB,
    "systemGraph" JSONB,
    "findings" JSONB,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WaitlistLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT DEFAULT 'pricing_pro',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminEmail" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "template" TEXT DEFAULT 'custom',
    "targetType" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "recipientEmails" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectGroup_userId_idx" ON "ProjectGroup"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectGroup_workspaceId_idx" ON "ProjectGroup"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectGroup_userId_slug_key" ON "ProjectGroup"("userId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectGroupMember_groupId_idx" ON "ProjectGroupMember"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectGroupMember_projectId_idx" ON "ProjectGroupMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectGroupMember_groupId_projectId_key" ON "ProjectGroupMember"("groupId", "projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SystemAnalysis_groupId_idx" ON "SystemAnalysis"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SystemAnalysis_status_createdAt_idx" ON "SystemAnalysis"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistLead_email_key" ON "WaitlistLead"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistLead_createdAt_idx" ON "WaitlistLead"("createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminEmail_senderId_idx" ON "AdminEmail"("senderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminEmail_createdAt_idx" ON "AdminEmail"("createdAt" DESC);

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectGroup_userId_fkey') THEN
    ALTER TABLE "ProjectGroup" ADD CONSTRAINT "ProjectGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectGroup_workspaceId_fkey') THEN
    ALTER TABLE "ProjectGroup" ADD CONSTRAINT "ProjectGroup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectGroupMember_groupId_fkey') THEN
    ALTER TABLE "ProjectGroupMember" ADD CONSTRAINT "ProjectGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectGroupMember_projectId_fkey') THEN
    ALTER TABLE "ProjectGroupMember" ADD CONSTRAINT "ProjectGroupMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SystemAnalysis_groupId_fkey') THEN
    ALTER TABLE "SystemAnalysis" ADD CONSTRAINT "SystemAnalysis_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
