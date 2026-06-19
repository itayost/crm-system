-- Phase 1: Introduce top-level Client (business) entity.
-- Additive -> backfill -> constrain. Reversible: Project.contactId is kept (made nullable)
-- and dropped only in scripts/02_drop_project_contactid.sql after prod is verified.
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/01_introduce_client_entity.sql
-- BACK UP THE DATABASE FIRST.

BEGIN;

-- 1. Client table
CREATE TABLE IF NOT EXISTS "Client" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "isVip"      BOOLEAN NOT NULL DEFAULT false,
  "address"    TEXT,
  "taxId"      TEXT,
  "notes"      TEXT,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "userId"     TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Client_userId_idx"    ON "Client"("userId");
CREATE INDEX IF NOT EXISTS "Client_createdAt_idx" ON "Client"("createdAt");

-- 2. New Contact columns (nullable / defaulted)
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "role"      TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "clientId"  TEXT;

-- 3. One Client per existing CLIENT/INACTIVE contact (deterministic, idempotent id)
INSERT INTO "Client" ("id","name","isVip","address","taxId","notes","isInternal","userId","createdAt","updatedAt")
SELECT
  'cl_' || c."id",
  COALESCE(NULLIF(c."company", ''), c."name"),
  c."isVip",
  c."address",
  c."taxId",
  c."notes",
  COALESCE(c."company" = 'ItayOst Internal', false),
  c."userId",
  c."createdAt",
  c."updatedAt"
FROM "Contact" c
WHERE c."status" IN ('CLIENT','INACTIVE')
  AND NOT EXISTS (SELECT 1 FROM "Client" cl WHERE cl."id" = 'cl_' || c."id");

-- 4. Link each converted contact to its new Client as the primary person
UPDATE "Contact" c
SET "clientId" = 'cl_' || c."id",
    "isPrimary" = true,
    "role" = COALESCE(c."role", 'בעלים')
WHERE c."status" IN ('CLIENT','INACTIVE')
  AND c."clientId" IS NULL;

-- 5. New Project columns (nullable first)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientId"         TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "primaryContactId" TEXT;

-- 6. Repoint projects: old contactId -> the contact's new Client; keep that contact as primary contact
UPDATE "Project" p
SET "clientId" = 'cl_' || p."contactId",
    "primaryContactId" = p."contactId"
WHERE p."clientId" IS NULL;

-- 7. Guard: every project must resolve to a real Client
DO $$
DECLARE orphan INT;
BEGIN
  SELECT COUNT(*) INTO orphan
  FROM "Project"
  WHERE "clientId" IS NULL
     OR "clientId" NOT IN (SELECT "id" FROM "Client");
  IF orphan > 0 THEN
    RAISE EXCEPTION 'Orphan projects without a Client: %', orphan;
  END IF;
END $$;

-- 8. Enforce Project.clientId + FKs; relax the old contactId (kept populated for rollback)
ALTER TABLE "Project" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "contactId" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_primaryContactId_fkey"
    FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Project_clientId_idx" ON "Project"("clientId");

-- 9. Contact.clientId FK + index
DO $$ BEGIN
  ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Contact_clientId_idx" ON "Contact"("clientId");

COMMIT;
