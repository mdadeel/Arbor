'use client'

import React, { useState, useMemo } from 'react'
import {
  Globe,
  Upload,
  Trash2,
  Search,
  Send,
  Copy,
  Check,
  ChevronRight,
  AlertCircle,
  FileCode2,
  Play,
  Clock,
  Sparkles,
  ExternalLink,
  Layers,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MethodBadge } from './method-badge'
import type { ParsedEndpoint, ParsedSchema } from '@/server/services/api-spec'

interface ApiExplorerProps {
  slug: string
}

export function ApiExplorer({ slug }: ApiExplorerProps) {
  const specsQuery = trpc.apiSpec.list.useQuery({ slug })
  const createSpec = trpc.apiSpec.create.useMutation({
    onSuccess: (newSpec) => {
      specsQuery.refetch()
      setSelectedSpecId(newSpec.id)
      setIsUploadOpen(false)
      resetUploadForm()
    },
  })
  const deleteSpec = trpc.apiSpec.delete.useMutation({
    onSuccess: () => {
      specsQuery.refetch()
      setSelectedSpecId(null)
    },
  })
  const proxy = trpc.apiSpec.proxy.useMutation()

  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  // Upload Form State
  const [uploadName, setUploadName] = useState('')
  const [uploadVersion, setUploadVersion] = useState('1.0.0')
  const [uploadRawSpec, setUploadRawSpec] = useState('')
  const [uploadDevUrl, setUploadDevUrl] = useState('')
  const [uploadProdUrl, setUploadProdUrl] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Endpoint Browser State
  const [searchQuery, setSearchQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('ALL')
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'docs' | 'try'>('docs')

  // Try It State
  const [envChoice, setEnvChoice] = useState<'custom' | 'dev' | 'prod'>('dev')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [tryHeaders, setTryHeaders] = useState('{\n  "Content-Type": "application/json"\n}')
  const [tryBody, setTryBody] = useState('')
  const [copiedText, setCopiedText] = useState(false)
  const [proxyResult, setProxyResult] = useState<{
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    durationMs: number
  } | null>(null)

  const specs = specsQuery.data ?? []
  const activeSpecId = selectedSpecId ?? (specs[0]?.id ?? null)

  const currentSpecQuery = trpc.apiSpec.get.useQuery(
    { slug, specId: activeSpecId as string },
    { enabled: !!activeSpecId }
  )
  const activeSpec = currentSpecQuery.data

  const endpoints = useMemo(() => {
    if (!activeSpec?.parsedEndpoints) return [] as ParsedEndpoint[]
    return activeSpec.parsedEndpoints as unknown as ParsedEndpoint[]
  }, [activeSpec])

  const baseUrls = useMemo(() => {
    if (!activeSpec?.baseUrls) return {} as Record<string, string>
    return activeSpec.baseUrls as Record<string, string>
  }, [activeSpec])

  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      const matchMethod = methodFilter === 'ALL' || ep.method.toUpperCase() === methodFilter
      const query = searchQuery.trim().toLowerCase()
      const matchSearch =
        !query ||
        ep.path.toLowerCase().includes(query) ||
        ep.summary.toLowerCase().includes(query) ||
        ep.tags.some((t) => t.toLowerCase().includes(query))
      return matchMethod && matchSearch
    })
  }, [endpoints, methodFilter, searchQuery])

  const selectedEndpoint = filteredEndpoints[selectedEndpointIndex] ?? filteredEndpoints[0] ?? null

  const resetUploadForm = () => {
    setUploadName('')
    setUploadVersion('1.0.0')
    setUploadRawSpec('')
    setUploadDevUrl('')
    setUploadProdUrl('')
    setUploadError(null)
  }

  const handleUpload = async () => {
    if (!uploadRawSpec.trim()) {
      setUploadError('Specification content is required')
      return
    }
    setUploadError(null)
    try {
      await createSpec.mutateAsync({
        slug,
        name: uploadName.trim() || 'API Spec',
        version: uploadVersion.trim() || '1.0.0',
        rawSpec: uploadRawSpec,
        baseUrls: {
          development: uploadDevUrl.trim() || undefined,
          production: uploadProdUrl.trim() || undefined,
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse specification'
      setUploadError(msg)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setUploadRawSpec(text)
      if (!uploadName) {
        setUploadName(file.name.replace(/\.(json|yaml|yml)$/, ''))
      }
    }
    reader.readAsText(file)
  }

  const getEffectiveBaseUrl = () => {
    if (envChoice === 'dev' && baseUrls.development) return baseUrls.development
    if (envChoice === 'prod' && baseUrls.production) return baseUrls.production
    return customBaseUrl || (baseUrls.development ?? baseUrls.production ?? 'http://localhost:3000')
  }

  const handleSendProxy = async () => {
    if (!selectedEndpoint) return
    const baseUrl = getEffectiveBaseUrl().replace(/\/$/, '')
    const fullUrl = `${baseUrl}${selectedEndpoint.path}`

    let parsedHeaders: Record<string, string> = {}
    try {
      if (tryHeaders.trim()) {
        parsedHeaders = JSON.parse(tryHeaders)
      }
    } catch {
      alert('Invalid JSON in Request Headers')
      return
    }

    try {
      const result = await proxy.mutateAsync({
        url: fullUrl,
        method: selectedEndpoint.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        headers: parsedHeaders,
        body: ['GET', 'HEAD'].includes(selectedEndpoint.method) ? undefined : tryBody || undefined,
      })
      setProxyResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed'
      setProxyResult({
        status: 500,
        statusText: 'Proxy Error',
        headers: {},
        body: msg,
        durationMs: 0,
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Top Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">API Explorer</h3>
              {activeSpec && (
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                  {activeSpec.endpointCount} endpoint{activeSpec.endpointCount === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Explore REST endpoints, inspect payload contracts, and test requests live.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {specs.length > 0 && (
            <Select
              value={activeSpecId ?? ''}
              onValueChange={(val) => {
                setSelectedSpecId(val)
                setSelectedEndpointIndex(0)
                setProxyResult(null)
              }}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs font-mono">
                <SelectValue placeholder="Select API Spec" />
              </SelectTrigger>
              <SelectContent>
                {specs.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} ({s.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeSpecId && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Delete Spec"
              onClick={() => {
                if (confirm('Are you sure you want to delete this API specification?')) {
                  deleteSpec.mutate({ slug, specId: activeSpecId })
                }
              }}
              disabled={deleteSpec.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setIsUploadOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            Import Spec
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {specs.length === 0 && !specsQuery.isLoading && (
        <Card className="border-dashed border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileCode2 className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold">No API Specifications Found</h4>
            <p className="mt-1.5 max-w-md text-xs text-muted-foreground">
              Import an OpenAPI 3.0 / 2.0 or Swagger specification in JSON or YAML format to
              inspect paths, schemas, query parameters, and execute live API calls.
            </p>
            <Button size="sm" className="mt-5 text-xs gap-1.5" onClick={() => setIsUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Import OpenAPI Spec
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Spec Active Browser */}
      {activeSpec && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column: Endpoint Browser List */}
          <div className="space-y-3 lg:col-span-4">
            {/* Filters */}
            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setSelectedEndpointIndex(0)
                  }}
                  placeholder="Filter paths, tags, summaries..."
                  className="h-8 pl-8 text-xs font-mono"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMethodFilter(m)
                      setSelectedEndpointIndex(0)
                    }}
                    className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium transition-colors ${
                      methodFilter === m
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Endpoints List */}
            <div className="max-h-[620px] overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border/60">
              {filteredEndpoints.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No endpoints matching filters.
                </div>
              ) : (
                filteredEndpoints.map((ep, idx) => {
                  const isSelected = ep === selectedEndpoint
                  return (
                    <button
                      key={`${ep.method}-${ep.path}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedEndpointIndex(idx)
                        setProxyResult(null)
                      }}
                      className={`w-full text-left p-2.5 transition-colors flex items-start gap-2.5 hover:bg-accent/40 ${
                        isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="pt-0.5">
                        <MethodBadge method={ep.method} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-semibold text-foreground truncate">
                          {ep.path}
                        </div>
                        {ep.summary && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {ep.summary}
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform text-muted-foreground/60 ${
                          isSelected ? 'text-primary transform translate-x-0.5' : ''
                        }`}
                      />
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Endpoint Details & Interactive Try It */}
          <div className="space-y-4 lg:col-span-8">
            {selectedEndpoint ? (
              <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                {/* Endpoint Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <MethodBadge method={selectedEndpoint.method} />
                      <span className="font-mono text-sm font-bold text-foreground">
                        {selectedEndpoint.path}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => copyToClipboard(selectedEndpoint.path)}
                        title="Copy path"
                      >
                        {copiedText ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    {selectedEndpoint.summary && (
                      <h4 className="text-sm font-medium text-foreground">{selectedEndpoint.summary}</h4>
                    )}
                    {selectedEndpoint.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {selectedEndpoint.description}
                      </p>
                    )}
                    {selectedEndpoint.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedEndpoint.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mode switch */}
                  <div className="flex rounded-md border border-border p-0.5 bg-muted/30">
                    <button
                      type="button"
                      onClick={() => setActiveTab('docs')}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        activeTab === 'docs'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Documentation
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('try')}
                      className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        activeTab === 'try'
                          ? 'bg-background text-primary shadow-sm font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Try It
                    </button>
                  </div>
                </div>

                {/* Tab: Documentation */}
                {activeTab === 'docs' && (
                  <div className="space-y-5">
                    {/* Parameters */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Parameters ({selectedEndpoint.parameters.length})
                      </h5>
                      {selectedEndpoint.parameters.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">No parameters required.</div>
                      ) : (
                        <div className="rounded-md border border-border overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-muted/40 font-medium text-muted-foreground border-b border-border">
                              <tr>
                                <th className="py-2 px-3">Name</th>
                                <th className="py-2 px-3">In</th>
                                <th className="py-2 px-3">Required</th>
                                <th className="py-2 px-3">Type</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {selectedEndpoint.parameters.map((p, pIdx) => (
                                <tr key={`${p.name}-${pIdx}`} className="hover:bg-muted/20">
                                  <td className="py-2 px-3 font-mono font-semibold text-foreground">
                                    {p.name}
                                  </td>
                                  <td className="py-2 px-3 text-muted-foreground">{p.in}</td>
                                  <td className="py-2 px-3">
                                    {p.required ? (
                                      <Badge variant="destructive" className="text-[9px] px-1 py-0">
                                        required
                                      </Badge>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">optional</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 font-mono text-muted-foreground">
                                    {p.schema && typeof p.schema === 'object' && 'type' in p.schema
                                      ? String((p.schema as Record<string, unknown>).type)
                                      : 'any'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Request Body */}
                    {Boolean(selectedEndpoint.requestBody) && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Request Body
                        </h5>
                        <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs text-foreground border border-border">
                          {JSON.stringify(selectedEndpoint.requestBody, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Responses */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Responses ({selectedEndpoint.responses.length})
                      </h5>
                      <div className="space-y-2">
                        {selectedEndpoint.responses.map((resp, rIdx) => (
                          <div
                            key={`${resp.status}-${rIdx}`}
                            className="rounded-md border border-border p-3 space-y-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  resp.status.startsWith('2')
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : resp.status.startsWith('4')
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : 'bg-red-500/15 text-red-400 border-red-500/30'
                                }
                              >
                                {resp.status}
                              </Badge>
                              <span className="text-xs text-foreground font-medium">
                                {resp.description || 'Response description'}
                              </span>
                            </div>
                            {Boolean(resp.schema) && (
                              <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2 font-mono text-[11px] text-muted-foreground border border-border/70">
                                {JSON.stringify(resp.schema, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Try It */}
                {activeTab === 'try' && (
                  <div className="space-y-4">
                    {/* URL Bar & Env Selector */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={envChoice}
                          onValueChange={(val: 'dev' | 'prod' | 'custom') => setEnvChoice(val)}
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dev">
                              Development {baseUrls.development ? `(${baseUrls.development})` : ''}
                            </SelectItem>
                            <SelectItem value="prod">
                              Production {baseUrls.production ? `(${baseUrls.production})` : ''}
                            </SelectItem>
                            <SelectItem value="custom">Custom URL</SelectItem>
                          </SelectContent>
                        </Select>

                        {envChoice === 'custom' && (
                          <Input
                            value={customBaseUrl}
                            onChange={(e) => setCustomBaseUrl(e.target.value)}
                            placeholder="http://localhost:3000"
                            className="h-8 flex-1 font-mono text-xs"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 font-mono text-xs">
                        <MethodBadge method={selectedEndpoint.method} />
                        <span className="text-muted-foreground select-none">{getEffectiveBaseUrl()}</span>
                        <span className="font-semibold text-foreground">{selectedEndpoint.path}</span>
                      </div>
                    </div>

                    {/* Headers Editor */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Headers (JSON)
                      </label>
                      <textarea
                        value={tryHeaders}
                        onChange={(e) => setTryHeaders(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    {/* Body Editor (if not GET) */}
                    {!['GET', 'HEAD'].includes(selectedEndpoint.method) && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Request Body (JSON)
                        </label>
                        <textarea
                          value={tryBody}
                          onChange={(e) => setTryBody(e.target.value)}
                          placeholder='{\n  "key": "value"\n}'
                          rows={4}
                          className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )}

                    {/* Submit Button */}
                    <Button
                      onClick={handleSendProxy}
                      disabled={proxy.isPending}
                      className="w-full h-9 text-xs gap-2"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {proxy.isPending ? 'Executing Request...' : 'Send Request'}
                    </Button>

                    {/* Response Display */}
                    {proxyResult && (
                      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                        <div className="flex items-center justify-between border-b border-border pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <Badge
                              className={
                                proxyResult.status >= 200 && proxyResult.status < 300
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : 'bg-red-500/15 text-red-400 border-red-500/30'
                              }
                            >
                              {proxyResult.status} {proxyResult.statusText}
                            </Badge>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {proxyResult.durationMs}ms
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(proxyResult.body)}
                          >
                            {copiedText ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            Copy Body
                          </Button>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Response Body
                          </span>
                          <pre className="max-h-64 overflow-auto rounded bg-background p-3 font-mono text-xs text-foreground border border-border">
                            {proxyResult.body || '<Empty Response>'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                Select an endpoint from the left to view details and test calls.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Import OpenAPI Specification</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Paste or upload an OpenAPI (Swagger) v2 or v3 spec in JSON or YAML format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {uploadError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">API Name</label>
                <Input
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g. Core REST API"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Version</label>
                <Input
                  value={uploadVersion}
                  onChange={(e) => setUploadVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Development Base URL</label>
                <Input
                  value={uploadDevUrl}
                  onChange={(e) => setUploadDevUrl(e.target.value)}
                  placeholder="http://localhost:3000/api"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Production Base URL</label>
                <Input
                  value={uploadProdUrl}
                  onChange={(e) => setUploadProdUrl(e.target.value)}
                  placeholder="https://api.myproject.com"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Spec Content (JSON or YAML)
                </label>
                <label className="cursor-pointer text-xs text-primary hover:underline">
                  Load from file
                  <input
                    type="file"
                    accept=".json,.yaml,.yml"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              <textarea
                value={uploadRawSpec}
                onChange={(e) => setUploadRawSpec(e.target.value)}
                placeholder='openapi: "3.0.0"\ninfo:\n  title: "Sample API"\n  version: "1.0.0"\npaths:\n  ...'
                rows={10}
                className="w-full rounded-md border border-border bg-background p-2.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setIsUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={handleUpload}
              disabled={createSpec.isPending}
            >
              {createSpec.isPending ? 'Validating & Saving...' : 'Save & Parse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
