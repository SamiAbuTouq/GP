import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function extractDbId(id: string): number {
  // Handle both "LEC001" format and plain number
  if (id.startsWith('LEC')) {
    return parseInt(id.replace('LEC', ''), 10)
  }
  return parseInt(id, 10)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dbId = extractDbId(id)

  try {
    const lecturer = await prisma.lecturer.findUnique({
      where: { user_id: dbId },
      include: {
        user: true,
        department: true,
        lecturer_can_teach_course: {
          include: { course: true },
        },
      },
    })

    if (!lecturer) {
      return NextResponse.json({ error: 'Lecturer not found.' }, { status: 404 })
    }

    return NextResponse.json({
      id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
      databaseId: lecturer.user_id,
      name: `${lecturer.user.first_name} ${lecturer.user.last_name}`.trim(),
      email: lecturer.user.email,
      department: lecturer.department.dept_name,
      departmentId: lecturer.dept_id,
      load: 0,
      maxWorkload: lecturer.max_workload,
      courses: lecturer.lecturer_can_teach_course.map(ltc => ltc.course.course_code),
      isAvailable: lecturer.is_available,
    })
  } catch (error) {
    console.error('Error fetching lecturer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lecturer.' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dbId = extractDbId(id)

  try {
    const body = await request.json()

    const existing = await prisma.lecturer.findUnique({
      where: { user_id: dbId },
      include: { user: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lecturer not found.' }, { status: 404 })
    }

    // Find department by name or use provided departmentId
    let deptId = body.departmentId
    if (!deptId && body.department) {
      let dept = await prisma.department.findFirst({
        where: { dept_name: body.department },
      })
      if (!dept) {
        dept = await prisma.department.create({
          data: { dept_name: body.department },
        })
      }
      deptId = dept.dept_id
    }

    // Validate email if changing
    if (body.email && body.email.toLowerCase() !== existing.user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Please enter a valid email address.' },
          { status: 400 }
        )
      }

      const emailConflict = await prisma.user.findFirst({
        where: {
          email: body.email.toLowerCase(),
          user_id: { not: dbId },
        },
      })
      if (emailConflict) {
        return NextResponse.json(
          { error: `Email "${body.email}" is already used by another user.` },
          { status: 409 }
        )
      }
    }

    // Validate name if changing
    if (body.name) {
      const nameParts = body.name.trim().split(/\s+/)
      const firstName = nameParts[0] || 'Unknown'
      const lastName = nameParts.slice(1).join(' ') || ''

      // Check for name conflict
      const nameConflict = await prisma.user.findFirst({
        where: {
          first_name: firstName,
          last_name: lastName,
          role_name: 'LECTURER',
          user_id: { not: dbId },
        },
      })
      if (nameConflict) {
        return NextResponse.json(
          { error: `A lecturer named "${body.name}" already exists.` },
          { status: 409 }
        )
      }

      // Update user
      await prisma.user.update({
        where: { user_id: dbId },
        data: {
          first_name: firstName,
          last_name: lastName,
          ...(body.email && { email: body.email.toLowerCase() }),
        },
      })
    } else if (body.email) {
      await prisma.user.update({
        where: { user_id: dbId },
        data: { email: body.email.toLowerCase() },
      })
    }

    // Update lecturer
    const lecturer = await prisma.lecturer.update({
      where: { user_id: dbId },
      data: {
        ...(deptId && { dept_id: deptId }),
        ...(body.maxWorkload !== undefined && { max_workload: Number(body.maxWorkload) }),
        ...(body.isAvailable !== undefined && { is_available: body.isAvailable }),
      },
      include: {
        user: true,
        department: true,
      },
    })

    // Update courses if provided
    if (body.courses !== undefined) {
      // Remove existing course associations
      await prisma.lecturerCanTeachCourse.deleteMany({
        where: { user_id: dbId },
      })

      // Add new course associations
      if (body.courses.length > 0) {
        const courses = await prisma.course.findMany({
          where: { course_code: { in: body.courses } },
        })

        if (courses.length > 0) {
          await prisma.lecturerCanTeachCourse.createMany({
            data: courses.map(course => ({
              user_id: dbId,
              course_id: course.course_id,
            })),
          })
        }
      }
    }

    return NextResponse.json({
      id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
      databaseId: lecturer.user_id,
      name: `${lecturer.user.first_name} ${lecturer.user.last_name}`.trim(),
      email: lecturer.user.email,
      department: lecturer.department.dept_name,
      departmentId: lecturer.dept_id,
      load: 0,
      maxWorkload: lecturer.max_workload,
      courses: body.courses || [],
      isAvailable: lecturer.is_available,
    })
  } catch (error) {
    console.error('Error updating lecturer:', error)
    const prismaError = error as { code?: string; meta?: { target?: string[] } }
    if (prismaError?.code === 'P2002') {
      const field = prismaError?.meta?.target?.[0]
      if (field === 'email') {
        return NextResponse.json({ error: 'This email address is already used by another user.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'A lecturer with these details already exists.' }, { status: 409 })
    }
    if (prismaError?.code === 'P2025') {
      return NextResponse.json({ error: 'Lecturer not found.' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update lecturer. Please try again.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dbId = extractDbId(id)

  try {
    // Check if lecturer is in use in schedules
    const scheduleEntries = await prisma.sectionScheduleEntry.count({
      where: { user_id: dbId },
    })
    if (scheduleEntries > 0) {
      return NextResponse.json(
        { error: `Cannot delete this lecturer because they are assigned to ${scheduleEntries} schedule entries. Remove the schedule entries first.` },
        { status: 409 }
      )
    }

    // Delete lecturer associations
    await prisma.lecturerCanTeachCourse.deleteMany({ where: { user_id: dbId } })
    await prisma.lecturerPreference.deleteMany({ where: { user_id: dbId } })
    await prisma.lecturerOfficeHours.deleteMany({ where: { user_id: dbId } })

    // Delete lecturer (user will be cascade deleted)
    await prisma.user.delete({
      where: { user_id: dbId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lecturer:', error)
    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2025') {
      return NextResponse.json({ error: 'Lecturer not found.' }, { status: 404 })
    }
    if (prismaError?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete this lecturer because they are referenced by other records.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to delete lecturer. Please try again.' },
      { status: 500 }
    )
  }
}
