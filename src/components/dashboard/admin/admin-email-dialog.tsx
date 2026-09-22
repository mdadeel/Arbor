'use client'

import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { AlertCircle, CheckCircle2, Eye, Loader2, Mail, Send, Sparkles, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

interface AdminEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTargetType?: 'all' | 'selected' | 'individual'
  individualUser?: AdminUserItem | null
  selectedUsers?: AdminUserItem[]
  onSuccess?: () => void
}

const TEMPLATES: Record<string, { subject: string; body: string }> = {
  announcement: {
    subject: 'Important Announcement from the Arbor Team',
    body: `Hello,\n\nWe are excited to announce major improvements to the Arbor automated codebase intelligence platform.\n\nYou can now explore real-time AST dependency analysis, cross-repository fullstack API contracts, and comprehensive health scoring directly on your developer workbench.\n\nExplore your dashboard: https://arborgit.vercel.app/dashboard\n\nBest regards,\nThe Arbor Team`,
  },
  perks_granted: {
    subject: "You've been granted Arbor Pro Entitlements!",
    body: `Hello,\n\nGreat news! The Arbor platform administrators have granted your account Pro privileges and extended benefits.\n\nYour upgraded plan includes:\n- Unlimited AST architectural audits\n- Priority BullMQ analysis worker queue\n- Automated AI finding explanations and architectural summaries\n- Executive markdown report exports and dynamic README badges\n\nLog in now to experience your new perks: https://arborgit.vercel.app/dashboard\n\nBest,\nThe Arbor Team`,
  },
  feature_update: {
    subject: 'New Feature: Multi-Repo System Groups & API Explorer',
    body: `Hi developer,\n\nWe just launched Fullstack Systems on Arbor! You can now group your frontend and backend repositories into unified system architectures.\n\nFeatures include:\n- Automatic cross-boundary HTTP contract detection\n- Interactive React Flow topology graphs\n- CORS and environment parity audits\n\nCheck out the updates: https://arborgit.vercel.app/dashboard\n\nHappy coding,\nArbor Engineering`,
  },
  security_advisory: {
    subject: 'Security & Maintenance Advisory: Token Sync & Permissions',
    body: `Dear Developer,\n\nWe are performing routine maintenance to enhance token encryption and repository connection security.\n\nIf any of your private repositories show an authentication warning, please verify your Personal Access Token or re-connect your GitHub identity in Account Settings.\n\nThank you for trusting Arbor.`,
  },
  custom: {
    subject: '',
    body: '',
  },
}

export function AdminEmailDialog({
  open,
  onOpenChange,
  initialTargetType = 'selected',
  individualUser = null,
  selectedUsers = [],
  onSuccess,
}: AdminEmailDialogProps) {
  const [targetType, setTargetType] = useState<'all' | 'selected' | 'individual'>(initialTargetType)
  const [template, setTemplate] = useState<string>('announcement')
  const [subject, setSubject] = useState<string>(TEMPLATES.announcement.subject)
  const [body, setBody] = useState<string>(TEMPLATES.announcement.body)
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')

  useEffect(() => {
    if (individualUser) {
      setTargetType('individual')
    } else if (selectedUsers.length > 0) {
      setTargetType('selected')
    } else {
      setTargetType('all')
    }
  }, [individualUser, selectedUsers, open])

  const sendMutation = trpc.admin.sendEmail.useMutation({
    onSuccess: () => {
      onSuccess?.()
      onOpenChange(false)
    },
  })

  const applyTemplate = (key: string) => {
    setTemplate(key)
    if (TEMPLATES[key]) {
      setSubject(TEMPLATES[key].subject)
      setBody(TEMPLATES[key].body)
    }
  }

  // Determine recipient count and sample list
  let recipientCount = 0
  let recipientSample: string[] = []

  if (targetType === 'individual' && individualUser) {
    recipientCount = 1
    recipientSample = [individualUser.email]
  } else if (targetType === 'selected') {
    recipientCount = selectedUsers.length
    recipientSample = selectedUsers.slice(0, 5).map((u) => u.email)
  } else {
    recipientCount = 0 // Resolved server-side
  }

  const handleSend = () => {
    let userIds: string[] | undefined = undefined
    if (targetType === 'individual' && individualUser) {
      userIds = [individualUser.id]
    } else if (targetType === 'selected') {
      userIds = selectedUsers.map((u) => u.id)
    }

    sendMutation.mutate({
      targetType,
      userIds,
      subject,
      body,
      template,
    })
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-display">Direct Email Dispatcher</DialogTitle>
              <DialogDescription className="text-xs">
                Broadcast messages, notifications, or exclusive perk updates directly from the admin panel.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Target Audience Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Target Recipients</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  targetType === 'all'
                    ? 'border-foreground/80 bg-muted text-foreground font-semibold shadow-xs'
                    : 'border-border bg-muted/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  <span>All Users</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Broadcast to everyone</div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('selected')}
                disabled={selectedUsers.length === 0}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  targetType === 'selected'
                    ? 'border-foreground/80 bg-muted text-foreground font-semibold shadow-xs'
                    : selectedUsers.length === 0
                    ? 'opacity-50 cursor-not-allowed border-border bg-muted/5'
                    : 'border-border bg-muted/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Selected ({selectedUsers.length})</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Checked in directory</div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('individual')}
                disabled={!individualUser}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  targetType === 'individual'
                    ? 'border-foreground/80 bg-muted text-foreground font-semibold shadow-xs'
                    : !individualUser
                    ? 'opacity-50 cursor-not-allowed border-border bg-muted/5'
                    : 'border-border bg-muted/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5" />
                  <span>Individual</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {individualUser ? individualUser.name : 'Select user first'}
                </div>
              </button>
            </div>

            {/* Recipient Preview Chips */}
            {targetType !== 'all' && recipientSample.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground font-medium">To:</span>
                {recipientSample.map((email) => (
                  <Badge key={email} variant="outline" className="font-mono text-[10px] border-border bg-muted/40">
                    {email}
                  </Badge>
                ))}
                {recipientCount > 5 && (
                  <span className="text-[10px] text-muted-foreground">+{recipientCount - 5} more</span>
                )}
              </div>
            )}
          </div>

          {/* Template Quick Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground">Message Template</label>
              <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    viewMode === 'edit' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    viewMode === 'preview' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'announcement', label: 'Announcement' },
                { id: 'perks_granted', label: 'Pro Perks Granted' },
                { id: 'feature_update', label: 'Feature Update' },
                { id: 'security_advisory', label: 'Security Notice' },
                { id: 'custom', label: 'Blank / Custom' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                    template === t.id
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Field */}
          <div className="space-y-1">
            <label className="font-semibold text-foreground">Subject Line</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Update regarding your Arbor account..."
              className="text-xs h-9"
            />
          </div>

          {/* Body Field or Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground">Message Body</label>
              {viewMode === 'edit' && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground mr-1">Insert tag:</span>
                  <button
                    type="button"
                    onClick={() => setBody((prev) => prev + ' {{name}}')}
                    className="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted text-[10px] font-mono text-primary transition-colors border border-border/60"
                  >
                    {'{{name}}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBody((prev) => prev + ' {{email}}')}
                    className="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted text-[10px] font-mono text-primary transition-colors border border-border/60"
                  >
                    {'{{email}}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBody((prev) => prev + ' {{projectsCount}}')}
                    className="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted text-[10px] font-mono text-primary transition-colors border border-border/60"
                  >
                    {'{{projectsCount}}'}
                  </button>
                </div>
              )}
            </div>
            {viewMode === 'edit' ? (
              <textarea
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message here..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono leading-relaxed"
              />
            ) : (
              <div className="p-4 rounded-lg border border-border bg-muted/20 text-xs font-mono max-h-60 overflow-y-auto leading-relaxed text-foreground space-y-2">
                <div className="text-muted-foreground pb-2 border-b border-border/50 text-[11px] space-y-1">
                  <div><strong>From:</strong> Arbor Platform &lt;support@arborgit.com&gt;</div>
                  <div><strong>To:</strong> {individualUser ? `${individualUser.name} <${individualUser.email}>` : (targetType === 'selected' ? `${recipientSample[0] || 'selected-user@example.com'} (+${recipientCount - 1} recipients)` : 'All Active Users')}</div>
                  <div><strong>Subject:</strong> {subject || '(No subject)'}</div>
                </div>
                <div className="pt-2 whitespace-pre-wrap font-sans text-xs">
                  {(body || '(Empty body)')
                    .replace(/{{name}}/g, individualUser?.name || 'Alex Developer')
                    .replace(/{{email}}/g, individualUser?.email || 'developer@example.com')
                    .replace(/{{projectsCount}}/g, '3')}
                </div>
              </div>
            )}
          </div>

          {sendMutation.isError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{sendMutation.error.message || 'Failed to dispatch email.'}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={sendMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!subject.trim() || !body.trim() || sendMutation.isPending}
            onClick={handleSend}
            className="gap-2"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Send Direct Email</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
