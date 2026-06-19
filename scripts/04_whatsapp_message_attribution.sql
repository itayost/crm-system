-- Phase 3: WhatsApp message attribution columns for multi-person clients + extraction bookkeeping.
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/04_whatsapp_message_attribution.sql

BEGIN;

ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "rawChatId"   TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "clientId"    TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_clientId_idx"             ON "WhatsAppMessage"("clientId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_processedAt_idx"          ON "WhatsAppMessage"("processedAt");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_clientId_processedAt_idx" ON "WhatsAppMessage"("clientId","processedAt");

-- Backfill the clientId snapshot from each message's contact (after Contact.clientId is populated).
UPDATE "WhatsAppMessage" m
SET "clientId" = c."clientId"
FROM "Contact" c
WHERE m."contactId" = c."id"
  AND m."clientId" IS NULL
  AND c."clientId" IS NOT NULL;

-- Throttle the first extraction run: mark all messages older than 14 days as already processed
-- so the extraction pass only looks at the recent window and doesn't draft hundreds of stale tickets.
UPDATE "WhatsAppMessage"
SET "processedAt" = CURRENT_TIMESTAMP
WHERE "processedAt" IS NULL
  AND "timestamp" < (CURRENT_TIMESTAMP - INTERVAL '14 days');

COMMIT;
