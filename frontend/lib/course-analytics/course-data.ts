import { z } from 'zod'

const CourseSchema = z.object({
  Year: z.string().default(''),
  Semester: z.string().default(''),
  Course_Number: z.string().default(''),
  English_Name: z.string().default(''),
  /** Mirrors `course.academic_level` from the API (distinct sections may repeat the same value). */
  academic_level: z.coerce.number().optional().default(1),
  /** Mirrors `course.credit_hours` from the API. */
  credit_hours: z.coerce.number().optional().default(0),
  Section: z.string().default(''),
  Lecturer_Name: z.string().default(''),
  Lecturer_ID: z.string().default(''),
  Department: z.string().default(''),
  Day: z.string().default(''),
  Time: z.string().default(''),
  Room: z.string().default(''),
  Room_ID: z.string().default(''),
  Registered_Students: z.coerce.number().default(0),
  Section_Capacity: z.coerce.number().default(0),
  isOnline: z.coerce.boolean().optional().default(false),
  Online: z.string().default(''),
  Start_Time: z.string().default(''),
  End_Time: z.string().default(''),
  islab: z.coerce.boolean().default(false),
  Department_ID: z.string().default(''),
})

export type Course = z.infer<typeof CourseSchema>

const SemesterTotalSchema = z.object({
  semesterId: z.number().optional(),
  academicYear: z.string(),
  semesterType: z.coerce.number(),
  semester: z.string(),
  totalStudents: z.number().nullable(),
})

export type SemesterTotal = z.infer<typeof SemesterTotalSchema>

/** When set, KPIs use registrar headcount(s): one term, or sum of all terms when filters are “all”. */
export interface CalculateStatsOptions {
  headcountTotal?: number | null
}

/**
 * Maps UI filters to a headcount from `/api/semesters` (DB `semester.total_students`).
 * Always sums every matching row in scope (never averages): one term → one row; “all semesters”
 * for a year → sum of that year’s terms; both “all” → sum of every stored term.
 * Returns null when department/search filters apply (not institution-wide) or nothing matches.
 */
export function resolveHeadcountForFilters(
  semesterTotals: SemesterTotal[],
  filters: { year: string; semester: string },
): number | null {
  if (!semesterTotals.length) return null
  const { year, semester } = filters
  const hasYear = year !== 'all'
  const hasSem = semester !== 'all'

  if (hasYear && hasSem) {
    const row = semesterTotals.find((s) => s.academicYear === year && s.semester === semester)
    return row?.totalStudents ?? null
  }
  if (!hasYear && !hasSem) {
    const sum = semesterTotals.reduce((acc, s) => acc + (s.totalStudents ?? 0), 0)
    return sum > 0 ? sum : null
  }
  if (hasYear && !hasSem) {
    const sum = semesterTotals
      .filter((t) => t.academicYear === year)
      .reduce((acc, t) => acc + (t.totalStudents ?? 0), 0)
    return sum > 0 ? sum : null
  }
  if (!hasYear && hasSem) {
    const sum = semesterTotals
      .filter((t) => t.semester === semester)
      .reduce((acc, t) => acc + (t.totalStudents ?? 0), 0)
    return sum > 0 ? sum : null
  }
  return null
}


/**
 * Fetch all course sections from the database via the Next.js API route.
 * The route queries PostgreSQL through Prisma and returns a flat JSON array
 * that matches the Course schema defined below.
 *
 * Optional query params passed straight through to the API:
 *   timetableStatus – e.g. "active" (default: all)
 *   semesterId      – filter to a specific semester by ID
 */
export async function loadCourseData(opts?: {
  timetableStatus?: string
  semesterId?: number
}): Promise<Course[]> {
  const params = new URLSearchParams()
  if (opts?.timetableStatus) params.set('timetableStatus', opts.timetableStatus)
  if (opts?.semesterId != null) params.set('semesterId', String(opts.semesterId))

  const qs = params.toString()
  const url = `/api/courses${qs ? `?${qs}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Failed to fetch courses from API (${response.status}): ${body}`,
    )
  }

  const data: unknown = await response.json()
  // Validate the response shape at runtime so unexpected DB changes
  // surface as a clear error rather than silently corrupting the UI.
  return z.array(CourseSchema).parse(data)
}

export async function loadSemesterTotals(): Promise<SemesterTotal[]> {
  const response = await fetch('/api/semesters')

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Failed to fetch semesters from API (${response.status}): ${body}`,
    )
  }

  const data: unknown = await response.json()
  return z.array(SemesterTotalSchema).parse(data)
}

export interface DashboardStats {
  totalCourses: number
  totalSections: number
  totalStudents: number
  /** Always seat-enrollment sum — never headcount. Use this for per-section averages. */
  seatEnrollmentSum: number
  /** Number of distinct Year|Semester combinations present in the current filtered dataset.
   *  Use this to normalize cumulative sums into per-term averages. */
  uniqueSemesters: number
  totalLecturers: number
  totalDepartments: number
  avgClassSize: number
  utilizationRate: number
  totalCapacity: number
  emptySeats: number
  fullSections: number
  avgSectionsPerCourse: number
  onlineSections: number
  inPersonSections: number
  blendedSections: number
  peakHour: string
  busiestDay: string
  largestDepartment: string
  mostPopularCourse: string
  wastedFacultyHours: number
}

export interface YearGrowthData {
  year: string
  students: number
  sections: number
  growth: number
  isPartial?: boolean
}

export interface RoomWasteData {
  room: string
  totalCapacity: number
  totalStudents: number
  unusedSeats: number
  efficiencyScore: number
}

export interface CourseGrowthData {
  code: string
  name: string
  previousStudents: number
  currentStudents: number
  growth: number
  trend: 'up' | 'down' | 'steady'
}

export interface DepartmentData {
  name: string
  fullName: string
  students: number
  sections: number
  courses: number
  utilization: number
  avgClassSize: number
}

export interface SemesterData {
  semester: string
  fullSemester: string
  students: number
  sections: number
  courses: number
}

export interface OnlineModeData {
  mode: string
  count: number
  percentage: number
  students: number
}

export interface LecturerData {
  name: string
  fullName: string
  sections: number
  students: number
  avgClassSize: number
  department: string
}

export interface TimeSlotData {
  hour: string
  sections: number
  students: number
}

export interface DayData {
  day: string
  fullDay: string
  sections: number
  students: number
}

export interface CourseData {
  name: string
  fullName: string
  code: string
  sections: number
  students: number
  avgClassSize: number
  department: string
}

export interface CapacityDistribution {
  range: string
  count: number
  percentage: number
}

export interface FilterOptions {
  semesters: string[]
  departments: string[]
  years: string[]
}

function getAcademicLevelLabel(academicLevel?: number): string {
  const level = Number(academicLevel)
  if (!Number.isFinite(level)) return 'Prep/Other'
  if (level >= 6) return 'Graduate'
  if (level >= 1) return `${level * 100}-Level`
  return 'Prep/Other'
}

export interface HeatmapData {
  day: string
  hour: string
  value: number
}

export interface ScatterDataPoint {
  name: string
  classSize: number
  utilization: number
  sections: number
}

export function getFilterOptions(courses: Course[]): FilterOptions {
  const semesterOrder = ['First Semester', 'Second Semester', 'Summer Semester']
  const rawSemesters = [...new Set(courses.map(c => c.Semester))].filter(s => s)
  const semesters = semesterOrder.filter(s => rawSemesters.includes(s))
  const departments = [...new Set(courses.map(c => c.Department))].filter(d => d).sort()
  const years = [...new Set(courses.map(c => c.Year))].sort()

  return { semesters, departments, years }
}

export function filterCourses(
  courses: Course[],
  filters: { semester?: string; department?: string; year?: string }
): Course[] {
  return courses.filter(c => {
    if (filters.semester && filters.semester !== 'all') {
      if (c.Semester !== filters.semester) return false
    }
    if (filters.department && filters.department !== 'all') {
      if (c.Department !== filters.department) return false
    }
    if (filters.year && filters.year !== 'all') {
      if (c.Year !== filters.year) return false
    }
    return true
  })
}

export function calculateStats(courses: Course[], opts?: CalculateStatsOptions): DashboardStats {
  const uniqueCourses = new Set(courses.map(c => c.Course_Number)).size
  const totalSections = courses.length
  const seatEnrollmentSum = courses.reduce((sum, c) => sum + c.Registered_Students, 0)
  const headcount = opts?.headcountTotal
  const totalStudents =
    headcount != null && headcount > 0 ? headcount : seatEnrollmentSum
  const uniqueLecturers = new Set(
    courses
      .filter(c => c.Lecturer_Name && c.Lecturer_Name.trim().toUpperCase() !== 'TBA')
      .map(c => c.Lecturer_ID),
  ).size
  const uniqueDepartments = new Set(courses.map(c => c.Department)).size
  // Issue 1: always use seat-enrollment sum so avgClassSize is never contaminated by HC totals.
  const avgClassSize = totalSections > 0 ? Math.round(seatEnrollmentSum / totalSections) : 0
  // Capacity utilization must stay seat-based (section enrollments vs section capacities).
  const utilizationEligibleCourses = courses.filter((c) => !c.isOnline && c.Section_Capacity > 0)
  const totalCapacity = utilizationEligibleCourses.reduce((sum, c) => sum + c.Section_Capacity, 0)
  const seatEnrollmentForCapacity = utilizationEligibleCourses.reduce(
    (sum, c) => sum + c.Registered_Students,
    0,
  )
  const utilizationRate =
    totalCapacity > 0 ? Math.round((seatEnrollmentForCapacity / totalCapacity) * 100) : 0
  const emptySeats = Math.max(0, totalCapacity - seatEnrollmentForCapacity)
  const fullSections = utilizationEligibleCourses.filter(
    (c) => c.Registered_Students >= c.Section_Capacity,
  ).length
  // Derive the number of distinct semesters in the current filtered data so cumulative sums
  // can be normalized into per-term averages (avgSectionsPerCourse, wastedFacultyHours, etc.).
  const uniqueSemesterCount = Math.max(
    1,
    new Set(courses.map(c => `${c.Year}|${c.Semester}`).filter(Boolean)).size
  )
  const avgSectionsPerCourse =
    uniqueCourses > 0
      ? Math.round((totalSections / uniqueSemesterCount / uniqueCourses) * 10) / 10
      : 0
  const onlineSections = courses.filter(c => c.Online === 'Online').length
  const blendedSections = courses.filter(c => c.Online === 'Blended').length
  const inPersonSections = totalSections - onlineSections - blendedSections
  const parseTimeToMinutes = (t?: string): number | null => {
    if (!t) return null
    const normalized = t.trim().toUpperCase()
    const m = normalized.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/)
    if (!m) return null

    let hh = Number(m[1])
    const mm = Number(m[2])
    const meridiem = m[3]

    if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm < 0 || mm > 59) return null

    if (meridiem) {
      if (hh < 1 || hh > 12) return null
      if (meridiem === 'AM' && hh === 12) hh = 0
      if (meridiem === 'PM' && hh !== 12) hh += 12
    } else if (hh < 0 || hh > 23) {
      return null
    }

    return hh * 60 + mm
  }

  const parseDaysPerWeek = (day?: string): number => {
    if (!day) return 0
    const normalized = day.trim()
    if (!normalized) return 0
    if (/^daily$/i.test(normalized)) return 5 // PSUT week in this dataset is Sun-Thu
    return normalized.split(/\s+/).filter(Boolean).length
  }

  const getSectionWeeklyHours = (c: Course): number => {
    const startMin = parseTimeToMinutes(c.Start_Time)
    const endMin = parseTimeToMinutes(c.End_Time)
    if (startMin == null || endMin == null || endMin <= startMin) return 0
    const meetingsPerWeek = parseDaysPerWeek(c.Day)
    if (meetingsPerWeek <= 0) return 0
    const durationHours = (endMin - startMin) / 60
    return durationHours * meetingsPerWeek
  }

  // Normalize by uniqueSemesterCount so the number reflects a typical weekly load per term
  // rather than cumulating across every semester in scope.
  const wastedFacultyHours = Math.round(
    courses
      .filter(c => c.Registered_Students < 10)
      .reduce((sumHours, c) => {
        return sumHours + getSectionWeeklyHours(c)
      }, 0) / uniqueSemesterCount,
  )
  
  // Find peak hour
  const hourCounts = new Map<string, number>()
  courses.forEach(c => {
    const hour = c.Start_Time?.split(':')[0]
    if (hour) {
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
    }
  })
  let peakHour = ''
  let maxHourCount = 0
  hourCounts.forEach((count, hour) => {
    if (count > maxHourCount) {
      maxHourCount = count
      peakHour = `${hour}:00`
    }
  })
  
  // Find busiest day
  const dayCounts = new Map<string, number>()
  courses.forEach(c => {
    if (c.Day) {
      const days = c.Day.split(' ')
      days.forEach(day => {
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1)
      })
    }
  })
  let busiestDay = ''
  let maxDayCount = 0
  dayCounts.forEach((count, day) => {
    if (count > maxDayCount) {
      maxDayCount = count
      busiestDay = day
    }
  })
  
  // Find largest department
  const deptStudents = new Map<string, number>()
  courses.forEach(c => {
    deptStudents.set(c.Department, (deptStudents.get(c.Department) || 0) + c.Registered_Students)
  })
  let largestDepartment = ''
  let maxDeptStudents = 0
  deptStudents.forEach((students, dept) => {
    if (students > maxDeptStudents) {
      maxDeptStudents = students
      largestDepartment = dept
    }
  })
  
  // Find most popular course
  const courseStudents = new Map<string, { name: string; students: number }>()
  courses.forEach(c => {
    const existing = courseStudents.get(c.Course_Number) || { name: c.English_Name, students: 0 }
    existing.students += c.Registered_Students
    courseStudents.set(c.Course_Number, existing)
  })
  let mostPopularCourse = ''
  let maxCourseStudents = 0
  courseStudents.forEach((data) => {
    if (data.students > maxCourseStudents) {
      maxCourseStudents = data.students
      mostPopularCourse = data.name
    }
  })

  return {
    totalCourses: uniqueCourses,
    totalSections,
    totalStudents,
    seatEnrollmentSum,
    uniqueSemesters: uniqueSemesterCount,
    totalLecturers: uniqueLecturers,
    totalDepartments: uniqueDepartments,
    avgClassSize,
    utilizationRate,
    totalCapacity,
    emptySeats,
    fullSections,
    avgSectionsPerCourse,
    onlineSections,
    inPersonSections,
    blendedSections,
    peakHour,
    busiestDay,
    largestDepartment: largestDepartment.length > 25 ? largestDepartment.substring(0, 23) + '...' : largestDepartment,
    mostPopularCourse: mostPopularCourse.length > 30 ? mostPopularCourse.substring(0, 28) + '...' : mostPopularCourse,
    wastedFacultyHours
  }
}

export function getDepartmentData(courses: Course[]): DepartmentData[] {
  const deptMap = new Map<string, { 
    students: number
    utilizationStudents: number
    sections: number
    courses: Set<string>
    capacity: number 
  }>()
  
  courses.forEach(course => {
    const existing = deptMap.get(course.Department) || { 
      students: 0, 
      utilizationStudents: 0,
      sections: 0, 
      courses: new Set(),
      capacity: 0 
    }

    // Keep students/sections/courses for all delivery modes.
    existing.students += course.Registered_Students
    existing.sections += 1
    existing.courses.add(course.Course_Number)

    // Keep utilization aligned with global formula: in-person/blended sections with capacity only.
    if (!course.isOnline && course.Section_Capacity > 0) {
      existing.utilizationStudents += course.Registered_Students
      existing.capacity += course.Section_Capacity
    }

    deptMap.set(course.Department, existing)
  })
  
  return Array.from(deptMap.entries())
    .filter(([name]) => name) // Filter empty department names
    .map(([name, data]) => ({
      name: name.length > 20 ? name.substring(0, 18) + '...' : name,
      fullName: name,
      students: data.students,
      sections: data.sections,
      courses: data.courses.size,
      utilization: data.capacity > 0 ? Math.round((data.utilizationStudents / data.capacity) * 100) : 0,
      avgClassSize: data.sections > 0 ? Math.round(data.students / data.sections) : 0
    }))
    .sort((a, b) => b.students - a.students)
}

export function getSemesterData(courses: Course[]): SemesterData[] {
  const semMap = new Map<string, { students: number; sections: number; courses: Set<string> }>()
  
  courses.forEach(course => {
    const key = `${course.Year} - ${course.Semester}`
    const existing = semMap.get(key) || { students: 0, sections: 0, courses: new Set() }
    existing.students += course.Registered_Students
    existing.sections += 1
    existing.courses.add(course.Course_Number)
    semMap.set(key, existing)
  })

  return Array.from(semMap.entries())
    .map(([semester, data]) => {
      // Create short label for chart
      let shortLabel = semester
        .replace('2022-2023', "'22-'23")
        .replace('2023-2024', "'23-'24")
        .replace('2024-2025', "'24-'25")
        .replace('2025-2026', "'25-'26")
        .replace('First Semester', 'Fall')
        .replace('Second Semester', 'Spring')
        .replace('Summer Semester', 'Summer')
      
      return {
        semester: shortLabel,
        fullSemester: semester,
        // Always use section-level seat enrollments to keep bars comparable across semesters.
        students: data.students,
        sections: data.sections,
        courses: data.courses.size
      }
    })
    .sort((a, b) => a.fullSemester.localeCompare(b.fullSemester))
}

export function getOnlineModeData(courses: Course[]): OnlineModeData[] {
  const modeMap = new Map<string, { count: number; students: number }>()
  
  courses.forEach(course => {
    const mode = course.Online === 'Online' ? 'Online' : 
                 course.Online === 'Blended' ? 'Blended' : 'On-Campus'
    const existing = modeMap.get(mode) || { count: 0, students: 0 }
    existing.count += 1
    existing.students += course.Registered_Students
    modeMap.set(mode, existing)
  })
  
  const total = courses.length
  return Array.from(modeMap.entries())
    .map(([mode, data]) => ({
      mode,
      count: data.count,
      percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
      students: data.students
    }))
    .sort((a, b) => b.count - a.count)
}

export function getTopLecturers(courses: Course[], limit = 20): LecturerData[] {
  // Bug 2 fix: key by Lecturer_ID (not name) so two lecturers with the same full name don't get merged.
  const lecturerMap = new Map<string, { name: string; sections: number; students: number; department: string }>()
  
  courses.forEach(course => {
    if (!course.Lecturer_Name || !course.Lecturer_ID) return
    const existing = lecturerMap.get(course.Lecturer_ID) || { name: course.Lecturer_Name, sections: 0, students: 0, department: course.Department }
    existing.sections += 1
    existing.students += course.Registered_Students
    lecturerMap.set(course.Lecturer_ID, existing)
  })
  
  return Array.from(lecturerMap.values())
    .map((data) => ({
      name: data.name.length > 18 ? data.name.substring(0, 16) + '...' : data.name,
      fullName: data.name,
      sections: data.sections,
      students: data.students,
      avgClassSize: data.sections > 0 ? Math.round(data.students / data.sections) : 0,
      department: data.department
    }))
    .sort((a, b) => b.sections - a.sections)
    .slice(0, limit)
}

export function getTimeSlotData(courses: Course[]): TimeSlotData[] {
  const timeMap = new Map<number, { sections: number; students: number }>()
  
  courses.forEach(course => {
    const hour = course.Start_Time?.split(':')[0]
    if (hour) {
      const hourNum = parseInt(hour)
      const existing = timeMap.get(hourNum) || { sections: 0, students: 0 }
      existing.sections += 1
      existing.students += course.Registered_Students
      timeMap.set(hourNum, existing)
    }
  })
  
  return Array.from(timeMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, data]) => ({ 
      hour: `${hour}:00`, 
      sections: data.sections, 
      students: data.students 
    }))
}

export function getDayData(courses: Course[]): DayData[] {
  const dayMap = new Map<string, { sections: number; students: number }>()
  const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat']
  const dayFullNames: Record<string, string> = {
    'Sun': 'Sunday',
    'Mon': 'Monday',
    'Tue': 'Tuesday',
    'Wed': 'Wednesday',
    'Thu': 'Thursday',
    'Sat': 'Saturday',
  }
  
  courses.forEach(course => {
    if (course.Day) {
      // Handle multi-day courses like "Sun Tue Thu"
      const days = course.Day.split(' ')
      days.forEach(day => {
        const shortDay = day.substring(0, 3)
        const existing = dayMap.get(shortDay) || { sections: 0, students: 0 }
        existing.sections += 1
        existing.students += course.Registered_Students
        dayMap.set(shortDay, existing)
      })
    }
  })
  
  return dayOrder
    .filter(day => dayMap.has(day))
    .map(day => ({
      day,
      fullDay: dayFullNames[day] || day,
      sections: dayMap.get(day)!.sections,
      students: dayMap.get(day)!.students
    }))
}

export function getTopCourses(courses: Course[], limit = 20): CourseData[] {
  const courseMap = new Map<string, { 
    name: string
    sections: number
    students: number
    department: string 
  }>()
  
  courses.forEach(course => {
    if (!course.Course_Number) return // Skip courses without a course number
    const existing = courseMap.get(course.Course_Number) || { 
      name: course.English_Name || '', 
      sections: 0, 
      students: 0,
      department: course.Department || ''
    }
    existing.sections += 1
    existing.students += course.Registered_Students
    courseMap.set(course.Course_Number, existing)
  })
  
  return Array.from(courseMap.entries())
    .filter(([code, data]) => code && data.name) // Filter out entries with no code or name
    .map(([code, data]) => {
      const name = data.name || ''
      return {
        code,
        name: name.length > 25 ? name.substring(0, 23) + '...' : name,
        fullName: name,
        sections: data.sections,
        students: data.students,
        avgClassSize: data.sections > 0 ? Math.round(data.students / data.sections) : 0,
        department: data.department
      }
    })
    .sort((a, b) => b.students - a.students)
    .slice(0, limit)
}

export function getCapacityDistribution(courses: Course[]): CapacityDistribution[] {
  // Bug 1 fix: use exclusive upper bounds (<) so float utilization values (e.g. 25.5%, 75.3%) never
  // fall into the gap between adjacent integer-labelled ranges. The last bucket has no upper bound.
  const ranges = [
    { label: '0-25%',  test: (u: number) => u < 25 },
    { label: '25-50%', test: (u: number) => u >= 25 && u < 50 },
    { label: '50-75%', test: (u: number) => u >= 50 && u < 75 },
    { label: '75-99%', test: (u: number) => u >= 75 && u < 100 },
    { label: '100%+',  test: (u: number) => u >= 100 },
  ]
  
  const utilizationEligibleCourses = courses.filter(c => !c.isOnline && c.Section_Capacity > 0)
  const total = utilizationEligibleCourses.length
  const distribution = ranges.map(range => {
    const count = utilizationEligibleCourses.filter(c => {
      const util = (c.Registered_Students / c.Section_Capacity) * 100
      return range.test(util)
    }).length
    
    return {
      range: range.label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }
  })
  
  return distribution
}

export function getDepartmentComparison(courses: Course[]): {
  name: string
  fullName: string
  students: number
  sections: number
  courses: number
  utilization: number
}[] {
  const deptData = getDepartmentData(courses)
  return deptData.slice(0, 6).map(d => ({
    name: d.name.length > 12 ? d.name.substring(0, 10) + '...' : d.name,
    fullName: d.fullName,
    students: d.students,
    sections: d.sections,
    courses: d.courses,
    utilization: d.utilization
  }))
}



export interface AcademicLevelModeData {
  level: string
  inPerson: number
  online: number
  blended: number
}

export function getAcademicLevelModeData(courses: Course[]): AcademicLevelModeData[] {
  const levelMap = new Map<string, { inPerson: number; online: number; blended: number }>()

  courses.forEach(course => {
    const level = getAcademicLevelLabel(course.academic_level)

    const existing = levelMap.get(level) || { inPerson: 0, online: 0, blended: 0 }
    if (course.Online === 'Online') existing.online += 1
    else if (course.Online === 'Blended') existing.blended += 1
    else existing.inPerson += 1
    
    levelMap.set(level, existing)
  })
  
  // Intentionally exclude "Prep/Other" from this chart.
  const levelOrder = ['100-Level', '200-Level', '300-Level', '400-Level', '500-Level', 'Graduate']
  
  return levelOrder
    .filter(level => levelMap.has(level))
    .map(level => {
      const data = levelMap.get(level)!
      return {
        level,
        inPerson: data.inPerson,
        online: data.online,
        blended: data.blended
      }
    })
}




export function getScheduleHeatmap(courses: Course[]): HeatmapData[] {
  const heatmap: HeatmapData[] = []
  // Saturday excluded to match DayChart behaviour (PSUT workweek is Sun–Thu)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
  const studentCounts = new Map<string, number>()
  
  courses.forEach(course => {
    if (course.Day && course.Start_Time) {
      const hour = course.Start_Time.split(':')[0]
      const courseDays = course.Day.split(' ')
      
      courseDays.forEach(day => {
        const shortDay = day.substring(0, 3)
        if (days.includes(shortDay)) {
          const key = `${shortDay}-${hour}`
          studentCounts.set(key, (studentCounts.get(key) || 0) + course.Registered_Students)
        }
      })
    }
  })
  
  // Get unique hours and sort
  const hours = [...new Set(Array.from(studentCounts.keys()).map(k => k.split('-')[1]))].sort((a, b) => parseInt(a) - parseInt(b))
  
  days.forEach(day => {
    hours.forEach(hour => {
      const key = `${day}-${hour}`
      heatmap.push({
        day,
        hour: `${hour}:00`,
        value: studentCounts.get(key) || 0
      })
    })
  })
  
  return heatmap
}

export function getDepartmentScatterData(courses: Course[]): ScatterDataPoint[] {
  const deptData = getDepartmentData(courses)
  return deptData.slice(0, 15).map(d => ({
    name: d.fullName,
    classSize: d.avgClassSize,
    utilization: d.utilization,
    sections: d.sections
  }))
}

export function getYearOverYearGrowth(
  courses: Course[],
  semesterTotals?: SemesterTotal[],
): YearGrowthData[] {
  if (semesterTotals?.length) {
    const firstByYear = new Map<string, number>()
    for (const s of semesterTotals) {
      if (s.semester !== 'First Semester' || s.totalStudents == null) continue
      firstByYear.set(s.academicYear, s.totalStudents)
    }

    const yearSemMap = new Map<string, Map<string, { students: number; sections: number }>>()
    for (const course of courses) {
      if (course.Year === undefined || course.Year === null || course.Year === '') continue
      const yearStr = String(course.Year).trim()
      if (!yearStr || yearStr === 'undefined' || yearStr === 'null') continue
      const semStr = String(course.Semester ?? '').trim()
      if (!yearSemMap.has(yearStr)) yearSemMap.set(yearStr, new Map())
      const semMap = yearSemMap.get(yearStr)!
      const existing = semMap.get(semStr) || { students: 0, sections: 0 }
      existing.students += course.Registered_Students
      existing.sections += 1
      semMap.set(semStr, existing)
    }

    const years = Array.from(yearSemMap.keys())
      .filter((y) => y && y !== 'undefined' && y !== 'null')
      .sort((a, b) => a.localeCompare(b))

    const result: YearGrowthData[] = []
    years.forEach((year, index) => {
      const curSemMap = yearSemMap.get(year)!
      const prevYear = index > 0 ? years[index - 1] : null
      const prevSemMap = prevYear ? yearSemMap.get(prevYear)! : null

      const hc = firstByYear.get(year)
      let students =
        hc != null
          ? hc
          : Array.from(curSemMap.values()).reduce((sum, v) => sum + v.students, 0)
      let sections = Array.from(curSemMap.values()).reduce((sum, v) => sum + v.sections, 0)
      let growth = 0
      let isPartial = false

      if (prevSemMap) {
        const curSems = new Set(Array.from(curSemMap.keys()).filter(Boolean))
        const prevSems = new Set(Array.from(prevSemMap.keys()).filter(Boolean))
        const comparableSems = Array.from(curSems).filter((s) => prevSems.has(s))

        const curComparableStudents = comparableSems.reduce(
          (sum, s) => sum + (curSemMap.get(s)?.students ?? 0),
          0,
        )
        const prevComparableStudents = comparableSems.reduce(
          (sum, s) => sum + (prevSemMap.get(s)?.students ?? 0),
          0,
        )
        const curComparableSections = comparableSems.reduce(
          (sum, s) => sum + (curSemMap.get(s)?.sections ?? 0),
          0,
        )

        if (curSems.size !== prevSems.size) {
          students =
            hc != null
              ? hc
              : curComparableStudents
          sections = curComparableSections
          isPartial = true
        }

        const curH = firstByYear.get(year)
        const prevH = prevYear ? firstByYear.get(prevYear) : undefined
        // Keep one metric per YoY delta:
        // - use headcount only when both years have registrar values
        // - otherwise compare seat-enrollment sums for both years
        const useHeadcountForGrowth = curH != null && prevH != null
        const growthCurrentBase = useHeadcountForGrowth ? curH : curComparableStudents
        const growthPreviousBase = useHeadcountForGrowth ? prevH : prevComparableStudents
        growth =
          growthPreviousBase > 0
            ? Math.round(((growthCurrentBase - growthPreviousBase) / growthPreviousBase) * 100)
            : 0
      }

      let displayYear = year
      if (typeof year === 'string' && year.startsWith('20')) {
        displayYear = "'" + year.substring(2)
      }

      result.push({ year: displayYear, students, sections, growth, isPartial })
    })

    return result
  }

  // Aggregate by year AND semester so we can avoid misleading YoY deltas
  // when the newest academic year is missing a semester (e.g., no Summer yet).
  const yearSemMap = new Map<string, Map<string, { students: number; sections: number }>>()

  for (const course of courses) {
    if (course.Year === undefined || course.Year === null || course.Year === '') continue
    const yearStr = String(course.Year).trim()
    if (!yearStr || yearStr === 'undefined' || yearStr === 'null') continue
    const semStr = String(course.Semester ?? '').trim()

    if (!yearSemMap.has(yearStr)) yearSemMap.set(yearStr, new Map())
    const semMap = yearSemMap.get(yearStr)!
    const existing = semMap.get(semStr) || { students: 0, sections: 0 }
    existing.students += course.Registered_Students
    existing.sections += 1
    semMap.set(semStr, existing)
  }

  const years = Array.from(yearSemMap.keys())
    .filter((y) => y && y !== 'undefined' && y !== 'null')
    .sort((a, b) => a.localeCompare(b))

  const result: YearGrowthData[] = []

  years.forEach((year, index) => {
    const curSemMap = yearSemMap.get(year)!
    const prevYear = index > 0 ? years[index - 1] : null
    const prevSemMap = prevYear ? yearSemMap.get(prevYear)! : null

    // Default: full-year totals (all semesters present for this year in the data)
    let students = Array.from(curSemMap.values()).reduce((sum, v) => sum + v.students, 0)
    let sections = Array.from(curSemMap.values()).reduce((sum, v) => sum + v.sections, 0)
    let growth = 0

    let isPartial = false
    if (prevSemMap) {
      const curSems = new Set(Array.from(curSemMap.keys()).filter(Boolean))
      const prevSems = new Set(Array.from(prevSemMap.keys()).filter(Boolean))
      const comparableSems = Array.from(curSems).filter((s) => prevSems.has(s))

      const curComparableStudents = comparableSems.reduce((sum, s) => sum + (curSemMap.get(s)?.students ?? 0), 0)
      const prevComparableStudents = comparableSems.reduce((sum, s) => sum + (prevSemMap.get(s)?.students ?? 0), 0)
      const curComparableSections = comparableSems.reduce((sum, s) => sum + (curSemMap.get(s)?.sections ?? 0), 0)

      // If semesters differ, show only comparable totals to avoid false drops/spikes.
      if (curSems.size !== prevSems.size) {
        students = curComparableStudents
        sections = curComparableSections
        isPartial = true
      }

      growth =
        prevComparableStudents > 0 ? Math.round(((curComparableStudents - prevComparableStudents) / prevComparableStudents) * 100) : 0
    }

    let displayYear = year
    if (typeof year === 'string' && year.startsWith('20')) {
      displayYear = "'" + year.substring(2)
    }

    result.push({ year: displayYear, students, sections, growth, isPartial })
  })

  return result
}



export interface UnderenrolledSection {
  course: string
  courseName: string
  section: string
  students: number
  capacity: number
  utilization: number
  lecturer: string
  department: string
}

export function getUnderenrolledSections(courses: Course[], threshold = 10): UnderenrolledSection[] {
  return courses
    // Bug 3 fix: exclude online sections — low enrollment in an online section wastes no physical room.
    .filter(c => !c.isOnline && c.Registered_Students < threshold)
    .map(c => ({
      course: c.Course_Number,
      courseName: c.English_Name,
      section: c.Section,
      students: c.Registered_Students,
      capacity: c.Section_Capacity,
      utilization:
        c.Section_Capacity > 0
          ? Math.round((c.Registered_Students / c.Section_Capacity) * 100)
          : 0,
      lecturer: c.Lecturer_Name,
      department: c.Department
    }))
    .sort((a, b) => a.students - b.students)
    .slice(0, 20)
}

export interface SemesterYoYData {
  semester: string
  years: { year: string; students: number; sections: number }[]
}

export function getSemesterYoYComparison(
  courses: Course[],
  semesterTotals?: SemesterTotal[],
): { year: string; first: number; second: number; summer: number }[] {
  if (semesterTotals?.length) {
    const yearMap = new Map<string, { first: number; second: number; summer: number }>()
    for (const s of semesterTotals) {
      if (s.totalStudents == null) continue
      const existing = yearMap.get(s.academicYear) || { first: 0, second: 0, summer: 0 }
      if (s.semester === 'First Semester') existing.first = s.totalStudents
      else if (s.semester === 'Second Semester') existing.second = s.totalStudents
      else if (s.semester === 'Summer Semester') existing.summer = s.totalStudents
      yearMap.set(s.academicYear, existing)
    }
    return Array.from(yearMap.entries())
      .filter(([y]) => y !== 'undefined' && y !== 'null')
      .map(([year, data]) => ({
        year: year
          .replace('2022-2023', "'22-'23")
          .replace('2023-2024', "'23-'24")
          .replace('2024-2025', "'24-'25")
          .replace('2025-2026', "'25-'26"),
        first: data.first,
        second: data.second,
        summer: data.summer,
      }))
      .sort((a, b) => a.year.localeCompare(b.year))
  }

  const yearMap = new Map<string, { first: number; second: number; summer: number }>()

  courses.forEach(c => {
    if (!c.Year) return
    const existing = yearMap.get(c.Year) || { first: 0, second: 0, summer: 0 }
    if (c.Semester === 'First Semester') existing.first += c.Registered_Students
    else if (c.Semester === 'Second Semester') existing.second += c.Registered_Students
    else if (c.Semester === 'Summer Semester') existing.summer += c.Registered_Students
    yearMap.set(c.Year, existing)
  })

  return Array.from(yearMap.entries())
    .filter(([y]) => y !== 'undefined' && y !== 'null')
    .map(([year, data]) => ({
      year: year.replace('2022-2023', "'22-'23").replace('2023-2024', "'23-'24").replace('2024-2025', "'24-'25").replace('2025-2026', "'25-'26"),
      first: data.first,
      second: data.second,
      summer: data.summer
    })).sort((a, b) => a.year.localeCompare(b.year))
}

export interface DepartmentUtilization {
  name: string
  fullName: string
  students: number
  capacity: number
  utilization: number
  sections: number
  status: 'low' | 'medium' | 'high' | 'full'
}

export function getDepartmentUtilization(courses: Course[]): DepartmentUtilization[] {
  const deptMap = new Map<string, { students: number; capacity: number; sections: number }>()
  
  courses.forEach(c => {
    if (c.isOnline || c.Section_Capacity <= 0) return
    const existing = deptMap.get(c.Department) || { students: 0, capacity: 0, sections: 0 }
    existing.students += c.Registered_Students
    existing.capacity += c.Section_Capacity
    existing.sections += 1
    deptMap.set(c.Department, existing)
  })
  
  return Array.from(deptMap.entries())
    .filter(([name]) => name)
    .map(([name, data]) => {
      const utilization = data.capacity > 0 ? Math.round((data.students / data.capacity) * 100) : 0
      // Issue 5: standardized thresholds — <60=low, 60-74=medium, 75-89=high, ≥90=full
      let status: 'low' | 'medium' | 'high' | 'full' = 'medium'
      if (utilization < 60) status = 'low'
      else if (utilization >= 90) status = 'full'
      else if (utilization >= 75) status = 'high'
      
      return {
        name: name.length > 20 ? name.substring(0, 18) + '...' : name,
        fullName: name,
        students: data.students,
        capacity: data.capacity,
        utilization,
        sections: data.sections,
        status
      }
    })
    .sort((a, b) => b.utilization - a.utilization)
}

export function getRoomWasteAnalysis(courses: Course[], limit = 10): RoomWasteData[] {
  const roomMap = new Map<
    string,
    {
      termMap: Map<string, { capacity: number; students: number; sectionKeys: Set<string> }>
    }
  >()

  courses.forEach(c => {
    if (isExcludedFromRoomUtilization(c.Room) || c.isOnline || c.Section_Capacity <= 0) return
    const existing = roomMap.get(c.Room) ?? { termMap: new Map() }
    const termKey = `${c.Year}|${c.Semester}`
    const sectionKey = `${c.Course_Number}|${c.Section}`
    const termData = existing.termMap.get(termKey) ?? {
      capacity: 0,
      students: 0,
      sectionKeys: new Set<string>(),
    }
    if (!termData.sectionKeys.has(sectionKey)) {
      termData.capacity += c.Section_Capacity
      termData.students += c.Registered_Students
      termData.sectionKeys.add(sectionKey)
    }
    existing.termMap.set(termKey, termData)
    roomMap.set(c.Room, existing)
  })

  return Array.from(roomMap.entries())
    .map(([room, data]) => {
      const termTotals = Array.from(data.termMap.values()).reduce(
        (acc, term) => {
          acc.capacity += term.capacity
          acc.students += term.students
          return acc
        },
        { capacity: 0, students: 0 },
      )
      const semCount = Math.max(1, data.termMap.size)
      const unusedSeats = Math.max(
        0,
        Math.round((termTotals.capacity - termTotals.students) / semCount),
      )
      const efficiencyScore =
        termTotals.capacity > 0
          ? Math.round((termTotals.students / termTotals.capacity) * 100)
          : 0
      return {
        room,
        totalCapacity: Math.round(termTotals.capacity / semCount),
        totalStudents: Math.round(termTotals.students / semCount),
        unusedSeats,
        efficiencyScore,
      }
    })
    .sort((a, b) => b.unusedSeats - a.unusedSeats)
    .slice(0, limit)
}

export function getCourseGrowthTrends(courses: Course[], limit = 5): CourseGrowthData[] {
  const courseYearSemMap = new Map<string, Map<string, Map<string, number>>>()

  courses.forEach(c => {
    if (!c.Course_Number || !c.Year || !c.Semester) return
    if (!courseYearSemMap.has(c.Course_Number)) {
      courseYearSemMap.set(c.Course_Number, new Map())
    }
    const yearMap = courseYearSemMap.get(c.Course_Number)!
    if (!yearMap.has(c.Year)) yearMap.set(c.Year, new Map())
    const semMap = yearMap.get(c.Year)!
    semMap.set(c.Semester, (semMap.get(c.Semester) ?? 0) + c.Registered_Students)
  })

  const years = [...new Set(courses.map(c => c.Year).filter(Boolean))].sort()
  if (years.length < 2) return []

  const currentYear = years[years.length - 1]
  const previousYear = years[years.length - 2]

  const result: CourseGrowthData[] = []

  for (const [code, yearMap] of courseYearSemMap) {
    const curSemMap = yearMap.get(currentYear)
    const prevSemMap = yearMap.get(previousYear)
    if (!curSemMap || !prevSemMap) continue

    const comparableSems = [...curSemMap.keys()].filter(s => prevSemMap.has(s))
    if (comparableSems.length === 0) continue

    const currentStudents = comparableSems.reduce(
      (s, sem) => s + (curSemMap.get(sem) ?? 0),
      0,
    )
    const previousStudents = comparableSems.reduce(
      (s, sem) => s + (prevSemMap.get(sem) ?? 0),
      0,
    )

    if (previousStudents < 30) continue

    const growth = Math.round(
      ((currentStudents - previousStudents) / previousStudents) * 100,
    )
    const trend: 'up' | 'down' | 'steady' =
      growth > 5 ? 'up' : growth < -5 ? 'down' : 'steady'
    const name =
      courses.find(co => co.Course_Number === code)?.English_Name ?? code

    result.push({
      code,
      name,
      previousStudents,
      currentStudents,
      growth,
      trend,
    })
  }

  return result
    .sort((a, b) => Math.abs(b.growth) - Math.abs(a.growth))
    .slice(0, limit)
}

export interface HighDemandSection {
  course: string
  courseName: string
  section: string
  students: number
  capacity: number
  utilization: number
  lecturer: string
  department: string
}

export function getHighDemandSections(courses: Course[], threshold = 95): HighDemandSection[] {
  return courses
    .filter(
      c =>
        !c.isOnline &&
        c.Section_Capacity > 0 &&
        ((c.Registered_Students / c.Section_Capacity) * 100) >= threshold,
    )
    .map(c => ({
      course: c.Course_Number,
      courseName: c.English_Name,
      section: c.Section,
      students: c.Registered_Students,
      capacity: c.Section_Capacity,
      utilization: Math.round((c.Registered_Students / c.Section_Capacity) * 100),
      lecturer: c.Lecturer_Name,
      department: c.Department
    }))
    .sort((a, b) => b.utilization - a.utilization) // Sort by highest utilization first
    .slice(0, 20)
}

export interface FacultyWorkloadData {
  sections: string
  count: number
}

export function getFacultyWorkloadDistribution(courses: Course[]): FacultyWorkloadData[] {
  const lecturerTermMap = new Map<string, Map<string, number>>()

  courses.forEach(course => {
    if (!course.Lecturer_ID || course.Lecturer_Name?.trim().toUpperCase() === 'TBA') {
      return
    }
    const lecturer = course.Lecturer_ID
    const termKey = `${course.Year}|${course.Semester}`
    const termCounts = lecturerTermMap.get(lecturer) || new Map<string, number>()
    termCounts.set(termKey, (termCounts.get(termKey) || 0) + 1)
    lecturerTermMap.set(lecturer, termCounts)
  })
  
  const distribution = new Map<string, number>()
  const groups = ['1 Section', '2 Sections', '3 Sections', '4 Sections', '5 Sections', '6+ Sections']
  groups.forEach(g => distribution.set(g, 0))
  
  lecturerTermMap.forEach(termCounts => {
    const terms = Array.from(termCounts.values())
    if (terms.length === 0) return
    // Issue 4: use rounded average sections per term, not peak, to avoid overstating heavy loads.
    const avgSections = Math.round(terms.reduce((sum, v) => sum + v, 0) / terms.length)

    if (avgSections <= 1) distribution.set('1 Section', distribution.get('1 Section')! + 1)
    else if (avgSections === 2) distribution.set('2 Sections', distribution.get('2 Sections')! + 1)
    else if (avgSections === 3) distribution.set('3 Sections', distribution.get('3 Sections')! + 1)
    else if (avgSections === 4) distribution.set('4 Sections', distribution.get('4 Sections')! + 1)
    else if (avgSections === 5) distribution.set('5 Sections', distribution.get('5 Sections')! + 1)
    else distribution.set('6+ Sections', distribution.get('6+ Sections')! + 1)
  })
  
  return groups.map(g => ({ sections: g, count: distribution.get(g) || 0 }))
}

export interface RoomTypeUtilization {
  type: string
  sections: number
  avgUtilization: number
}

function isExcludedFromRoomUtilization(room?: string): boolean {
  if (!room) return true
  const normalized = room.trim().toLowerCase()
  return normalized === 'online' || normalized.includes('training') || normalized.includes('project')
}

export function getRoomTypeUtilization(courses: Course[]): RoomTypeUtilization[] {
  // Issue 3: track raw totals for a capacity-weighted average instead of an unweighted average of per-section %.
  let labStudents = 0, labCapacity = 0, labSections = 0
  let classStudents = 0, classCapacity = 0, classSections = 0
  
  courses.forEach(c => {
    if (!isExcludedFromRoomUtilization(c.Room) && c.Section_Capacity > 0) {
      if (c.islab === true) {
        labStudents += c.Registered_Students
        labCapacity += c.Section_Capacity
        labSections++
      } else {
        classStudents += c.Registered_Students
        classCapacity += c.Section_Capacity
        classSections++
      }
    }
  })
  
  return [
    { type: 'Standard Classroom', sections: classSections, avgUtilization: classCapacity > 0 ? Math.round((classStudents / classCapacity) * 100) : 0 },
    { type: 'Laboratory', sections: labSections, avgUtilization: labCapacity > 0 ? Math.round((labStudents / labCapacity) * 100) : 0 }
  ]
}
