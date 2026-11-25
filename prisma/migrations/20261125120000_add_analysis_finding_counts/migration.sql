-- Denormalized visible-finding totals so project lists do not need to scan the
-- findings JSON column for every repository. Nullable: existing rows keep null
-- until re-analysed or backfilled.

ALTER TABLE "Analysis"
  ADD COLUMN "findingsCount" INTEGER,
  ADD COLUMN "criticalFindingsCount" INTEGER;
