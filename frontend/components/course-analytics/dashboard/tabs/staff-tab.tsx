'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/course-analytics-ui/card'
import { TopLecturersTable } from '@/components/course-analytics/dashboard/data-table'
import {
  LecturerStressScatterChart,
  FacultyCreditHoursBarChart,
} from '@/components/course-analytics/dashboard/strategic-charts'
import type { DashboardStats, LecturerData, LecturerStressPoint, FacultyCreditLoadRow } from '@/lib/course-analytics/course-data'

interface StaffTabProps {
  stats: DashboardStats
  lecturerData: LecturerData[]
  lecturerStress: LecturerStressPoint[]
  facultyCreditTop: FacultyCreditLoadRow[]
  studentLecturerRatioValue: number | 'N/A'
}

/** Shared Recharts height so the two top Staff cards match; fits ~15 vertical bar rows. */
const STAFF_CHART_HEIGHT = 384
/** Main body height for bottom row: table scroll area = overview content min-height. */
const STAFF_BOTTOM_BODY_CLASS = 'min-h-[400px]'

export function StaffTab({
  stats,
  lecturerData,
  lecturerStress,
  facultyCreditTop,
  studentLecturerRatioValue,
}: StaffTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <LecturerStressScatterChart data={lecturerStress} chartHeight={STAFF_CHART_HEIGHT} />
        <FacultyCreditHoursBarChart data={facultyCreditTop} chartHeight={STAFF_CHART_HEIGHT} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <TopLecturersTable
          data={lecturerData}
          uniqueSemesters={stats.uniqueSemesters}
          scrollAreaHeightClass="h-[400px]"
        />
        <Card className="flex h-full min-h-0 flex-col">
          <CardHeader className="shrink-0 pb-4">
            <CardTitle className="text-lg font-semibold">Staff overview</CardTitle>
            <CardDescription>Credit-hour totals and preparation breadth from timetable rows in scope.</CardDescription>
          </CardHeader>
          <CardContent className={`flex flex-1 flex-col justify-center ${STAFF_BOTTOM_BODY_CLASS}`}>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{stats.totalLecturers}</p>
                <p className="text-sm text-muted-foreground">Lecturers (distinct IDs)</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-chart-2">{stats.totalDepartments}</p>
                <p className="text-sm text-muted-foreground">Departments</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-accent">
                  {stats.totalSections > 0 && stats.totalLecturers > 0
                    ? (stats.totalSections / stats.uniqueSemesters / stats.totalLecturers).toFixed(1)
                    : '0'}
                </p>
                <p className="text-sm text-muted-foreground">Avg sections / lecturer / term</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-chart-5">
                  {studentLecturerRatioValue === 'N/A' ? '0' : studentLecturerRatioValue}
                </p>
                <p className="text-sm text-muted-foreground">Avg students / lecturer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
