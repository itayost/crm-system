-- Structured intake on a client request: where it happens, what happened, what
-- was expected, how often, whether it used to work, whether it blocks them.
-- Filled by the support agent from what the client said, mostly without asking.
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/11_request_intake.sql

BEGIN;

ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "intake" JSONB;

COMMIT;
