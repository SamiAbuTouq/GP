'use client'

import { ClipboardList, Building2, Users, CalendarClock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { Badge } from '@/components/course-analytics-ui/badge'
import { ScrollArea } from '@/components/course-analytics-ui/scroll-area'
import type { ActionInsight, ActionInsightCategory } from '@/lib/course-analytics/course-data'

const categoryMeta: Record<
  ActionInsightCategory,
  { label: string; icon: typeof Building2; badgeClass: string }
> = {
  resource: { label: 'Resource', icon: Building2, badgeClass: 'bg-chart-4/15 text-chart-4 border-chart-4/25' },
  capacity: { label: 'Capacity', icon: ClipboardList, badgeClass: 'bg-chart-2/15 text-chart-2 border-chart-2/25' },
  hr: { label: 'HR', icon: Users, badgeClass: 'bg-chart-3/15 text-chart-3 border-chart-3/25' },
  scheduling: { label: 'Scheduling', icon: CalendarClock, badgeClass: 'bg-chart-5/15 text-chart-5 border-chart-5/25' },
}

export function ActionCenterPanel({ insights }: { insights: ActionInsight[] }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold tracking-tight">Managerial action center</CardTitle>
        <CardDescription>
          -language items derived from the same utilization, waste, lab, HR, and timetable metrics shown in the charts
          (no projected enrollment or synthetic forecasts).
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {insights.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            No automated actions for the current filter scope. Try widening the year range or clearing the department filter
            when you want institution-wide signals.
          </p>
        ) : (
          <ScrollArea className="max-h-[min(520px,70vh)] pr-2">
            <ul className="space-y-3 px-6 pb-6">
              {insights.map((item, idx) => {
                const meta = categoryMeta[item.category]
                const Icon = meta.icon
                return (
                  <li
                    key={`${item.title}-${idx}`}
                    className="rounded-xl border border-border/50 bg-muted/20 p-4 transition-colors hover:bg-muted/35"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`gap-1 font-semibold ${meta.badgeClass}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">{item.title}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.message}</p>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
