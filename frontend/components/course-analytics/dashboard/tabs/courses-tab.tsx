'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { TopCoursesChart, AcademicLevelStackedChart } from '@/components/course-analytics/dashboard/charts'
import { TopCoursesTable } from '@/components/course-analytics/dashboard/data-table'
import type { DashboardStats, CourseData, AcademicLevelModeData } from '@/lib/course-analytics/course-data'

interface CoursesTabProps {
  stats: DashboardStats
  topCourses: CourseData[]
  academicLevelModeData: AcademicLevelModeData[]
}

export function CoursesTab({ stats, topCourses, academicLevelModeData }: CoursesTabProps) {
  return (
    <div className="space-y-6">
      <TopCoursesChart data={topCourses} />
      <div className="grid gap-6 lg:grid-cols-2">
        <TopCoursesTable data={topCourses} className="h-full" />
        <div className="grid gap-6 sm:grid-cols-1">
          <AcademicLevelStackedChart data={academicLevelModeData} />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Course Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total unique courses</span>
                <span className="font-semibold">{stats.totalCourses}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Average sections per course</span>
                <span className="font-semibold">{stats.avgSectionsPerCourse}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Most popular course</span>
                <span className="truncate max-w-[180px] font-semibold" title={stats.mostPopularCourse}>
                  {stats.mostPopularCourse || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Average class size</span>
                <span className="font-semibold">{stats.avgClassSize} students</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
