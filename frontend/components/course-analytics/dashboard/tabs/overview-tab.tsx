'use client'

import {
  BookOpen,
  Users,
  Target,
  PieChart,
  Gauge,
  Award,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { Badge } from '@/components/course-analytics-ui/badge'
import {
  SemesterChart,
  CapacityChart,
  DepartmentComparisonChart,
  RoomWasteTable,
  RoomTypeChart,
} from '@/components/course-analytics/dashboard/charts'
import type {
  DashboardStats,
  DepartmentData,
  SemesterData,
  OnlineModeData,
  CapacityDistribution,
  RoomWasteData,
  RoomTypeUtilization,
} from '@/lib/course-analytics/course-data'

interface OverviewTabProps {
  stats: DashboardStats
  departmentData: DepartmentData[]
  semesterData: SemesterData[]
  onlineModeData: OnlineModeData[]
  capacityData: CapacityDistribution[]
  deptComparison: { name: string; students: number; sections: number; courses: number; utilization: number }[]
  roomWasteData: RoomWasteData[]
  roomTypeData: RoomTypeUtilization[]
}

export function OverviewTab({
  stats,
  departmentData,
  semesterData,
  onlineModeData,
  capacityData,
  deptComparison,
  roomWasteData,
  roomTypeData,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Enrollment & Trends Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SemesterChart data={semesterData} />
        <DepartmentComparisonChart data={deptComparison.map(d => ({ ...d, utilization: d.utilization }))} />
      </div>

      {/* Efficiency & Capacity Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RoomWasteTable data={roomWasteData} className="h-full" />
        <div className="flex flex-col gap-6">
          <RoomTypeChart data={roomTypeData} />
          <CapacityChart data={capacityData} />
        </div>
      </div>

      {/* Quick Insights */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Gauge className="h-4 w-4 text-primary" />
              Capacity Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Full sections</span>
              <span className="font-semibold">{stats.fullSections}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Under 50% filled</span>
              <span className="font-semibold">
                {capacityData.filter(c => c.range === '0-25%' || c.range === '26-50%').reduce((sum, c) => sum + c.count, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Over 75% filled</span>
              <span className="font-semibold">
                {capacityData.filter(c => c.range === '76-99%' || c.range === '100%+').reduce((sum, c) => sum + c.count, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Empty seats total</span>
              <span className="font-semibold">{stats.emptySeats.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Target className="h-4 w-4 text-destructive" />
              Resource Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex flex-col justify-center">
            <div className="flex flex-col items-center justify-center py-2 text-center">
              <span className="text-4xl font-bold text-destructive mb-2">{stats.wastedFacultyHours}</span>
              <span className="text-sm font-medium">Estimated Wasted Faculty Hours</span>
              <p className="text-xs text-muted-foreground mt-2 max-w-[250px]">
                Calculated based on sections running with fewer than 10 students enrolled.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
