import { AlertTriangle, Boxes, History, Layers } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

const ADDITIONAL_VIEWS = [
  ['environment', 'Environment'], ['api', 'API'], ['docs', 'Docs'], ['health', 'Health'],
  ['commits', 'Commits'], ['insights', 'Insights'], ['dependencies', 'Dependencies'],
  ['policies', 'Policies'], ['pull-requests', 'Pull requests'],
] as const

export function AnalysisReportNavigation({ tab, onValueChange, findingsCount, historyCount }: {
  tab: string
  onValueChange: (value: string) => void
  findingsCount: number
  historyCount: number
}) {
  const additional = ADDITIONAL_VIEWS.find(([value]) => value === tab)
  return (
    <nav aria-label="Analysis report views" className="flex flex-wrap items-center gap-3">
      <TabsList className="h-auto min-h-9 flex-wrap justify-start gap-1">
        <TabsTrigger value="overview" className="gap-1.5 text-xs"><Layers className="size-3.5" />Overview</TabsTrigger>
        <TabsTrigger value="findings" className="gap-1.5 text-xs"><AlertTriangle className="size-3.5" />Findings ({findingsCount})</TabsTrigger>
        <TabsTrigger value="architecture" className="gap-1.5 text-xs"><Boxes className="size-3.5" />Architecture</TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5 text-xs"><History className="size-3.5" />History ({historyCount})</TabsTrigger>
        {/* Keep an accessible tab label for the currently selected additional panel. */}
        {additional && <TabsTrigger value={additional[0]} className="text-xs">{additional[1]}</TabsTrigger>}
      </TabsList>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        More views
        <select aria-label="More report views" value={additional?.[0] ?? ''} onChange={(event) => onValueChange(event.target.value)}
          className="h-9 max-w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <option value="" disabled>Choose a view</option>
          {ADDITIONAL_VIEWS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </nav>
  )
}
