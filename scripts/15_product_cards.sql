-- The support bot's knowledge substrate: a per-project ProductCard (what the
-- delivered product is, in Hebrew, regenerated from the repo) and a per-client
-- profile (what the bot may know about the client, and may therefore say).
--
-- Client.notes deliberately stays as it is - owner-private, never prompted.
-- The profile is a separate column precisely so that boundary stays legible.
--
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/15_product_cards.sql
--
-- Then regenerate the client:
--   npx prisma generate

BEGIN;

CREATE TABLE IF NOT EXISTS "ProductCard" (
  "id"            TEXT NOT NULL,
  "projectId"     TEXT NOT NULL,
  "cardHe"        TEXT NOT NULL,
  "manualNotesHe" TEXT,
  "commitSha"     TEXT,
  "generatedAt"   TIMESTAMP(3),
  "sourceNote"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductCard_projectId_key" ON "ProductCard" ("projectId");

DO $$
BEGIN
  ALTER TABLE "ProductCard"
    ADD CONSTRAINT "ProductCard_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "profileHe" TEXT;

COMMIT;

-- Verify:
--   SELECT to_regclass('"ProductCard"');
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'Client' AND column_name = 'profileHe';
