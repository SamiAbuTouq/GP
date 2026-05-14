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

export function StaffTab({
  stats,
  lecturerData,
  lecturerStress,
  facultyCreditTop,
  studentLecturerRatioValue,
}: StaffTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <LecturerStressScatterChart data={lecturerStress} />
        <FacultyCreditHoursBarChart data={facultyCreditTop} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <TopLecturersTable data={lecturerData} uniqueSemesters={stats.uniqueSemesters} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Staff overview</CardTitle>
            <CardDescription>Credit-hour totals and preparation breadth from timetable rows in scope.</CardDescription>
          </CardHeader>
          <CardContent>
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
