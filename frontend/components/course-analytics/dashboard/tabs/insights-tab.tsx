'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/course-analytics-ui/card'
import { UnderenrolledAlert, RoomWasteTable } from '@/components/course-analytics/dashboard/charts'
import {
  SemesterSeatVolumeChart,
  HighDemandCourseTrendChart,
  LabPressureLineChart,
  HighSaturationPressureAreaChart,
  RoomUtilizationTrendsChart,
  SectionExpansionTable,
} from '@/components/course-analytics/dashboard/strategic-charts'
import type {
  CourseSaturationTrendSeries,
  PlanningTermRow,
  RoomUtilizationTrendRoom,
  RoomWasteData,
  SectionExpansionRow,
  SemesterData,
  UnderenrolledSection,
} from '@/lib/course-analytics/course-data'

interface InsightsTabProps {
  readonly analyticsMode: 'past' | 'planning'
  readonly semesterData: SemesterData[]
  readonly underenrolled: UnderenrolledSection[]
  readonly roomWasteData: RoomWasteData[]
  readonly planningTermSeries: PlanningTermRow[]
  readonly highDemandTermLabels: string[]
  readonly highDemandSeries: CourseSaturationTrendSeries[]
  readonly roomUtilTrends: { heavy: RoomUtilizationTrendRoom[]; light: RoomUtilizationTrendRoom[] }
  readonly expansionRows: SectionExpansionRow[]
  readonly distinctTermCount: number
}

export function InsightsTab({
  analyticsMode,
  semesterData,
  underenrolled,
  roomWasteData,
  planningTermSeries,
  highDemandTermLabels,
  highDemandSeries,
  roomUtilTrends,
  expansionRows,
  distinctTermCount,
}: InsightsTabProps) {
  const expansionNote =
    distinctTermCount <= 1
      ? 'Only one term in scope: a course needs ≥90% utilization in that term to appear (recurrence across terms is not observable here).'
      : undefined

  return (
    <div className="space-y-8 pb-8">
      {analyticsMode === 'past' ? (
        <section className="space-y-4">
          <h3 className="ml-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">Historical audit</h3>
          <div className="grid gap-6 lg:grid-cols-2">
            <SemesterSeatVolumeChart data={semesterData} />
            <RoomWasteTable data={roomWasteData} className="h-full min-h-[320px]" />
          </div>
          <UnderenrolledAlert data={underenrolled} threshold={10} />
        </section>
      ) : (
        <section className="space-y-4">
          <h3 className="ml-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">Planning signals</h3>
          <p className="ml-1 max-w-3xl text-sm text-muted-foreground">
            All views below use historical section registrations and capacities only — no enrollment forecasts or synthetic
            projections.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <HighDemandCourseTrendChart termLabels={highDemandTermLabels} series={highDemandSeries} />
            <LabPressureLineChart data={planningTermSeries} />
          </div>
          {planningTermSeries.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <HighSaturationPressureAreaChart data={planningTermSeries} />
              <RoomUtilizationTrendsChart heavy={roomUtilTrends.heavy} light={roomUtilTrends.light} />
            </div>
          ) : (
            <RoomUtilizationTrendsChart heavy={roomUtilTrends.heavy} light={roomUtilTrends.light} />
          )}
          <SectionExpansionTable rows={expansionRows} minTermsNote={expansionNote} />
        </section>
      )}

      {analyticsMode === 'past' ? (
        <section className="space-y-4">
          <h3 className="ml-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">Cross-check</h3>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Switch to Planning — Insight</CardTitle>
              <CardDescription>
                For recurring high-saturation courses, lab occupancy over time, room utilization trends, and section expansion
                candidates, use the perspective toggle above and reopen this tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {distinctTermCount} term{distinctTermCount === 1 ? '' : 's'} in the current filters.
            </CardContent>
          </Card>
        </section>
      ) : (
        <section className="space-y-4">
          <h3 className="ml-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">Operational cross-check</h3>
          <div className="grid gap-6 lg:grid-cols-2">
            <RoomWasteTable data={roomWasteData} className="h-full min-h-[280px]" />
            <UnderenrolledAlert data={underenrolled} threshold={10} />
          </div>
        </section>
      )}
    </div>
  )
}
