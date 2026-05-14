'use client'

import { Gauge } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { MiniStat } from '@/components/course-analytics/dashboard/stat-card'
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
            <RoomOccupancyHeatmapChart data={roomOccupancyHeatmap} />
            <SlotDensityComparisonChart rows={slotDensity.rows} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <DepartmentalSaturationChart data={departmentData} />
            <DeliveryModeDonutChart data={onlineModeData} />
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Gauge className="h-5 w-5 text-primary" />
                Capacity snapshot
              </CardTitle>
              <CardDescription>
                Physical sections in scope: utilization is registered students divided by seat capacity; empty seats and
                full sections summarize headroom and at-capacity offerings (labs shown separately when lab sections are
                present).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <MiniStat
                  label="Physical utilization (seats)"
                  value={`${stats.utilizationRate}%`}
                  icon={Gauge}
                />
                <MiniStat
                  label="Empty seats (physical)"
                  value={stats.emptySeats.toLocaleString()}
                  icon={Gauge}
                />
                <MiniStat label="Full physical sections" value={stats.fullSections} icon={Gauge} />
                {labOccupancyPct != null ? (
                  <MiniStat label="Lab seat occupancy (aggregate)" value={`${labOccupancyPct}%`} icon={Gauge} />
                ) : null}
              </div>
            </CardContent>
          </Card>
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
