import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { proxyToBackend } from '@/lib/proxy-backend'
import { requireAdminFromRefreshCookie } from '@/lib/server-auth'


function decodeSemesterType(type: number): string {
  const map: Record<number, string> = {
    1: 'First Semester',
    2: 'Second Semester',
    3: 'Summer Semester',
  }
  return map[type] ?? `Semester ${type}`
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat']
function decodeDaysMask(mask: number | string | bigint | null | undefined): string {
  const numericMask =
    typeof mask === 'bigint'
      ? Number(mask)
      : typeof mask === 'string'
        ? Number(mask)
        : mask

  if (!Number.isFinite(numericMask as number)) return ''
  return DAY_LABELS.filter((_, i) => ((numericMask as number) >> i) & 1).join(' ')
}

function formatTime(value: Date | string | null | undefined): string {
  if (!value) return ''

  if (typeof value === 'string') {
    const m = value.match(/^(\d{1,2}):(\d{2})/)
    if (!m) return ''
    return `${m[1].padStart(2, '0')}:${m[2]}`
  }

  const h = value.getUTCHours().toString().padStart(2, '0')
  const m = value.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Returns one row per section schedule entry — the shape expected by
 * `lib/course-analytics/course-data.ts` (Year, Semester, Course_Number, …).
 */
export async function GET(request: Request) {
  const auth = await requireAdminFromRefreshCookie()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)

    const timetableStatus = searchParams.get('timetableStatus')
    const semesterId = searchParams.get('semesterId')

    const entries = await prisma.sectionScheduleEntry.findMany({
      where: {
        timetable: {
          semester_id: { not: null },
          ...(timetableStatus ? { status: timetableStatus } : {}),
          ...(semesterId ? { semester_id: Number(semesterId) } : {}),
        },
      },
      select: {
        user_id: true,
        room_id: true,
        registered_students: true,
        section_number: true,
        timeslot: true,
        timetable: {
          select: {
            semester: true,
          },
        },
        room: true,
        lecturer: {
          select: {
            user: true,
          },
        },
        course: {
          select: {
            course_code: true,
            course_name: true,
            academic_level: true,
            credit_hours: true,
            dept_id: true,
            delivery_mode: true,
            is_lab: true,
            department: true,
          },
        },
      },
      orderBy: { entry_id: 'asc' },
    })

    const courses = entries.flatMap((entry) => {
      const semester = entry.timetable.semester
      if (!semester) return []
      return [
        {
          Year: semester.academic_year,
          Semester: decodeSemesterType(semester.semester_type),
          Course_Number: entry.course.course_code,
          English_Name: entry.course.course_name,
          academic_level: entry.course.academic_level,
          credit_hours: entry.course.credit_hours,
          Section: entry.section_number,
          Lecturer_Name: `${entry.lecturer.user.first_name} ${entry.lecturer.user.last_name}`,
          Lecturer_ID: String(entry.user_id),
          Department: entry.course.department.dept_name,
          Day: decodeDaysMask(entry.timeslot.days_mask),
          Time: `${formatTime(entry.timeslot.start_time)} - ${formatTime(entry.timeslot.end_time)}`,
          Room: entry.room.room_number,
          Room_ID: String(entry.room_id),
          Registered_Students: entry.registered_students,
          Section_Capacity: entry.course.delivery_mode === 'ONLINE' ? 0 : entry.room.capacity,
          isOnline: entry.course.delivery_mode === 'ONLINE',
          Online:
            entry.course.delivery_mode === 'ONLINE'
              ? 'Online'
              : entry.course.delivery_mode === 'BLENDED'
                ? 'Blended'
                : 'On-Campus',
          Start_Time: formatTime(entry.timeslot.start_time),
          End_Time: formatTime(entry.timeslot.end_time),
          islab: entry.course.is_lab,
          Department_ID: String(entry.course.dept_id),
        },
      ]
    })

    return NextResponse.json(courses, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('[GET /api/courses]', error)
    return NextResponse.json(
      { error: 'Failed to fetch course data from the database.' },
      { status: 500 },
    )
  }
}

/** Proxies catalog create to Nest (`CreateCourseDto` includes optional `isLab`). */
export async function POST(request: Request) {
  const body = await request.text()
  return proxyToBackend('/courses', { method: 'POST', body })
}
