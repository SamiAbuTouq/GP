import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const course = await prisma.course.findUnique({
      where: { course_id: parseInt(id) },
      include: {
        department: true,
        _count: {
          select: { section_schedule_entries: true },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
    }

    return NextResponse.json({
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      creditHours: course.credit_hours,
      academicLevel: course.academic_level,
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      departmentId: course.dept_id,
      sections: (course as any).sections ?? (course._count?.section_schedule_entries || 0),
    })
  } catch (error) {
    console.error('Error fetching course:', error)
    return NextResponse.json(
      { error: 'Failed to fetch course.' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()

    const existing = await prisma.course.findUnique({
      where: { course_id: parseInt(id) },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
    }

    // Find department by name or use provided departmentId
    let deptId = body.departmentId
    if (!deptId && body.department) {
      let dept = await prisma.department.findFirst({
        where: { dept_name: body.department },
      })
      if (!dept) {
        // Create the department if it doesn't exist
        dept = await prisma.department.create({
          data: { dept_name: body.department },
        })
      }
      deptId = dept.dept_id
    }

    // Check if code is changing and if new code conflicts
    if (body.code && body.code !== existing.course_code) {
      const codeConflict = await prisma.course.findUnique({
        where: { course_code: body.code },
      })
      if (codeConflict) {
        return NextResponse.json(
          { error: `Course code "${body.code}" is already used by another course.` },
          { status: 409 }
        )
      }
    }

    // Check if name is changing and conflicts within the same department
    const targetDeptId = deptId || existing.dept_id
    if (body.name && body.name !== existing.course_name) {
      const nameConflict = await prisma.course.findFirst({
        where: {
          course_name: body.name,
          dept_id: targetDeptId,
          course_id: { not: parseInt(id) },
        },
      })
      if (nameConflict) {
        return NextResponse.json(
          { error: `A course named "${body.name}" already exists in this department.` },
          { status: 409 }
        )
      }
    }

    const course = await prisma.course.update({
      where: { course_id: parseInt(id) },
      data: {
        ...(body.code && { course_code: body.code }),
        ...(body.name && { course_name: body.name }),
        ...(body.creditHours !== undefined && { credit_hours: Number(body.creditHours) }),
        ...(body.academicLevel !== undefined && { academic_level: Number(body.academicLevel) }),
        ...(body.deliveryMode && { delivery_mode: body.deliveryMode }),
        ...(deptId && { dept_id: deptId }),
        ...((body.sections !== undefined) && { sections: Number(body.sections) } as any),
      },
      include: {
        department: true,
        _count: {
          select: { section_schedule_entries: true },
        },
      },
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
      departmentId: course.dept_id,
      sections: (course as any).sections ?? (course._count?.section_schedule_entries || 0),
    })
  } catch (error) {
    console.error('Error updating course:', error)
    const prismaError = error as { code?: string; meta?: { target?: string[] } }
    if (prismaError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A course with this code already exists.' },
        { status: 409 }
      )
    }
    if (prismaError?.code === 'P2025') {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update course. Please try again.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Check if course is in use
    const scheduleEntries = await prisma.sectionScheduleEntry.count({
      where: { course_id: parseInt(id) },
    })
    if (scheduleEntries > 0) {
      return NextResponse.json(
        { error: `Cannot delete this course because it is used in ${scheduleEntries} schedule entries. Remove the schedule entries first.` },
        { status: 409 }
      )
    }

    // Also check lecturer associations
    const lecturerAssocs = await prisma.lecturerCanTeachCourse.count({
      where: { course_id: parseInt(id) },
    })
    if (lecturerAssocs > 0) {
      // Delete these associations first
      await prisma.lecturerCanTeachCourse.deleteMany({
        where: { course_id: parseInt(id) },
      })
    }

    // Delete prerequisites
    await prisma.coursePrerequisite.deleteMany({
      where: {
        OR: [
          { course_id: parseInt(id) },
          { prerequisite_id: parseInt(id) },
        ],
      },
    })

    await prisma.course.delete({
      where: { course_id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting course:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2025') {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
    }
    if (prismaError?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete this course because it is referenced by other records.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to delete course. Please try again.' },
      { status: 500 }
    )
  }
}
