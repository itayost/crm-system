-- Phase 17: let a client sign off a delivered phase from the portal.
--
-- Purely additive, two nullable columns, no backfill. Every existing phase
-- reads as "the client has never answered on this", which is exactly true:
-- until now the portal rendered "ממתין לאישורך" on a phase with no approval
-- control anywhere, so no client has ever signed one off.
--
-- approvedAt already existed and could only be set by Itay. It stays the
-- sign-off; clientReviewedAt is the narrower fact that the *client themselves*
-- answered, which is the one that matters if an invoice is ever disputed.
--
-- Apply with:
--   npx prisma db execute --schema prisma/schema.prisma --file scripts/17_phase_client_review.sql
-- Safe to re-run.

BEGIN;

ALTER TABLE "ProjectPhase" ADD COLUMN IF NOT EXISTS "clientReviewedAt" TIMESTAMP(3);
ALTER TABLE "ProjectPhase" ADD COLUMN IF NOT EXISTS "clientNote" TEXT;

COMMIT;
