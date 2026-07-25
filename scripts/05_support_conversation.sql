-- Support agent slice 2: one conversation row per WhatsApp chat on the bot session.
-- Holds the trimmed rolling history, the draft awaiting the client's confirmation,
-- when that confirmation was asked, and how many reminders went out (slice 6).
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/05_support_conversation.sql

BEGIN;

CREATE TABLE IF NOT EXISTS "SupportConversation" (
  "id"                  TEXT         NOT NULL,
  "chatId"              TEXT         NOT NULL,
  "clientId"            TEXT         NOT NULL,
  "contactId"           TEXT         NOT NULL,
  "userId"              TEXT         NOT NULL,
  "messages"            JSONB        NOT NULL DEFAULT '[]',
  "pendingDraft"        JSONB,
  "confirmationAskedAt" TIMESTAMP(3),
  "remindersSent"       INTEGER      NOT NULL DEFAULT 0,
  "lastActiveAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- Keyed per owner, not per chat id: one owner's conversation must never be
-- readable or overwritable through another's.
DROP INDEX IF EXISTS "SupportConversation_chatId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SupportConversation_userId_chatId_key" ON "SupportConversation"("userId","chatId");
CREATE INDEX IF NOT EXISTS "SupportConversation_clientId_idx" ON "SupportConversation"("clientId");
CREATE INDEX IF NOT EXISTS "SupportConversation_confirmationAskedAt_idx" ON "SupportConversation"("confirmationAskedAt");

DO $$
BEGIN
  ALTER TABLE "SupportConversation"
    ADD CONSTRAINT "SupportConversation_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SupportConversation"
    ADD CONSTRAINT "SupportConversation_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SupportConversation"
    ADD CONSTRAINT "SupportConversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
