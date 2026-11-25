# Production Migration Deployment Order

Use this order when deploying the analysis finding-count change and the
reconciliation migration. It applies to the two migrations added in this release:

1. `20261125120000_add_analysis_finding_counts` — adds nullable
   `Analysis.findingsCount` and `Analysis.criticalFindingsCount`.
2. `20261125130000_reconcile_schema_drift` — adds schema objects that were
   previously created with `db push`. The DDL is idempotent, so it is safe when
   the objects already exist.

Do **not** run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset`
against production. Only `prisma migrate deploy` applies committed migrations.

## Order

1. **Rehearse on staging.** Restore a recent production snapshot and run the
   complete sequence below against it. Confirm the projects page shows a score
   trend and finding totals.

2. **Take a backup or database snapshot.** The migrations are additive, but a
   snapshot is the only fast rollback for the backfill.

3. **Use a direct, non-pooled connection for migrations.** If your host provides
   separate pooled and direct URLs, set `DATABASE_URL` to the direct URL for the
   commands below. Migration advisory locks can fail through a transaction
   pooler.

4. **Check the migration state.**

   ```bash
   npx prisma migrate status
   ```

   Resolve any failed migration before continuing.

5. **Apply migrations before deploying the new application.**

   ```bash
   npx prisma migrate deploy
   ```

   The reconcile migration is intentionally idempotent because existing
   databases may already contain its tables and columns. It is expected to
   succeed on both fresh and previously `db push`-synced databases.

6. **Backfill existing finding counters.** This is safe while the old app is
   still serving traffic: the columns are nullable and the old code ignores
   them. It only updates completed analyses whose counters are still `null`,
   and it can be rerun safely.

   ```bash
   npx tsx scripts/backfill-finding-counts.ts
   ```

7. **Deploy the new application.** The new runner writes both counters whenever
   an analysis completes, so only historical rows depend on the backfill.

8. **Verify.**

   ```sql
   SELECT count(*)
   FROM "Analysis"
   WHERE status = 'completed' AND "findingsCount" IS NULL;
   ```

   Expect `0`. Check the projects page for a trend and finding counts, and check
   `/api/health` for database and Redis readiness.

## Rollback

- Rolling the application back is safe: the new columns are nullable and older
  code does not read them.
- Do not drop the new columns to roll back. They are additive and dropping them
  would require a later migration.
- If the backfill was incorrect, fix the script and rerun it; it only touches
  rows with `NULL` counters.
- If a migration fails, stop and inspect `npx prisma migrate status` before
  retrying. Do not edit an already-applied migration.
