-- CreateEnum
CREATE TYPE "ApiType" AS ENUM ('rest', 'graphql');

-- CreateEnum
CREATE TYPE "SpecFormat" AS ENUM ('openapi3', 'openapi2', 'graphql_schema', 'manual');

-- CreateTable
CREATE TABLE "ApiSpec" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" "ApiType" NOT NULL DEFAULT 'rest',
    "specFormat" "SpecFormat" NOT NULL DEFAULT 'openapi3',
    "rawSpec" TEXT NOT NULL,
    "parsedEndpoints" JSONB,
    "parsedSchemas" JSONB,
    "baseUrls" JSONB,
    "endpointCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiSpec_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiSpec_projectId_idx" ON "ApiSpec"("projectId");

-- AddForeignKey
ALTER TABLE "ApiSpec" ADD CONSTRAINT "ApiSpec_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
