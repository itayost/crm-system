-- Phase 1 cleanup: drop the dormant Project.contactId column.
-- RUN ONLY AFTER the new Client-based code is verified in production.
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/02_drop_project_contactid.sql

BEGIN;

ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_contactId_fkey";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "contactId";

COMMIT;
