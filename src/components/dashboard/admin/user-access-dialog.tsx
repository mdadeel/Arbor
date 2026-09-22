'use client'

import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Check, CheckCircle2, Loader2, Shield, UserCheck, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AdminUserItem } from '@/server/services/admin'

interface UserAccessDialogProps {
  user: AdminUserItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (updatedUser: AdminUserItem) => void
}

export function UserAccessDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserAccessDialogProps) {
  const [role, setRole] = useState<string>('user')
  const [status, setStatus] = useState<string>('active')
  const [bypassRateLimit, setBypassRateLimit] = useState(false)
  const [canAnalyzePrivate, setCanAnalyzePrivate] = useState(true)
  const [unlimitedProjects, setUnlimitedProjects] = useState(false)

  useEffect(() => {
    if (user) {
      setRole(user.role || 'user')
      setStatus(user.status || 'active')
      setBypassRateLimit(Boolean(user.permissions?.bypassRateLimit))
      setCanAnalyzePrivate(user.permissions?.canAnalyzePrivate !== false)
      setUnlimitedProjects(Boolean(user.permissions?.unlimitedProjects))
    }
  }, [user])

  const mutation = trpc.admin.updateUserAccess.useMutation({
    onSuccess: (data) => {
      onSuccess(data.user)
      onOpenChange(false)
    },
  })

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-display">User Access Controls &amp; Permissions</DialogTitle>
              <DialogDescription className="text-xs">
                Manage roles, account activity status, and security permissions for{' '}
                <strong className="text-foreground">{user.name}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Role Selection */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Account Role</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'user', label: 'User', desc: 'Standard member' },
                { id: 'moderator', label: 'Moderator', desc: 'Read-only admin console' },
                { id: 'admin', label: 'Admin', desc: 'Full console & controls' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    role === r.id
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20'
                  }`}
                >
                  <div className="text-xs font-semibold">{r.label}</div>
                  <div className="text-[10px] text-muted-foreground">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Account Status</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`p-2.5 rounded-lg border flex items-center gap-2 transition-all ${
                  status === 'active'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'border-border bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20'
                }`}
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <div className="text-xs">Active</div>
                  <div className="text-[10px] opacity-70">Normal system access</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('suspended')}
                className={`p-2.5 rounded-lg border flex items-center gap-2 transition-all ${
                  status === 'suspended'
                    ? 'border-red-500/40 bg-red-500/10 text-red-500 font-bold shadow-xs'
                    : 'border-border bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20'
                }`}
              >
                <UserX className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <div className="text-xs">Suspended</div>
                  <div className="text-[10px] opacity-70">Block sign-in &amp; runs</div>
                </div>
              </button>
            </div>
          </div>

          {/* Granular Permission Toggles */}
          <div className="space-y-2 pt-1">
            <label className="font-semibold text-foreground">Capability Overrides</label>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/15 transition-colors">
                <div>
                  <div className="font-medium text-foreground text-xs">Bypass Rate Limits</div>
                  <div className="text-[11px] text-muted-foreground">Exempt from sliding-window analysis caps (10/hr).</div>
                </div>
                <input
                  type="checkbox"
                  checked={bypassRateLimit}
                  onChange={(e) => setBypassRateLimit(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/15 transition-colors">
                <div>
                  <div className="font-medium text-foreground text-xs">Analyze Private Repositories</div>
                  <div className="text-[11px] text-muted-foreground">Allow cloning private repositories via OAuth/PAT tokens.</div>
                </div>
                <input
                  type="checkbox"
                  checked={canAnalyzePrivate}
                  onChange={(e) => setCanAnalyzePrivate(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/15 transition-colors">
                <div>
                  <div className="font-medium text-foreground text-xs">Unlimited Repositories</div>
                  <div className="text-[11px] text-muted-foreground">Remove repository connection count limits.</div>
                </div>
                <input
                  type="checkbox"
                  checked={unlimitedProjects}
                  onChange={(e) => setUnlimitedProjects(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
              </label>
            </div>
          </div>

          {mutation.isError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
              {mutation.error.message || 'Failed to update access controls.'}
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
                role,
                status,
                permissions: {
                  bypassRateLimit,
                  canAnalyzePrivate,
                  unlimitedProjects,
                },
              })
            }
            className="gap-2"
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Save Controls</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
