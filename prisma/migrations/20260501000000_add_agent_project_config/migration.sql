-- CreateEnum
CREATE TYPE "AgentMonitoringStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateTable
CREATE TABLE "AgentProjectConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "agentSlug" TEXT NOT NULL,
    "status" "AgentMonitoringStatus" NOT NULL DEFAULT 'ACTIVE',
    "githubOwner" TEXT NOT NULL,
    "githubRepo" TEXT NOT NULL,
    "githubBranch" TEXT NOT NULL DEFAULT 'main',
    "vercelTeamId" TEXT NOT NULL,
    "vercelProjectId" TEXT NOT NULL,
    "supabaseProjectRef" TEXT,
    "smokeUrl" TEXT,
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "safetyConfig" JSONB NOT NULL,
    "morningReportInclude" BOOLEAN NOT NULL DEFAULT true,
    "ingestionConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProjectConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentProjectConfig_projectId_key" ON "AgentProjectConfig"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProjectConfig_agentSlug_key" ON "AgentProjectConfig"("agentSlug");

-- CreateIndex
CREATE INDEX "AgentProjectConfig_status_idx" ON "AgentProjectConfig"("status");

-- AddForeignKey
ALTER TABLE "AgentProjectConfig" ADD CONSTRAINT "AgentProjectConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
