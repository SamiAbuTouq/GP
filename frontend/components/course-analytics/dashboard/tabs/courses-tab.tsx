'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TopCoursesTable } from '@/components/course-analytics/dashboard/data-table'
import {
  TopCoursesEnrollmentBarChart,
  HighDemandCourseTrendChart,
} from '@/components/course-analytics/dashboard/strategic-charts'
import type { CourseData, CourseSaturationTrendSeries } from '@/lib/course-analytics/course-data'

interface CoursesTabProps {
  analyticsMode: 'past' | 'planning'
  topCourses: CourseData[]
  highDemandTermLabels: string[]
  highDemandSeries: CourseSaturationTrendSeries[]
  totalUniqueCourses: number
  hasYearOrSemFilter?: boolean
}

export function CoursesTab({
  analyticsMode,
  topCourses,
  highDemandTermLabels,
  highDemandSeries,
  totalUniqueCourses,
  hasYearOrSemFilter = false,
}: CoursesTabProps) {
  return (
    <div className="space-y-6">
      {analyticsMode === 'planning' ? (
        <HighDemandCourseTrendChart termLabels={highDemandTermLabels} series={highDemandSeries} />
      ) : (
        <TopCoursesEnrollmentBarChart data={topCourses} />
      )}

      {!hasYearOrSemFilter && (
        <p className="-mt-2 text-xs text-muted-foreground px-1">
          Totals combine every term in scope. Narrow by year or semester to read a single term.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <TopCoursesTable data={topCourses} className="h-full" />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Course demand notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Unique courses in scope</span>
              <span className="font-semibold tabular-nums">{totalUniqueCourses}</span>
            </div>
            <p className="text-muted-foreground">
              {analyticsMode === 'planning'
                ? 'Trend lines show each course’s strongest section occupancy per term when the course ran. Values are capped at observed section capacity.'
                : 'Rankings use summed seat enrollments across all sections for each course number.'}
            </p>
            {topCourses[0] ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Leading course</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="max-w-[200px] cursor-default truncate font-semibold">{topCourses[0].name}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{topCourses[0].fullName}</TooltipContent>
                </Tooltip>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
