'use client'
 
import { formatName } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/course-analytics-ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/course-analytics-ui/card'
import { Badge } from '@/components/course-analytics-ui/badge'
import { ScrollArea } from '@/components/course-analytics-ui/scroll-area'
import type { CourseData, LecturerData } from '@/lib/course-analytics/course-data'

interface TopCoursesTableProps {
  data: CourseData[]
  className?: string
}

export function TopCoursesTable({ data, className }: TopCoursesTableProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-4np">
        <CardTitle className="text-lg font-semibold">Top Courses</CardTitle>
        <CardDescription>Courses with highest enrollment</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="h-[550px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky top-0 bg-card pl-6">Course</TableHead>
                <TableHead className="sticky top-0 bg-card text-right">Students</TableHead>
                <TableHead className="sticky top-0 bg-card text-right">Sections</TableHead>
                <TableHead className="sticky top-0 bg-card pr-6 text-right">Avg Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((course, index) => (
                <TableRow key={course.code} className="group border-border/40">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary" title={course.fullName}>
                          {formatName(course.name)}
                        </p>
                        <p className="mt-0.5 text-[11px] font-mono tracking-wider text-muted-foreground/80 uppercase">
                          {course.code}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <span className="font-bold tabular-nums text-foreground tracking-tight">
                      {course.students.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-4 text-muted-foreground font-medium tabular-nums">
                    {course.sections}
                  </TableCell>
                  <TableCell className="pr-6 text-right py-4">
                    <Badge variant="secondary" className="font-mono text-xs font-semibold bg-secondary/30 text-secondary-foreground ring-1 ring-inset ring-border/10">
                      {course.avgClassSize}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

interface TopLecturersTableProps {
  data: LecturerData[]
  className?: string
  /** Number of distinct terms in the current filtered dataset (from stats.uniqueSemesters).
   *  When > 1 a disclaimer note is shown so users know section counts are cumulative. */
  uniqueSemesters?: number
}

export function TopLecturersTable({ data, className, uniqueSemesters = 1 }: TopLecturersTableProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Top Lecturers</CardTitle>
        <CardDescription>
          {uniqueSemesters > 1
            ? `Sections & students are cumulative across ${uniqueSemesters} terms — not per-term averages`
            : 'Lecturers with most sections'}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky top-0 bg-card pl-6">Lecturer</TableHead>
                <TableHead className="sticky top-0 bg-card text-right">Sections</TableHead>
                <TableHead className="sticky top-0 bg-card text-right">Students</TableHead>
                <TableHead className="sticky top-0 bg-card pr-6 text-right">Avg Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((lecturer, index) => (
                <TableRow key={lecturer.fullName} className="group border-border/40">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-xs font-bold text-accent transition-all duration-300 group-hover:scale-110 group-hover:bg-accent/25">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-accent" title={lecturer.fullName}>
                        {formatName(lecturer.name)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <span className="font-bold tabular-nums text-foreground tracking-tight">
                      {lecturer.sections}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-4 text-muted-foreground font-medium tabular-nums">
                    {lecturer.students.toLocaleString()}
                  </TableCell>
                  <TableCell className="pr-6 text-right py-4">
                    <Badge variant="secondary" className="font-mono text-xs font-semibold bg-secondary/30 text-secondary-foreground ring-1 ring-inset ring-border/10">
                      {lecturer.avgClassSize}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
