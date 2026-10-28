'use client'

import { Printer } from 'lucide-react'

export function PrintReportToolbar({
  repoName,
  sharedUntilIso,
}: {
  repoName: string
  sharedUntilIso: string
}) {
  return (
    <div className="audit-screen-toolbar" role="region" aria-label="Print controls">
      <span>
        Print-ready A4 audit snapshot for <strong>{repoName}</strong> · Link valid until{' '}
        <span className="audit-mono">{sharedUntilIso.replace('T', ' ').slice(0, 16)} UTC</span>
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="audit-screen-print-btn"
      >
        <Printer className="h-3.5 w-3.5" />
        <span>Print / Save PDF</span>
      </button>
    </div>
  )
}
