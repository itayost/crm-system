-- CRM Architecture Redesign: In-Place Data Migration
-- Run this BEFORE `prisma db push` to transform the existing database.
-- This script creates the Contact table, migrates data, updates FKs, and drops old tables.

BEGIN;

-- 1. Create new enums
DO $$ BEGIN
  CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'CLIENT', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContactSource" AS ENUM ('WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RetentionFrequency" AS ENUM ('MONTHLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create Contact table
CREATE TABLE IF NOT EXISTS "Contact" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT NOT NULL,
  "company" TEXT,
  "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
  "source" "ContactSource" NOT NULL,
  "estimatedBudget" DECIMAL(10,2),
  "projectType" TEXT,
  "isVip" BOOLEAN NOT NULL DEFAULT false,
  "address" TEXT,
  "taxId" TEXT,
  "notes" TEXT,
  "convertedAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- 3. Migrate Client records -> Contact (status = CLIENT)
INSERT INTO "Contact" ("id", "name", "email", "phone", "company", "status", "source", "isVip", "address", "taxId", "notes", "convertedAt", "userId", "createdAt", "updatedAt")
SELECT
  c."id",
  c."name",
  c."email",
  c."phone",
  c."company",
  'CLIENT'::"ContactStatus",
  COALESCE(l."source"::text::"ContactSource", 'OTHER'::"ContactSource"),
  (c."type" = 'VIP'),
  c."address",
  c."taxId",
  c."notes",
  COALESCE(l."convertedAt", c."createdAt"),
  c."userId",
  c."createdAt",
  c."updatedAt"
FROM "Client" c
LEFT JOIN "Lead" l ON l."convertedToClientId" = c."id";

-- 4. Migrate non-converted Lead records -> Contact
INSERT INTO "Contact" ("id", "name", "email", "phone", "company", "status", "source", "estimatedBudget", "projectType", "isVip", "notes", "convertedAt", "userId", "createdAt", "updatedAt")
SELECT
  l."id",
  l."name",
  l."email",
  l."phone",
  l."company",
  CASE l."status"::text
    WHEN 'CONVERTED' THEN 'CLIENT'::"ContactStatus"
    WHEN 'LOST' THEN 'INACTIVE'::"ContactStatus"
    ELSE l."status"::text::"ContactStatus"
  END,
  l."source"::text::"ContactSource",
  l."estimatedBudget",
  l."projectType",
  false,
  l."notes",
  CASE WHEN l."status"::text = 'CONVERTED' THEN l."convertedAt" ELSE NULL END,
  l."userId",
  l."createdAt",
  l."updatedAt"
FROM "Lead" l
WHERE l."convertedToClientId" IS NULL;

-- 5. Add contactId column to Project (nullable first)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

-- 6. Populate contactId from clientId (client IDs are now contact IDs)
UPDATE "Project" SET "contactId" = "clientId";

-- 7. Make contactId NOT NULL
ALTER TABLE "Project" ALTER COLUMN "contactId" SET NOT NULL;

-- 8. Add price column (copy from budget)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "price" DECIMAL(10,2);
UPDATE "Project" SET "price" = "budget";

-- 9. Add retention columns
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "retention" DECIMAL(10,2);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "retentionFrequency" "RetentionFrequency";

-- 10. Make Task.projectId nullable
ALTER TABLE "Task" ALTER COLUMN "projectId" DROP NOT NULL;

-- 11. Map WAITING_APPROVAL tasks to IN_PROGRESS
UPDATE "Task" SET "status" = 'IN_PROGRESS' WHERE "status"::text = 'WAITING_APPROVAL';

-- 12. Drop subtask self-reference on Task
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_parentTaskId_fkey";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "parentTaskId";

-- 13. Drop priorityScore columns
ALTER TABLE "Project" DROP COLUMN IF EXISTS "priorityScore";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "priorityCalculatedAt";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "priorityScore";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "priorityCalculatedAt";

-- 14. Drop stage column from Project
ALTER TABLE "Project" DROP COLUMN IF EXISTS "stage";

-- 15. Add FK constraint for Contact
ALTER TABLE "Project" ADD CONSTRAINT "Project_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 16. Add FK for Contact -> User
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 17. Add indexes on Contact
CREATE INDEX IF NOT EXISTS "Contact_status_idx" ON "Contact"("status");
CREATE INDEX IF NOT EXISTS "Contact_createdAt_idx" ON "Contact"("createdAt");

-- 18. Drop old FK constraints
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_clientId_fkey";

-- 19. Drop old columns from Project
ALTER TABLE "Project" DROP COLUMN IF EXISTS "clientId";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "budget";

-- 20. Drop old tables (order matters for FK constraints)
DROP TABLE IF EXISTS "Milestone" CASCADE;
DROP TABLE IF EXISTS "Document" CASCADE;
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "RecurringPayment" CASCADE;
DROP TABLE IF EXISTS "Activity" CASCADE;
DROP TABLE IF EXISTS "Notification" CASCADE;
DROP TABLE IF EXISTS "Lead" CASCADE;
DROP TABLE IF EXISTS "Client" CASCADE;

-- 21. Drop old enums
DROP TYPE IF EXISTS "LeadStatus";
DROP TYPE IF EXISTS "LeadSource";
DROP TYPE IF EXISTS "ClientType";
DROP TYPE IF EXISTS "ClientStatus";
DROP TYPE IF EXISTS "ProjectStage";
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "PaymentType";
DROP TYPE IF EXISTS "Frequency";
DROP TYPE IF EXISTS "NotificationType";

-- 22. Drop old TaskStatus value (WAITING_APPROVAL) - can't easily remove enum values in PG
-- Prisma db push will handle enum cleanup

COMMIT;
