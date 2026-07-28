-- The lead pipeline the owner actually sells through: a lead is NEW, then
-- CONTACTED, then a spec meeting is booked (MEETING_SCHEDULED), then a quote
-- goes out (QUOTED). NEGOTIATING never described a real stage and folds into
-- QUOTED. LOST gives a dead lead somewhere to go that is not INACTIVE, which
-- means "churned client".
--
-- Also adds the next action every lead carries: one date, one note.
--
-- This is the first enum VALUE rebuild in this repo (scripts/migrate-in-place.sql
-- explicitly punted on removing a value). It works because "ContactStatus" is
-- referenced by exactly one column, "Contact"."status" - verify before running:
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE udt_name = 'ContactStatus';
--
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/12_contact_pipeline.sql
--
-- Then regenerate the client:
--   npx prisma generate

BEGIN;

-- 1. The next action. Additive, so it is safe ahead of the code deploy.
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "nextActionAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "nextActionNote" TEXT;

-- 2. Rebuild the enum. Postgres can add a value in place but cannot remove one,
--    so the whole type is replaced and the column re-cast through text.
--
--    The guard asks whether the type already holds a new value, NOT whether the
--    column still has type "ContactStatus" - after a successful run it does,
--    because the replacement was renamed into that name, and guarding on the
--    name would make a second run try to cast to a type that no longer exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ContactStatus' AND e.enumlabel = 'MEETING_SCHEDULED'
  ) THEN
    CREATE TYPE "ContactStatus_new" AS ENUM (
      'NEW',
      'CONTACTED',
      'MEETING_SCHEDULED',
      'QUOTED',
      'CLIENT',
      'LOST',
      'INACTIVE'
    );

    ALTER TABLE "Contact" ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE "Contact"
      ALTER COLUMN "status" TYPE "ContactStatus_new"
      USING (
        CASE WHEN "status"::text = 'NEGOTIATING' THEN 'QUOTED' ELSE "status"::text END
      )::"ContactStatus_new";

    DROP TYPE "ContactStatus";
    ALTER TYPE "ContactStatus_new" RENAME TO "ContactStatus";

    ALTER TABLE "Contact" ALTER COLUMN "status" SET DEFAULT 'NEW';
  END IF;
END $$;

-- 3. The leads list sorts on this, overdue first.
CREATE INDEX IF NOT EXISTS "Contact_userId_nextActionAt_idx"
  ON "Contact" ("userId", "nextActionAt");

COMMIT;

-- Verify:
--   SELECT unnest(enum_range(NULL::"ContactStatus"));
--   SELECT status, COUNT(*) FROM "Contact" GROUP BY 1 ORDER BY 1;
--   -- expect zero NEGOTIATING and a QUOTED count raised by however many there were
