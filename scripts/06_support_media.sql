-- Support agent slice 3: media on archived messages, and media pending attachment
-- on an open support conversation.
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/06_support_media.sql

BEGIN;

ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "mediaPath"     TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "mediaMimeType" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "transcript"    TEXT;

ALTER TABLE "SupportConversation" ADD COLUMN IF NOT EXISTS "pendingMedia" JSONB NOT NULL DEFAULT '[]';

COMMIT;
