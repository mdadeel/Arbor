'use client'

import { useEffect, useState } from 'react'
import { Check, FileDiff, History, Save, Sparkles } from 'lucide-react'
import type { FindingData } from './finding-item'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/createui/button'
import { cn } from '@/lib/utils'

type TriageStatus = 'open' | 'accepted_risk' | 'false_positive' | 'resolved'

export function FindingWorkflowActions({ finding, slug, analysisId }: {
  finding: FindingData
  slug: string
  analysisId?: string
}) {
  const utils = trpc.useUtils()
  const triage = trpc.policy.triageList.useQuery({ slug })
  const [status, setStatus] = useState<TriageStatus>('open')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const savedTriage = triage.data?.find((entry) => entry.fingerprint === finding.fingerprint)
  const hasFingerprint = Boolean(finding.fingerprint && /^[a-f0-9]{64}$/i.test(finding.fingerprint))
  const history = trpc.policy.triageHistory.useQuery(
    { slug, fingerprint: finding.fingerprint ?? '' },
    { enabled: showHistory && hasFingerprint }
  )

  useEffect(() => {
    if (!savedTriage) return
    if (['open', 'accepted_risk', 'false_positive', 'resolved'].includes(savedTriage.status)) {
      setStatus(savedTriage.status as TriageStatus)
    }
    setNote(savedTriage.note ?? '')
  }, [savedTriage])

  const saveTriage = trpc.policy.triage.useMutation({
    onSuccess: async () => {
      setMessage('Triage decision recorded in the audit history.')
      await Promise.all([
        utils.policy.triageList.invalidate({ slug }),
        finding.fingerprint ? utils.policy.triageHistory.invalidate({ slug, fingerprint: finding.fingerprint }) : Promise.resolve(),
      ])
    },
    onError: (error) => setMessage(error.message),
  })

  const canSuggestPatch = Boolean(analysisId && finding.fingerprint && /^[a-f0-9]{64}$/i.test(finding.fingerprint) && finding.file && !finding.policySuppressed)
  const proposals = trpc.patchSuggestion.list.useQuery({ slug }, { enabled: canSuggestPatch })
  const createPatch = trpc.patchSuggestion.create.useMutation({
    onSuccess: async () => {
      setMessage('Validated patch proposal saved for review only; no repository files were changed.')
      await utils.patchSuggestion.list.invalidate({ slug })
    },
    onError: (error) => setMessage(error.message),
  })
  const setProposalStatus = trpc.patchSuggestion.setStatus.useMutation({
    onSuccess: async () => {
      setMessage('Proposal status updated. No repository files were changed.')
      await utils.patchSuggestion.list.invalidate({ slug })
    },
    onError: (error) => setMessage(error.message),
  })
  const matchingProposals = proposals.data?.filter((proposal) => proposal.analysisId === analysisId && proposal.findingFingerprint === finding.fingerprint) ?? []

  return (
    <div className="space-y-2 pt-1">
      <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/35 p-3 sm:flex-row sm:items-end">
        <label className="min-w-36 space-y-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Finding disposition
          <select value={status} onChange={(event) => setStatus(event.target.value as TriageStatus)} className="h-8 w-full rounded-md border border-border bg-background px-2 text-[11px] font-normal normal-case tracking-normal text-foreground">
            <option value="open">Open</option>
            <option value="accepted_risk">Accepted risk</option>
            <option value="false_positive">False positive</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="min-w-0 flex-1 space-y-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Audit note <span className="font-normal normal-case tracking-normal">(optional)</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} placeholder="Context or follow-up…" className="h-8 w-full rounded-md border border-border bg-background px-2 text-[11px] font-normal normal-case tracking-normal text-foreground placeholder:text-muted-foreground/60" />
        </label>
        <Button variant="neutral-light" appearance="outline" size="sm" loading={saveTriage.isPending} onClick={() => saveTriage.mutate({
          slug,
          finding: { id: finding.id, title: finding.title, ...(finding.ruleId ? { ruleId: finding.ruleId } : {}), ...(finding.file ? { file: finding.file } : {}) },
          status,
          note: note.trim() || null,
        })}>
          <Save className="size-3.5" /> Save triage
        </Button>
      </div>

      {hasFingerprint && (
        <div>
          <Button variant="neutral-light" appearance="ghost" size="xs" onClick={() => setShowHistory((open) => !open)}>
            <History className="size-3" /> {showHistory ? 'Hide audit history' : 'View audit history'}
          </Button>
          {showHistory && (
            <div className="mt-2 rounded-lg border border-border/70 bg-background/35 p-3">
              {history.isLoading ? <p className="text-[10px] text-muted-foreground">Loading triage history…</p> : history.error ? <p className="text-[10px] text-destructive">{history.error.message}</p> : history.data?.length ? (
                <ol className="space-y-2">
                  {history.data.map((event) => (
                    <li key={event.id} className="border-l border-primary/30 pl-2.5 text-[10px]">
                      <p className="font-medium text-foreground">{event.fromStatus ? `${event.fromStatus.replace('_', ' ')} → ` : ''}{event.toStatus.replace('_', ' ')}</p>
                      <p className="text-muted-foreground">{event.actor.name ?? 'Team member'} · {new Date(event.createdAt).toLocaleString()}</p>
                      {event.note && <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{event.note}</p>}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-[10px] text-muted-foreground">No triage decisions recorded yet.</p>}
            </div>
          )}
        </div>
      )}

      {canSuggestPatch && (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.035] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" />Review-only patch proposal</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">A bounded AI suggestion is validated against the pinned source file. Arbor will never apply it or open a pull request.</p>
            </div>
            <Button variant="primary" appearance="outline" size="sm" loading={createPatch.isPending} disabled={!finding.file || !analysisId || !finding.fingerprint} onClick={() => createPatch.mutate({ slug, analysisId: analysisId!, findingFingerprint: finding.fingerprint! })}>
              <FileDiff className="size-3.5" /> Suggest patch
            </Button>
          </div>
          {proposals.error && <p className="mt-2 text-[10px] text-destructive">{proposals.error.message}</p>}
          {matchingProposals.map((proposal) => (
            <details key={proposal.id} className="mt-3 overflow-hidden rounded-md border border-border/70 bg-background/70">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-foreground">{proposal.summary}</span>
                <span className={cn('rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide', proposal.status === 'proposed' ? 'border-primary/30 text-primary' : proposal.status === 'accepted' ? 'border-emerald-500/30 text-emerald-300' : 'border-border text-muted-foreground')}>{proposal.status}</span>
              </summary>
              <div className="space-y-2 border-t border-border/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>{proposal.provider} · {proposal.model}</span>
                  <span>{proposal.validation && typeof proposal.validation === 'object' && 'addedLines' in proposal.validation ? `Validated: +${String(proposal.validation.addedLines)} / −${String('removedLines' in proposal.validation ? proposal.validation.removedLines : 0)} lines` : 'Diff passed the single-file apply check'}</span>
                </div>
                <pre className="max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/40 p-3 font-mono text-[10px] leading-relaxed text-foreground"><code>{proposal.diff}</code></pre>
                {proposal.status === 'proposed' && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="success" appearance="outline" size="xs" loading={setProposalStatus.isPending && setProposalStatus.variables?.id === proposal.id} onClick={() => setProposalStatus.mutate({ slug, id: proposal.id, status: 'accepted' })}><Check className="size-3" /> Mark reviewed</Button>
                    <Button variant="neutral-light" appearance="ghost" size="xs" loading={setProposalStatus.isPending && setProposalStatus.variables?.id === proposal.id} onClick={() => setProposalStatus.mutate({ slug, id: proposal.id, status: 'dismissed' })}>Dismiss</Button>
                  </div>
                )}
                <p className="text-[10px] leading-relaxed text-muted-foreground">“Mark reviewed” records approval for human follow-up only; it does not write to GitHub, change the local repository, or create a pull request.</p>
              </div>
            </details>
          ))}
        </div>
      )}

      {message && <p role="status" className={cn('text-[10px]', message.includes('recorded') || message.includes('saved') || message.includes('updated') ? 'text-emerald-400' : 'text-amber-300')}>{message}</p>}
    </div>
  )
}
