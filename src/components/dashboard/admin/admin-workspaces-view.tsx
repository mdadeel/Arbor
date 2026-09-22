'use client'

import { useState } from 'react'
import type { AdminWorkspaceItem } from '@/server/services/admin'
import { trpc } from '@/lib/trpc'
import {
  Building2,
  Calendar,
  FolderGit2,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AdminWorkspacesViewProps {
  initialWorkspaces: AdminWorkspaceItem[]
}

export function AdminWorkspacesView({ initialWorkspaces }: AdminWorkspacesViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWorkspace, setSelectedWorkspace] = useState<AdminWorkspaceItem | null>(null)

  const {
    data: workspaces = initialWorkspaces,
    isLoading,
    refetch,
    isFetching,
  } = trpc.admin.listWorkspaces.useQuery(undefined, {
    initialData: initialWorkspaces,
    refetchOnWindowFocus: false,
  })

  const filteredWorkspaces = workspaces.filter((w) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      w.name.toLowerCase().includes(term) ||
      w.slug.toLowerCase().includes(term) ||
      w.owner.name.toLowerCase().includes(term) ||
      w.owner.email.toLowerCase().includes(term) ||
      w.owner.githubUsername.toLowerCase().includes(term)
    )
  })

  const totalMembers = workspaces.reduce((sum, w) => sum + w.membersCount, 0)
  const totalProjects = workspaces.reduce((sum, w) => sum + w.projectsCount, 0)

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono text-[10px]">OWNER</Badge>
      case 'admin':
        return <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 font-mono text-[10px]">ADMIN</Badge>
      case 'member':
        return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono text-[10px]">MEMBER</Badge>
      case 'viewer':
      default:
        return <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground font-mono text-[10px]">VIEWER</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Collaborative Workspaces
            </h1>
            <Badge variant="outline" className="border-border text-xs font-mono">
              {workspaces.length} Teams
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Multi-tenant organization accounts, team rosters, and collaborative project links.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2 text-xs h-8 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Workspaces</span>
        </Button>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80 bg-card">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Total Workspaces</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {workspaces.length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-emerald-500" />
              <span>Team Memberships</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {totalMembers}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <FolderGit2 className="h-3.5 w-3.5 text-blue-500" />
              <span>Team Tracked Repos</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {totalProjects}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="border-border/80 bg-card">
        <CardContent className="p-3.5">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by workspace name, slug, owner name, or email..."
              className="pl-8 text-xs h-9 bg-background/50 border-border/70"
            />
          </div>
        </CardContent>
      </Card>

      {/* Workspaces Table */}
      <Card className="border-border/80 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Workspace</th>
                <th className="py-2.5 px-4 font-medium">Owner</th>
                <th className="py-2.5 px-4 font-medium">Members</th>
                <th className="py-2.5 px-4 font-medium">Projects</th>
                <th className="py-2.5 px-4 font-medium">Created</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading workspaces...</span>
                  </td>
                </tr>
              ) : filteredWorkspaces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No workspaces found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {searchTerm ? 'Try a different search term.' : 'Workspaces created by users will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredWorkspaces.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7 rounded-md border border-border">
                          {w.avatarUrl && <AvatarImage src={w.avatarUrl} alt={w.name} />}
                          <AvatarFallback className="rounded-md text-[11px] font-semibold bg-muted text-foreground">
                            {w.name?.[0]?.toUpperCase() || 'W'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium text-foreground block">{w.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            /{w.slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-border shrink-0">
                          {w.owner.avatarUrl && <AvatarImage src={w.owner.avatarUrl} alt={w.owner.name} />}
                          <AvatarFallback className="text-[10px] bg-muted">
                            {w.owner.name?.[0]?.toUpperCase() || 'O'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground truncate block leading-tight">
                            {w.owner.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate block">
                            {w.owner.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span>{w.membersCount}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        <FolderGit2 className="h-3 w-3 text-muted-foreground" />
                        <span>{w.projectsCount}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                      {new Date(w.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedWorkspace(w)}
                        className="h-7 text-xs gap-1.5"
                      >
                        <UserCheck className="h-3 w-3 text-muted-foreground" />
                        <span>Inspect Roster</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inspect Roster Dialog */}
      <Dialog open={Boolean(selectedWorkspace)} onOpenChange={(open) => !open && setSelectedWorkspace(null)}>
        <DialogContent className="max-w-xl border-border bg-card">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-display font-bold text-foreground">
                {selectedWorkspace?.name} — Team Roster
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                /{selectedWorkspace?.slug}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Detailed list of members and assigned workspace roles.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 max-h-80 overflow-y-auto divide-y divide-border/60">
            {selectedWorkspace?.members.map((member) => (
              <div key={member.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-7 w-7 border border-border shrink-0">
                    {member.user.avatarUrl && <AvatarImage src={member.user.avatarUrl} alt={member.user.name} />}
                    <AvatarFallback className="text-[10px] bg-muted">
                      {member.user.name?.[0]?.toUpperCase() || 'M'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground block truncate">
                      {member.user.name || member.user.githubUsername}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block truncate">
                      {member.user.email}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getRoleBadge(member.role)}
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Joined {new Date(member.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
