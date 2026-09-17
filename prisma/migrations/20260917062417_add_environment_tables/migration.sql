-- CreateEnum
CREATE TYPE "EnvVariableStatus" AS ENUM ('set', 'missing', 'different', 'unknown');

-- CreateEnum
CREATE TYPE "EnvVariableCategory" AS ENUM ('database', 'api_key', 'auth', 'config', 'storage', 'other');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('development', 'staging', 'production', 'custom');

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EnvironmentType" NOT NULL DEFAULT 'development',
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvVariable" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "EnvVariableStatus" NOT NULL DEFAULT 'unknown',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "category" "EnvVariableCategory" NOT NULL DEFAULT 'other',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvVariable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Environment_projectId_idx" ON "Environment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_projectId_name_key" ON "Environment"("projectId", "name");

-- CreateIndex
CREATE INDEX "EnvVariable_environmentId_idx" ON "EnvVariable"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvVariable_environmentId_key_key" ON "EnvVariable"("environmentId", "key");

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvVariable" ADD CONSTRAINT "EnvVariable_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
