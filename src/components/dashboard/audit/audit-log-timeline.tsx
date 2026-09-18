'use client'

import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
  FolderGit2,
  Key,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface AuditLogTimelineProps {
  workspaceId?: string
  projectId?: string
}

export function AuditLogTimeline({ workspaceId, projectId }: AuditLogTimelineProps) {
  const { data: logs, isLoading } = trpc.audit.list.useQuery({
    workspaceId,
    projectId,
    limit: 40,
  })

  const getActionIcon = (action: string, entityType: string) => {
    if (action.includes('member') || action.includes('user')) {
      return <UserPlus className="h-4 w-4 text-sky-400" />
    }
    if (action.includes('project')) {
      return <FolderGit2 className="h-4 w-4 text-emerald-400" />
    }
    if (action.includes('analysis')) {
      return <Activity className="h-4 w-4 text-primary" />
    }
    if (action.includes('env')) {
      return <Key className="h-4 w-4 text-amber-400" />
    }
    if (action.includes('doc')) {
      return <FileText className="h-4 w-4 text-purple-400" />
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />
  }

  const formatAction = (action: string) => {
    return action
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Security & Activity Audit Trail
            </CardTitle>
            <CardDescription className="text-xs">
              Immutable record of project changes, access events, environment updates, and analyses.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            v2 Audit Log
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            Loading audit events...
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            No audit events recorded yet. Actions taken across Arbor will be logged here.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
            {logs.map((log: any) => (
              <div key={log.id} className="relative flex items-start justify-between gap-4">
                {/* Timeline node icon */}
                <div className="absolute -left-6 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-border">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {formatAction(log.action)}
                    </span>
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                      {log.entityType}
                    </Badge>
                    {log.project && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        [{log.project.name}]
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Avatar className="h-4 w-4 border border-border">
                      <AvatarImage src={log.user.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[9px]">
                        {log.user.name?.slice(0, 1) ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span>{log.user.name ?? log.user.email}</span>
                    <span>·</span>
                    <span className="font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {log.metadata && (
                    <div className="mt-1 rounded bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                      {JSON.stringify(log.metadata)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
