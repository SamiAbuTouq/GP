'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { ScrollArea } from '@/components/course-analytics-ui/scroll-area'
import { ActionCenterPanel } from '@/components/course-analytics/dashboard/action-center-panel'
import {
  CourseSaturationTrendChart,
  LabPressureLineChart,
  RoomUtilizationTrendChart,
} from '@/components/course-analytics/dashboard/decision-charts'
import type {
  ActionInsight,
  CourseSaturationTrend,
  LabPressurePoint,
  RoomUtilTrendSeries,
  SectionExpansionRow,
} from '@/lib/course-analytics/course-data'

interface PlanningTabProps {
  courseSaturationTrends: CourseSaturationTrend[]
  labPressure: LabPressurePoint[]
  roomUtilTrend: RoomUtilTrendSeries
  expansionRows: SectionExpansionRow[]
  actionInsights: ActionInsight[]
}

export function PlanningTab({
  courseSaturationTrends,
  labPressure,
  roomUtilTrend,
  expansionRows,
  actionInsights,
}: PlanningTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_340px] xl:items-start">
        <div className="space-y-6">
          <Card className="border-chart-2/20 bg-chart-2/[0.04]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Planning &amp; strategic insight mode</CardTitle>
              <CardDescription>
                Uses only recurring patterns in historical scheduling and utilization: high saturation episodes, lab occupancy
                pressure, and room efficiency over time. There is no modeled enrollment forecast or growth assumption.
              </CardDescription>
            </CardHeader>
          </Card>

          <CourseSaturationTrendChart trends={courseSaturationTrends} />

          <div className="grid gap-6 lg:grid-cols-2">
            <LabPressureLineChart data={labPressure} />
            <RoomUtilizationTrendChart rooms={roomUtilTrend.rooms} points={roomUtilTrend.points} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Section expansion signals</CardTitle>
              <CardDescription>
                Courses where at least two observed terms had a physical section reaching 90%+ room utilization (max per term).
                Recommendations describe the observed pattern only.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {expansionRows.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">
                  No courses met the recurring high-saturation rule for the current filters.
                </p>
              ) : (
                <ScrollArea className="max-h-[min(420px,55vh)]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card/95 backdrop-blur">
                      <tr className="border-b text-left">
                        <th className="px-6 py-2.5 font-medium text-muted-foreground">Course</th>
                        <th className="px-3 py-2.5 font-medium text-muted-foreground">Department</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">High terms</th>
                        <th className="px-6 py-2.5 text-right font-medium text-muted-foreground">Observed terms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expansionRows.map((row) => (
                        <tr
                          key={row.courseCode}
                          className="border-b border-border/50 align-top last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-3">
                            <div className="font-medium text-foreground">{row.courseCode}</div>
                            <div className="mt-1 max-w-[280px] text-xs text-muted-foreground leading-snug">{row.courseName}</div>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{row.department || '—'}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">{row.termsWithHighSaturation}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">{row.termsObserved}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="space-y-3 border-t border-border/60 px-6 py-4">
                    {expansionRows.slice(0, 6).map((row) => (
                      <p key={`${row.courseCode}-rec`} className="text-xs leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground">{row.courseCode}:</span> {row.recommendation}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <ActionCenterPanel insights={actionInsights} />
        </div>
      </div>
    </div>
  )
}
