import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'

export async function GET() {
  try {
    const lecturers = await prisma.lecturer.findMany({
      include: {
        user: true,
        department: true,
        lecturer_can_teach_course: {
          include: {
            course: true,
          },
        },
      },
      orderBy: {
        user: {
          last_name: 'asc',
        },
      },
    })

    // Transform to match frontend expected format
    const transformedLecturers = lecturers.map(lecturer => ({
      id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
      databaseId: lecturer.user_id,
      name: `${lecturer.user.first_name} ${lecturer.user.last_name}`.trim(),
      email: lecturer.user.email,
      department: lecturer.department.dept_name,
      departmentId: lecturer.dept_id,
      load: 0, // Calculate from schedule if needed
      maxWorkload: lecturer.max_workload,
      courses: lecturer.lecturer_can_teach_course.map(ltc => ltc.course.course_code),
      isAvailable: lecturer.is_available,
    }))

    return NextResponse.json(transformedLecturers)
  } catch (error) {
    console.error('Error fetching lecturers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lecturers. Please check database connection.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    const name = (body.name || '').trim()
    const email = (body.email || '').trim().toLowerCase()

    if (!name) {
      return NextResponse.json(
        { error: 'Lecturer name is required.' },
        { status: 400 }
      )
    }

    if (name.split(/\s+/).length < 2) {
      return NextResponse.json(
        { error: 'Please enter both first name and last name.' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required.' },
        { status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    // Validate max workload
    const maxWorkload = Number(body.maxWorkload) || 18
    if (maxWorkload < 1 || maxWorkload > 40) {
      return NextResponse.json(
        { error: 'Max workload must be between 1 and 40 hours.' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: `A user with email "${email}" already exists. Please use a different email.` },
        { status: 409 }
      )
    }

    // Parse name into first and last name
    const nameParts = name.split(/\s+/)
    const firstName = nameParts[0] || 'Unknown'
    const lastName = nameParts.slice(1).join(' ') || ''

    // Check if a lecturer with the same name already exists
    const existingLecturerByName = await prisma.user.findFirst({
      where: {
        first_name: firstName,
        last_name: lastName,
        role_name: 'LECTURER',
      },
    })

    if (existingLecturerByName) {
      return NextResponse.json(
        { error: `A lecturer named "${name}" already exists. Please use a different name.` },
        { status: 409 }
      )
    }

    // Validate department
    if (!body.department && !body.departmentId) {
      return NextResponse.json(
        { error: 'Department is required. Please select a department.' },
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
        const newDept = await prisma.department.create({
          data: { dept_name: body.department },
        })
        deptId = newDept.dept_id
      }
    }

    if (!deptId) {
      return NextResponse.json(
        { error: 'Department is required. Please select a department for this lecturer.' },
        { status: 400 }
      )
    }

    const defaultPassword = 'DefaultPassword0!'
    const passwordHash = await bcrypt.hash(defaultPassword, 12)

    // Create user first
    const user = await prisma.user.create({
      data: {
        email: email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role_name: 'LECTURER',
      },
    })

    // Create lecturer record
    const lecturer = await prisma.lecturer.create({
      data: {
        user_id: user.user_id,
        dept_id: deptId,
        max_workload: maxWorkload,
        is_available: true,
      },
      include: {
        user: true,
        department: true,
      },
    })

    // Add courses if provided
    if (body.courses && body.courses.length > 0) {
      const courses = await prisma.course.findMany({
        where: { course_code: { in: body.courses } },
      })

      if (courses.length > 0) {
        await prisma.lecturerCanTeachCourse.createMany({
          data: courses.map(course => ({
            user_id: user.user_id,
            course_id: course.course_id,
          })),
        })
      }

      // Warn if some courses were not found
      if (courses.length < body.courses.length) {
        const foundCodes = courses.map(c => c.course_code)
        const notFound = body.courses.filter((c: string) => !foundCodes.includes(c))
        console.warn(`Some courses were not found: ${notFound.join(', ')}`)
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
    console.error('Error creating lecturer:', error)
    const prismaError = error as { code?: string; meta?: { target?: string[] } }
    if (prismaError?.code === 'P2002') {
      const field = prismaError?.meta?.target?.[0]
      if (field === 'email') {
        return NextResponse.json({ error: 'A user with this email address already exists.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'A lecturer with these details already exists.' }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Failed to create lecturer. Please try again.' },
      { status: 500 }
    )
  }
}
