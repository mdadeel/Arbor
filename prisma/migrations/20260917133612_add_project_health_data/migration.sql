-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "healthData" JSONB,
ADD COLUMN     "lastHealthSyncAt" TIMESTAMP(3);
