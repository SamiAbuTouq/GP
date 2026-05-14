import { z } from 'zod'
import { ApiClient } from '@/lib/api-client'

/** Next route handlers may not see the Nest refresh cookie (different host); forward the SPA access token. */
function nextApiAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = ApiClient.getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

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

export type ActionInsightCategory = 'resource' | 'capacity' | 'hr' | 'scheduling'

export interface ActionInsight {
  category: ActionInsightCategory
  title: string
  message: string
}

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

  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    headers: nextApiAuthHeaders(),
  })

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 401) {
      throw new Error('Authentication required. Please sign in again and retry.')
    }
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
  const response = await fetch('/api/semesters', {
    credentials: 'include',
    cache: 'no-store',
    headers: nextApiAuthHeaders(),
  })

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 401) {
      throw new Error('Authentication required. Please sign in again and retry.')
    }
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
  const yearStart = (y: string) => {
    const n = parseInt(String(y).slice(0, 4), 10)
    return Number.isFinite(n) ? n : 0
  }
  const years = [...new Set(courses.map(c => c.Year))]
    .filter(Boolean)
    .sort((a, b) => yearStart(b) - yearStart(a))

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
      .map(c => c.Lecturer_ID)
      .filter(id => id !== ''), // Fix: exclude empty-string IDs from TBA/unassigned sections
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
  
  // Find peak hour — normalise via parseInt so "08" and "8" map to the same key
  const hourCounts = new Map<string, number>()
  courses.forEach(c => {
    const raw = c.Start_Time?.split(':')[0]
    if (raw == null) return
    const hour = String(parseInt(raw, 10)) // "08" → "8", avoids split-vote between formats
    if (!isNaN(parseInt(hour))) {
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
                 course.Online === 'Blended' ? 'Blended' : 'Face To Face'
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




/**
 * Campus-oriented day × start-hour grid: for each calendar slot, sums Registered_Students
 * across sections that meet on that day at that start hour (one contribution per section
 * per meeting day). Fully online sections are omitted so totals match on-campus load.
 * Workweek grid is Sun–Thu (Fri is not in DB day masks; Sat from masks is ignored here).
 */
export function getScheduleHeatmap(courses: Course[]): HeatmapData[] {
  const heatmap: HeatmapData[] = []
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
  const studentCounts = new Map<string, number>()

  for (const course of courses) {
    if (course.isOnline) continue
    if (!course.Day?.trim() || !course.Start_Time?.trim()) continue

    const hourRaw = course.Start_Time.split(':')[0]
    if (hourRaw === '') continue
    const hour = hourRaw.padStart(2, '0')

    for (const shortDay of expandCourseMeetingDays(course.Day)) {
      if (!days.includes(shortDay)) continue
      const key = `${shortDay}-${hour}`
      studentCounts.set(key, (studentCounts.get(key) || 0) + course.Registered_Students)
    }
  }
  
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

export function isExcludedFromRoomUtilization(room?: string): boolean {
  if (!room) return true
  const normalized = room.trim().toLowerCase()
  return normalized === 'online' || normalized.includes('training') || normalized.includes('project')
}

/** Physical sections with positive capacity (seat-based occupancy applies). `Section_Capacity` is the room/section seat limit in this dataset. */
export function isPhysicalCapacitySection(c: Course): boolean {
  return !c.isOnline && c.Section_Capacity > 0 && !isExcludedFromRoomUtilization(c.Room)
}

export function sectionOccupancyPercent(c: Course): number | null {
  if (!isPhysicalCapacitySection(c)) return null
  return (c.Registered_Students / c.Section_Capacity) * 100
}

/** Map one day token to canonical Sun|Mon|…|Sat, or null if not a weekday token. */
function canonicalWeekdayFromToken(token: string): string | null {
  const t = token.trim().toLowerCase()
  if (!t || t === 'tba' || t === 'n/a' || t === '—' || t === '-') return null
  if (t.startsWith('sun')) return 'Sun'
  if (t.startsWith('mon')) return 'Mon'
  if (t.startsWith('tue')) return 'Tue'
  if (t.startsWith('wed')) return 'Wed'
  if (t.startsWith('thu')) return 'Thu'
  if (t.startsWith('fri')) return 'Fri'
  if (t.startsWith('sat')) return 'Sat'
  return null
}

/**
 * Parses `Course.Day`: splits on whitespace and on punctuation (comma, slash, pipe);
 * case-insensitive; expands `Daily` to Sun–Thu (workweek used elsewhere in this app).
 * Repeats in the source string are preserved (each counts as one meeting occurrence).
 */
export function expandCourseMeetingDays(dayField: string | undefined): string[] {
  if (!dayField?.trim()) return []
  const normalized = dayField
    .replace(/,/g, ' ')
    .replace(/\//g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = normalized.split(' ').filter(Boolean)
  const out: string[] = []
  for (const raw of tokens) {
    if (/^daily$/i.test(raw)) {
      out.push('Sun', 'Mon', 'Tue', 'Wed', 'Thu')
      continue
    }
    const d = canonicalWeekdayFromToken(raw)
    if (d) out.push(d)
  }
  return out
}

/** Sum of unused seats across physical sections: Σ max(0, capacity − registered). */
export function getTotalPhysicalRoomWasteSeats(courses: Course[]): number {
  return courses.reduce((sum, c) => {
    if (!isPhysicalCapacitySection(c)) return sum
    return sum + Math.max(0, c.Section_Capacity - c.Registered_Students)
  }, 0)
}

function semesterTypeOrder(sem: string): number {
  if (sem === 'First Semester') return 0
  if (sem === 'Second Semester') return 1
  if (sem === 'Summer Semester') return 2
  return 9
}

function compareTermKeys(a: string, b: string): number {
  const [ya, sa] = a.split('|')
  const [yb, sb] = b.split('|')
  const cy = String(ya).localeCompare(String(yb))
  if (cy !== 0) return cy
  return semesterTypeOrder(sa) - semesterTypeOrder(sb)
}

function formatTermLabel(year: string, semester: string): string {
  const y = String(year)
    .replace('2022-2023', "'22-'23")
    .replace('2023-2024', "'23-'24")
    .replace('2024-2025', "'24-'25")
    .replace('2025-2026', "'25-'26")
  const s = semester.replace('First Semester', 'Fall').replace('Second Semester', 'Spring').replace('Summer Semester', 'Summer')
  return `${y} ${s}`
}

export interface LecturerStressPoint {
  id: string
  name: string
  fullName: string
  creditHours: number
  prepCount: number
  sections: number
}

/** Faculty load: Σ credit_hours; preparation stress: distinct Course_Number per Lecturer_ID. */
export function getLecturerStressScatterData(courses: Course[], minSections = 1): LecturerStressPoint[] {
  const byId = new Map<string, { name: string; credit: number; courses: Set<string>; sections: number }>()
  for (const c of courses) {
    if (!c.Lecturer_ID || !c.Lecturer_Name || c.Lecturer_Name.trim().toUpperCase() === 'TBA') continue
    const row = byId.get(c.Lecturer_ID) ?? {
      name: c.Lecturer_Name,
      credit: 0,
      courses: new Set<string>(),
      sections: 0,
    }
    row.credit += Number(c.credit_hours) || 0
    if (c.Course_Number) row.courses.add(c.Course_Number)
    row.sections += 1
    byId.set(c.Lecturer_ID, row)
  }
  return Array.from(byId.entries())
    .map(([id, d]) => ({
      id,
      name: d.name.length > 22 ? `${d.name.slice(0, 20)}…` : d.name,
      fullName: d.name,
      creditHours: Math.round(d.credit * 10) / 10,
      prepCount: d.courses.size,
      sections: d.sections,
    }))
    .filter((r) => r.sections >= minSections)
    .sort((a, b) => b.creditHours - a.creditHours)
}

export interface SlotDensityClusterRow {
  cluster: string
  avgSaturationPct: number
  sessionCount: number
}

/**
 * Session-weighted average occupancy for Sun–Tue–Thu vs Mon–Wed meeting patterns.
 * Each section-day occurrence contributes that section's occupancy %.
 */
export function getSlotDensityClusters(courses: Course[]): {
  rows: SlotDensityClusterRow[]
  stt: number
  mw: number
} {
  const STT = new Set(['Sun', 'Tue', 'Thu'])
  const MW = new Set(['Mon', 'Wed'])
  const sttUtils: number[] = []
  const mwUtils: number[] = []

  for (const c of courses) {
    const u = sectionOccupancyPercent(c)
    if (u == null || !c.Day) continue
    const util = Math.min(150, Math.round(u * 10) / 10)
    for (const d of expandCourseMeetingDays(c.Day)) {
      if (STT.has(d)) sttUtils.push(util)
      if (MW.has(d)) mwUtils.push(util)
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0

  const stt = avg(sttUtils)
  const mw = avg(mwUtils)

  return {
    rows: [
      { cluster: 'Sun–Tue–Thu', avgSaturationPct: stt, sessionCount: sttUtils.length },
      { cluster: 'Mon–Wed', avgSaturationPct: mw, sessionCount: mwUtils.length },
    ],
    stt,
    mw,
  }
}

export interface AcademicWeightRow {
  department: string
  fullName: string
  academicWeight: number
}

/** Instructional demand: Σ (Registered_Students × credit_hours) by department. */
export function getAcademicWeightByDepartment(courses: Course[]): AcademicWeightRow[] {
  const m = new Map<string, number>()
  for (const c of courses) {
    const ch = Number(c.credit_hours) || 0
    const w = c.Registered_Students * ch
    m.set(c.Department, (m.get(c.Department) || 0) + w)
  }
  return Array.from(m.entries())
    .filter(([name]) => name)
    .map(([fullName, academicWeight]) => ({
      fullName,
      department: fullName.length > 20 ? `${fullName.slice(0, 18)}…` : fullName,
      academicWeight: Math.round(academicWeight),
    }))
    .sort((a, b) => b.academicWeight - a.academicWeight)
}

export interface RoomOccupancyHeatmapResult {
  rooms: string[]
  days: string[]
  /** Row = room index, col = day index: average occupancy % for sections meeting that day in that room. */
  matrix: number[][]
  meetings: number[][]
}

const HEATMAP_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']

/** Room × weekday heat: mean section occupancy for physical sections in that room on that day. */
export function getRoomOccupancyHeatmap(courses: Course[], roomLimit = 14): RoomOccupancyHeatmapResult {
  const roomMeetings = new Map<string, Map<string, number[]>>()

  for (const c of courses) {
    const u = sectionOccupancyPercent(c)
    if (u == null || !c.Room || !c.Day) continue
    if (!roomMeetings.has(c.Room)) roomMeetings.set(c.Room, new Map())
    const byDay = roomMeetings.get(c.Room)!
    for (const d of expandCourseMeetingDays(c.Day)) {
      if (!HEATMAP_DAYS.includes(d)) continue
      if (!byDay.has(d)) byDay.set(d, [])
      byDay.get(d)!.push(u)
    }
  }

  const roomScores = [...roomMeetings.entries()].map(([room, byDay]) => {
    let n = 0
    for (const arr of byDay.values()) n += arr.length
    const avgAll =
      n > 0
        ? [...byDay.values()].flat().reduce((s, v) => s + v, 0) / n
        : 0
    return { room, n, avgAll }
  })
  const rooms = roomScores
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, roomLimit)
    .map((r) => r.room)

  const matrix: number[][] = []
  const meetings: number[][] = []
  for (const room of rooms) {
    const byDay = roomMeetings.get(room)!
    const row: number[] = []
    const mrow: number[] = []
    for (const day of HEATMAP_DAYS) {
      const arr = byDay.get(day) || []
      const avg =
        arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0
      row.push(avg)
      mrow.push(arr.length)
    }
    matrix.push(row)
    meetings.push(mrow)
  }

  return { rooms, days: HEATMAP_DAYS, matrix, meetings }
}

export interface PlanningTermRow {
  termKey: string
  termLabel: string
  /** Physical sections at or above saturation threshold. */
  highSaturationSectionCount: number
  physicalSectionCount: number
  /** Lab sections only: aggregate seat occupancy %. */
  labOccupancyPct: number | null
  labSectionCount: number
}

export function getPlanningTermPressureSeries(
  courses: Course[],
  saturationThresholdPct = 90,
): PlanningTermRow[] {
  const termMap = new Map<
    string,
    {
      physical: Course[]
      highSat: number
      labStudents: number
      labCap: number
      labN: number
    }
  >()

  for (const c of courses) {
    const key = `${c.Year}|${c.Semester}`
    if (!c.Year || !c.Semester) continue
    const row =
      termMap.get(key) ?? { physical: [], highSat: 0, labStudents: 0, labCap: 0, labN: 0 }
    if (isPhysicalCapacitySection(c)) {
      row.physical.push(c)
      const u = sectionOccupancyPercent(c)!
      if (u >= saturationThresholdPct) row.highSat += 1
    }
    if (c.islab === true && isPhysicalCapacitySection(c)) {
      row.labStudents += c.Registered_Students
      row.labCap += c.Section_Capacity
      row.labN += 1
    }
    termMap.set(key, row)
  }

  return [...termMap.entries()]
    .sort(([a], [b]) => compareTermKeys(a, b))
    .map(([termKey, row]) => {
      const [year, semester] = termKey.split('|')
      return {
        termKey,
        termLabel: formatTermLabel(year, semester),
        highSaturationSectionCount: row.highSat,
        physicalSectionCount: row.physical.length,
        labOccupancyPct:
          row.labCap > 0 ? Math.round((row.labStudents / row.labCap) * 100) : row.labN > 0 ? 0 : null,
        labSectionCount: row.labN,
      }
    })
}

export interface SectionExpansionRow {
  courseNumber: string
  courseName: string
  department: string
  termsWithHighSaturation: number
  /** Distinct Year|Semester where the course has at least one physical section. */
  termsOffered: number
  maxObservedUtilizationPct: number
  highSaturationSectionCount: number
}

/**
 * Courses with recurring high saturation (≥ threshold in multiple distinct terms).
 * Uses only observed section utilization — not a forecast.
 */
export function getSectionExpansionCandidates(
  courses: Course[],
  opts?: { saturationThresholdPct?: number; minTermsWithHighSat?: number },
): SectionExpansionRow[] {
  const threshold = opts?.saturationThresholdPct ?? 90
  const minTerms = opts?.minTermsWithHighSat ?? 2

  type PerCourse = {
    name: string
    dept: string
    termHigh: Set<string>
    termOffered: Set<string>
    maxU: number
    highSections: number
  }
  const byCourse = new Map<string, PerCourse>()

  for (const c of courses) {
    if (!c.Course_Number) continue
    const u = sectionOccupancyPercent(c)
    if (u == null) continue
    const termKey = `${c.Year}|${c.Semester}`
    const row =
      byCourse.get(c.Course_Number) ?? {
        name: c.English_Name || c.Course_Number,
        dept: c.Department,
        termHigh: new Set<string>(),
        termOffered: new Set<string>(),
        maxU: 0,
        highSections: 0,
      }
    row.termOffered.add(termKey)
    row.maxU = Math.max(row.maxU, u)
    if (u >= threshold) {
      row.termHigh.add(termKey)
      row.highSections += 1
    }
    byCourse.set(c.Course_Number, row)
  }

  return Array.from(byCourse.entries())
    .map(([courseNumber, r]) => ({
      courseNumber,
      courseName: r.name.length > 40 ? `${r.name.slice(0, 38)}…` : r.name,
      department: r.dept,
      termsWithHighSaturation: r.termHigh.size,
      termsOffered: r.termOffered.size,
      maxObservedUtilizationPct: Math.round(r.maxU),
      highSaturationSectionCount: r.highSections,
    }))
    .filter((row) => row.termsWithHighSaturation >= minTerms)
    .sort((a, b) => b.termsWithHighSaturation - a.termsWithHighSaturation || b.maxObservedUtilizationPct - a.maxObservedUtilizationPct)
    .slice(0, 40)
}

export interface CourseSaturationTrendSeries {
  courseNumber: string
  label: string
  /** Parallel to `terms` array from getHighDemandCourseSaturationTrend. */
  maxUtilByTermIndex: number[]
}

export function getHighDemandCourseSaturationTrend(
  courses: Course[],
  maxSeries = 5,
): { termKeys: string[]; termLabels: string[]; series: CourseSaturationTrendSeries[] } {
  const termKeys = [...new Set(courses.map((c) => `${c.Year}|${c.Semester}`).filter((k) => k.includes('|')))].sort(
    compareTermKeys,
  )
  if (termKeys.length === 0) return { termKeys: [], termLabels: [], series: [] }

  const byCourseTermUtil = new Map<string, Map<string, number>>()
  for (const c of courses) {
    const u = sectionOccupancyPercent(c)
    if (u == null || !c.Course_Number) continue
    const tk = `${c.Year}|${c.Semester}`
    if (!byCourseTermUtil.has(c.Course_Number)) byCourseTermUtil.set(c.Course_Number, new Map())
    const m = byCourseTermUtil.get(c.Course_Number)!
    m.set(tk, Math.max(m.get(tk) ?? 0, u))
  }

  const courseScores = [...byCourseTermUtil.entries()].map(([code, m]) => {
    let score = 0
    for (const tk of termKeys) {
      const u = m.get(tk)
      if (u != null && u >= 90) score += 1
    }
    const labelRow = courses.find((c) => c.Course_Number === code)
    const label =
      (labelRow?.English_Name && labelRow.English_Name.slice(0, 18)) || code
    return { code, m, score, label: label.length > 22 ? `${label.slice(0, 20)}…` : label }
  })
  const top = courseScores
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.code.localeCompare(a.code))
    .slice(0, maxSeries)

  const termLabels = termKeys.map((k) => {
    const [y, s] = k.split('|')
    return formatTermLabel(y, s)
  })

  const series: CourseSaturationTrendSeries[] = top.map((c) => ({
    courseNumber: c.code,
    label: c.label,
    maxUtilByTermIndex: termKeys.map((tk) => {
      const u = c.m.get(tk)
      return u != null ? Math.round(u) : 0
    }),
  }))

  return { termKeys, termLabels, series }
}

export interface RoomUtilizationTrendRoom {
  room: string
  points: { termKey: string; termLabel: string; occupancyPct: number }[]
}

/** Heavily used vs lightly used rooms: mean physical occupancy % per term. */
export function getRoomUtilizationTrends(
  courses: Course[],
  heavyCount = 3,
  lightCount = 3,
): { heavy: RoomUtilizationTrendRoom[]; light: RoomUtilizationTrendRoom[] } {
  const termKeys = [...new Set(courses.map((c) => `${c.Year}|${c.Semester}`).filter((k) => k.includes('|')))].sort(
    compareTermKeys,
  )
  const roomTermUtils = new Map<string, Map<string, number[]>>()

  for (const c of courses) {
    const u = sectionOccupancyPercent(c)
    if (u == null || !c.Room) continue
    const tk = `${c.Year}|${c.Semester}`
    if (!roomTermUtils.has(c.Room)) roomTermUtils.set(c.Room, new Map())
    const tm = roomTermUtils.get(c.Room)!
    if (!tm.has(tk)) tm.set(tk, [])
    tm.get(tk)!.push(u)
  }

  const roomOverall: { room: string; avg: number; n: number }[] = []
  for (const [room, tm] of roomTermUtils) {
    const flat = [...tm.values()].flat()
    if (flat.length < 3) continue
    const avg = flat.reduce((s, v) => s + v, 0) / flat.length
    roomOverall.push({ room, avg, n: flat.length })
  }
  roomOverall.sort((a, b) => b.avg - a.avg)
  const heavyRooms = roomOverall.slice(0, heavyCount).map((r) => r.room)
  const lightRooms = roomOverall.slice(-lightCount).map((r) => r.room)

  const buildSeries = (rooms: string[]): RoomUtilizationTrendRoom[] =>
    rooms.map((room) => {
      const tm = roomTermUtils.get(room)!
      return {
        room,
        points: termKeys.map((tk) => {
          const arr = tm.get(tk) || []
          const occ =
            arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0
          const [y, s] = tk.split('|')
          return { termKey: tk, termLabel: formatTermLabel(y, s), occupancyPct: occ }
        }),
      }
    })

  return {
    heavy: buildSeries(heavyRooms),
    light: buildSeries(lightRooms),
  }
}

export interface FacultyCreditLoadRow {
  id: string
  name: string
  fullName: string
  creditHours: number
}

export function getFacultyCreditLoadTop(courses: Course[], limit = 15): FacultyCreditLoadRow[] {
  const stress = getLecturerStressScatterData(courses, 1)
  return stress
    .map((s) => ({
      id: s.id,
      name: s.name,
      fullName: s.fullName,
      creditHours: s.creditHours,
    }))
    .sort((a, b) => b.creditHours - a.creditHours)
    .slice(0, limit)
}

export type ManagementActionCategory = 'resource' | 'capacity' | 'hr' | 'scheduling'

export interface ManagementActionItem {
  id: string
  category: ManagementActionCategory
  message: string
}

export function buildManagementActionItems(
  courses: Course[],
  roomWaste: RoomWasteData[],
  slotDensity: ReturnType<typeof getSlotDensityClusters>,
  lecturerStress: LecturerStressPoint[],
  labOccupancyPct: number | null,
): ManagementActionItem[] {
  const items: ManagementActionItem[] = []

  const topWaste = roomWaste[0]
  if (topWaste && topWaste.unusedSeats > 20 && topWaste.efficiencyScore < 55) {
    items.push({
      id: 'room-waste',
      category: 'resource',
      message: `Room ${topWaste.room} shows high unused capacity (${topWaste.unusedSeats} unused seats per term on average, ${topWaste.efficiencyScore}% fill). Action: Reassign smaller courses to smaller rooms or consolidate offerings.`,
    })
  }

  if (labOccupancyPct != null && labOccupancyPct >= 85) {
    items.push({
      id: 'lab-pressure',
      category: 'capacity',
      message: `Laboratory sections average ${labOccupancyPct}% occupancy. Action: Expand lab scheduling windows or redistribute lab-heavy courses across terms.`,
    })
  }

  const heavyPrep = lecturerStress.filter((l) => l.prepCount >= 4).sort((a, b) => b.prepCount - a.prepCount)[0]
  if (heavyPrep) {
    items.push({
      id: 'prep-stress',
      category: 'hr',
      message: `Lecturer ${heavyPrep.fullName} is assigned ${heavyPrep.prepCount} distinct course preparations (${heavyPrep.creditHours} credit hours). Action: Rebalance preparations where possible to protect instructional quality.`,
    })
  }

  const { stt, mw } = slotDensity
  if (slotDensity.rows[0].sessionCount > 0 && slotDensity.rows[1].sessionCount > 0 && mw + 1 < stt && stt - mw >= 8) {
    items.push({
      id: 'slot-imbalance',
      category: 'scheduling',
      message: `Mon–Wed meeting slots average ${mw}% occupancy vs ${stt}% for Sun–Tue–Thu patterns. Action: Redistribute sections to lift mid-week slot efficiency.`,
    })
  } else if (
    slotDensity.rows[0].sessionCount > 0 &&
    slotDensity.rows[1].sessionCount > 0 &&
    stt + 1 < mw &&
    mw - stt >= 8
  ) {
    items.push({
      id: 'slot-imbalance-2',
      category: 'scheduling',
      message: `Sun–Tue–Thu patterns average ${stt}% occupancy vs ${mw}% for Mon–Wed. Action: Review whether Sun–Tue–Thu bands are under-filled relative to demand.`,
    })
  }

  const wasteTotal = getTotalPhysicalRoomWasteSeats(courses)
  if (wasteTotal > 500 && !items.some((i) => i.id === 'room-waste')) {
    items.push({
      id: 'aggregate-waste',
      category: 'resource',
      message: `Physical sections leave about ${wasteTotal.toLocaleString()} unused seats in aggregate (Σ capacity − enrollment). Action: Prioritize room right-sizing in timetable reviews.`,
    })
  }

  return items.slice(0, 8)
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
