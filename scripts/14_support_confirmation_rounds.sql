-- Count how many times the support agent has put a summary to one client
-- without a ticket ever coming out of it.
--
-- The always-confirm rule had no upper bound. The follow-up sweep files an
-- unanswered draft after two days, but its clock measures the client's
-- SILENCE, and it is pushed forward every time the client writes - so a client
-- who keeps answering "כן" resets it on every turn and never reaches it. When
-- the agent then re-worded its own summary and asked again, nothing in the
-- system could end the exchange. That is exactly what happened to Eden.
--
-- This column is the bound: past a few rounds the agent files the wording the
-- client already approved instead of asking once more.
--
-- Additive and defaulted, so it is safe to run ahead of the code deploy.
--
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/14_support_confirmation_rounds.sql
--
-- Then regenerate the client:
--   npx prisma generate

BEGIN;

ALTER TABLE "SupportConversation"
  ADD COLUMN IF NOT EXISTS "confirmationRounds" INTEGER NOT NULL DEFAULT 0;

COMMIT;

-- Verify - every row reports 0, and conversations still holding a draft are
-- the ones the new bound will apply to from their next turn:
--   SELECT "confirmationRounds", COUNT(*) FROM "SupportConversation" GROUP BY 1;
--   SELECT "chatId", "confirmationAskedAt" FROM "SupportConversation" WHERE "pendingDraft" IS NOT NULL;
