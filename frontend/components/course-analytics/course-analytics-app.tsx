'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'motion/react'
import {
  BookOpen,
  Building2,
  Presentation,
  Calendar,
  Activity,
  Lightbulb,
  LayoutDashboard,
  History,
  Compass,
} from 'lucide-react'
import {
  loadCourseData,
  loadSemesterTotals,
  calculateStats,
  resolveHeadcountForFilters,
  getDepartmentData,
  getSemesterData,
  getTopLecturers,
  getScheduleHeatmap,
  getFilterOptions,
  filterCourses,
  getTopCourses,
  getRoomWasteAnalysis,
  getRoomTypeUtilization,
  getUnderenrolledSections,
  getOnlineModeData,
  getLecturerStressScatterData,
  getSlotDensityClusters,
  getAcademicWeightByDepartment,
  getRoomOccupancyHeatmap,
  getPlanningTermPressureSeries,
  getHighDemandCourseSaturationTrend,
  getRoomUtilizationTrends,
  getSectionExpansionCandidates,
  getFacultyCreditLoadTop,
  buildManagementActionItems,
  type Course,
  type FilterOptions,
  type SemesterTotal,
} from '@/lib/course-analytics/course-data'
import { Filters } from '@/components/course-analytics/dashboard/filters'
import { LoadingSkeleton } from '@/components/course-analytics/dashboard/loading-skeleton'
import { ErrorBanner } from '@/components/course-analytics/dashboard/error-banner'
import { OverviewTab } from '@/components/course-analytics/dashboard/tabs/overview-tab'
import { DepartmentsTab } from '@/components/course-analytics/dashboard/tabs/departments-tab'
import { ScheduleTab } from '@/components/course-analytics/dashboard/tabs/schedule-tab'
import { CoursesTab } from '@/components/course-analytics/dashboard/tabs/courses-tab'
import { StaffTab } from '@/components/course-analytics/dashboard/tabs/staff-tab'
import { InsightsTab } from '@/components/course-analytics/dashboard/tabs/insights-tab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/course-analytics-ui/tabs'
import { Badge } from '@/components/course-analytics-ui/badge'
import { PalettePicker } from '@/components/course-analytics/palette-picker'
import { useDebounce } from '@/hooks/use-debounce'
import { segmentedNavTabItemRadiusClass } from '@/lib/segmented-nav-tabs'
import { cn } from '@/lib/utils'

/**
 * Scope dashboard tab styles to the analytics surface so they follow app theme.
 */
const DASHBOARD_TAB_TRIGGER_CLASS = `relative ${segmentedNavTabItemRadiusClass} px-4 py-2 text-sm font-semibold text-slate-600 shadow-none transition-colors duration-200 data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none data-[state=active]:hover:bg-transparent ca-dark:text-slate-400 ca-dark:data-[state=active]:bg-transparent ca-dark:data-[state=active]:text-primary-foreground`
const DASHBOARD_TAB_LIST_CLASS = `flex h-auto w-full flex-wrap items-stretch justify-start gap-1 ${segmentedNavTabItemRadiusClass} border border-slate-200/80 bg-slate-100/80 p-1 shadow-inner ca-dark:border-slate-700 ca-dark:bg-slate-900/50`

function DashboardActiveTabPill() {
  return (
    <motion.div
      layoutId="dashboard-tabs-active"
      className={`absolute inset-0 z-0 ${segmentedNavTabItemRadiusClass} bg-primary shadow-sm`}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
    />
  )
}

function AnalyticsModePill() {
  return (
    <motion.div
      layoutId="analytics-mode-pill"
      className={`absolute inset-0 z-0 ${segmentedNavTabItemRadiusClass} bg-primary shadow-sm`}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.55 }}
    />
  )
}

export default function CourseAnalyticsApp({
  onInitialLoadComplete,
}: {
  onInitialLoadComplete?: () => void
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [semesterTotals, setSemesterTotals] = useState<SemesterTotal[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ semesters: [], departments: [], years: [] })
  const [selectedSemester, setSelectedSemester] = useState('all')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [analyticsMode, setAnalyticsMode] = useState<'past' | 'planning'>('past')

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
  const semesterData = useMemo(() => getSemesterData(filteredCourses), [filteredCourses])
  const lecturerData = useMemo(() => getTopLecturers(filteredCourses), [filteredCourses])
  const topCourses = useMemo(() => getTopCourses(filteredCourses), [filteredCourses])
  const heatmapData = useMemo(() => getScheduleHeatmap(filteredCourses), [filteredCourses])
  const underenrolled = useMemo(() => getUnderenrolledSections(filteredCourses, 10), [filteredCourses])
  const roomWasteData = useMemo(() => getRoomWasteAnalysis(filteredCourses, 14), [filteredCourses])
  const roomTypeData = useMemo(() => getRoomTypeUtilization(filteredCourses), [filteredCourses])

  const onlineModeData = useMemo(() => getOnlineModeData(filteredCourses), [filteredCourses])
  const lecturerStress = useMemo(() => getLecturerStressScatterData(filteredCourses), [filteredCourses])
  const slotDensity = useMemo(() => getSlotDensityClusters(filteredCourses), [filteredCourses])
  const academicWeight = useMemo(() => getAcademicWeightByDepartment(filteredCourses), [filteredCourses])
  const roomOccupancyHeatmap = useMemo(() => getRoomOccupancyHeatmap(filteredCourses), [filteredCourses])
  const planningTermSeries = useMemo(() => getPlanningTermPressureSeries(filteredCourses), [filteredCourses])
  const highDemandCourseTrend = useMemo(() => getHighDemandCourseSaturationTrend(filteredCourses), [filteredCourses])
  const roomUtilTrends = useMemo(() => getRoomUtilizationTrends(filteredCourses), [filteredCourses])
  const facultyCreditTop = useMemo(() => getFacultyCreditLoadTop(filteredCourses), [filteredCourses])
  const distinctTermCount = useMemo(
    () => new Set(filteredCourses.map((c) => `${c.Year}|${c.Semester}`).filter(Boolean)).size,
    [filteredCourses],
  )
  const expansionRows = useMemo(
    () =>
      getSectionExpansionCandidates(filteredCourses, {
        minTermsWithHighSat: distinctTermCount <= 1 ? 1 : 2,
      }),
    [filteredCourses, distinctTermCount],
  )
  const labOccupancyPct = useMemo(() => {
    const lab = roomTypeData.find((r) => r.type === 'Laboratory')
    if (!lab || lab.sections <= 0) return null
    return lab.avgUtilization
  }, [roomTypeData])
  const actionItems = useMemo(
    () => buildManagementActionItems(filteredCourses, roomWasteData, slotDensity, lecturerStress, labOccupancyPct),
    [filteredCourses, roomWasteData, slotDensity, lecturerStress, labOccupancyPct],
  )

  const studentLecturerRatioValue = useMemo(() => {
    if (stats.totalLecturers <= 0) return 'N/A'
    return Math.round((stats.seatEnrollmentSum / stats.totalLecturers) * 10) / 10
  }, [stats.totalLecturers, stats.seatEnrollmentSum])

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
                <PalettePicker />
              </div>
            </div>
          </Filters>
        </div>
      </header>

      <div className="mx-auto max-w-[1680px] px-4 pt-6 pb-8 sm:px-6 lg:px-8 flex flex-col gap-4">

        {/* Strategic view mode */}
        <section className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Analytics perspective</p>
          <div className={`${DASHBOARD_TAB_LIST_CLASS} w-full sm:w-auto`}>
            <button
              type="button"
              onClick={() => setAnalyticsMode('past')}
              className={cn(
                DASHBOARD_TAB_TRIGGER_CLASS,
                'flex flex-1 items-center justify-center gap-2 sm:flex-initial',
                analyticsMode === 'past' ? 'text-primary-foreground' : '',
              )}
            >
              {analyticsMode === 'past' && <AnalyticsModePill />}
              <History className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Past — Audit</span>
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsMode('planning')}
              className={cn(
                DASHBOARD_TAB_TRIGGER_CLASS,
                'flex flex-1 items-center justify-center gap-2 sm:flex-initial',
                analyticsMode === 'planning' ? 'text-primary-foreground' : '',
              )}
            >
              {analyticsMode === 'planning' && <AnalyticsModePill />}
              <Compass className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Planning — Insight</span>
            </button>
          </div>
        </section>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={DASHBOARD_TAB_LIST_CLASS}>
            <TabsTrigger value="overview" className={DASHBOARD_TAB_TRIGGER_CLASS}>
              {activeTab === 'overview' && <DashboardActiveTabPill />}
              <LayoutDashboard className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Overview</span>
            </TabsTrigger>

            <TabsTrigger value="departments" className={DASHBOARD_TAB_TRIGGER_CLASS}>
              {activeTab === 'departments' && <DashboardActiveTabPill />}
              <Building2 className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Departments</span>
            </TabsTrigger>

            <TabsTrigger value="schedule" className={DASHBOARD_TAB_TRIGGER_CLASS}>
              {activeTab === 'schedule' && <DashboardActiveTabPill />}
              <Calendar className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Schedule</span>
            </TabsTrigger>

            <TabsTrigger value="courses" className={DASHBOARD_TAB_TRIGGER_CLASS}>
              {activeTab === 'courses' && <DashboardActiveTabPill />}
              <BookOpen className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Courses</span>
            </TabsTrigger>

            <TabsTrigger value="staff" className={DASHBOARD_TAB_TRIGGER_CLASS}>
              {activeTab === 'staff' && <DashboardActiveTabPill />}
              <Presentation className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Staff</span>
            </TabsTrigger>

            <TabsTrigger value="insights" className={DASHBOARD_TAB_TRIGGER_CLASS}>
              {activeTab === 'insights' && <DashboardActiveTabPill />}
              <Lightbulb className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Insights</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              analyticsMode={analyticsMode}
              actionItems={actionItems}
              stats={stats}
              departmentData={departmentData}
              onlineModeData={onlineModeData}
              roomOccupancyHeatmap={roomOccupancyHeatmap}
              slotDensity={slotDensity}
              labOccupancyPct={labOccupancyPct}
              distinctTermCount={distinctTermCount}
              planningTermSeries={planningTermSeries}
            />
          </TabsContent>

          <TabsContent value="departments">
            <DepartmentsTab analyticsMode={analyticsMode} departmentData={departmentData} academicWeight={academicWeight} />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleTab analyticsMode={analyticsMode} heatmapData={heatmapData} slotDensityRows={slotDensity.rows} planningTermSeries={planningTermSeries} />
          </TabsContent>

          <TabsContent value="courses">
            <CoursesTab
              analyticsMode={analyticsMode}
              topCourses={topCourses}
              highDemandTermLabels={highDemandCourseTrend.termLabels}
              highDemandSeries={highDemandCourseTrend.series}
              totalUniqueCourses={stats.totalCourses}
              hasYearOrSemFilter={selectedYear !== 'all' || selectedSemester !== 'all'}
            />
          </TabsContent>

          <TabsContent value="staff">
            <StaffTab
              stats={stats}
              lecturerData={lecturerData}
              lecturerStress={lecturerStress}
              facultyCreditTop={facultyCreditTop}
              studentLecturerRatioValue={studentLecturerRatioValue}
            />
          </TabsContent>

          <TabsContent value="insights">
            <InsightsTab
              analyticsMode={analyticsMode}
              semesterData={semesterData}
              underenrolled={underenrolled}
              roomWasteData={roomWasteData}
              planningTermSeries={planningTermSeries}
              highDemandTermLabels={highDemandCourseTrend.termLabels}
              highDemandSeries={highDemandCourseTrend.series}
              roomUtilTrends={roomUtilTrends}
              expansionRows={expansionRows}
              distinctTermCount={distinctTermCount}
            />
          </TabsContent>
        </Tabs>


      </div>
    </main>
  )
}
