-- Projects are billed per phase, not as one lump. Each phase has an order, a
-- price, its own client sign-off and its own payment; the project keeps a
-- מקדמה paid up front. Total = advance + sum(phase prices).
--
-- Payment is deliberately separate from approval: approved work is finished,
-- not settled, and "what has been signed off but not paid" is the number worth
-- chasing.
--
-- DESTRUCTIVE: this drops "Project"."price". The column's money is migrated
-- into a single phase first. BACK UP THE DATABASE FIRST.
--
-- Before running, snapshot what revenue is today:
--   SELECT status, COUNT(*), SUM(price) FROM "Project" GROUP BY 1 ORDER BY 1;
--
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/13_project_phases.sql
--
-- Then regenerate the client:
--   npx prisma generate

BEGIN;

-- 1. The phase status enum.
DO $$
BEGIN
  CREATE TYPE "PhaseStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'PENDING_APPROVAL',
    'REVISIONS',
    'APPROVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. The advance. Additive, so it is safe ahead of the code deploy.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "advanceAmount" DECIMAL(10,2);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "advancePaidAt" TIMESTAMP(3);

-- 3. The phases themselves. No userId: ownership comes through the project,
--    the same way AgentProjectConfig works.
CREATE TABLE IF NOT EXISTS "ProjectPhase" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "order"      INTEGER NOT NULL,
  "status"     "PhaseStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "price"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "approvedAt" TIMESTAMP(3),
  "paidAt"     TIMESTAMP(3),
  "projectId"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "ProjectPhase"
    ADD CONSTRAINT "ProjectPhase_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ProjectPhase_projectId_idx" ON "ProjectPhase" ("projectId");
CREATE INDEX IF NOT EXISTS "ProjectPhase_projectId_order_idx" ON "ProjectPhase" ("projectId", "order");
CREATE INDEX IF NOT EXISTS "ProjectPhase_status_idx" ON "ProjectPhase" ("status");

-- 4. Carry every existing price into one phase, then drop the column.
--    Guarded twice so a re-run is a no-op: the column must still exist, and
--    the project must not already have phases.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Project' AND column_name = 'price'
  ) THEN
    INSERT INTO "ProjectPhase" ("id", "name", "order", "status", "price", "approvedAt", "paidAt", "projectId", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      'פיתוח',
      1,
      -- A finished project was delivered and paid for. Preserving that is what
      -- keeps historic revenue intact once revenue is computed from phases.
      CASE WHEN p."status" = 'COMPLETED' THEN 'APPROVED'::"PhaseStatus"
           ELSE 'IN_PROGRESS'::"PhaseStatus" END,
      p."price",
      CASE WHEN p."status" = 'COMPLETED' THEN COALESCE(p."completedAt", p."updatedAt") END,
      CASE WHEN p."status" = 'COMPLETED' THEN COALESCE(p."completedAt", p."updatedAt") END,
      p."id",
      p."createdAt",
      p."updatedAt"
    FROM "Project" p
    WHERE p."price" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "ProjectPhase" ph WHERE ph."projectId" = p."id");

    ALTER TABLE "Project" DROP COLUMN IF EXISTS "price";
  END IF;
END $$;

COMMIT;

-- Verify - the second number must equal the COMPLETED sum from the snapshot:
--   SELECT COUNT(*) FROM "ProjectPhase";
--   SELECT SUM("price") FROM "ProjectPhase" WHERE "paidAt" IS NOT NULL;
--   SELECT SUM("price") FROM "ProjectPhase";  -- equals the old grand total
