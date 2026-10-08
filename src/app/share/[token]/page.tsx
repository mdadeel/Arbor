import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { getSharedReport } from '@/server/services/report-sharing'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/createui/button'

export const metadata = {
  title: 'Shared Arbor report',
  robots: { index: false, follow: false },
}

type SharedFinding = {
  id?: string
  title?: string
  category?: string
  severity?: string
  detail?: string
  recommendation?: string
  file?: string
  line?: number
  policyPack?: string
  policySuppressed?: boolean
}

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const shared = await getSharedReport(token)
  if (!shared) notFound()
  const { analysis } = shared
  const findings = analysis.findings as SharedFinding[]
  const scoreItems = [
    ['Overall', analysis.scores.overall],
    ['Architecture', analysis.scores.architecture],
    ['Maintainability', analysis.scores.techDebt],
    ['Performance', analysis.scores.performance],
    ['Security', analysis.scores.security],
  ] as const

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-2">
          <Badge variant="outline" className="gap-1.5 text-[10px] uppercase tracking-wide">
            <ShieldCheck className="h-3 w-3" /> Read-only shared report
          </Badge>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{analysis.projectName}</h1>
          <p className="text-xs text-muted-foreground">
            Scan from {new Date(analysis.createdAt).toLocaleString()} · branch <span className="font-mono">{analysis.branch}</span>
            {analysis.commitSha ? ` · ${analysis.commitSha.slice(0, 7)}` : ''}
          </p>
        </div>
        <Button asChild variant="neutral-light" appearance="outline" size="sm">
          <Link href={`/api/share/${token}`} target="_blank" rel="noreferrer">
            Download report JSON <ExternalLink className="size-3.5" />
          </Link>
        </Button>
      </header>

      <section aria-label="Score summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {scoreItems.map(([label, value]) => (
          <Card key={label} className="border-border">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">{value ?? '—'}<span className="text-xs text-muted-foreground">/100</span></p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-border">
        <CardHeader className="border-b border-border/70 py-4">
          <CardTitle className="text-sm">Findings ({findings.length})</CardTitle>
          <CardDescription className="text-xs">A bounded static analysis snapshot. Confirm each signal in context; this report is not a security certification.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/60 p-0">
          {findings.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No findings were recorded for this scan.</p>
          ) : findings.map((finding, index) => (
            <article key={finding.id ?? index} className="space-y-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 flex-1 text-sm font-semibold">{finding.title ?? 'Finding'}</h2>
                {finding.severity && <Badge variant="outline" className="capitalize">{finding.severity}</Badge>}
                {finding.category && <Badge variant="secondary" className="capitalize">{finding.category}</Badge>}
                {finding.policyPack && <span className="text-[10px] text-muted-foreground">Policy: {finding.policyPack}</span>}
              </div>
              {finding.file && <p className="font-mono text-[11px] text-muted-foreground">{finding.file}{finding.line ? `:${finding.line}` : ''}</p>}
              {finding.detail && <p className="text-xs leading-relaxed text-muted-foreground">{finding.detail}</p>}
              {finding.recommendation && <p className="text-xs leading-relaxed text-foreground/80"><span className="font-semibold">Next step:</span> {finding.recommendation}</p>}
              {finding.policySuppressed && <p className="text-[10px] text-muted-foreground">Suppressed by this report&apos;s recorded policy settings.</p>}
            </article>
          ))}
        </CardContent>
      </Card>

      <footer className="text-[11px] leading-relaxed text-muted-foreground">
        This link expires {new Date(shared.sharedUntil).toLocaleString()} and can be revoked by its project owner. It grants access only to this report snapshot.
      </footer>
    </main>
  )
}
