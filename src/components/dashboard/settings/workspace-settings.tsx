'use client'

import { useState } from 'react'
import {
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type InviteRole = 'admin' | 'member' | 'viewer'

export function WorkspaceSettings() {
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<InviteRole>('member')
  const [createdInviteToken, setCreatedInviteToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  const workspacesQuery = trpc.workspace.list.useQuery()
  const activeWorkspace = workspacesQuery.data?.find((w) =>
    selectedWsId ? w.id === selectedWsId : true
  )

  const workspaceDetailQuery = trpc.workspace.get.useQuery(
    { workspaceIdOrSlug: activeWorkspace?.id ?? '' },
    { enabled: Boolean(activeWorkspace?.id) }
  )

  const billingQuery = trpc.billing.status.useQuery(
    { workspaceId: activeWorkspace?.id ?? '' },
    { enabled: Boolean(activeWorkspace?.id) }
  )

  const createWsMutation = trpc.workspace.create.useMutation({
    onSuccess: (ws) => {
      setNewWorkspaceName('')
      workspacesQuery.refetch()
      setSelectedWsId(ws.id)
    },
  })

  const inviteMutation = trpc.workspace.invite.useMutation({
    onSuccess: (invitation) => {
      setInviteEmail('')
      setCreatedInviteToken(invitation.token)
      workspaceDetailQuery.refetch()
      billingQuery.refetch()
    },
  })

  const removeMemberMutation = trpc.workspace.removeMember.useMutation({
    onSuccess: () => {
      workspaceDetailQuery.refetch()
      billingQuery.refetch()
    },
  })

  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => {
      setBillingError(null)
      window.location.assign(checkoutUrl)
    },
    onError: (err) => {
      setBillingError(err.message)
    },
  })

  const portalMutation = trpc.billing.createPortalSession.useMutation({
    onSuccess: ({ portalUrl }) => {
      setBillingError(null)
      window.open(portalUrl, '_blank', 'noopener,noreferrer')
    },
    onError: (err) => {
      setBillingError(err.message)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return
    createWsMutation.mutate({ name: newWorkspaceName.trim() })
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeWorkspace || !inviteEmail.trim()) return
    inviteMutation.mutate({
      workspaceId: activeWorkspace.id,
      email: inviteEmail.trim(),
      role: inviteRole,
    })
  }

  const copyInviteLink = () => {
    if (!createdInviteToken) return
    const link = `${window.location.origin}/invite/${createdInviteToken}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const billing = billingQuery.data

  return (
    <div className="space-y-6">
      {/* Workspaces List & Creation */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Your Workspaces
          </CardTitle>
          <CardDescription className="text-xs">
            Multi-tenant teams and project organizations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new workspace inline form */}
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="New workspace name (e.g. Acme Engineering)"
              className="text-xs h-9"
            />
            <Button
              type="submit"
              size="sm"
              disabled={createWsMutation.isPending || !newWorkspaceName.trim()}
              className="gap-1.5 text-xs shrink-0"
            >
              {createWsMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Create Workspace
            </Button>
          </form>

          {/* Workspaces list */}
          {workspacesQuery.isLoading ? (
            <p className="text-xs text-muted-foreground py-3">Loading workspaces...</p>
          ) : !workspacesQuery.data || workspacesQuery.data.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No team workspaces created yet. Create one to enable team invitations, RBAC, and workspace billing.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {workspacesQuery.data.map((ws) => {
                const isSelected = activeWorkspace?.id === ws.id
                return (
                  <div
                    key={ws.id}
                    onClick={() => {
                      setSelectedWsId(ws.id)
                      setBillingError(null)
                    }}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                        : 'border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {ws.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={ws.plan === 'teams' ? 'default' : 'secondary'}
                          className="text-[10px] font-mono uppercase"
                        >
                          {ws.plan}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono capitalize">
                          {ws.role}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground font-mono">
                      <span>{ws.memberCount} members</span>
                      <span>·</span>
                      <span>{ws.projectCount} projects</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Workspace Plan & Billing */}
      {activeWorkspace && billing && (
        <Card className="border-border">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  {billing.workspaceName} Plan &amp; Billing
                </CardTitle>
                <CardDescription className="text-xs">
                  Flat per-workspace pricing via Lemon Squeezy (never billed per seat).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={billing.plan === 'teams' ? 'default' : 'outline'}
                  className="font-mono text-[10px] uppercase"
                >
                  {billing.plan === 'teams'
                    ? `Teams · $${billing.monthlyPriceUsd}/mo`
                    : 'Free · $0/mo'}
                </Badge>
                {billing.subscription && (
                  <Badge variant="secondary" className="font-mono text-[10px] capitalize">
                    {billing.subscription.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-md border border-border/70 bg-muted/10 p-3">
                <p className="text-[11px] text-muted-foreground">Analysis quota</p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                  {billing.limits.hourlyAnalyses} / hour
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/10 p-3">
                <p className="text-[11px] text-muted-foreground">Workspace members</p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                  {billing.usage.members}
                  {billing.usage.pendingInvites > 0
                    ? ` (+${billing.usage.pendingInvites} invited)`
                    : ''}{' '}
                  / {billing.limits.maxWorkspaceMembers}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/10 p-3">
                <p className="text-[11px] text-muted-foreground">Scheduled scans</p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                  {billing.usage.enabledScheduledScans} / {billing.limits.maxScheduledScans}
                </p>
              </div>
            </div>

            {billing.subscription?.renewsAt && !billing.subscription.cancelAtPeriodEnd && (
              <p className="text-xs text-muted-foreground">
                Next renewal:{' '}
                <span className="font-mono text-foreground">
                  {new Date(billing.subscription.renewsAt).toLocaleDateString()}
                </span>
              </p>
            )}
            {billing.subscription?.endsAt && billing.subscription.cancelAtPeriodEnd && (
              <p className="text-xs text-amber-400">
                Subscription cancelled — Teams limits remain active until{' '}
                <span className="font-mono">
                  {new Date(billing.subscription.endsAt).toLocaleDateString()}
                </span>
                .
              </p>
            )}

            {billingError && (
              <p role="alert" className="text-xs font-medium text-red-400">
                {billingError}
              </p>
            )}

            {billing.canManageBilling ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(billing.plan === 'free' || billing.subscription?.cancelAtPeriodEnd) && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={checkoutMutation.isPending || !billing.billingConfigured}
                    onClick={() => checkoutMutation.mutate({ workspaceId: activeWorkspace.id })}
                    className="gap-1.5 text-xs"
                  >
                    {checkoutMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Upgrade Workspace (${billing.monthlyPriceUsd}/mo)
                  </Button>
                )}

                {billing.subscription?.hasPortal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={portalMutation.isPending}
                    onClick={() => portalMutation.mutate({ workspaceId: activeWorkspace.id })}
                    className="gap-1.5 text-xs"
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    Manage Billing Portal
                  </Button>
                )}

                {!billing.billingConfigured && (
                  <span className="text-[11px] text-muted-foreground">
                    Set Lemon Squeezy environment variables to enable live checkout on this deployment.
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only the workspace owner can upgrade plans or open the billing portal.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Workspace Team & RBAC Management */}
      {activeWorkspace && workspaceDetailQuery.data && (
        <Card className="border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {workspaceDetailQuery.data.name} Team Members
                </CardTitle>
                <CardDescription className="text-xs">
                  Role-based access control (Owner, Admin, Member, Viewer).
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px]">
                Your role: {workspaceDetailQuery.data.currentUserRole}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Invite Form */}
            {(workspaceDetailQuery.data.currentUserRole === 'owner' ||
              workspaceDetailQuery.data.currentUserRole === 'admin') && (
              <form
                onSubmit={handleInvite}
                className="space-y-3 rounded-md border border-border/70 p-3 bg-muted/10"
              >
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 text-primary" />
                  Invite Teammate
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="text-xs h-9 flex-1 min-w-[200px]"
                  />
                  <Select
                    value={inviteRole}
                    onValueChange={(val) => {
                      if (val === 'admin' || val === 'member' || val === 'viewer') {
                        setInviteRole(val)
                      }
                    }}
                  >
                    <SelectTrigger className="w-[120px] h-9 text-xs">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={inviteMutation.isPending || !inviteEmail.trim()}
                    className="text-xs h-9 gap-1.5 shrink-0"
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                    Send Invite
                  </Button>
                </div>

                {inviteMutation.error && (
                  <p role="alert" className="text-xs font-medium text-red-400">
                    {inviteMutation.error.message}
                  </p>
                )}

                {createdInviteToken && (
                  <div className="mt-2 flex items-center justify-between rounded bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs text-emerald-400">
                    <span className="font-mono text-[11px] truncate">
                      Invite ready: {createdInviteToken}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={copyInviteLink}
                      className="h-7 text-xs gap-1 text-emerald-400 hover:text-emerald-300"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? 'Copied' : 'Copy link'}
                    </Button>
                  </div>
                )}
              </form>
            )}

            {/* Members list */}
            <div className="divide-y divide-border/60">
              {workspaceDetailQuery.data.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-2.5 px-1"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage src={member.user.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {member.user.name?.slice(0, 2).toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {member.user.name ?? 'Member'}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {member.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={member.role === 'owner' ? 'default' : 'outline'}
                      className="text-[10px] font-mono capitalize"
                    >
                      {member.role}
                    </Badge>
                    {member.role !== 'owner' &&
                      workspaceDetailQuery.data.currentUserRole === 'owner' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeMemberMutation.mutate({
                              workspaceId: activeWorkspace.id,
                              targetUserId: member.userId,
                            })
                          }
                          className="h-7 w-7 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
