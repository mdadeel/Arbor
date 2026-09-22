'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AdminAuditLogItem } from '@/server/services/admin'
import { trpc } from '@/lib/trpc'
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  History,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  User,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AdminAuditViewProps {
  initialLogs: AdminAuditLogItem[]
}

export function AdminAuditView({ initialLogs }: AdminAuditViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const { data: logs = initialLogs, isLoading, refetch, isFetching } = trpc.admin.listAuditLogs.useQuery(
    {
      action: categoryFilter !== 'all' ? categoryFilter : undefined,
      search: searchTerm.trim() || undefined,
      limit: 100,
    },
    {
      initialData: initialLogs,
      refetchOnWindowFocus: false,
    }
  )

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id))
  }

  const getActionBadge = (action: string) => {
    if (action.includes('access')) {
      return <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 font-mono text-[10px]">ACCESS EDIT</Badge>
    }
    if (action.includes('benefits')) {
      return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono text-[10px]">BENEFITS</Badge>
    }
    if (action.includes('email')) {
      return <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono text-[10px]">BROADCAST</Badge>
    }
    if (action.includes('delete') || action.includes('purge')) {
      return <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 font-mono text-[10px]">DESTRUCTIVE</Badge>
    }
    if (action.includes('project')) {
      return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono text-[10px]">PROJECT</Badge>
    }
    return <Badge variant="outline" className="border-border bg-muted/30 text-muted-foreground font-mono text-[10px]">{action.split('.')[0]?.toUpperCase() || 'LOG'}</Badge>
  }

  const formatRelativeTime = (dateInput: Date | string) => {
    const d = new Date(dateInput)
    const diff = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Platform Audit Trail
            </h1>
            <Badge variant="outline" className="border-border text-xs font-mono">
              {logs.length} Events
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tamper-evident record of administrative operations, role promotions, plan grants, and system modifications.
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
          <span>Refresh Feed</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/80 bg-card">
        <CardContent className="p-3.5 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by actor email, name, action type, or entity ID..."
              className="pl-8 text-xs h-9 bg-background/50 border-border/70"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48 text-xs h-9 bg-background/50 border-border/70">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="admin.user_access">User Access & Roles</SelectItem>
                <SelectItem value="admin.user_benefits">Plan & Perks Grants</SelectItem>
                <SelectItem value="admin.email">Email Broadcasts</SelectItem>
                <SelectItem value="project">Project Actions</SelectItem>
                <SelectItem value="environment">Environment Configs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-border/80 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-4 w-8"></th>
                <th className="py-2.5 px-4 font-medium">Timestamp</th>
                <th className="py-2.5 px-4 font-medium">Actor</th>
                <th className="py-2.5 px-4 font-medium">Action</th>
                <th className="py-2.5 px-4 font-medium">Target Entity</th>
                <th className="py-2.5 px-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No audit records found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {searchTerm ? 'Try adjusting your search query or category filter.' : 'Platform actions will record here automatically.'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id
                  const hasMeta = log.metadata && Object.keys(log.metadata).length > 0

                  return (
                    <>
                      <tr
                        key={log.id}
                        className={`hover:bg-muted/20 transition-colors ${isExpanded ? 'bg-muted/30' : ''}`}
                      >
                        <td className="py-3 px-3 text-center">
                          {hasMeta && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(log.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1"
                              aria-label="Toggle metadata"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-foreground">{formatRelativeTime(log.createdAt)}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6 border border-border shrink-0">
                              {log.user.avatarUrl && <AvatarImage src={log.user.avatarUrl} alt={log.user.name} />}
                              <AvatarFallback className="text-[10px] bg-muted">
                                {log.user.name?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <span className="font-medium text-foreground truncate block leading-tight">
                                {log.user.name || log.user.githubUsername}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono truncate block">
                                {log.user.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getActionBadge(log.action)}
                            <span className="font-mono text-xs text-foreground truncate max-w-[180px] sm:max-w-none">
                              {log.action}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-mono text-[11px] uppercase bg-muted/50 px-1.5 py-0.5 rounded text-foreground/80">
                              {log.entityType}
                            </span>
                            <span className="font-mono text-[10px] truncate max-w-[120px]">
                              {log.project?.name || log.workspace?.name || log.entityId}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {hasMeta ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(log.id)}
                              className="text-[11px] font-mono text-primary hover:underline"
                            >
                              {isExpanded ? 'Hide Payload' : 'View Payload'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-mono">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded JSON Inspector */}
                      {isExpanded && hasMeta && (
                        <tr className="bg-muted/15">
                          <td colSpan={6} className="py-3 px-6">
                            <div className="rounded-md border border-border bg-background/80 p-3 text-[11px] font-mono">
                              <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <Info className="h-3 w-3" />
                                <span>Operation Payload & State Transition</span>
                              </div>
                              <pre className="text-foreground overflow-x-auto max-h-48 scrollbar-thin">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
