'use client'

import React, { useState } from 'react'
import {
  Search,
  Plus,
  BookOpen,
  Boxes,
  Globe,
  FileCheck,
  FileCode,
  Rocket,
  FileText,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Folder,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DocTreeNode } from '@/server/services/document'
import type { DocCategory } from '@prisma/client'

const CATEGORY_META: Record<
  DocCategory,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  guide: { label: 'Guides & Manuals', icon: BookOpen },
  architecture: { label: 'Architecture', icon: Boxes },
  api: { label: 'API Guides', icon: Globe },
  runbook: { label: 'Runbooks', icon: FileCheck },
  adr: { label: 'ADRs', icon: FileCode },
  onboarding: { label: 'Onboarding', icon: Rocket },
  general: { label: 'General', icon: FileText },
}

interface DocTreeSidebarProps {
  tree: Record<DocCategory, DocTreeNode[]>
  selectedDocId: string | null
  onSelectDoc: (id: string) => void
  onNewDoc: (category?: DocCategory) => void
}

function DocNodeItem({
  node,
  selectedDocId,
  onSelectDoc,
  depth = 0,
}: {
  node: DocTreeNode
  selectedDocId: string | null
  onSelectDoc: (id: string) => void
  depth?: number
}) {
  const [isOpen, setIsOpen] = useState(true)
  const isSelected = selectedDocId === node.id
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="space-y-0.5">
      <div
        className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer ${
          isSelected
            ? 'bg-primary/15 text-primary font-medium border-l-2 border-primary'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        }`}
        style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
        onClick={() => onSelectDoc(node.id)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              className="p-0.5 hover:text-foreground text-muted-foreground/80"
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(!isOpen)
              }}
            >
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-3" />
          )}

          <span className="truncate">{node.title}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {node.isStale && (
            <span title="Stale document — needs review" className="text-amber-500">
              <AlertTriangle className="h-3 w-3" />
            </span>
          )}
          <span className="font-mono text-[9px] text-muted-foreground/60">v{node.version}</span>
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="space-y-0.5 border-l border-border/40 ml-3">
          {node.children.map((child) => (
            <DocNodeItem
              key={child.id}
              node={child}
              selectedDocId={selectedDocId}
              onSelectDoc={onSelectDoc}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DocTreeSidebar({
  tree,
  selectedDocId,
  onSelectDoc,
  onNewDoc,
}: DocTreeSidebarProps) {
  const [search, setSearch] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Flatten and filter when search query is present
  const query = search.trim().toLowerCase()

  const categories = Object.keys(tree) as DocCategory[]

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      {/* Header & New Doc Button */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          <span>Documentation</span>
        </div>
        <Button
          size="sm"
          className="h-7 text-xs gap-1 px-2"
          onClick={() => onNewDoc()}
        >
          <Plus className="h-3 w-3" />
          Doc
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter documentation..."
          className="h-8 pl-8 text-xs font-mono"
        />
      </div>

      {/* Categories & Tree */}
      <div className="max-h-[600px] overflow-y-auto space-y-3 pt-1">
        {categories.map((category) => {
          const items = tree[category] ?? []
          const meta = CATEGORY_META[category]
          const Icon = meta.icon
          const isCollapsed = collapsedCategories.has(category)

          // Filter by search
          const matchingItems = query
            ? items.filter((it) => it.title.toLowerCase().includes(query))
            : items

          if (matchingItems.length === 0 && query) return null

          return (
            <div key={category} className="space-y-1">
              <div
                className="flex items-center justify-between rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/30 cursor-pointer select-none"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-primary/80" />
                  <span className="text-foreground/90 font-medium">{meta.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{items.length}</span>
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </div>

              {!isCollapsed && (
                <div className="space-y-0.5 pl-1">
                  {matchingItems.length === 0 ? (
                    <div className="px-3 py-1 text-[11px] text-muted-foreground/60 italic">
                      No documents
                    </div>
                  ) : (
                    matchingItems.map((node) => (
                      <DocNodeItem
                        key={node.id}
                        node={node}
                        selectedDocId={selectedDocId}
                        onSelectDoc={onSelectDoc}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
