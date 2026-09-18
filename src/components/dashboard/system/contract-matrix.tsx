'use client'

import React, { useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Filter,
  HelpCircle,
  Search,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MethodBadge } from '@/components/dashboard/method-badge'
import type { ContractItem, ContractStatus } from '@/server/services/system-analysis'

interface ContractMatrixProps {
  items: ContractItem[]
  summary: {
    total: number
    connected: number
    broken: number
    orphaned: number
    methodMismatch: number
  }
}

export function ContractMatrix({ items = [], summary }: ContractMatrixProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all')

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        item.path.toLowerCase().includes(q) ||
        item.method.toLowerCase().includes(q) ||
        item.frontendFile?.toLowerCase().includes(q) ||
        item.backendFile?.toLowerCase().includes(q)
      )
    })
  }, [items, search, statusFilter])

  return (
    <div className="space-y-4">
      {/* Metric filter pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
            statusFilter === 'all'
              ? 'border-foreground bg-accent/40 ring-1 ring-foreground'
              : 'border-border bg-card/60 hover:bg-accent/20'
          }`}
        >
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Endpoints
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-foreground">{summary.total}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('connected')}
          className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
            statusFilter === 'connected'
              ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
              : 'border-border bg-card/60 hover:bg-emerald-500/5'
          }`}
        >
          <div>
            <span className="text-[11px] font-medium text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">
              Connected
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-500 dark:text-emerald-400">
              {summary.connected}
            </p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('broken')}
          className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
            statusFilter === 'broken'
              ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500'
              : 'border-border bg-card/60 hover:bg-red-500/5'
          }`}
        >
          <div>
            <span className="text-[11px] font-medium text-red-500 dark:text-red-400 uppercase tracking-wider">
              Broken (404)
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-red-500 dark:text-red-400">
              {summary.broken}
            </p>
          </div>
          <AlertCircle className="h-5 w-5 text-red-500" />
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('orphaned')}
          className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
            statusFilter === 'orphaned'
              ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
              : 'border-border bg-card/60 hover:bg-amber-500/5'
          }`}
        >
          <div>
            <span className="text-[11px] font-medium text-amber-500 dark:text-amber-400 uppercase tracking-wider">
              Orphaned Routes
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-amber-500 dark:text-amber-400">
              {summary.orphaned}
            </p>
          </div>
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter by route path or file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span>Showing {filtered.length} of {items.length} routes</span>
        </div>
      </div>

      {/* Route Contract Table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-3 w-16">Method</th>
                <th className="p-3">Route Path</th>
                <th className="p-3 w-36">Contract Status</th>
                <th className="p-3">Frontend Caller</th>
                <th className="p-3">Backend Handler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No API contracts matched your search.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-accent/20 transition-colors font-mono"
                  >
                    <td className="p-3">
                      <MethodBadge method={item.method} />
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      {item.path}
                    </td>
                    <td className="p-3">
                      {item.status === 'connected' && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 gap-1 text-[10px] font-medium py-0.5"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Connected</span>
                        </Badge>
                      )}
                      {item.status === 'broken' && (
                        <Badge
                          variant="outline"
                          className="border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400 gap-1 text-[10px] font-medium py-0.5 animate-pulse"
                        >
                          <AlertCircle className="h-3 w-3" />
                          <span>Broken (404)</span>
                        </Badge>
                      )}
                      {item.status === 'method_mismatch' && (
                        <Badge
                          variant="outline"
                          className="border-purple-500/30 bg-purple-500/10 text-purple-400 gap-1 text-[10px] font-medium py-0.5"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          <span>Method Conflict</span>
                        </Badge>
                      )}
                      {item.status === 'orphaned' && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400 gap-1 text-[10px] font-medium py-0.5"
                        >
                          <HelpCircle className="h-3 w-3" />
                          <span>Orphaned (Dead)</span>
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {item.frontendFile ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <FileCode className="h-3 w-3 shrink-0 text-primary" />
                          <span className="truncate">
                            {item.frontendFile}
                            {item.frontendLine ? `:${item.frontendLine}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {item.backendFile ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <FileCode className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {item.backendFile}
                            {item.backendLine ? `:${item.backendLine}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-red-400/80 font-semibold">Missing from backend!</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
