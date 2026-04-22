'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TopCoursesChart, AcademicLevelStackedChart } from '@/components/course-analytics/dashboard/charts'
import { TopCoursesTable } from '@/components/course-analytics/dashboard/data-table'
import type { DashboardStats, CourseData, AcademicLevelModeData } from '@/lib/course-analytics/course-data'

interface CoursesTabProps {
  stats: DashboardStats
  topCourses: CourseData[]
  academicLevelModeData: AcademicLevelModeData[]
  /** True when a year or semester filter is active. Used to suppress the multi-term disclaimer. */
  hasYearOrSemFilter?: boolean
}

export function CoursesTab({ stats, topCourses, academicLevelModeData, hasYearOrSemFilter = false }: CoursesTabProps) {
  return (
    <div className="space-y-6">
      <TopCoursesChart data={topCourses} />
      {/* Issue 7: Warn users that multi-year totals inflate older courses when no year/semester filter is active */}
      {!hasYearOrSemFilter && (
        <p className="-mt-4 text-xs text-muted-foreground px-1">
          Total across all selected terms. Apply a year or semester filter to compare within a single term.
        </p>
      )}
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
                <span className="text-muted-foreground">Avg sections per course (per term)</span>
                <span className="font-semibold">{stats.avgSectionsPerCourse}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Most popular course</span>
                {stats.mostPopularCourse ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="max-w-[180px] cursor-default truncate font-semibold">
                        {stats.mostPopularCourse}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{stats.mostPopularCourse}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="max-w-[180px] truncate font-semibold">N/A</span>
                )}
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
