'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Save } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/createui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type RuleOverride = { enabled?: boolean; severity?: 'info' | 'warning' | 'critical' }
type Draft = { enabled: boolean; overrides: Record<string, RuleOverride> }

function objectOverrides(value: unknown): Record<string, RuleOverride> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, RuleOverride>
}

export function PolicyControls({ slug }: { slug: string }) {
  const utils = trpc.useUtils()
  const state = trpc.policy.forProject.useQuery({ slug })
  const [scope, setScope] = useState<'project' | 'workspace'>('project')
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!state.data) return
    setDrafts(Object.fromEntries(state.data.map((pack) => [pack.key, {
      enabled: pack.effective.enabled,
      overrides: objectOverrides(pack.effective.overrides),
    }])))
  }, [state.data])

  const update = trpc.policy.update.useMutation({
    onSuccess: async () => {
      setMessage('Policy settings saved. New scans will record these versions.')
      await utils.policy.forProject.invalidate({ slug })
    },
    onError: (error) => setMessage(error.message),
  })

  const setRule = (packKey: string, ruleId: string, value: string) => {
    setDrafts((current) => {
      const draft = current[packKey] ?? { enabled: true, overrides: {} }
      const overrides = { ...draft.overrides }
      if (value === 'default') delete overrides[ruleId]
      else if (value === 'off') overrides[ruleId] = { enabled: false }
      else overrides[ruleId] = { enabled: true, severity: value as RuleOverride['severity'] }
      return { ...current, [packKey]: { ...draft, overrides } }
    })
  }

  if (state.isLoading) return <p className="text-xs text-muted-foreground">Loading policy packs…</p>
  if (state.error) return <p className="text-xs text-destructive">{state.error.message}</p>

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary" />Versioned analysis policies</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            Policy overrides change finding severity and suppression for future scans; they do not erase raw evidence. Each analysis stores the effective pack versions used.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Apply changes to
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              value={scope}
              onChange={(event) => setScope(event.target.value as 'project' | 'workspace')}
            >
              <option value="project">This project</option>
              {state.data?.[0]?.workspaceAvailable && <option value="workspace">Entire workspace</option>}
            </select>
          </label>
          {scope === 'workspace' && <span className="text-[10px] text-muted-foreground">Workspace-wide policy changes require an owner or admin role.</span>}
        </CardContent>
      </Card>

      {state.data?.map((pack) => {
        const draft = drafts[pack.key] ?? { enabled: true, overrides: {} }
        return (
          <Card key={pack.key} className="border-border">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-sm">{pack.title}</CardTitle>
                <CardDescription className="max-w-2xl text-xs">{pack.description}</CardDescription>
                <p className="text-[10px] text-muted-foreground">Effective version {pack.effective.version}</p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => setDrafts((current) => ({ ...current, [pack.key]: { ...draft, enabled: event.target.checked } }))}
                  className="accent-primary"
                />
                Enabled
              </label>
            </CardHeader>
            <CardContent className="space-y-2 border-t border-border/60 pt-3">
              {pack.rules.map((rule) => {
                const override = draft.overrides[rule.id]
                const value = override?.enabled === false ? 'off' : override?.severity ?? 'default'
                return (
                  <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-background/35 px-3 py-2">
                    <span className="text-xs text-foreground">{rule.title}</span>
                    <select
                      aria-label={`Policy action for ${rule.title}`}
                      className="h-7 rounded border border-border bg-background px-2 text-[11px] text-foreground"
                      value={value}
                      onChange={(event) => setRule(pack.key, rule.id, event.target.value)}
                    >
                      <option value="default">Default severity</option>
                      <option value="critical">Critical</option>
                      <option value="warning">Warning</option>
                      <option value="info">Info</option>
                      <option value="off">Suppress this rule</option>
                    </select>
                  </div>
                )
              })}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-[10px] text-muted-foreground">Project-specific settings override workspace settings for the same pack.</p>
                <Button
                  variant="primary"
                  appearance="outline"
                  size="sm"
                  loading={update.isPending && update.variables?.packKey === pack.key}
                  onClick={() => update.mutate({
                    slug,
                    packKey: pack.key,
                    scope,
                    enabled: draft.enabled,
                    overrides: draft.overrides,
                  })}
                >
                  <Save className="size-3.5" /> Save {pack.title}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
      {message && <p role="status" className={cn('text-xs', message.includes('saved') ? 'text-emerald-400' : 'text-amber-300')}>{message}</p>}
    </div>
  )
}
