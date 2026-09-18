'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CornerDownLeft,
  FileCode,
  FileText,
  FolderGit2,
  Info,
  LayoutDashboard,
  Loader2,
  Plus,
  Search,
  Settings,
  Terminal,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScoreBadge } from '@/components/dashboard/score-badge'
import { MethodBadge } from '@/components/dashboard/method-badge'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import type { SearchResultItem } from '@/server/services/search'

export interface CommandProject {
  id: string
  name: string
  slug: string
  repoFullName: string
  latestScores?: unknown
  healthData?: unknown
}

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects?: CommandProject[]
}

export function CommandMenu({ open, onOpenChange, projects = [] }: CommandMenuProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 150)
    return () => clearTimeout(timer)
  }, [query])

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [debouncedQuery])

  // Reset query and selection when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setDebouncedQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // Fetch search results from tRPC backend
  const { data: searchResults, isLoading } = trpc.search.query.useQuery(
    { q: debouncedQuery },
    { enabled: open }
  )

  // Build flattened list of items for keyboard navigation
  const flatItems = useMemo(() => {
    const list: Array<{
      category: string
      item: SearchResultItem
    }> = []

    if (!debouncedQuery) {
      // Zero-query: show recent projects (if any)
      if (projects.length > 0) {
        for (const p of projects.slice(0, 4)) {
          const scores = p.latestScores as { overall?: number } | null
          const health = p.healthData as { score?: number } | null
          const score = health?.score ?? scores?.overall
          list.push({
            category: 'Recent Projects',
            item: {
              id: `recent-${p.id}`,
              type: 'project',
              title: p.name,
              subtitle: p.repoFullName,
              href: `/projects/${p.slug}`,
              badge: score != null ? `${score}/100` : undefined,
              badgeColor: score != null ? (score >= 80 ? 'emerald' : score >= 50 ? 'amber' : 'red') : 'muted',
            },
          })
        }
      }

      // Zero-query: static navigation
      const actions = searchResults?.actions ?? [
        {
          id: 'action-dashboard',
          type: 'action',
          title: 'Developer Workbench Dashboard',
          subtitle: 'Overview of repository health and recent analyses',
          href: '/dashboard',
          badge: 'Navigation',
          badgeColor: 'muted',
        },
        {
          id: 'action-all-projects',
          type: 'action',
          title: 'All Projects',
          subtitle: 'Browse all connected repositories',
          href: '/projects',
          badge: 'Navigation',
          badgeColor: 'muted',
        },
        {
          id: 'action-new-project',
          type: 'action',
          title: 'Connect New Repository',
          subtitle: 'Import a GitHub repository and trigger an audit',
          href: '/projects/new',
          badge: 'Action',
          badgeColor: 'emerald',
        },
        {
          id: 'action-settings',
          type: 'action',
          title: 'Workspace Settings',
          subtitle: 'Manage profile and GitHub connection',
          href: '/settings',
          badge: 'Settings',
          badgeColor: 'muted',
        },
      ]

      for (const a of actions) {
        list.push({ category: 'Quick Navigation', item: a })
      }

      return list
    }

    if (searchResults) {
      for (const p of searchResults.projects) {
        list.push({ category: 'Projects', item: p })
      }
      for (const f of searchResults.findings) {
        list.push({ category: 'Analysis Findings', item: f })
      }
      for (const ep of searchResults.endpoints) {
        list.push({ category: 'API Endpoints', item: ep })
      }
      for (const doc of searchResults.documents) {
        list.push({ category: 'Documentation', item: doc })
      }
      for (const a of searchResults.actions) {
        list.push({ category: 'Commands & Actions', item: a })
      }
    }

    return list
  }, [debouncedQuery, searchResults, projects])

  // Scroll active item into view when navigating via keyboard
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
      })
    }
  }, [selectedIndex])

  // Handle keyboard navigation inside search input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flatItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % flatItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = flatItems[selectedIndex]
      if (selected) {
        handleSelect(selected.item.href)
      }
    }
  }

  const handleSelect = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  // Render type-specific icon
  const renderItemIcon = (item: SearchResultItem) => {
    switch (item.type) {
      case 'project':
        return <FolderGit2 className="h-4 w-4 shrink-0 text-primary" />
      case 'finding':
        if (item.badge === 'critical') {
          return <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
        }
        if (item.badge === 'warning') {
          return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        }
        return <Info className="h-4 w-4 shrink-0 text-blue-400" />
      case 'endpoint':
        return <Terminal className="h-4 w-4 shrink-0 text-emerald-400" />
      case 'document':
        return <BookOpen className="h-4 w-4 shrink-0 text-sky-400" />
      case 'action':
        if (item.id.includes('new')) {
          return <Plus className="h-4 w-4 shrink-0 text-emerald-400" />
        }
        if (item.id.includes('settings')) {
          return <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
        }
        return <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" />
    }
  }

  // Render type-specific badge
  const renderItemBadge = (item: SearchResultItem) => {
    if (!item.badge) return null

    if (item.type === 'endpoint') {
      return <MethodBadge method={item.badge} />
    }

    if (item.type === 'project') {
      const scoreNum = parseInt(item.badge.split('/')[0], 10)
      return isNaN(scoreNum) ? null : <ScoreBadge score={scoreNum} size="sm" />
    }

    if (item.type === 'finding') {
      return (
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border uppercase tracking-wider',
            item.badge === 'critical'
              ? 'bg-red-500/15 text-red-400 border-red-500/30'
              : item.badge === 'warning'
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
          )}
        >
          {item.badge}
        </span>
      )
    }

    return (
      <span className="inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
        {item.badge}
      </span>
    )
  }

  // Group flattened items by category for rendering with headers
  const groupedSections = useMemo(() => {
    const groups: { [cat: string]: Array<{ item: SearchResultItem; flatIndex: number }> } = {}
    flatItems.forEach((entry, idx) => {
      if (!groups[entry.category]) {
        groups[entry.category] = []
      }
      groups[entry.category].push({ item: entry.item, flatIndex: idx })
    })
    return groups
  }, [flatItems])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl border-border bg-card shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search Arbor</DialogTitle>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="flex items-center border-b border-border px-3.5 bg-background/50">
          <Search className="mr-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, findings, APIs, docs, or commands... (Type to filter)"
            className="h-12 border-0 bg-transparent px-0 py-3 text-xs sm:text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
            autoFocus
          />
          {isLoading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="text-[10px] font-mono font-semibold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/60 bg-muted/30"
            >
              Clear
            </button>
          ) : (
            <kbd className="hidden sm:inline-block pointer-events-none rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          )}
        </div>

        {/* Results Container */}
        <div className="max-h-[380px] min-h-[160px] overflow-y-auto p-2 space-y-4">
          {flatItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No matching results found for &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(groupedSections).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {category} ({items.length})
                </div>
                <div className="space-y-0.5">
                  {items.map(({ item, flatIndex }) => {
                    const isSelected = flatIndex === selectedIndex

                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          itemRefs.current[flatIndex] = el
                        }}
                        onClick={() => handleSelect(item.href)}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-xs transition-colors text-left',
                          isSelected
                            ? 'bg-accent text-accent-foreground ring-1 ring-border/80'
                            : 'text-foreground hover:bg-accent/50'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {renderItemIcon(item)}
                          <div className="min-w-0">
                            <p className="font-medium truncate leading-tight">
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {renderItemBadge(item)}
                          {isSelected && (
                            <CornerDownLeft className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Keyboard Navigation Footer */}
        <div className="flex items-center justify-between border-t border-border/80 bg-background/50 px-3.5 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <span className="font-semibold text-foreground">Arbor</span>
            <span>command center</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <kbd className="rounded border border-border/80 bg-muted/60 px-1 py-0.5">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <kbd className="rounded border border-border/80 bg-muted/60 px-1 py-0.5">⏎</kbd> Select
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <kbd className="rounded border border-border/80 bg-muted/60 px-1 py-0.5">Esc</kbd> Close
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
