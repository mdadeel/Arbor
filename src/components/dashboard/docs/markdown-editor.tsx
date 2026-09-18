'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  Code,
  Table as TableIcon,
  Quote,
  Eye,
  Edit3,
  Columns,
  Save,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MarkdownViewer } from './markdown-viewer'
import type { DocCategory } from '@prisma/client'

interface MarkdownEditorProps {
  initialTitle?: string
  initialContent?: string
  initialCategory?: DocCategory
  isNew?: boolean
  onSave: (data: {
    title: string
    content: string
    category: DocCategory
    changeNote?: string
  }) => Promise<void>
  onCancel: () => void
  isSaving?: boolean
}

export function MarkdownEditor({
  initialTitle = '',
  initialContent = '',
  initialCategory = 'general',
  isNew = false,
  onSave,
  onCancel,
  isSaving = false,
}: MarkdownEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [category, setCategory] = useState<DocCategory>(initialCategory)
  const [changeNote, setChangeNote] = useState('')
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertFormatting = (prefix: string, suffix: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.substring(start, end) || placeholder
    const replacement = `${prefix}${selected}${suffix}`

    const newContent = content.substring(0, start) + replacement + content.substring(end)
    setContent(newContent)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
    }, 0)
  }

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (title.trim() && !isSaving) {
          onSave({ title: title.trim(), content, category, changeNote: changeNote.trim() || undefined })
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [title, content, category, changeNote, isSaving, onSave])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await onSave({
      title: title.trim(),
      content,
      category,
      changeNote: changeNote.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4">
      {/* Top Meta Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-1 items-center gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title (e.g. Architecture Overview)"
            className="h-9 font-semibold text-sm max-w-md"
            autoFocus
          />
          <Select value={category} onValueChange={(val) => setCategory(val as DocCategory)}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="guide">Guide</SelectItem>
              <SelectItem value="architecture">Architecture</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="runbook">Runbook</SelectItem>
              <SelectItem value="adr">ADR</SelectItem>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Mode Controls & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5 bg-muted/30">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === 'edit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              title="Edit Only"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === 'split' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              title="Split View"
            >
              <Columns className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              title="Preview Only"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 text-xs">
            <X className="mr-1 h-3.5 w-3.5" />
            Cancel
          </Button>

          <Button type="submit" size="sm" disabled={!title.trim() || isSaving} className="h-8 text-xs gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : isNew ? 'Create Doc' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      {viewMode !== 'preview' && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border/70 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertFormatting('**', '**', 'bold text')}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertFormatting('*', '*', 'italic text')}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertFormatting('# ', '', 'Heading 1')}
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertFormatting('## ', '', 'Heading 2')}
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertFormatting('- ', '', 'List item')}
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertFormatting('```ts\n', '\n```', '// code here')}
            title="Code Block"
          >
            <Code className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => insertFormatting('> [!NOTE]\n> ', '', 'Important note')}
            title="Callout Note"
          >
            <Quote className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() =>
              insertFormatting(
                '| Column 1 | Column 2 |\n|---|---|\n| Item 1 | Value 1 |\n'
              )
            }
            title="Table"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Editor & Preview Area */}
      <div className={`grid gap-4 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Editor text area */}
        {viewMode !== 'preview' && (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your markdown content here..."
              rows={22}
              className="w-full rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
            />
          </div>
        )}

        {/* Live Preview area */}
        {viewMode !== 'edit' && (
          <div className="max-h-[520px] overflow-y-auto rounded-md border border-border bg-background/50 p-4">
            <MarkdownViewer content={content} />
          </div>
        )}
      </div>

      {/* Change note (for updates) */}
      {!isNew && (
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Change Note:</label>
          <Input
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="e.g. Updated system diagram, revised incident runbook"
            className="h-8 text-xs font-mono"
          />
        </div>
      )}
    </form>
  )
}
