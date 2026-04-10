'use client'

import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/course-analytics-ui/card'
import { Badge } from '@/components/course-analytics-ui/badge'
import { TimeSlotChart, DayChart, UtilizationHeatmap } from '@/components/course-analytics/dashboard/charts'
import { MiniStat } from '@/components/course-analytics/dashboard/stat-card'
import type { DashboardStats, TimeSlotData, DayData, HeatmapData } from '@/lib/course-analytics/course-data'

interface ScheduleTabProps {
  stats: DashboardStats
  timeSlotData: TimeSlotData[]
  dayData: DayData[]
  heatmapData: HeatmapData[]
}

export function ScheduleTab({ stats, timeSlotData, dayData, heatmapData }: ScheduleTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <TimeSlotChart data={timeSlotData} />
        <DayChart data={dayData} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <UtilizationHeatmap data={heatmapData} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-primary" />
              Schedule Intelligence
            </CardTitle>
            <CardDescription>Key scheduling metrics and patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MiniStat label="Busiest Hour" value={stats.peakHour || 'N/A'} icon={Clock} />
              <MiniStat label="Busiest Day" value={stats.busiestDay || 'N/A'} icon={Clock} />
              <MiniStat label="Time slots used" value={timeSlotData.length} icon={Clock} />
              <MiniStat label="Active days" value={dayData.length} icon={Clock} />
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">Daily Distribution</h4>
              <div className="flex flex-wrap gap-2">
                {dayData.map((day) => (
                  <Badge key={day.day} variant="secondary" className="gap-1.5 px-3 py-1.5">
                    <span className="font-semibold">{day.day}</span>
                    <span className="text-muted-foreground">|</span>
                    <span>{day.sections} sessions</span>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
