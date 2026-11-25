/**
 * Backfills Analysis.findingsCount / criticalFindingsCount from stored findings.
 *
 * Safe to re-run: only rows with a null findingsCount are processed. Run after
 * the add_analysis_finding_counts migration:
 *
 *   npx tsx scripts/backfill-finding-counts.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PAGE_SIZE = 100

type StoredFinding = { severity?: unknown; policySuppressed?: unknown }

function countVisible(findings: unknown): { visible: number; critical: number } {
  const rows = Array.isArray(findings) ? (findings as StoredFinding[]) : []
  const visibleRows = rows.filter(
    (row) => row && typeof row === 'object' && !row.policySuppressed
  )
  return {
    visible: visibleRows.length,
    critical: visibleRows.filter((row) => row.severity === 'critical').length,
  }
}

async function main() {
  let cursor: string | undefined
  let updated = 0

  while (true) {
    const rows = await prisma.analysis.findMany({
      where: { status: 'completed', findingsCount: null },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, findings: true },
    })
    if (rows.length === 0) break

    for (const row of rows) {
      const counts = countVisible(row.findings)
      await prisma.analysis.update({
        where: { id: row.id },
        data: {
          findingsCount: counts.visible,
          criticalFindingsCount: counts.critical,
        },
      })
      updated++
    }

    cursor = rows[rows.length - 1].id
    console.log(`Backfilled ${updated} analyses…`)
  }

  console.log(`Done. Updated ${updated} analyses.`)
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
