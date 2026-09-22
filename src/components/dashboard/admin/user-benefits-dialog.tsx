'use client'

import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Check, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { AdminUserItem } from '@/server/services/admin'

interface UserBenefitsDialogProps {
  user: AdminUserItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (updatedUser: AdminUserItem) => void
}

const AVAILABLE_PERKS = [
  {
    id: 'unlimited_analyses',
    title: 'Unlimited AST Analyses',
    description: 'Bypasses standard daily and hourly analysis run limits.',
  },
  {
    id: 'priority_worker',
    title: 'Priority BullMQ Queue',
    description: 'Fast-track worker processing for cloning and AST parsing.',
  },
  {
    id: 'ai_insights',
    title: 'Pro AI Insights & Explanations',
    description: 'Access to automated architectural summaries without BYOK keys.',
  },
  {
    id: 'custom_export',
    title: 'White-label Exports & Badges',
    description: 'Full Markdown / JSON / dynamic badge generation capabilities.',
  },
  {
    id: 'early_access',
    title: 'Beta Experimental Tools',
    description: 'Immediate access to unreleased AST visualizers and linters.',
  },
]

export function UserBenefitsDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserBenefitsDialogProps) {
  const [plan, setPlan] = useState<string>('free')
  const [selectedPerks, setSelectedPerks] = useState<string[]>([])
  const [customNotes, setCustomNotes] = useState<string>('')

  useEffect(() => {
    if (user) {
      setPlan(user.plan || 'free')
      setSelectedPerks(user.benefits?.perks || [])
      setCustomNotes(user.benefits?.customNotes || '')
    }
  }, [user])

  const mutation = trpc.admin.updateUserBenefits.useMutation({
    onSuccess: (data) => {
      onSuccess(data.user)
      onOpenChange(false)
    },
  })

  const togglePerk = (perkId: string) => {
    setSelectedPerks((prev) =>
      prev.includes(perkId) ? prev.filter((id) => id !== perkId) : [...prev, perkId]
    )
  }

  const applyPreset = (preset: 'free' | 'pro' | 'vip') => {
    if (preset === 'free') {
      setPlan('free')
      setSelectedPerks([])
      setCustomNotes('Reset to Community Free tier')
    } else if (preset === 'pro') {
      setPlan('pro')
      setSelectedPerks(['unlimited_analyses', 'priority_worker', 'ai_insights'])
      setCustomNotes('Complimentary Pro tier granted by administrator')
    } else if (preset === 'vip') {
      setPlan('lifetime')
      setSelectedPerks(AVAILABLE_PERKS.map((p) => p.id))
      setCustomNotes('Lifetime VIP benefits & unlimited access')
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-display">Manage User Benefits &amp; Plan</DialogTitle>
              <DialogDescription className="text-xs">
                Grant subscription tiers, unlock custom perks, and attach administrator notes for{' '}
                <strong className="text-foreground">{user.name}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Quick Presets */}
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
            <span className="text-[11px] font-medium text-muted-foreground">Quick Presets:</span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('free')}
                className="h-7 text-[11px] px-2.5"
              >
                Reset Free
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('pro')}
                className="h-7 text-[11px] px-2.5"
              >
                Grant Pro
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('vip')}
                className="h-7 text-[11px] px-2.5"
              >
                Lifetime VIP
              </Button>
            </div>
          </div>

          {/* Plan Tier Selection */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Subscription Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'free', label: 'Community Free' },
                { id: 'pro', label: 'Pro Tier' },
                { id: 'teams', label: 'Teams Tier' },
                { id: 'enterprise', label: 'Enterprise' },
                { id: 'lifetime', label: 'Lifetime Pass' },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setPlan(tier.id)}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    plan === tier.id
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20'
                  }`}
                >
                  <div className="capitalize text-xs">{tier.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Perks Multi-Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground">Active Benefits &amp; Entitlements</label>
              <span className="text-[11px] text-muted-foreground">
                {selectedPerks.length} selected
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {AVAILABLE_PERKS.map((perk) => {
                const isSelected = selectedPerks.includes(perk.id)
                return (
                  <button
                    key={perk.id}
                    type="button"
                    onClick={() => togglePerk(perk.id)}
                    className={`w-full p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-colors ${
                      isSelected
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/20'
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded mt-0.5 shrink-0 flex items-center justify-center border ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-muted-foreground/40 bg-background'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-xs">{perk.title}</div>
                      <div className="text-[11px] text-muted-foreground">{perk.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Grant Notes */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Grant Reason / Admin Note</label>
            <Input
              placeholder="e.g. VIP sponsor, early beta tester, hackathon winner..."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          {mutation.isError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
              {mutation.error.message || 'Failed to update user benefits.'}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                userId: user.id,
                plan,
                perks: selectedPerks,
                customNotes,
              })
            }
            className="gap-2"
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Save Benefits</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
