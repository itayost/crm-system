-- Support agent slice 4: what the agent found in a project's repository while
-- talking to the client, carried onto the filed request's internal note.
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/07_support_repo_findings.sql

BEGIN;

ALTER TABLE "SupportConversation" ADD COLUMN IF NOT EXISTS "repoFindings" JSONB NOT NULL DEFAULT '[]';

COMMIT;
