-- Every list and dashboard query filters by userId, usually together with
-- status, but only Request had a composite index for it. The rest were falling
-- back to a single-column status index and filtering the owner in memory.
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/10_owner_scoped_indexes.sql

BEGIN;

CREATE INDEX IF NOT EXISTS "Project_userId_status_idx" ON "Project"("userId","status");
CREATE INDEX IF NOT EXISTS "Task_userId_status_idx"    ON "Task"("userId","status");
CREATE INDEX IF NOT EXISTS "Contact_userId_status_idx" ON "Contact"("userId","status");

-- Referential actions on these foreign keys scan the whole child table without
-- an index: deleting one contact or project scanned every request.
CREATE INDEX IF NOT EXISTS "Request_contactId_idx" ON "Request"("contactId");
CREATE INDEX IF NOT EXISTS "Request_projectId_idx" ON "Request"("projectId");
CREATE INDEX IF NOT EXISTS "SupportConversation_contactId_idx" ON "SupportConversation"("contactId");
CREATE INDEX IF NOT EXISTS "Project_primaryContactId_idx" ON "Project"("primaryContactId");

COMMIT;
