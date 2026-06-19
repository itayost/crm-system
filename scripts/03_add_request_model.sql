-- Phase 2: Add the Request (client-request / ticket) model.
-- Depends on scripts/01_introduce_client_entity.sql (Client table must exist).
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/03_add_request_model.sql

BEGIN;

DO $$ BEGIN
  CREATE TYPE "RequestType" AS ENUM ('REQUEST','BUG','IMPROVEMENT','QUESTION','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RequestStatus" AS ENUM ('PENDING_REVIEW','OPEN','IN_PROGRESS','RESOLVED','DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RequestSource" AS ENUM ('WHATSAPP','MANUAL','EMAIL','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Request" (
  "id"              TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "type"            "RequestType"   NOT NULL DEFAULT 'REQUEST',
  "status"          "RequestStatus" NOT NULL DEFAULT 'OPEN',
  "priority"        "Priority"      NOT NULL DEFAULT 'MEDIUM',
  "source"          "RequestSource" NOT NULL DEFAULT 'MANUAL',
  "isAiGenerated"   BOOLEAN NOT NULL DEFAULT false,
  "aiConfidence"    DOUBLE PRECISION,
  "aiNote"          TEXT,
  "sourceMessageId" TEXT,
  "clientId"        TEXT NOT NULL,
  "contactId"       TEXT,
  "projectId"       TEXT,
  "userId"          TEXT NOT NULL,
  "resolvedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Request" ADD CONSTRAINT "Request_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Request" ADD CONSTRAINT "Request_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Request" ADD CONSTRAINT "Request_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Request" ADD CONSTRAINT "Request_sourceMessageId_fkey"
    FOREIGN KEY ("sourceMessageId") REFERENCES "WhatsAppMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Request" ADD CONSTRAINT "Request_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Request_clientId_idx"        ON "Request"("clientId");
CREATE INDEX IF NOT EXISTS "Request_status_idx"          ON "Request"("status");
CREATE INDEX IF NOT EXISTS "Request_type_idx"            ON "Request"("type");
CREATE INDEX IF NOT EXISTS "Request_userId_status_idx"   ON "Request"("userId","status");
CREATE INDEX IF NOT EXISTS "Request_sourceMessageId_idx" ON "Request"("sourceMessageId");

COMMIT;
