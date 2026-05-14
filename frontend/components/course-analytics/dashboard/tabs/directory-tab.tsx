'use client'

import { DepartmentsTab } from '@/components/course-analytics/dashboard/tabs/departments-tab'
import { ScheduleTab } from '@/components/course-analytics/dashboard/tabs/schedule-tab'
import { CoursesTab } from '@/components/course-analytics/dashboard/tabs/courses-tab'
import { StaffTab } from '@/components/course-analytics/dashboard/tabs/staff-tab'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/course-analytics-ui/card'
import type {
  AcademicLevelModeData,
  CourseData,
  DashboardStats,
  DayData,
  DepartmentData,
  FacultyWorkloadData,
  HeatmapData,
  LecturerData,
  TimeSlotData,
} from '@/lib/course-analytics/course-data'

interface DirectoryTabProps {
  stats: DashboardStats
  departmentData: DepartmentData[]
  scatterData: { name: string; classSize: number; utilization: number; sections: number }[]
  timeSlotData: TimeSlotData[]
  dayData: DayData[]
  heatmapData: HeatmapData[]
  topCourses: CourseData[]
  academicLevelModeData: AcademicLevelModeData[]
  hasYearOrSemFilter: boolean
  lecturerData: LecturerData[]
  facultyWorkload: FacultyWorkloadData[]
  studentLecturerRatioValue: number | 'N/A'
}

export function DirectoryTab(props: DirectoryTabProps) {
  return (
    <div className="space-y-10">
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Directory &amp; drill-down</CardTitle>
          <CardDescription>
            Classic department, schedule, catalog, and staff views—unchanged data definitions, grouped here so audit and planning
            tabs stay executive-focused.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Departments</h3>
        <DepartmentsTab departmentData={props.departmentData} scatterData={props.scatterData} />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule</h3>
        <ScheduleTab stats={props.stats} timeSlotData={props.timeSlotData} dayData={props.dayData} heatmapData={props.heatmapData} />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Courses</h3>
        <CoursesTab
          stats={props.stats}
          topCourses={props.topCourses}
          academicLevelModeData={props.academicLevelModeData}
          hasYearOrSemFilter={props.hasYearOrSemFilter}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff</h3>
        <StaffTab
          stats={props.stats}
          lecturerData={props.lecturerData}
          facultyWorkload={props.facultyWorkload}
          studentLecturerRatioValue={props.studentLecturerRatioValue}
        />
      </section>
    </div>
  )
}
