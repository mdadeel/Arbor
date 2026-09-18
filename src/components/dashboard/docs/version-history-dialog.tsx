'use client'

import React, { useState } from 'react'
import { History, RotateCcw, Clock, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarkdownViewer } from './markdown-viewer'

export type DocVersionItem = {
  id: string
  version: number
  title: string
  content: string
  changeNote?: string | null
  createdAt: Date | string
}

interface VersionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  versions: DocVersionItem[]
  currentVersion: number
  onRestore: (version: number) => Promise<void>
  isRestoring?: boolean
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  versions,
  currentVersion,
  onRestore,
  isRestoring = false,
}: VersionHistoryDialogProps) {
  const [previewVersion, setPreviewVersion] = useState<number | null>(null)

  const selectedPreview = versions.find((v) => v.version === previewVersion)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <History className="h-4 w-4" />
            <DialogTitle className="text-sm font-semibold">Version History & Audit Log</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            View past revisions of this document or restore previous states.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {versions.map((ver) => {
            const isCurrent = ver.version === currentVersion
            const isExpanded = previewVersion === ver.version
            const dateStr = new Date(ver.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })

            return (
              <div
                key={ver.id}
                className={`rounded-lg border transition-colors p-3.5 space-y-2 ${
                  isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant={isCurrent ? 'default' : 'outline'}
                      className="font-mono text-[10px]"
                    >
                      v{ver.version}
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">{ver.title}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {dateStr}
                    </span>

                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                        onClick={() => onRestore(ver.version)}
                        disabled={isRestoring}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </Button>
                    )}
                  </div>
                </div>

                {ver.changeNote && (
                  <p className="text-xs text-muted-foreground font-mono bg-muted/40 p-1.5 rounded">
                    {ver.changeNote}
                  </p>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setPreviewVersion(isExpanded ? null : ver.version)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {isExpanded ? 'Hide Preview' : 'Inspect Content Snapshot'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="max-h-60 overflow-y-auto rounded border border-border/80 bg-background/80 p-3 text-xs mt-2">
                    <MarkdownViewer content={ver.content} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
