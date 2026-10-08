'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Check,
  HelpCircle,
  Clock3,
  Download,
  ExternalLink,
  GitPullRequest,
  Link2,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/createui/button'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function signed(value: number | null | undefined, suffix = '') {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value}${suffix}`
}

export function TrendView({ slug }: { slug: string }) {
  const trend = trpc.insights.trends.useQuery({ slug })
  if (trend.isLoading) return <Card><CardContent className="py-10 text-center text-xs text-muted-foreground">Loading comparable analysis history…</CardContent></Card>
  if (trend.error) return <Card><CardContent className="py-10 text-center text-xs text-destructive">{trend.error.message}</CardContent></Card>
  const data = trend.data?.series ?? []

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm"><TrendingUp className="h-4 w-4 text-primary" />Analysis trends</CardTitle>
          <CardDescription className="mt-1 max-w-2xl text-xs leading-relaxed">
            Comparable score and visible-finding changes. Arbor keeps this chart on the latest branch and only joins runs with the same analyzer and effective policy versions; results remain historical static-analysis snapshots.
          </CardDescription>
        </div>
        {trend.data?.latest && (
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">Latest score <strong className="ml-1 font-mono text-foreground">{trend.data.latest.overallScore ?? '—'}</strong></span>
            <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">Since previous <strong className={cn('ml-1 font-mono', (trend.data.delta?.overallScore ?? 0) >= 0 ? 'text-emerald-400' : 'text-amber-300')}>{signed(trend.data.delta?.overallScore)}</strong></span>
            <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">Critical change <strong className="ml-1 font-mono text-foreground">{signed(trend.data.delta?.criticalCount)}</strong></span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 sm:p-5">
        {data.length < 2 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <HelpCircle className="h-5 w-5 text-primary/70" />
            <p className="font-medium text-foreground">Run another scan to establish a trend.</p>
            <p>Arbor compares completed scans for this project; the graph appears after two results.</p>
          </div>
        ) : (
          <div className="h-64 w-full" role="img" aria-label="Line chart of overall health score and finding counts over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.map((point) => ({ ...point, dateLabel: new Date(point.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }))} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis yAxisId="scores" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="findings" orientation="right" allowDecimals={false} width={30} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value, name) => [value, name === 'overallScore' ? 'Overall score' : name === 'findingsCount' ? 'Findings' : 'Critical findings']}
                  labelFormatter={(label, values) => {
                    const point = values[0]?.payload as { branch?: string; commitSha?: string | null } | undefined
                    return `${label}${point?.branch ? ` · ${point.branch}` : ''}${point?.commitSha ? ` · ${point.commitSha.slice(0, 7)}` : ''}`
                  }}
                />
                <Line yAxisId="scores" type="monotone" dataKey="overallScore" name="overallScore" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                <Line yAxisId="findings" type="monotone" dataKey="findingsCount" name="findingsCount" stroke="#f59e0b" strokeWidth={1.8} dot={false} />
                <Line yAxisId="findings" type="monotone" dataKey="criticalCount" name="criticalCount" stroke="#ef4444" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.length > 0 && <p className="mt-2 text-[10px] text-muted-foreground">Showing {data.length} compatible scan(s) on <span className="font-mono text-foreground">{trend.data?.branch}</span> · analyzer version {trend.data?.analysisVersion} · {trend.data?.excludedRuns ?? 0} recent run(s) from other branches or policy versions excluded · finding counts omit policy-suppressed items.</p>}
      </CardContent>
    </Card>
  )
}

export function ScheduleControls({ slug, defaultBranch }: { slug: string; defaultBranch: string }) {
  const utils = trpc.useUtils()
  const schedule = trpc.insights.schedule.useQuery({ slug })
  const [enabled, setEnabled] = useState(false)
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('weekly')
  const [branch, setBranch] = useState(defaultBranch)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!schedule.data) return
    setEnabled(schedule.data.enabled)
    setCadence(schedule.data.cadence)
    setBranch(schedule.data.branch)
  }, [schedule.data])

  const update = trpc.insights.updateSchedule.useMutation({
    onSuccess: async () => {
      setMessage('Schedule saved. Due scans are dispatched by the recovery-safe worker.')
      await utils.insights.schedule.invalidate({ slug })
    },
    onError: (error) => setMessage(error.message),
  })

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><CalendarClock className="h-4 w-4 text-primary" />Scheduled scans</CardTitle>
        <CardDescription className="text-xs leading-relaxed">Keep the report fresh on a daily or weekly cadence. Dispatch is database-backed and recoverable; overlapping scans are skipped rather than duplicated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-border/60 pt-4">
        {schedule.error && <p className="text-xs text-destructive">{schedule.error.message}</p>}
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
          <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-foreground">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="accent-primary" />
            Enable schedule
          </label>
          <label className="space-y-1 text-[11px] text-muted-foreground">
            Scan frequency
            <select value={cadence} onChange={(event) => setCadence(event.target.value as 'daily' | 'weekly')} className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground">
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
            </select>
          </label>
          <label className="space-y-1 text-[11px] text-muted-foreground">
            Branch
            <input value={branch} onChange={(event) => setBranch(event.target.value)} maxLength={255} className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground" />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-[10px] text-muted-foreground">
            {schedule.data?.nextRunAt && <p className="flex items-center gap-1.5"><Clock3 className="h-3 w-3" />Next run {new Date(schedule.data.nextRunAt).toLocaleString()}</p>}
            {schedule.data?.lastRunAt && <p>Last dispatch {new Date(schedule.data.lastRunAt).toLocaleString()}</p>}
            {schedule.data?.lastError && <p className="flex items-center gap-1.5 text-amber-300"><AlertTriangle className="h-3 w-3" />{schedule.data.lastError}</p>}
          </div>
          <Button variant="primary" appearance="outline" size="sm" loading={update.isPending} onClick={() => update.mutate({ slug, enabled, cadence, branch: branch.trim() || defaultBranch })}>
            <Check className="size-3.5" /> Save schedule
          </Button>
        </div>
        {message && <p role="status" className={cn('text-xs', message.includes('saved') ? 'text-emerald-400' : 'text-amber-300')}>{message}</p>}
      </CardContent>
    </Card>
  )
}

export function ShareReportControl({ slug, analysisId }: { slug: string; analysisId: string }) {
  const utils = trpc.useUtils()
  const links = trpc.share.list.useQuery({ slug })
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const create = trpc.share.create.useMutation({
    onSuccess: async (result) => {
      setNewLink(`${window.location.origin}/share/${result.token}`)
      setMessage('Link created. The secret URL is shown only once; copy it now.')
      await utils.share.list.invalidate({ slug })
    },
    onError: (error) => setMessage(error.message),
  })
  const revoke = trpc.share.revoke.useMutation({
    onSuccess: async () => {
      setMessage('Share link revoked.')
      setNewLink(null)
      await utils.share.list.invalidate({ slug })
    },
    onError: (error) => setMessage(error.message),
  })

  const copyLink = async () => {
    if (!newLink) return
    try {
      await navigator.clipboard.writeText(newLink)
      setMessage('Share link copied to clipboard.')
    } catch {
      setMessage('Clipboard access was blocked. Select and copy the link manually.')
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><Link2 className="h-4 w-4 text-primary" />Read-only report links</CardTitle>
        <CardDescription className="text-xs leading-relaxed">Create an expiring, revocable link to this completed snapshot. Anyone with the link can view its bounded report details; no repository access or account is needed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-[11px] text-muted-foreground">
            Link lifetime
            <select value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))} className="ml-2 h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
              {[1, 7, 14, 30].map((days) => <option key={days} value={days}>{days} day{days === 1 ? '' : 's'}</option>)}
            </select>
          </label>
          <Button variant="primary" appearance="solid" size="sm" loading={create.isPending} onClick={() => { setNewLink(null); create.mutate({ slug, analysisId, expiresInDays }) }}>
            <Link2 className="size-3.5" /> Create share link
          </Button>
        </div>
        {newLink && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <label htmlFor="new-share-link" className="text-[10px] font-semibold uppercase tracking-wide text-primary">Copy this secret link now</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="new-share-link" readOnly value={newLink} onFocus={(event) => event.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-mono text-[11px] text-foreground" />
              <Button variant="neutral-light" appearance="outline" size="sm" onClick={copyLink}><Download className="size-3.5" /> Copy link</Button>
            </div>
          </div>
        )}
        {links.error && <p className="text-xs text-destructive">{links.error.message}</p>}
        {links.data && links.data.length > 0 && (
          <ul className="divide-y divide-border/60 rounded-md border border-border/70">
            {links.data.map((link) => {
              const expired = new Date(link.expiresAt) <= new Date()
              return (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0 text-[11px]">
                    <p className="font-mono text-foreground">Analysis {link.analysisId.slice(0, 10)}</p>
                    <p className="text-muted-foreground">{expired ? 'Expired' : 'Expires'} {new Date(link.expiresAt).toLocaleString()}</p>
                  </div>
                  {expired ? <span className="text-[10px] text-muted-foreground">No longer accessible</span> : (
                    <Button variant="danger" appearance="ghost" size="xs" loading={revoke.isPending && revoke.variables?.id === link.id} onClick={() => revoke.mutate({ slug, id: link.id })}>Revoke</Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {message && <p role="status" className={cn('text-xs', message.toLowerCase().includes('error') || message.toLowerCase().includes('blocked') ? 'text-amber-300' : 'text-muted-foreground')}>{message}</p>}
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground"><ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />The raw access token is never stored in plaintext. Treat the copied URL as a bearer secret and revoke it if shared accidentally.</p>
      </CardContent>
    </Card>
  )
}

export function PullRequestChecksView({ slug }: { slug: string }) {
  const pullRequests = trpc.project.pullRequests.useQuery({ slug }, { refetchInterval: (query) => query.state.data?.some((item) => item.status === 'queued' || item.status === 'analyzing') ? 5_000 : false })
  if (pullRequests.isLoading) return <Card><CardContent className="py-10 text-center text-xs text-muted-foreground">Loading pull-request checks…</CardContent></Card>
  if (pullRequests.error) return <Card><CardContent className="py-10 text-center text-xs text-destructive">{pullRequests.error.message}</CardContent></Card>
  const rows = pullRequests.data ?? []
  return (
    <Card className="border-border">
      <CardHeader className="border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><GitPullRequest className="h-4 w-4 text-primary" />GitHub pull-request health checks</CardTitle>
        <CardDescription className="text-xs leading-relaxed">Signed webhook deliveries queue scans at the exact pull-request head commit. Arbor publishes an idempotent Check Run and annotations only for findings that overlap added lines.</CardDescription>
      </CardHeader>
      {rows.length === 0 ? (
        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-muted-foreground">
          <GitPullRequest className="h-5 w-5 text-primary/70" />
          <p className="font-medium text-foreground">No pull-request checks yet</p>
          <p>When a configured GitHub webhook receives a supported pull-request event for this repository, its analysis and Check Run appear here.</p>
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {rows.map((item) => {
              return (
                <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">#{item.number} {item.title}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="break-all font-mono text-[10px] text-muted-foreground">{item.baseBranch} ← {item.headBranch} · {item.headSha.slice(0, 12)}</p>
                    <p className="text-[10px] text-muted-foreground">Received {new Date(item.createdAt).toLocaleString()}{item.completedAt ? ` · completed ${new Date(item.completedAt).toLocaleString()}` : ''}</p>
                    {item.overallScore != null && <p className="text-[11px] text-foreground">Score {item.overallScore}/100 · {item.findingsCount} finding(s) ({item.criticalCount} critical, {item.warningCount} warnings)</p>}
                    {item.errorMessage && <p className="text-[10px] text-red-300">Analysis: {item.errorMessage}</p>}
                    {item.checkError && <p className="text-[10px] text-amber-300">Check Run publication: {item.checkError}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.checkUrl ? (
                      <Button asChild variant="neutral-light" appearance="outline" size="xs"><a href={item.checkUrl} target="_blank" rel="noreferrer">Open GitHub Check Run <ExternalLink className="size-3" /></a></Button>
                    ) : <span className="self-center text-[10px] text-muted-foreground">Check Run pending</span>}
                    {item.analysisId && <Button asChild variant="primary" appearance="ghost" size="xs"><a href={`/projects/${encodeURIComponent(slug)}?tab=findings`}>View report</a></Button>}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

function numeric(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function SupplyChainView({ slug }: { slug: string }) {
  const supply = trpc.project.supplyChain.useQuery({ slug })
  if (supply.isLoading) return <Card><CardContent className="py-10 text-center text-xs text-muted-foreground">Building dependency inventory…</CardContent></Card>
  if (supply.error) return <Card><CardContent className="py-10 text-center text-xs text-destructive">{supply.error.message}</CardContent></Card>
  if (!supply.data?.inventory) return (
    <Card className="border-dashed"><CardContent className="py-12 text-center text-xs text-muted-foreground">No dependency inventory is available yet. Run a fresh analysis to inspect supported manifests and lockfiles.</CardContent></Card>
  )

  const inventory = supply.data.inventory
  const inventoryTruncated = inventory.truncated === true
  const inventoryComplete = inventory.complete === true
  const packageListTruncated = inventory.packagesTruncated === true
  const packages = (Array.isArray(inventory.packages) ? inventory.packages : []).map(asRecord).filter((pkg): pkg is Record<string, unknown> => Boolean(pkg))
  const advisoryReport = asRecord(supply.data.advisories)
  const advisories = (Array.isArray(advisoryReport?.advisories) ? advisoryReport.advisories : []).map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item))
  const ecosystems = Array.isArray(inventory.ecosystems) ? inventory.ecosystems.filter((item): item is string => typeof item === 'string') : []

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm"><ShieldAlert className="h-4 w-4 text-primary" />Dependency inventory &amp; supply-chain risk</CardTitle>
            <CardDescription className="mt-1 max-w-2xl text-xs">Normalized resolved packages and advisory matches for the analyzed commit. An incomplete inventory means some constraints or transitive dependencies could not be resolved.</CardDescription>
          </div>
          {supply.data.analysisId && supply.data.sbomAvailable && (
            <Button asChild variant="primary" appearance="outline" size="sm">
              <a href={`/api/projects/${encodeURIComponent(slug)}/analyses/${encodeURIComponent(supply.data.analysisId)}/sbom`}><Download className="size-3.5" /> Download CycloneDX SBOM</a>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Direct" value={numeric(inventory.directCount)} />
            <Metric label="Transitive" value={numeric(inventory.transitiveCount)} />
            <Metric label="Ecosystems" value={ecosystems.join(', ') || '—'} />
            <Metric label="Inventory" value={inventoryTruncated ? 'Capped' : inventoryComplete ? 'Resolved' : 'Partial'} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Array.isArray(inventory.lockfiles) ? inventory.lockfiles : []).map((file) => typeof file === 'string' ? <span key={file} className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">{file}</span> : null)}
          </div>
          {inventoryTruncated && <p className="text-[10px] text-amber-300">Inventory reached the 5,000-package safety cap; SBOM and advisory coverage may be partial.</p>}
          {packageListTruncated && <p className="text-[10px] text-amber-300">Package list capped at 250 rows for this view; the complete retained inventory is attached to the analysis.</p>}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="border-b border-border/70 pb-3">
          <CardTitle className="text-sm">Advisory matching</CardTitle>
          <CardDescription className="text-xs">Provider: {typeof advisoryReport?.source === 'string' ? advisoryReport.source : 'GitHub Advisory Database'} · Status: {typeof advisoryReport?.status === 'string' ? advisoryReport.status : 'not checked'} · Queried {numeric(advisoryReport?.queriedCount)} package versions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {advisories.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              {advisoryReport?.status === 'unavailable' || advisoryReport?.status === 'partial'
                ? `No advisory match was confirmed. The provider reported: ${typeof advisoryReport.error === 'string' ? advisoryReport.error : 'partial coverage'}`
                : 'No matching advisories were found for the resolved versions queried.'}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {advisories.slice(0, 50).map((item, index) => (
                <li key={`${String(item.id)}-${String(item.packageName)}-${index}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">{String(item.packageName)} · {String(item.id)}</span>
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-red-300">{String(item.severity)}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{String(item.summary)}</p>
                    <p className="text-[10px] text-muted-foreground">Affected range: {String(item.vulnerableRange ?? 'not specified')} · fixed in: {String(item.patchedVersion ?? 'not specified')}</p>
                  </div>
                  {typeof item.url === 'string' && <a className="shrink-0 text-[11px] text-primary underline-offset-2 hover:underline" href={item.url} target="_blank" rel="noreferrer">Advisory details</a>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="border-b border-border/70 pb-3">
          <CardTitle className="text-sm">Normalized packages ({numeric(inventory.directCount) + numeric(inventory.transitiveCount)})</CardTitle>
          <CardDescription className="text-xs">{inventoryComplete ? 'Lockfile-backed resolved versions' : 'Partial or constraint-only versions; resolution status is shown per package'}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[48rem] text-left text-[11px]">
              <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Package</th><th className="px-3 py-2">Version</th><th className="px-3 py-2">Dependency path</th><th className="px-3 py-2">Ecosystem / type</th><th className="px-3 py-2">PURL</th><th className="px-3 py-2">State</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {packages.slice(0, 250).map((pkg, index) => (
                  <tr key={`${String(pkg.purl ?? pkg.name)}-${index}`}>
                    <td className="px-3 py-2 font-medium text-foreground">{String(pkg.name ?? 'unknown')}{pkg.direct ? <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary">direct</span> : null}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{String(pkg.version ?? 'unknown')}</td>
                    <td className="max-w-60 truncate px-3 py-2 font-mono text-[10px] text-muted-foreground" title={Array.isArray(pkg.dependencyPath) ? pkg.dependencyPath.map(String).join(' → ') : ''}>{Array.isArray(pkg.dependencyPath) ? pkg.dependencyPath.map(String).join(' → ') : '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{String(pkg.ecosystem ?? '—')} / {String(pkg.dependencyType ?? '—')}</td>
                    <td className="max-w-60 truncate px-3 py-2 font-mono text-[10px] text-muted-foreground" title={String(pkg.purl ?? '')}>{String(pkg.purl ?? '—')}</td>
                    <td className="px-3 py-2"><span className={cn('rounded-full border px-1.5 py-0.5 text-[9px]', pkg.resolved ? 'border-emerald-500/25 text-emerald-300' : 'border-amber-500/30 text-amber-300')}>{pkg.resolved ? 'resolved' : 'constraint'}</span></td>
                  </tr>
                ))}
                {packages.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No supported package records in this analysis.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-border/70 bg-background/50 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words font-mono text-sm font-semibold text-foreground">{value}</p></div>
}

export function NotificationPreferences() {
  const utils = trpc.useUtils()
  const preferences = trpc.notifications.preferences.useQuery()
  const [enabled, setEnabled] = useState(true)
  const [minimumSeverity, setMinimumSeverity] = useState<'critical' | 'warning' | 'info'>('critical')
  const [scoreRegressionThreshold, setScoreRegressionThreshold] = useState(10)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!preferences.data) return
    setEnabled(preferences.data.enabled)
    setMinimumSeverity(preferences.data.minimumSeverity as 'critical' | 'warning' | 'info')
    setScoreRegressionThreshold(preferences.data.scoreRegressionThreshold)
  }, [preferences.data])

  const update = trpc.notifications.updatePreferences.useMutation({
    onSuccess: async () => {
      setMessage('Notification preferences saved.')
      await utils.notifications.preferences.invalidate()
    },
    onError: (error) => setMessage(error.message),
  })

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><BellRing className="h-4 w-4 text-primary" />Analysis notifications</CardTitle>
        <CardDescription className="text-xs">Choose which completed-scan events appear in your in-app inbox. Duplicate project/run events are deduplicated automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-border/60 pt-4">
        {preferences.error && <p className="text-xs text-destructive">{preferences.error.message}</p>}
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-foreground"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="accent-primary" />Enable notifications</label>
          <label className="space-y-1 text-[11px] text-muted-foreground">Minimum finding severity<select value={minimumSeverity} onChange={(event) => setMinimumSeverity(event.target.value as typeof minimumSeverity)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"><option value="critical">Critical only</option><option value="warning">Warning or higher</option><option value="info">All findings</option></select></label>
          <label className="space-y-1 text-[11px] text-muted-foreground">Notify after score drops by<select value={scoreRegressionThreshold} onChange={(event) => setScoreRegressionThreshold(Number(event.target.value))} className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground">{[5, 10, 15, 20, 25].map((threshold) => <option key={threshold} value={threshold}>{threshold} points</option>)}</select></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] leading-relaxed text-muted-foreground">Notifications show in the authenticated Arbor inbox; this preference does not opt you into external email delivery.</p>
          <Button variant="primary" appearance="outline" size="sm" loading={update.isPending} onClick={() => update.mutate({ enabled, minimumSeverity, scoreRegressionThreshold })}><Check className="size-3.5" /> Save preferences</Button>
        </div>
        {message && <p role="status" className={cn('text-xs', message.includes('saved') ? 'text-emerald-400' : 'text-amber-300')}>{message}</p>}
      </CardContent>
    </Card>
  )
}
