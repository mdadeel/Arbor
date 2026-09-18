'use client'

import React, { useState, useMemo } from 'react'
import {
  BookOpen,
  Plus,
  Edit,
  History,
  Trash2,
  AlertTriangle,
  Calendar,
  Clock,
  RefreshCw,
  FileText,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DocTreeSidebar } from './doc-tree-sidebar'
import { MarkdownViewer } from './markdown-viewer'
import { MarkdownEditor } from './markdown-editor'
import { VersionHistoryDialog } from './version-history-dialog'
import type { DocCategory } from '@prisma/client'

interface DocHubProps {
  slug: string
}

export function DocHub({ slug }: DocHubProps) {
  const treeQuery = trpc.document.tree.useQuery({ slug })
  const checkStaleMutation = trpc.document.checkStaleness.useMutation({
    onSuccess: () => treeQuery.refetch(),
  })

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newDocCategory, setNewDocCategory] = useState<DocCategory>('general')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const tree = useMemo(() => {
    return (
      treeQuery.data ?? {
        guide: [],
        architecture: [],
        api: [],
        runbook: [],
        adr: [],
        onboarding: [],
        general: [],
      }
    )
  }, [treeQuery.data])

  // Find first available doc if none selected
  const firstAvailableDocId = useMemo(() => {
    for (const cat of Object.keys(tree) as DocCategory[]) {
      if (tree[cat].length > 0) {
        return tree[cat][0].id
      }
    }
    return null
  }, [tree])

  const activeDocId = selectedDocId ?? firstAvailableDocId

  const docQuery = trpc.document.get.useQuery(
    { slug, docId: activeDocId as string },
    { enabled: !!activeDocId && !isCreating }
  )

  const createDoc = trpc.document.create.useMutation({
    onSuccess: (newDoc) => {
      treeQuery.refetch()
      setSelectedDocId(newDoc.id)
      setIsCreating(false)
      setIsEditing(false)
    },
  })

  const updateDoc = trpc.document.update.useMutation({
    onSuccess: () => {
      treeQuery.refetch()
      docQuery.refetch()
      setIsEditing(false)
    },
  })

  const deleteDoc = trpc.document.delete.useMutation({
    onSuccess: () => {
      treeQuery.refetch()
      setSelectedDocId(null)
      setIsEditing(false)
      setIsCreating(false)
    },
  })

  const restoreDoc = trpc.document.restore.useMutation({
    onSuccess: () => {
      treeQuery.refetch()
      docQuery.refetch()
      setIsHistoryOpen(false)
    },
  })

  const doc = docQuery.data

  const handleStartCreate = (category: DocCategory = 'general') => {
    setNewDocCategory(category)
    setIsCreating(true)
    setIsEditing(false)
  }

  const handleSaveCreate = async (data: {
    title: string
    content: string
    category: DocCategory
  }) => {
    await createDoc.mutateAsync({
      slug,
      title: data.title,
      content: data.content,
      category: data.category,
    })
  }

  const handleSaveUpdate = async (data: {
    title: string
    content: string
    category: DocCategory
    changeNote?: string
  }) => {
    if (!doc) return
    await updateDoc.mutateAsync({
      slug,
      docId: doc.id,
      title: data.title,
      content: data.content,
      category: data.category,
      changeNote: data.changeNote,
    })
  }

  const hasAnyDocs = Boolean(firstAvailableDocId)

  return (
    <div className="space-y-4">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Documentation Hub
            </h3>
            <p className="text-xs text-muted-foreground">
              Searchable, versioned technical documentation and ADRs for this repository.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => checkStaleMutation.mutate({ slug })}
            disabled={checkStaleMutation.isPending}
            title="Scan documentation for staleness (>90 days without updates)"
          >
            <RefreshCw className={`h-3 w-3 ${checkStaleMutation.isPending ? 'animate-spin' : ''}`} />
            Check Staleness
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => handleStartCreate()}
          >
            <Plus className="h-3.5 w-3.5" />
            New Document
          </Button>
        </div>
      </div>

      {/* Main Workbench Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Document Tree Sidebar */}
        <div className="lg:col-span-4">
          <DocTreeSidebar
            tree={tree}
            selectedDocId={activeDocId}
            onSelectDoc={(id) => {
              setSelectedDocId(id)
              setIsCreating(false)
              setIsEditing(false)
            }}
            onNewDoc={(category) => handleStartCreate(category)}
          />
        </div>

        {/* Right: Content Viewer / Editor */}
        <div className="space-y-4 lg:col-span-8">
          {isCreating ? (
            <MarkdownEditor
              isNew={true}
              initialCategory={newDocCategory}
              onSave={handleSaveCreate}
              onCancel={() => setIsCreating(false)}
              isSaving={createDoc.isPending}
            />
          ) : isEditing && doc ? (
            <MarkdownEditor
              isNew={false}
              initialTitle={doc.title}
              initialContent={doc.content}
              initialCategory={doc.category}
              onSave={handleSaveUpdate}
              onCancel={() => setIsEditing(false)}
              isSaving={updateDoc.isPending}
            />
          ) : doc ? (
            <div className="space-y-4 rounded-lg border border-border bg-card p-6">
              {/* Document Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono capitalize">
                      {doc.category}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      v{doc.version}
                    </Badge>
                    {doc.isStale && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Needs Review (Stale)
                      </Badge>
                    )}
                  </div>

                  <h1 className="text-xl font-bold tracking-tight text-foreground">{doc.title}</h1>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                    {doc.parent && (
                      <span className="text-muted-foreground">
                        Parent: <span className="font-semibold text-foreground">{doc.parent.title}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setIsHistoryOpen(true)}
                  >
                    <History className="h-3.5 w-3.5" />
                    History ({doc.versions.length})
                  </Button>

                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
                        deleteDoc.mutate({ slug, docId: doc.id })
                      }
                    }}
                    disabled={deleteDoc.isPending}
                    title="Delete Document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Document Body */}
              <div className="pt-2">
                <MarkdownViewer content={doc.content} />
              </div>

              {/* Version History Modal */}
              <VersionHistoryDialog
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                versions={doc.versions}
                currentVersion={doc.version}
                onRestore={async (version) => {
                  await restoreDoc.mutateAsync({ slug, docId: doc.id, version })
                }}
                isRestoring={restoreDoc.isPending}
              />
            </div>
          ) : hasAnyDocs ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
              Select a document from the sidebar to read and edit.
            </div>
          ) : (
            <Card className="border-dashed border-border bg-card/40">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold">No Documentation Yet</h4>
                <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
                  Create system architectures, API guides, runbooks, and ADRs (Architecture Decision Records)
                  with automatic versioning and staleness detection.
                </p>
                <Button
                  size="sm"
                  className="mt-5 text-xs gap-1.5"
                  onClick={() => handleStartCreate('architecture')}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create First Document
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
