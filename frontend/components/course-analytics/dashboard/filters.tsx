'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/course-analytics-ui/select'
import { Button } from '@/components/course-analytics-ui/button'
import { Input } from '@/components/course-analytics-ui/input'
import { X, Filter, Calendar, Building2, GraduationCap, Search } from 'lucide-react'
import type { FilterOptions } from '@/lib/course-analytics/course-data'

interface FiltersProps {
  filterOptions: FilterOptions
  selectedSemester: string
  selectedDepartment: string
  selectedYear: string
  searchQuery: string
  hasActiveFilters: boolean
  onSemesterChange: (value: string) => void
  onDepartmentChange: (value: string) => void
  onYearChange: (value: string) => void
  onSearchChange: (value: string) => void
  onClearFilters: () => void
  children?: React.ReactNode
}

export function Filters({
  filterOptions,
  selectedSemester,
  selectedDepartment,
  selectedYear,
  searchQuery,
  hasActiveFilters,
  onSemesterChange,
  onDepartmentChange,
  onYearChange,
  onSearchChange,
  onClearFilters,
  children,
}: FiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap w-full">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filters</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="dashboard-search"
            type="text"
            placeholder="Search courses or lecturers..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-[220px] border-border bg-transparent pl-9 text-sm"
            aria-label="Search courses or lecturers"
          />
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={onYearChange}>
            <SelectTrigger
              id="year-filter"
              className="h-9 w-[150px] border-border bg-transparent text-sm"
              aria-label="Filter by academic year"
            >
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {Array.from(new Set(filterOptions.years.map(String)))
                .filter((y) => y && y !== 'undefined' && y !== 'null')
                .map((year, idx) => (
                  <SelectItem key={`year-${idx}-${year}`} value={year}>
                    {year}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Semester Filter */}
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedSemester} onValueChange={onSemesterChange}>
            <SelectTrigger
              id="semester-filter"
              className="h-9 w-[170px] border-border bg-transparent text-sm"
              aria-label="Filter by semester"
            >
              <SelectValue placeholder="Select Semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {Array.from(new Set(filterOptions.semesters.map(String)))
                .filter((s) => s && s !== 'undefined' && s !== 'null')
                .map((sem, idx) => (
                  <SelectItem key={`semester-${idx}-${sem}`} value={sem}>
                    {sem}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Department Filter */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
            <SelectTrigger
              id="department-filter"
              className="h-9 w-[240px] border-border bg-transparent text-sm"
              aria-label="Filter by department"
            >
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Departments</SelectItem>
              {Array.from(new Set(filterOptions.departments.map(String)))
                .filter((d) => d && d !== 'undefined' && d !== 'null')
                .map((dept, idx) => (
                  <SelectItem key={`dept-${idx}-${dept}`} value={dept}>
                    <span className="truncate">{dept}</span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            aria-label="Clear all filters"
            className="h-9 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            Clear All
          </Button>
        )}
      </div>

      {children && <div className="ml-auto">{children}</div>}
    </div>
  )
}
