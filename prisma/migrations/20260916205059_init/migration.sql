-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('queued', 'cloning', 'analyzing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "githubId" INTEGER NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "githubAccessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenScope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "repoFullName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "repoPrivate" BOOLEAN NOT NULL DEFAULT false,
    "detectedStack" JSONB,
    "latestScores" JSONB,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'queued',
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "branch" TEXT NOT NULL,
    "overallScore" INTEGER,
    "architectureScore" INTEGER,
    "techDebtScore" INTEGER,
    "performanceScore" INTEGER,
    "documentationScore" INTEGER,
    "securityScore" INTEGER,
    "techStack" JSONB,
    "structure" JSONB,
    "findings" JSONB,
    "dependencyGraph" JSONB,
    "metrics" JSONB,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE INDEX "Project_userId_status_idx" ON "Project"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_userId_slug_key" ON "Project"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_userId_repoFullName_key" ON "Project"("userId", "repoFullName");

-- CreateIndex
CREATE INDEX "Analysis_projectId_createdAt_idx" ON "Analysis"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Analysis_projectId_status_idx" ON "Analysis"("projectId", "status");

-- CreateIndex
CREATE INDEX "Analysis_status_idx" ON "Analysis"("status");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
