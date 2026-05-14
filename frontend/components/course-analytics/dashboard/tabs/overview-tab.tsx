'use client'

import { Gauge } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import {
  ActionCenterPanel,
  DepartmentalSaturationChart,
  DeliveryModeDonutChart,
  RoomOccupancyHeatmapChart,
  SlotDensityComparisonChart,
  HighSaturationPressureAreaChart,
  LabPressureLineChart,
} from '@/components/course-analytics/dashboard/strategic-charts'
import type {
  DashboardStats,
  DepartmentData,
  ManagementActionItem,
  OnlineModeData,
  RoomOccupancyHeatmapResult,
  PlanningTermRow,
} from '@/lib/course-analytics/course-data'

interface OverviewTabProps {
  analyticsMode: 'past' | 'planning'
  actionItems: ManagementActionItem[]
  stats: DashboardStats
  departmentData: DepartmentData[]
  onlineModeData: OnlineModeData[]
  roomOccupancyHeatmap: RoomOccupancyHeatmapResult
  slotDensity: { rows: { cluster: string; avgSaturationPct: number; sessionCount: number }[]; stt: number; mw: number }
  labOccupancyPct: number | null
  distinctTermCount: number
  planningTermSeries: PlanningTermRow[]
}

export function OverviewTab({
  analyticsMode,
  actionItems,
  stats,
  departmentData,
  onlineModeData,
  roomOccupancyHeatmap,
  slotDensity,
  labOccupancyPct,
  distinctTermCount,
  planningTermSeries,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <ActionCenterPanel items={actionItems} />

      {analyticsMode === 'past' ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <DepartmentalSaturationChart data={departmentData} />
            <DeliveryModeDonutChart data={onlineModeData} />
          </div>
          <RoomOccupancyHeatmapChart data={roomOccupancyHeatmap} />
          <div className="grid gap-6 lg:grid-cols-2">
            <SlotDensityComparisonChart rows={slotDensity.rows} />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Gauge className="h-4 w-4 text-primary" />
                  Capacity snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Physical utilization (seats)</span>
                  <span className="font-semibold tabular-nums">{stats.utilizationRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Empty seats (physical)</span>
                  <span className="font-semibold tabular-nums">{stats.emptySeats.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Full physical sections</span>
                  <span className="font-semibold tabular-nums">{stats.fullSections}</span>
                </div>
                {labOccupancyPct != null ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lab seat occupancy (aggregate)</span>
                    <span className="font-semibold tabular-nums">{labOccupancyPct}%</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <PlanningOverviewSection
          slotDensity={slotDensity}
          distinctTermCount={distinctTermCount}
          stats={stats}
          planningTermSeries={planningTermSeries}
        />
      )}
    </div>
  )
}

function PlanningOverviewSection({
  slotDensity,
  distinctTermCount,
  stats,
  planningTermSeries,
}: {
  slotDensity: OverviewTabProps['slotDensity']
  distinctTermCount: number
  stats: DashboardStats
  planningTermSeries: PlanningTermRow[]
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Planning overview</CardTitle>
            <p className="text-sm text-muted-foreground">
              This mode summarizes recurring pressure from historical registrations and room use. It does not project future
              enrollment — open the Insights tab for demand curves, lab trends, room histories, and expansion candidates.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{distinctTermCount}</span> distinct term
              {distinctTermCount !== 1 ? 's' : ''} in the current filters.
            </p>
            <p>
              Sun–Tue–Thu vs Mon–Wed average occupancy gap:{' '}
              <span className="font-medium text-foreground tabular-nums">
                {Math.abs(slotDensity.stt - slotDensity.mw).toFixed(1)} pts
              </span>{' '}
              ({slotDensity.stt}% vs {slotDensity.mw}%).
            </p>
            <p>
              Institution-wide physical utilization in scope:{' '}
              <span className="font-medium text-foreground">{stats.utilizationRate}%</span>.
            </p>
          </CardContent>
        </Card>
        <SlotDensityComparisonChart rows={slotDensity.rows} />
      </div>
      {planningTermSeries.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <HighSaturationPressureAreaChart data={planningTermSeries} />
          <LabPressureLineChart data={planningTermSeries} />
        </div>
      ) : null}
    </div>
  )
}
