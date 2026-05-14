'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { ScrollArea } from '@/components/course-analytics-ui/scroll-area'
import type { RoomWasteData, UnderenrolledSection } from '@/lib/course-analytics/course-data'

interface UnderenrolledAlertProps {
  data: UnderenrolledSection[]
  threshold?: number
}

export function UnderenrolledAlert({ data, threshold = 10 }: UnderenrolledAlertProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-chart-2/20 text-chart-2">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            Enrollment Health
          </CardTitle>
          <CardDescription>No critically underenrolled sections found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">All sections have at least {threshold} students enrolled.</p>
        </CardContent>
      </Card>
    )
  }

  const listHeight = 8 * 40

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/20 text-destructive">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </span>
          Underenrolled Sections
        </CardTitle>
        <CardDescription>
          {data.length} physical sections with fewer than {threshold} students enrolled (online excluded)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="w-full" style={{ height: listHeight }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left">
                <th className="px-6 py-2.5 font-medium text-muted-foreground">Course</th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Sec</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Students</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Cap</th>
                <th className="px-6 py-2.5 text-right font-medium text-muted-foreground">Fill %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((section, idx) => (
                <tr
                  key={`${section.course}-${section.section}-${idx}`}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-2.5">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{section.course}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="max-w-[200px] cursor-default truncate text-xs text-muted-foreground">
                            {section.courseName}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{section.courseName}</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{section.section}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-destructive">{section.students}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{section.capacity}</td>
                  <td className="px-6 py-2.5 text-right">
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      {section.utilization}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function RoomWasteTable({ data, className }: { data: RoomWasteData[]; className?: string }) {
  return (
    <Card className={`flex flex-col h-full border-border/40 overflow-hidden ${className || ''}`}>
      <CardHeader className="pb-4 shrink-0">
        <CardTitle className="text-lg font-semibold text-destructive">Room Waste (Unused Seats)</CardTitle>
        <CardDescription>
          Σ(section seat capacity − enrolled) aggregated by room; online, training, and project rooms excluded. Averages
          shown when multiple terms appear in scope.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden px-0 pb-0 min-h-0">
        <div className="h-full overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur">
              <tr className="border-b text-left">
                <th className="px-6 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Room</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Unused/Term
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Fill %
                </th>
                <th className="px-6 py-2.5 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Capacity/Term
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((room, idx) => (
                <tr
                  key={`${room.room}-${idx}`}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-3 font-medium text-foreground">{room.room}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-semibold text-destructive">{room.unusedSeats}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">{room.efficiencyScore}%</span>
                      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${room.efficiencyScore < 30 ? 'bg-destructive' : room.efficiencyScore < 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${room.efficiencyScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-muted-foreground tabular-nums">{room.totalCapacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
