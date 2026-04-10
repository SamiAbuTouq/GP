'use client'

import { useEffect, useState, useMemo, useCallback, useDeferredValue } from 'react'
import {
  BookOpen,
  Users,
  Building2,
  TrendingUp,
  Percent,
  Presentation,
  GraduationCap,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  MonitorPlay,
  Calendar,
  Clock,
  Target,
  BarChart3,
  Activity,
  Lightbulb,
  Library,
  PieChart,
  Armchair,
  Laptop,
  LayoutDashboard,
} from 'lucide-react'
import {
  loadCourseData,
  loadSemesterTotals,
  calculateStats,
  resolveHeadcountForFilters,
  getDepartmentData,
  getSemesterData,
  getOnlineModeData,
  getTopLecturers,
  getTimeSlotData,
  getDayData,
  getTopCourses,
  getCapacityDistribution,
  getDepartmentComparison,
  getFilterOptions,
  filterCourses,
  getScheduleHeatmap,
  getDepartmentScatterData,
  getYearOverYearGrowth,
  getUnderenrolledSections,
  getSemesterYoYComparison,
  getDepartmentUtilization,
  getRoomWasteAnalysis,
  getCourseGrowthTrends,
  type Course,
  type FilterOptions,
  type SemesterTotal,
} from '@/lib/course-analytics/course-data'
import { StatCard, MiniStat } from '@/components/course-analytics/dashboard/stat-card'
import { Filters } from '@/components/course-analytics/dashboard/filters'
import { LoadingSkeleton } from '@/components/course-analytics/dashboard/loading-skeleton'
import { ErrorBanner } from '@/components/course-analytics/dashboard/error-banner'
import { OverviewTab } from '@/components/course-analytics/dashboard/tabs/overview-tab'
import { DepartmentsTab } from '@/components/course-analytics/dashboard/tabs/departments-tab'
import { ScheduleTab } from '@/components/course-analytics/dashboard/tabs/schedule-tab'
import { CoursesTab } from '@/components/course-analytics/dashboard/tabs/courses-tab'
import { StaffTab } from '@/components/course-analytics/dashboard/tabs/staff-tab'
import { InsightsTab } from '@/components/course-analytics/dashboard/tabs/insights-tab'
import { Button } from '@/components/course-analytics-ui/button'
import {
  getHighDemandSections,
  getFacultyWorkloadDistribution,
  getRoomTypeUtilization,
  getAcademicLevelModeData,
  getAcademicFocusData,
} from '@/lib/course-analytics/course-data'
import { Card, CardContent } from '@/components/course-analytics-ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/course-analytics-ui/tabs'
import { Badge } from '@/components/course-analytics-ui/badge'
import { ThemeToggle } from '@/components/course-analytics/theme-toggle'
import { PalettePicker } from '@/components/course-analytics/palette-picker'
import { useDebounce } from '@/hooks/use-debounce'

export default function CourseAnalyticsApp({
  onInitialLoadComplete,
}: {
  onInitialLoadComplete?: () => void
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [semesterTotals, setSemesterTotals] = useState<SemesterTotal[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ semesters: [], departments: [], years: [] })
  const [selectedSemester, setSelectedSemester] = useState('all')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Debounce search so we don't re-filter on every keystroke
  const debouncedSearch = useDebounce(searchQuery, 400)

  const filteredCourses = useMemo(() => {
    let filtered = filterCourses(allCourses, {
      semester: selectedSemester,
      department: selectedDepartment,
      year: selectedYear,
    })

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase().trim()
      filtered = filtered.filter(
        (course) =>
          course.English_Name?.toLowerCase().includes(query) ||
          course.Course_Number?.toLowerCase().includes(query) ||
          course.Lecturer_Name?.toLowerCase().includes(query) ||
          course.Department?.toLowerCase().includes(query),
      )
    }

    return filtered
  }, [allCourses, selectedSemester, selectedDepartment, selectedYear, debouncedSearch])

  /** Official registrar headcount for current filters (DB), or null when not applicable. */
  const semesterHeadcountTotal = useMemo(() => {
    if (selectedDepartment !== 'all' || debouncedSearch.trim() !== '') return null
    return resolveHeadcountForFilters(semesterTotals, {
      year: selectedYear,
      semester: selectedSemester,
    })
  }, [semesterTotals, selectedDepartment, debouncedSearch, selectedYear, selectedSemester])

  // Derived data — filtered courses; student KPIs use DB headcount when institution-wide
  const stats = useMemo(
    () => calculateStats(filteredCourses, { headcountTotal: semesterHeadcountTotal }),
    [filteredCourses, semesterHeadcountTotal],
  )
  const departmentData = useMemo(() => getDepartmentData(filteredCourses), [filteredCourses])
  const semesterData = useMemo(() => getSemesterData(filteredCourses, semesterTotals), [filteredCourses, semesterTotals])
  const onlineModeData = useMemo(() => getOnlineModeData(filteredCourses), [filteredCourses])
  const lecturerData = useMemo(() => getTopLecturers(filteredCourses), [filteredCourses])
  const timeSlotData = useMemo(() => getTimeSlotData(filteredCourses), [filteredCourses])
  const dayData = useMemo(() => getDayData(filteredCourses), [filteredCourses])
  const topCourses = useMemo(() => getTopCourses(filteredCourses), [filteredCourses])
  const capacityData = useMemo(() => getCapacityDistribution(filteredCourses), [filteredCourses])
  const deptComparison = useMemo(() => getDepartmentComparison(filteredCourses), [filteredCourses])
  const heatmapData = useMemo(() => getScheduleHeatmap(filteredCourses), [filteredCourses])
  const scatterData = useMemo(() => getDepartmentScatterData(filteredCourses), [filteredCourses])
  const yearGrowth = useMemo(
    () => getYearOverYearGrowth(filteredCourses, semesterTotals),
    [filteredCourses, semesterTotals],
  )
  const underenrolled = useMemo(() => getUnderenrolledSections(filteredCourses, 10), [filteredCourses])
  const semesterYoYData = useMemo(
    () => getSemesterYoYComparison(filteredCourses, semesterTotals),
    [filteredCourses, semesterTotals],
  )
  const deptUtilizationData = useMemo(() => getDepartmentUtilization(filteredCourses), [filteredCourses])
  const roomWasteData = useMemo(() => getRoomWasteAnalysis(filteredCourses, 14), [filteredCourses])
  const courseGrowthTrends = useMemo(() => getCourseGrowthTrends(filteredCourses), [filteredCourses])
  const highDemandSections = useMemo(() => getHighDemandSections(filteredCourses, 95), [filteredCourses])
  const facultyWorkload = useMemo(() => getFacultyWorkloadDistribution(filteredCourses), [filteredCourses])
  const roomTypeData = useMemo(() => getRoomTypeUtilization(filteredCourses), [filteredCourses])
  const academicLevelModeData = useMemo(() => getAcademicLevelModeData(filteredCourses), [filteredCourses])
  const academicFocusData = useMemo(() => getAcademicFocusData(filteredCourses), [filteredCourses])

  const studentLecturerRatioValue = useMemo(() => {
    if (stats.totalLecturers <= 0) return 'N/A'
    if (semesterHeadcountTotal != null && semesterHeadcountTotal > 0) {
      return Math.round((semesterHeadcountTotal / stats.totalLecturers) * 10) / 10
    }
    if (selectedSemester !== 'all' || selectedYear !== 'all') return stats.studentLecturerRatio
    return 'N/A'
  }, [stats.totalLecturers, stats.studentLecturerRatio, semesterHeadcountTotal, selectedSemester, selectedYear])

  const studentLecturerRatioDescription = useMemo(() => {
    if (studentLecturerRatioValue === 'N/A') {
      return 'Select year/semester or use institution view for headcount-based ratio'
    }
    return semesterHeadcountTotal != null ? 'Based on official semester headcount' : 'Average students per lecturer'
  }, [studentLecturerRatioValue, semesterHeadcountTotal])

  const lecturersKpiValue = useMemo(() => {
    if (semesterHeadcountTotal != null && semesterHeadcountTotal > 0) return stats.totalLecturers
    if (selectedSemester !== 'all' || selectedYear !== 'all') return stats.totalLecturers
    return 'N/A'
  }, [semesterHeadcountTotal, selectedSemester, selectedYear, stats.totalLecturers])

  const lecturersKpiDescription = useMemo(() => {
    if (lecturersKpiValue === 'N/A') {
      return 'Narrow by year/semester for teaching staff in scope'
    }
    return `${stats.totalDepartments} departments`
  }, [lecturersKpiValue, stats.totalDepartments])

  const totalStudentsDescription = useMemo(() => {
    if (semesterHeadcountTotal == null) {
      return 'Seat enrollments summed across sections'
    }
    if (selectedYear === 'all' && selectedSemester === 'all') {
      return 'Sum of official headcounts across all terms'
    }
    if (selectedYear !== 'all' && selectedSemester === 'all') {
      return 'Sum of official headcounts for this academic year'
    }
    if (selectedYear === 'all' && selectedSemester !== 'all') {
      return 'Sum of official headcounts for this term across all years'
    }
    return 'Official semester headcount'
  }, [semesterHeadcountTotal, selectedYear, selectedSemester])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [courses, totals] = await Promise.all([loadCourseData(), loadSemesterTotals()])
      setAllCourses(courses)
      setSemesterTotals(totals)
      setFilterOptions(getFilterOptions(courses))
    } catch (err) {
      console.error('Failed to load course data:', err)
      setError('Failed to load course data. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
      onInitialLoadComplete?.()
    }
  }, [onInitialLoadComplete])

  useEffect(() => {
    loadData()
  }, [loadData])

  const clearFilters = useCallback(() => {
    setSelectedSemester('all')
    setSelectedDepartment('all')
    setSelectedYear('all')
    setSearchQuery('')
  }, [])

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorBanner message={error} onRetry={loadData} />

  // Single source of truth for active filter state
  const hasActiveFilters =
    selectedSemester !== 'all' ||
    selectedDepartment !== 'all' ||
    selectedYear !== 'all' ||
    searchQuery !== ''

  return (
    <main className="relative min-h-full bg-background transition-colors duration-500 animate-in fade-in duration-1000">
      <div className="mesh-background" />
      
      {/* Sticky Glassmorphism Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/60 backdrop-blur-xl transition-all duration-300">
        <div className="mx-auto max-w-[1680px] px-4 py-3 sm:px-6 lg:px-8">
          <Filters
            filterOptions={filterOptions}
            selectedSemester={selectedSemester}
            selectedDepartment={selectedDepartment}
            selectedYear={selectedYear}
            searchQuery={searchQuery}
            onSemesterChange={setSelectedSemester}
            onDepartmentChange={setSelectedDepartment}
            onYearChange={setSelectedYear}
            onSearchChange={setSearchQuery}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          >
            <div className="flex items-center gap-4">
              {hasActiveFilters && (
                <Badge variant="secondary" className="hidden gap-1.5 border-white/5 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md sm:flex">
                  <Activity className="h-3 w-3 text-primary" />
                  {filteredCourses.length.toLocaleString()} Sections
                </Badge>
              )}
              <div className="flex items-center gap-2 rounded-full border border-border bg-background/50 p-0.5 backdrop-blur-md h-9">
                <ThemeToggle />
                <div className="h-4 w-[1px] bg-border" />
                <PalettePicker />
              </div>
            </div>
          </Filters>
        </div>
      </header>

      <div className="mx-auto max-w-[1680px] px-4 pt-6 pb-8 sm:px-6 lg:px-8 flex flex-col gap-6">

        {/* Primary KPIs */}
        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon={Users}
            description={totalStudentsDescription}
            variant="primary"
          />
          <StatCard
            title="Utilization Rate"
            value={`${stats.utilizationRate}%`}
            icon={PieChart}
            description={`${stats.emptySeats.toLocaleString()} empty seats`}
            variant={stats.utilizationRate < 60 ? 'warning' : stats.utilizationRate >= 85 ? 'success' : 'default'}
          />
          <StatCard
            title="Student-Lecturer"
            value={studentLecturerRatioValue}
            icon={Users}
            description={studentLecturerRatioDescription}
          />
          <StatCard
            title="Lecturers"
            value={lecturersKpiValue}
            icon={Presentation}
            description={lecturersKpiDescription}
          />
        </section>

        {/* Secondary KPIs */}
        <section className="mb-6">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 lg:p-5">
              <MiniStat label="Avg Class Size" value={stats.avgClassSize} icon={Users} />
              <MiniStat
                label="Full Sections"
                value={stats.fullSections}
                icon={AlertTriangle}
                highlight={stats.fullSections > stats.totalSections * 0.2}
              />
              <MiniStat label="Total Capacity" value={stats.totalCapacity.toLocaleString()} icon={Armchair} />
              <MiniStat label="Sections/Course" value={stats.avgSectionsPerCourse} icon={BarChart3} />
              <MiniStat label="Online" value={stats.onlineSections} icon={Laptop} />
              <MiniStat label="In-Person" value={stats.inPersonSections} icon={Building2} />
              <MiniStat label="Peak Hour" value={stats.peakHour || 'N/A'} icon={Clock} />
              <MiniStat label="Busiest Day" value={stats.busiestDay || 'N/A'} icon={Calendar} />
            </CardContent>
          </Card>
        </section>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-card p-1.5 sm:w-auto">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              <span>Departments</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="courses" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              <span>Courses</span>
            </TabsTrigger>
            <TabsTrigger value="staff" className="gap-1.5">
              <Presentation className="h-4 w-4" />
              <span>Staff</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5">
              <Lightbulb className="h-4 w-4" />
              <span>Insights</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              stats={stats}
              departmentData={departmentData}
              semesterData={semesterData}
              onlineModeData={onlineModeData}
              capacityData={capacityData}
              deptComparison={deptComparison}
              roomWasteData={roomWasteData}
              roomTypeData={roomTypeData}
            />
          </TabsContent>

          <TabsContent value="departments">
            <DepartmentsTab departmentData={departmentData} scatterData={scatterData} />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleTab
              stats={stats}
              timeSlotData={timeSlotData}
              dayData={dayData}
              heatmapData={heatmapData}
            />
          </TabsContent>

          <TabsContent value="courses">
            <CoursesTab stats={stats} topCourses={topCourses} academicLevelModeData={academicLevelModeData} />
          </TabsContent>

          <TabsContent value="staff">
            <StaffTab stats={stats} lecturerData={lecturerData} facultyWorkload={facultyWorkload} />
          </TabsContent>

          <TabsContent value="insights">
            <InsightsTab 
              yearGrowth={yearGrowth} 
              underenrolled={underenrolled} 
              highDemand={highDemandSections}
              semesterYoY={semesterYoYData}
              departmentUtilization={deptUtilizationData}
              courseGrowthTrends={courseGrowthTrends}
            />
          </TabsContent>
        </Tabs>


      </div>
    </main>
  )
}
