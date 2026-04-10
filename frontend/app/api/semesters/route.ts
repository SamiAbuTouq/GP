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

export async function GET() {
  try {
    const semesters = await prisma.semester.findMany({
      select: {
        semester_id: true,
        academic_year: true,
        semester_type: true,
        total_students: true,
      },
      orderBy: [{ academic_year: 'asc' }, { semester_type: 'asc' }],
    })

    return NextResponse.json(
      semesters.map((s) => ({
        semesterId: s.semester_id,
        academicYear: s.academic_year,
        semesterType: s.semester_type,
        semester: decodeSemesterType(s.semester_type),
        totalStudents: s.total_students,
      })),
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
        },
      },
    )
  } catch (error) {
    console.error('[GET /api/semesters]', error)
    return NextResponse.json(
      { error: 'Failed to fetch semester totals from the database.' },
      { status: 500 },
    )
  }
}
