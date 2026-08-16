-- A request gains a price, a quote, and the client's answer to it.
--
-- Until now a client ticket went extraction -> PENDING_REVIEW -> approve ->
-- Task -> work, and nobody ever discussed money. The review gate was triage,
-- not a commercial gate. These columns add the second gate: a BILLABLE or
-- QUOTE_REQUIRED request cannot become a Task until the client has approved a
-- quoted price, and an approved one materialises as a ProjectPhase so the money
-- has exactly one home.
--
-- Purely additive. Every column is nullable and "billingKind" IS NULL means
-- "behave exactly as before", so this is safe to run ahead of the code deploy
-- and every request written before today keeps working untouched.
--
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/16_request_billing.sql
--
-- Then regenerate the client:
--   npx prisma generate

BEGIN;

-- 1. The two enums.
DO $$
BEGIN
  CREATE TYPE "RequestBilling" AS ENUM (
    'INCLUDED',
    'BILLABLE',
    'WARRANTY',
    'QUOTE_REQUIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ClientDecision" AS ENUM (
    'APPROVED',
    'DECLINED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. The quote itself.
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "billingKind"        "RequestBilling";
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "estimateHours"      DECIMAL(5,2);
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "quotedPrice"        DECIMAL(10,2);
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "quotedAt"           TIMESTAMP(3);
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "clientDecision"     "ClientDecision";
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "clientDecisionAt"   TIMESTAMP(3);
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "clientDecisionNote" TEXT;

-- 3. The link to the billing phase an approved quote becomes.
--    UNIQUE is the idempotency guard: a client double-tapping approve in the
--    portal claims the link once, so it cannot bill twice. Same shape as the
--    existing "taskId" link.
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "phaseId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Request_phaseId_key" ON "Request" ("phaseId");

DO $$
BEGIN
  ALTER TABLE "Request"
    ADD CONSTRAINT "Request_phaseId_fkey"
    FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. The dashboard's "ממתין לאישור הלקוח" filter is a derived predicate
--    (quotedAt set, clientDecisionAt null) rather than a new RequestStatus, so
--    it needs an index rather than an enum change.
CREATE INDEX IF NOT EXISTS "Request_userId_quotedAt_idx" ON "Request" ("userId", "quotedAt");

COMMIT;

-- Verify - all zero on a fresh apply, and the column list should show all eight:
--   SELECT COUNT(*) FROM "Request" WHERE "billingKind" IS NOT NULL;
--   SELECT COUNT(*) FROM "Request" WHERE "quotedAt" IS NOT NULL AND "clientDecisionAt" IS NULL;
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'Request'
--      AND column_name IN ('billingKind','estimateHours','quotedPrice','quotedAt',
--                          'clientDecision','clientDecisionAt','clientDecisionNote','phaseId');
