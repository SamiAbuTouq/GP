import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      include: {
        department: true,
        _count: {
          select: { section_schedule_entries: true },
        },
      },
      orderBy: { course_code: 'asc' },
    })

    return NextResponse.json(
      courses.map(course => ({
        id: course.course_id,
        code: course.course_code,
        name: course.course_name,
        creditHours: course.credit_hours,
        academicLevel: course.academic_level,
        deliveryMode: course.delivery_mode,
        department: course.department.dept_name,
        departmentId: course.dept_id,
        sections: (course as any).sections ?? (course._count?.section_schedule_entries || 0),
      }))
    )
  } catch (error) {
    console.error('Error fetching courses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch courses. Please check database connection.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    const code = (body.code || '').trim()
    const name = (body.name || '').trim()

    if (!code) {
      return NextResponse.json(
        { error: 'Course code is required.' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Course name is required.' },
        { status: 400 }
      )
    }

    // Validate credit hours
    const creditHours = Number(body.creditHours) || 3
    if (creditHours < 1 || creditHours > 6) {
      return NextResponse.json(
        { error: 'Credit hours must be between 1 and 6.' },
        { status: 400 }
      )
    }

    // Validate academic level
    const academicLevel = Number(body.academicLevel) || 1
    if (academicLevel < 1 || academicLevel > 5) {
      return NextResponse.json(
        { error: 'Academic level must be between 1 and 5.' },
        { status: 400 }
      )
    }

    // Validate delivery mode
    const deliveryMode = (body.deliveryMode || 'On-Campus').trim()
    if (!deliveryMode) {
      return NextResponse.json(
        { error: 'Delivery mode is required.' },
        { status: 400 }
      )
    }

    // Find department by name or use provided departmentId
    let deptId = body.departmentId
    if (!deptId && body.department) {
      const dept = await prisma.department.findFirst({
        where: { dept_name: body.department },
      })
      if (dept) {
        deptId = dept.dept_id
      } else {
        // Create department if it doesn't exist
        const newDept = await prisma.department.create({
          data: { dept_name: body.department },
        })
        deptId = newDept.dept_id
      }
    }

    if (!deptId) {
      return NextResponse.json(
        { error: 'Department is required. Please select a department for this course.' },
        { status: 400 }
      )
    }

    // Check if course code already exists
    const existingCourse = await prisma.course.findUnique({
      where: { course_code: code },
    })

    if (existingCourse) {
      return NextResponse.json(
        { error: `Course with code "${code}" already exists. Please use a different code.` },
        { status: 409 }
      )
    }

    // Check if a course with the same name exists in the same department
    const existingCourseByName = await prisma.course.findFirst({
      where: {
        course_name: name,
        dept_id: deptId,
      },
    })

    if (existingCourseByName) {
      return NextResponse.json(
        { error: `A course named "${name}" already exists in this department.` },
        { status: 409 }
      )
    }

    const course = await prisma.course.create({
      data: {
        course_code: code,
        course_name: name,
        credit_hours: creditHours,
        academic_level: academicLevel,
        delivery_mode: deliveryMode,
        dept_id: deptId,
        ...((body.sections !== undefined) && { sections: Number(body.sections) } as any),
      },
      include: { department: true },
    })

    return NextResponse.json({
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      creditHours: course.credit_hours,
      academicLevel: course.academic_level,
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      sections: (course as any).sections ?? 0,
    })
  } catch (error) {
    console.error('Error creating course:', error)
    const prismaError = error as { code?: string; meta?: { target?: string[] } }
    if (prismaError?.code === 'P2002') {
      const field = prismaError?.meta?.target?.[0]
      if (field === 'course_code') {
        return NextResponse.json({ error: 'A course with this code already exists.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'A course with these details already exists.' }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Failed to create course. Please try again.' },
      { status: 500 }
    )
  }
}
