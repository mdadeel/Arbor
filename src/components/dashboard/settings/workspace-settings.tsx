'use client'

import { useState } from 'react'
import {
  Building2,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Plus,
  Shield,
  Trash2,
  UserCheck,
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

export function WorkspaceSettings() {
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [createdInviteToken, setCreatedInviteToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const workspacesQuery = trpc.workspace.list.useQuery()
  const activeWorkspace = workspacesQuery.data?.find((w: any) =>
    selectedWsId ? w.id === selectedWsId : true
  )

  const workspaceDetailQuery = trpc.workspace.get.useQuery(
    { workspaceIdOrSlug: activeWorkspace?.id ?? '' },
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
    },
  })

  const removeMemberMutation = trpc.workspace.removeMember.useMutation({
    onSuccess: () => {
      workspaceDetailQuery.refetch()
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
              No team workspaces created yet. Create one to enable team invitations and RBAC.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {workspacesQuery.data.map((ws: any) => {
                const isSelected = activeWorkspace?.id === ws.id
                return (
                  <div
                    key={ws.id}
                    onClick={() => setSelectedWsId(ws.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                        : 'border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {ws.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono capitalize">
                        {ws.role}
                      </Badge>
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
              <form onSubmit={handleInvite} className="space-y-3 rounded-md border border-border/70 p-3 bg-muted/10">
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
                    onValueChange={(val: any) => setInviteRole(val)}
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

                {createdInviteToken && (
                  <div className="mt-2 flex items-center justify-between rounded bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs text-emerald-400">
                    <span className="font-mono text-[11px] truncate">
                      Token: {createdInviteToken}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={copyInviteLink}
                      className="h-7 text-xs gap-1 text-emerald-400 hover:text-emerald-300"
                    >
                      {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy link'}
                    </Button>
                  </div>
                )}
              </form>
            )}

            {/* Members list */}
            <div className="divide-y divide-border/60">
              {workspaceDetailQuery.data.members.map((member: any) => (
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
