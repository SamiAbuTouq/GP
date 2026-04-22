'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/course-analytics-ui/card'
import { Badge } from '@/components/course-analytics-ui/badge'
import { ScrollArea } from '@/components/course-analytics-ui/scroll-area'
import { DepartmentChart, SectionScatterChart } from '@/components/course-analytics/dashboard/charts'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DepartmentData } from '@/lib/course-analytics/course-data'

interface DepartmentsTabProps {
  departmentData: DepartmentData[]
  scatterData: { name: string; classSize: number; utilization: number; sections: number }[]
}

export function DepartmentsTab({ departmentData, scatterData }: DepartmentsTabProps) {
  return (
    <div className="space-y-6">
      <DepartmentChart data={departmentData} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionScatterChart data={scatterData} />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Department Details</CardTitle>
            <CardDescription>Complete breakdown by department</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ScrollArea className="h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left">
                    <th className="px-6 py-3 font-medium text-muted-foreground">Department</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Students</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Sections</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Courses</th>
                    <th className="px-6 py-3 text-right font-medium text-muted-foreground">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentData.map((dept, index) => (
                    <tr key={dept.fullName} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                            {index + 1}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default truncate font-medium">{dept.name}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top">{dept.fullName}</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{dept.students.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{dept.sections}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{dept.courses}</td>
                      <td className="px-6 py-3 text-right">
                        {/* Issue 5: unified thresholds — ≥90=full/default, ≥75=high/secondary, ≥60=medium/outline, <60=low/destructive */}
                        <Badge
                          variant={dept.utilization >= 90 ? 'default' : dept.utilization >= 75 ? 'secondary' : dept.utilization >= 60 ? 'outline' : 'destructive'}
                          className="font-mono text-xs"
                        >
                          {dept.utilization}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
