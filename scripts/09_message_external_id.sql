-- WhatsApp message identity: WAHA's own message id, so a redelivered webhook is
-- recognised instead of being archived, answered, and billed a second time.
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/09_message_external_id.sql

BEGIN;

ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

-- Unique where present. Postgres allows many NULLs in a unique index, so the
-- rows archived before this column existed are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_externalId_key"
  ON "WhatsAppMessage"("externalId");

COMMIT;
