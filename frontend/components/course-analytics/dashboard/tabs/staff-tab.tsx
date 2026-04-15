'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/course-analytics-ui/card'
import { TopLecturersTable } from '@/components/course-analytics/dashboard/data-table'
import { FacultyWorkloadChart } from '@/components/course-analytics/dashboard/charts'
import type { DashboardStats, LecturerData, FacultyWorkloadData } from '@/lib/course-analytics/course-data'

interface StaffTabProps {
  stats: DashboardStats
  lecturerData: LecturerData[]
  facultyWorkload: FacultyWorkloadData[]
  studentLecturerRatioValue: number | 'N/A'
}

export function StaffTab({
  stats,
  lecturerData,
  facultyWorkload,
  studentLecturerRatioValue,
}: StaffTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <TopLecturersTable data={lecturerData} uniqueSemesters={stats.uniqueSemesters} />
        <FacultyWorkloadChart data={facultyWorkload} />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Staff Overview</CardTitle>
          <CardDescription>Summary of teaching staff metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{stats.totalLecturers}</p>
              <p className="text-sm text-muted-foreground">Total Lecturers</p>
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
              <p className="text-sm text-muted-foreground">Avg Sections/Lecturer/Term</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-chart-5">
                {studentLecturerRatioValue === 'N/A' ? '0' : studentLecturerRatioValue}
              </p>
              <p className="text-sm text-muted-foreground">Avg Students/Lecturer</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
