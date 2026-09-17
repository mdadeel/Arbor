'use client'

import { useMemo, useState } from 'react'
import { Check, Circle, Plus, Trash2, AlertTriangle, Download, Filter } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Status = 'set' | 'missing' | 'different' | 'unknown'
type Category = 'database' | 'api_key' | 'auth' | 'config' | 'storage' | 'other'

const STATUS_LABELS: Record<Status, string> = {
  set: 'Set',
  missing: 'Missing',
  different: 'Different',
  unknown: 'Unknown',
}

const CATEGORY_LABELS: Record<Category, string> = {
  database: 'Database',
  api_key: 'API Key',
  auth: 'Auth',
  config: 'Config',
  storage: 'Storage',
  other: 'Other',
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'set') {
    return <Check className="h-4 w-4 text-emerald-500" aria-label="Set" />
  }
  if (status === 'missing') {
    return <Circle className="h-4 w-4 text-red-500" aria-label="Missing" />
  }
  if (status === 'different') {
    return <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Different" />
  }
  return <span className="h-4 w-4 rounded-full border border-muted-foreground" aria-label="Unknown" />
}

function statusClass(status: Status): string {
  if (status === 'set') return 'bg-emerald-500/10 text-emerald-500'
  if (status === 'missing') return 'bg-red-500/10 text-red-500'
  if (status === 'different') return 'bg-amber-500/10 text-amber-500'
  return 'bg-muted text-muted-foreground'
}

export function EnvironmentMatrix({ slug }: { slug: string }) {
  const matrix = trpc.environment.matrix.useQuery({ slug })
  const setup = trpc.environment.setup.useMutation({ onSuccess: () => matrix.refetch() })
  const update = trpc.environment.updateVariable.useMutation({ onSuccess: () => matrix.refetch() })
  const create = trpc.environment.createVariable.useMutation({ onSuccess: () => matrix.refetch() })
  const remove = trpc.environment.deleteVariable.useMutation({ onSuccess: () => matrix.refetch() })
  const genTemplate = trpc.environment.generateTemplate.useMutation()
  const bulkUpdate = trpc.environment.bulkUpdateStatus.useMutation({ onSuccess: () => { matrix.refetch(); setSelected(new Set()) } })

  const [key, setKey] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [required, setRequired] = useState(true)
  const [category, setCategory] = useState<Category>('other')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const data = matrix.data
  const rows = useMemo(() => {
    if (!data) return []
    const byKey = new Map<string, { key: string; category: string; cells: Map<string, { id: string; status: Status }> }>()
    for (const variable of data.variables) {
      let row = byKey.get(variable.key)
      if (!row) {
        row = { key: variable.key, category: variable.category, cells: new Map() }
        byKey.set(variable.key, row)
      }
      row.cells.set(variable.environmentId, { id: variable.id, status: variable.status })
    }
    let result = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
    if (filterCategory !== 'all') {
      result = result.filter((r) => r.category === filterCategory)
    }
    return result
  }, [data, filterCategory])

  const missingByEnvironment = useMemo(() => {
    if (!data) return []
    return data.environments.map((environment) => ({
      environment: environment.name,
      variables: data.variables.filter(
        (variable) =>
          variable.environmentId === environment.id &&
          variable.status === 'missing' &&
          variable.required
      ),
    }))
  }, [data])

  const statusCounts = useMemo(() => {
    if (!data) return { set: 0, missing: 0, different: 0, unknown: 0 }
    const counts = { set: 0, missing: 0, different: 0, unknown: 0 }
    for (const v of data.variables) counts[v.status]++
    return counts
  }, [data])

  const allSelectedIds = useMemo(() => {
    const ids: string[] = []
    for (const row of rows) {
      if (selected.has(row.key)) {
        for (const cell of row.cells.values()) ids.push(cell.id)
      }
    }
    return ids
  }, [rows, selected])

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.key)))
  }

  const onStatusChange = (variableId: string, status: Status) =>
    update.mutate({ slug, variableId, status })
  const onAddVariable = () => {
    const trimmed = key.trim()
    if (!trimmed || !environmentId) return
    create.mutate({ slug, environmentId, key: trimmed, required, category })
    setKey('')
  }
  const onDeleteVariable = (variableId: string) => remove.mutate({ slug, variableId })

  const onExportTemplate = async () => {
    const template = await genTemplate.mutateAsync({ slug })
    const blob = new Blob([template], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '.env.example'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onBulkStatus = (status: Status) => {
    if (allSelectedIds.length === 0) return
    bulkUpdate.mutate({ slug, variableIds: allSelectedIds, status })
  }

  if (matrix.isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading environments…</div>
  }

  if (!data || data.environments.length === 0) {
    const detected = (data?.variables.length ?? 0)
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <h3 className="font-medium">Environment variables</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {detected > 0
            ? `Detected ${detected} environment variable${detected === 1 ? '' : 's'} in your code.`
            : 'No environment variables detected yet.'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up Development, Staging, and Production to track them across environments.
        </p>
        <Button className="mt-4" onClick={() => setup.mutate({ slug })} disabled={setup.isPending}>
          <Plus className="mr-2 h-4 w-4" />
          Set Up Environments
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{rows.length} variable{rows.length === 1 ? '' : 's'}</span>
        <span className="text-border">|</span>
        <span className="text-emerald-500">{statusCounts.set} set</span>
        <span className="text-border">|</span>
        <span className="text-red-500">{statusCounts.missing} missing</span>
        <span className="text-border">|</span>
        <span className="text-amber-500">{statusCounts.different} different</span>
        <span className="text-border">|</span>
        <span>{statusCounts.unknown} unknown</span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Category filter */}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <Filter className="mr-1 h-3 w-3" />
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Export template */}
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onExportTemplate} disabled={genTemplate.isPending}>
            <Download className="mr-1.5 h-3 w-3" />
            Export .env
          </Button>
        </div>

        {/* Add variable form */}
        <div className="flex items-center gap-2">
          <Select value={environmentId} onValueChange={setEnvironmentId}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Add to environment" />
            </SelectTrigger>
            <SelectContent>
              {data.environments.map((environment) => (
                <SelectItem key={environment.id} value={environment.id}>
                  {environment.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="VARIABLE_NAME"
            className="h-8 w-[160px] font-mono text-xs"
          />
          <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
            <SelectTrigger className="h-8 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs" onClick={onAddVariable} disabled={!key.trim() || !environmentId || create.isPending}>
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onBulkStatus('set')} disabled={bulkUpdate.isPending}>
              Mark Set
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onBulkStatus('missing')} disabled={bulkUpdate.isPending}>
              Mark Missing
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Matrix table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-[200px]">Variable</TableHead>
              <TableHead className="w-[80px]">Category</TableHead>
              {data.environments.map((environment) => (
                <TableHead key={environment.id} className="text-center">
                  {environment.name}
                </TableHead>
              ))}
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} className={selected.has(row.key) ? 'bg-primary/5' : ''}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border"
                    checked={selected.has(row.key)}
                    onChange={() => toggleSelect(row.key)}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{row.key}</TableCell>
                <TableCell>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {CATEGORY_LABELS[row.category as Category] ?? row.category}
                  </span>
                </TableCell>
                {data.environments.map((environment) => {
                  const cell = row.cells.get(environment.id)
                  return (
                    <TableCell key={environment.id} className="text-center">
                      {cell ? (
                        <Select
                          value={cell.status}
                          onValueChange={(value) => onStatusChange(cell.id, value as Status)}
                        >
                          <SelectTrigger className="h-7 w-[100px] border-0 bg-transparent shadow-none text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                <span className="flex items-center gap-2">
                                  <StatusIcon status={value as Status} />
                                  {label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )
                })}
                <TableCell>
                  {row.cells.size > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        const firstCell = Array.from(row.cells.values())[0]
                        if (!firstCell) return
                        onDeleteVariable(firstCell.id)
                      }}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Missing variables report */}
      <div className="space-y-2">
        {missingByEnvironment
          .filter((item) => item.variables.length > 0)
          .map((item) => (
            <div key={item.environment} className="flex items-center gap-2 text-sm text-red-500">
              <Badge className={statusClass('missing')}>{item.variables.length}</Badge>
              <span>required variable{item.variables.length === 1 ? '' : 's'} missing in {item.environment}:</span>
              <span className="font-mono text-xs">
                {item.variables.map((variable) => variable.key).join(' · ')}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}