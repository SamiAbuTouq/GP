import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
  try {
    const { searchParams } = new URL(request.url)
    const timetableStatus = searchParams.get('timetableStatus')
    const semesterId = searchParams.get('semesterId')

    const entries = await prisma.sectionScheduleEntry.findMany({
      where: {
        timetable: {
          ...(timetableStatus ? { status: timetableStatus } : {}),
          ...(semesterId ? { semester_id: Number(semesterId) } : {}),
        },
      },
      select: {
        user_id: true,
        room_id: true,
        registered_students: true,
        section_capacity: true,
        section_number: true,
        is_lab: true,
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
            department: true,
          },
        },
      },
      orderBy: { entry_id: 'asc' },
    })

    const courses = entries.map((entry) => ({
      Year: entry.timetable.semester.academic_year,
      Semester: decodeSemesterType(entry.timetable.semester.semester_type),
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
      Section_Capacity:
        entry.course.delivery_mode === 'ONLINE'
          ? entry.registered_students
          : entry.section_capacity,
      Online:
        entry.course.delivery_mode === 'ONLINE'
          ? 'Online'
          : entry.course.delivery_mode === 'BLENDED'
            ? 'Blended'
            : 'Face-to-Face',
      Start_Time: formatTime(entry.timeslot.start_time),
      End_Time: formatTime(entry.timeslot.end_time),
      islab: entry.is_lab,
      Department_ID: String(entry.course.dept_id),
    }))

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
