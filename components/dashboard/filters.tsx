"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Filter, RefreshCw, GraduationCap } from "lucide-react"
import { ExportIcon } from "@/components/custom-icons"

interface DashboardFiltersProps {
  semester: string
  department: string
  college: string
  onSemesterChange: (value: string) => void
  onDepartmentChange: (value: string) => void
  onCollegeChange: (value: string) => void
  onRefresh: () => void
}

export function DashboardFilters({
  semester,
  department,
  college,
  onSemesterChange,
  onDepartmentChange,
  onCollegeChange,
  onRefresh,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Filter className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">Filters</span>
      </div>

      <div className="h-6 w-px bg-border" />

      <Select value={semester} onValueChange={onSemesterChange}>
        <SelectTrigger className="h-9 w-[150px] text-sm font-medium">
          <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Semester" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fall-2024">Fall 2024</SelectItem>
          <SelectItem value="spring-2024">Spring 2024</SelectItem>
          <SelectItem value="summer-2024">Summer 2024</SelectItem>
          <SelectItem value="fall-2023">Fall 2023</SelectItem>
        </SelectContent>
      </Select>

      <Select value={department} onValueChange={onDepartmentChange}>
        <SelectTrigger className="h-9 w-[170px] text-sm font-medium">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          <SelectItem value="cs">Computer Science</SelectItem>
          <SelectItem value="se">Software Engineering</SelectItem>
          <SelectItem value="ds">Data Science</SelectItem>
          <SelectItem value="is">Information Systems</SelectItem>
          <SelectItem value="cys">Cybersecurity</SelectItem>
        </SelectContent>
      </Select>

      <Select value={college} onValueChange={onCollegeChange}>
        <SelectTrigger className="h-9 w-[280px] text-sm font-medium">
          <GraduationCap className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="College" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Colleges</SelectItem>
          <SelectItem value="khscs">King Hussein School of Computing Sciences</SelectItem>
          <SelectItem value="kaiioe">King Abdullah II School of Engineering</SelectItem>
          <SelectItem value="ktsbt">King Talal School of Business Technology</SelectItem>
          <SelectItem value="kaisgssr">King Abdullah I School of Graduate Studies</SelectItem>
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-9 text-sm font-medium" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button size="sm" className="h-9 text-sm font-medium">
          <ExportIcon className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  )
}
