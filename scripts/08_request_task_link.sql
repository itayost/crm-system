-- Support agent slice 5: one-to-one link from an approved Request to the Task it created.
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/08_request_task_link.sql

BEGIN;

ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "taskId" TEXT;

-- Unique: approving twice must never produce a second Task.
CREATE UNIQUE INDEX IF NOT EXISTS "Request_taskId_key" ON "Request"("taskId");

DO $$
BEGIN
  ALTER TABLE "Request"
    ADD CONSTRAINT "Request_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
