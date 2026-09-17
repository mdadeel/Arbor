/*
  Warnings:

  - Added the required column `updatedAt` to the `Analysis` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "designSystem" JSONB,
ADD COLUMN     "designSystemScore" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill then drop the provisional default to match the schema (no @default in Prisma)
ALTER TABLE "Analysis" ALTER COLUMN "updatedAt" DROP DEFAULT;
