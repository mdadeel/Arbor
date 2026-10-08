-- Roadmap phases 1-5: PR checks, policy/triage, schedules/notifications/shares,
-- dependency snapshots, and review-only AI patch suggestions.

CREATE TYPE "PullRequestAnalysisStatus" AS ENUM ('queued', 'analyzing', 'completed', 'failed', 'closed');
CREATE TYPE "FindingTriageStatus" AS ENUM ('open', 'accepted_risk', 'false_positive', 'resolved');
CREATE TYPE "ScanCadence" AS ENUM ('daily', 'weekly');
CREATE TYPE "NotificationKind" AS ENUM ('critical_finding', 'finding_alert', 'score_regression', 'scan_completed');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('received', 'processing', 'queued', 'ignored', 'failed');
CREATE TYPE "PatchSuggestionStatus" AS ENUM ('proposed', 'accepted', 'dismissed');

ALTER TABLE "Analysis"
  ADD COLUMN "analysisVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "requestedCommitSha" TEXT,
  ADD COLUMN "dependencyInventory" JSONB,
  ADD COLUMN "dependencyAdvisories" JSONB,
  ADD COLUMN "sbom" JSONB,
  ADD COLUMN "policySnapshot" JSONB;

CREATE TABLE "GitHubWebhookDelivery" (
  "id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "action" TEXT,
  "repository" TEXT,
  "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'received',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GitHubWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PullRequestAnalysis" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "baseBranch" TEXT NOT NULL,
  "headBranch" TEXT NOT NULL,
  "baseSha" TEXT NOT NULL,
  "headSha" TEXT NOT NULL,
  "status" "PullRequestAnalysisStatus" NOT NULL DEFAULT 'queued',
  "analysisId" TEXT,
  "checkRunId" TEXT,
  "checkUrl" TEXT,
  "checkError" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PullRequestAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicyPackSetting" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "projectId" TEXT,
  "packKey" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "overrides" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PolicyPackSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PolicyPackSetting_scope_check" CHECK (("workspaceId" IS NULL) <> ("projectId" IS NULL))
);

CREATE TABLE "FindingTriage" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "FindingTriageStatus" NOT NULL DEFAULT 'open',
  "assigneeId" TEXT,
  "note" TEXT,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FindingTriage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FindingTriageEvent" (
  "id" TEXT NOT NULL,
  "triageId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "fromStatus" "FindingTriageStatus",
  "toStatus" "FindingTriageStatus" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingTriageEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScanSchedule" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "cadence" "ScanCadence" NOT NULL DEFAULT 'weekly',
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "branch" TEXT NOT NULL,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScanSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "minimumSeverity" TEXT NOT NULL DEFAULT 'critical',
  "scoreRegressionThreshold" INTEGER NOT NULL DEFAULT 10,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "NotificationPreference_score_threshold_check" CHECK ("scoreRegressionThreshold" BETWEEN 1 AND 100),
  CONSTRAINT "NotificationPreference_severity_check" CHECK ("minimumSeverity" IN ('critical', 'warning', 'info'))
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "analysisId" TEXT,
  "kind" "NotificationKind" NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportShareLink" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportShareLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatchSuggestion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "findingFingerprint" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "diff" TEXT NOT NULL,
  "validation" JSONB,
  "status" "PatchSuggestionStatus" NOT NULL DEFAULT 'proposed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PatchSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PullRequestAnalysis_analysisId_key" ON "PullRequestAnalysis"("analysisId");
CREATE UNIQUE INDEX "PullRequestAnalysis_projectId_number_headSha_key" ON "PullRequestAnalysis"("projectId", "number", "headSha");
CREATE INDEX "PullRequestAnalysis_projectId_number_createdAt_idx" ON "PullRequestAnalysis"("projectId", "number", "createdAt" DESC);
CREATE INDEX "PullRequestAnalysis_status_createdAt_idx" ON "PullRequestAnalysis"("status", "createdAt");
CREATE INDEX "GitHubWebhookDelivery_status_createdAt_idx" ON "GitHubWebhookDelivery"("status", "createdAt");
CREATE UNIQUE INDEX "PolicyPackSetting_workspaceId_packKey_key" ON "PolicyPackSetting"("workspaceId", "packKey");
CREATE UNIQUE INDEX "PolicyPackSetting_projectId_packKey_key" ON "PolicyPackSetting"("projectId", "packKey");
CREATE INDEX "PolicyPackSetting_workspaceId_idx" ON "PolicyPackSetting"("workspaceId");
CREATE INDEX "PolicyPackSetting_projectId_idx" ON "PolicyPackSetting"("projectId");
CREATE UNIQUE INDEX "FindingTriage_projectId_fingerprint_key" ON "FindingTriage"("projectId", "fingerprint");
CREATE INDEX "FindingTriage_projectId_status_updatedAt_idx" ON "FindingTriage"("projectId", "status", "updatedAt" DESC);
CREATE INDEX "FindingTriageEvent_triageId_createdAt_idx" ON "FindingTriageEvent"("triageId", "createdAt");
CREATE INDEX "FindingTriageEvent_actorId_createdAt_idx" ON "FindingTriageEvent"("actorId", "createdAt");
CREATE UNIQUE INDEX "ScanSchedule_projectId_key" ON "ScanSchedule"("projectId");
CREATE INDEX "ScanSchedule_enabled_nextRunAt_idx" ON "ScanSchedule"("enabled", "nextRunAt");
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);
CREATE INDEX "Notification_projectId_createdAt_idx" ON "Notification"("projectId", "createdAt" DESC);
CREATE UNIQUE INDEX "ReportShareLink_tokenHash_key" ON "ReportShareLink"("tokenHash");
CREATE INDEX "ReportShareLink_projectId_createdAt_idx" ON "ReportShareLink"("projectId", "createdAt" DESC);
CREATE INDEX "ReportShareLink_expiresAt_revokedAt_idx" ON "ReportShareLink"("expiresAt", "revokedAt");
CREATE INDEX "PatchSuggestion_projectId_createdAt_idx" ON "PatchSuggestion"("projectId", "createdAt" DESC);
CREATE INDEX "PatchSuggestion_analysisId_findingFingerprint_idx" ON "PatchSuggestion"("analysisId", "findingFingerprint");

ALTER TABLE "PullRequestAnalysis" ADD CONSTRAINT "PullRequestAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PullRequestAnalysis" ADD CONSTRAINT "PullRequestAnalysis_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PolicyPackSetting" ADD CONSTRAINT "PolicyPackSetting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PolicyPackSetting" ADD CONSTRAINT "PolicyPackSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FindingTriage" ADD CONSTRAINT "FindingTriage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FindingTriageEvent" ADD CONSTRAINT "FindingTriageEvent_triageId_fkey" FOREIGN KEY ("triageId") REFERENCES "FindingTriage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FindingTriageEvent" ADD CONSTRAINT "FindingTriageEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScanSchedule" ADD CONSTRAINT "ScanSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportShareLink" ADD CONSTRAINT "ReportShareLink_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportShareLink" ADD CONSTRAINT "ReportShareLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatchSuggestion" ADD CONSTRAINT "PatchSuggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatchSuggestion" ADD CONSTRAINT "PatchSuggestion_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatchSuggestion" ADD CONSTRAINT "PatchSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
