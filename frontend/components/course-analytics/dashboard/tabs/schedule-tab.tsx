'use client'

import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/course-analytics-ui/card'
import { MiniStat } from '@/components/course-analytics/dashboard/stat-card'
import {
  CampusConcurrentDensityChart,
  SlotDensityComparisonChart,
  LabPressureLineChart,
} from '@/components/course-analytics/dashboard/strategic-charts'
import type { HeatmapData, PlanningTermRow, SlotDensityClusterRow } from '@/lib/course-analytics/course-data'

interface ScheduleTabProps {
  analyticsMode: 'past' | 'planning'
  heatmapData: HeatmapData[]
  slotDensityRows: SlotDensityClusterRow[]
  planningTermSeries: PlanningTermRow[]
}

export function ScheduleTab({ analyticsMode, heatmapData, slotDensityRows, planningTermSeries }: ScheduleTabProps) {
  const peakFromHeat = [...heatmapData].sort((a, b) => b.value - a.value)[0]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <CampusConcurrentDensityChart data={heatmapData} />
        <SlotDensityComparisonChart rows={slotDensityRows} />
      </div>

      {analyticsMode === 'planning' && planningTermSeries.length > 0 ? (
        <LabPressureLineChart data={planningTermSeries} />
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-primary" />
            Slot intelligence
          </CardTitle>
          <CardDescription>
            Campus density uses day and start hour; each section contributes its Registered_Students once per scheduled meeting
            day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MiniStat
              label="Peak grid cell"
              value={peakFromHeat ? `${peakFromHeat.day} ${peakFromHeat.hour}` : 'N/A'}
              icon={Clock}
            />
            <MiniStat
              label="Peak concurrent seats"
              value={peakFromHeat ? peakFromHeat.value.toLocaleString() : '0'}
              icon={Clock}
            />
            <MiniStat label="Active day-hour cells" value={heatmapData.filter((h) => h.value > 0).length} icon={Clock} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
