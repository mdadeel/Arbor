'use client'

import React, { useMemo } from 'react'
import { marked } from 'marked'
import { Copy, Check, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MarkdownViewerProps {
  content: string
}

export type TocItem = {
  id: string
  text: string
  level: number
}

export function extractToc(content: string): TocItem[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm
  const items: TocItem[] = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const rawText = match[2].trim()
    const id = rawText
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
    items.push({ id, text: rawText, level })
  }

  return items
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const html = useMemo(() => {
    try {
      return marked.parse(content || '*No content provided.*', {
        gfm: true,
        breaks: true,
      }) as string
    } catch {
      return '<p class="text-destructive">Failed to render markdown content.</p>'
    }
  }, [content])

  const toc = useMemo(() => extractToc(content), [content])

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Main Content Area */}
      <div className={toc.length > 2 ? 'lg:col-span-9' : 'lg:col-span-12'}>
        <article
          className="prose prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-h1:border-b prose-h1:border-border prose-h1:pb-2 prose-h1:text-2xl prose-h2:border-b prose-h2:border-border/60 prose-h2:pb-1.5 prose-h2:text-xl prose-h3:text-lg prose-p:text-sm prose-p:leading-relaxed prose-p:text-muted-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:font-mono prose-code:text-xs prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-foreground prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border prose-pre:p-4 prose-pre:rounded-lg prose-pre:font-mono prose-pre:text-xs prose-hr:border-border prose-table:border prose-table:border-border prose-th:border-b prose-th:border-border prose-th:bg-muted/40 prose-th:p-2.5 prose-th:text-xs prose-td:border-b prose-td:border-border/60 prose-td:p-2.5 prose-td:text-xs prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Table of Contents sidebar (if 3 or more headings) */}
      {toc.length > 2 && (
        <div className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-4 space-y-2.5 rounded-lg border border-border bg-card/60 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              On this page
            </div>
            <nav className="space-y-1 text-xs">
              {toc.map((item, idx) => (
                <a
                  key={`${item.id}-${idx}`}
                  href={`#${item.id}`}
                  className={`block truncate transition-colors hover:text-foreground ${
                    item.level === 1
                      ? 'font-medium text-foreground'
                      : item.level === 2
                      ? 'pl-3 text-muted-foreground'
                      : 'pl-6 text-muted-foreground/80'
                  }`}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
