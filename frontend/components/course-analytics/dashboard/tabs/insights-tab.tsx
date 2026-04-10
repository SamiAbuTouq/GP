'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/course-analytics-ui/card'
import { Badge } from '@/components/course-analytics-ui/badge'
import { UnderenrolledAlert, HighDemandAlert, SemesterYoYChart, DepartmentUtilizationGauges, CourseGrowthChart } from '@/components/course-analytics/dashboard/charts'
import type { UnderenrolledSection, HighDemandSection, DepartmentUtilization, CourseGrowthData } from '@/lib/course-analytics/course-data'

interface YearGrowthData {
  year: string
  students: number
  sections: number
  growth: number
  isPartial?: boolean
}

interface SemesterYoYData {
  year: string
  first: number
  second: number
  summer: number
}

interface InsightsTabProps {
  yearGrowth: YearGrowthData[]
  underenrolled: UnderenrolledSection[]
  highDemand: HighDemandSection[]
  semesterYoY: SemesterYoYData[]
  departmentUtilization: DepartmentUtilization[]
  courseGrowthTrends: CourseGrowthData[]
}

export function InsightsTab({ yearGrowth, underenrolled, highDemand, semesterYoY, departmentUtilization, courseGrowthTrends }: InsightsTabProps) {
  return (
    <div className="space-y-8 pb-8">
      {/* Top Row: Year and Semester Trends */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider ml-1">Historical Trends</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Year-over-Year Growth Text */}
          <Card className="h-full">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="h-5 w-5 text-primary" />
                Year-over-Year Growth Details
              </CardTitle>
              <CardDescription>
                First-semester headcount from the registrar when available; section counts from schedule data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {yearGrowth.length === 0 ? (
                <p className="text-sm text-muted-foreground">No year data available.</p>
              ) : (
                <div className="space-y-4">
                  {[...yearGrowth].reverse().map((yr, idx, arr) => (
                    <div key={yr.year} className="flex items-center justify-between rounded-lg border border-border/50 p-4 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-6">
                        <div className="flex h-10 px-3 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold tracking-wide text-primary">
                          {yr.year}
                        </div>
                        <div className="flex gap-8">
                          <div>
                            <p className="text-xs text-muted-foreground">Students</p>
                            <p className="text-lg font-semibold tabular-nums tracking-tight">{yr.students.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Sections</p>
                            <p className="text-lg font-semibold tabular-nums tracking-tight">{yr.sections.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      {idx < arr.length - 1 && (
                        <div className="flex items-center gap-4 text-right">
                          <div className="flex flex-col items-end">
                            <p className="text-xs text-muted-foreground">Net Growth</p>
                            <Badge
                              variant={yr.growth >= 0 ? 'default' : 'destructive'}
                              className="font-mono mt-0.5"
                            >
                              {yr.growth >= 0 ? '+' : ''}{yr.growth}%
                            </Badge>
                          </div>
                          {yr.growth !== 0 && (
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${yr.growth > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                              {yr.growth > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {yearGrowth.some((yr) => yr.isPartial) && (
                    <p className="text-xs text-muted-foreground">
                      Partial years are compared using only semester types available in both adjacent years.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Semester YoY Chart */}
          <SemesterYoYChart data={semesterYoY} />
        </div>
      </section>

      {/* Middle Row: Efficiency & Growth Analysis */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider ml-1">Performance Analysis</h3>
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Department Utilization Gauges */}
          <DepartmentUtilizationGauges data={departmentUtilization} />

          {/* Course Growth Analysis */}
          <CourseGrowthChart data={courseGrowthTrends} />
        </div>
      </section>

      {/* Bottom Row: Resource Management & Alerts */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider ml-1">Resource Alerts</h3>
        <div className="grid gap-6">
          <div className="min-h-0">
            <HighDemandAlert data={highDemand} threshold={95} />
          </div>
          <div className="min-h-0">
            <UnderenrolledAlert data={underenrolled} threshold={10} />
          </div>
        </div>
      </section>
    </div>
  )
}
