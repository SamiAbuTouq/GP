import { NextResponse } from 'next/server'
import type { DeliveryMode } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { academicLevelFromCourseCode } from '@/lib/academic-level'

function deliveryModeLabel(mode: DeliveryMode): 'Online' | 'Blended' | 'On-Campus' {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'BLENDED') return 'Blended'
  return 'On-Campus'
}

function decodeSemesterType(type: number): string {
  const map: Record<number, string> = {
    1: 'First Semester',
    2: 'Second Semester',
    3: 'Summer Semester',
  }
  return map[type] ?? `Semester ${type}`
}

type SemesterKey = { semester_id: number; academic_year: string; semester_type: number }

/** Newest term first: by calendar start year from academic_year, then semester_type (Summer > Second > First). */
function pickNewestSemesterWithData(semesters: SemesterKey[]): SemesterKey | null {
  if (!semesters.length) return null
  const startYear = (y: string) => {
    const m = String(y).trim().match(/^(\d{4})/)
    return m ? parseInt(m[1], 10) : 0
  }
  return [...semesters].sort((a, b) => {
    const yd = startYear(b.academic_year) - startYear(a.academic_year)
    if (yd !== 0) return yd
    return b.semester_type - a.semester_type
  })[0]
}

/**
 * Unique catalog courses with section counts for the newest semester that actually appears in
 * `section_schedule_entry` (same notion of “latest schedule” as the rest of the app).
 *
 * We derive the target term from all schedule rows so we never pick an empty `semester` row and
 * we do not rely on nested `timetable` filters (which can behave inconsistently across adapters).
 */
export async function GET() {
  try {
    const entryRows = await prisma.sectionScheduleEntry.findMany({
      select: {
        course_id: true,
        section_number: true,
        timetable: {
          select: {
            semester_id: true,
            semester: {
              select: {
                semester_id: true,
                academic_year: true,
                semester_type: true,
              },
            },
          },
        },
      },
    })

    const semesterById = new Map<number, SemesterKey>()
    for (const row of entryRows) {
      const s = row.timetable.semester
      semesterById.set(s.semester_id, {
        semester_id: s.semester_id,
        academic_year: s.academic_year,
        semester_type: s.semester_type,
      })
    }

    const latestSemester = pickNewestSemesterWithData([...semesterById.values()])

    const sectionSetsByCourseId = new Map<number, Set<string>>()
    if (latestSemester) {
      const targetId = latestSemester.semester_id
      for (const row of entryRows) {
        if (row.timetable.semester_id !== targetId) continue
        let set = sectionSetsByCourseId.get(row.course_id)
        if (!set) {
          set = new Set()
          sectionSetsByCourseId.set(row.course_id, set)
        }
        set.add(String(row.section_number).trim())
      }
    }

    const allCourses = await prisma.course.findMany({
      include: { department: true },
      orderBy: { course_code: 'asc' },
    })

    const courses = allCourses.map((c) => ({
      id: c.course_id,
      code: c.course_code,
      name: c.course_name,
      creditHours: c.credit_hours,
      academicLevel: academicLevelFromCourseCode(c.course_code),
      deliveryMode: deliveryModeLabel(c.delivery_mode),
      department: c.department.dept_name,
      sections: sectionSetsByCourseId.get(c.course_id)?.size ?? 0,
    }))

    return NextResponse.json(
      {
        lastSemester: latestSemester
          ? {
              academicYear: latestSemester.academic_year,
              semester: decodeSemesterType(latestSemester.semester_type),
            }
          : null,
        courses,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      },
    )
  } catch (error) {
    console.error('[GET /api/courses/catalog]', error)
    return NextResponse.json(
      { error: 'Failed to load course catalog from the database.' },
      { status: 500 },
    )
  }
}
