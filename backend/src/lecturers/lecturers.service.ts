import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLecturerDto, UpdateLecturerDto } from './dto/lecturer.dto';
import * as bcrypt from 'bcrypt';

/** Policy max workload (hours) shown and stored for all lecturers. */
const STANDARD_MAX_WORKLOAD_HOURS = 15;

@Injectable()
export class LecturersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Timetable for the current academic term (by semester date range), else the most recently started term.
   * Prefers an `active` timetable when several exist for that semester.
   */
  private async resolveCurrentTimetableId(): Promise<number | null> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let semester = await this.prisma.semester.findFirst({
      where: {
        start_date: { lte: today },
        end_date: { gte: today },
      },
      orderBy: { start_date: 'desc' },
    });

    if (!semester) {
      semester = await this.prisma.semester.findFirst({
        orderBy: { start_date: 'desc' },
      });
    }

    if (!semester) return null;

    const timetables = await this.prisma.timetable.findMany({
      where: { semester_id: semester.semester_id },
      orderBy: [{ version_number: 'desc' }, { generated_at: 'desc' }],
    });
    const timetable = timetables.find((t) => t.status === 'active') ?? timetables[0];
    return timetable?.timetable_id ?? null;
  }

  /**
   * Per section on the timetable: add that course's credit hours.
   * Two sections of the same course → 2 × credit hours (e.g. 2×3 = 6).
   * Distinct (user, course, section_number) so multiple slot rows for one section count once.
   */
  private async teachingLoadByUserIdForTimetable(
    timetableId: number,
  ): Promise<Map<number, number>> {
    const rows = await this.prisma.sectionScheduleEntry.findMany({
      where: { timetable_id: timetableId },
      distinct: ['user_id', 'course_id', 'section_number'],
      select: {
        user_id: true,
        course: { select: { credit_hours: true } },
      },
    });

    const map = new Map<number, number>();
    for (const row of rows) {
      const ch = row.course.credit_hours;
      map.set(row.user_id, (map.get(row.user_id) ?? 0) + ch);
    }
    return map;
  }

  private async teachingLoadForUserOnTimetable(
    timetableId: number,
    userId: number,
  ): Promise<number> {
    const rows = await this.prisma.sectionScheduleEntry.findMany({
      where: { timetable_id: timetableId, user_id: userId },
      distinct: ['course_id', 'section_number'],
      select: { course: { select: { credit_hours: true } } },
    });
    return rows.reduce((acc, row) => acc + row.course.credit_hours, 0);
  }

  async findAll() {
    const timetableId = await this.resolveCurrentTimetableId();
    const loadByUserId = timetableId
      ? await this.teachingLoadByUserIdForTimetable(timetableId)
      : new Map<number, number>();

    const lecturers = await this.prisma.lecturer.findMany({
      include: {
        user: true,
        department: true,
        lecturer_can_teach_course: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { user: { first_name: 'asc' } },
    });

    return lecturers.map((lecturer) => {
      return {
        id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
        databaseId: lecturer.user_id,
        name: `${lecturer.user.first_name} ${lecturer.user.last_name}`,
        email: lecturer.user.email,
        department: lecturer.department.dept_name,
        departmentId: lecturer.dept_id,
        load: loadByUserId.get(lecturer.user_id) ?? 0,
        maxWorkload: STANDARD_MAX_WORKLOAD_HOURS,
        courses: lecturer.lecturer_can_teach_course.map((c) => c.course.course_code),
        isAvailable: lecturer.is_available,
      };
    });
  }

  async findOne(id: number) {
    const lecturer = await this.prisma.lecturer.findUnique({
      where: { user_id: id },
      include: {
        user: true,
        department: true,
        lecturer_can_teach_course: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lecturer) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }

    const timetableId = await this.resolveCurrentTimetableId();
    const load =
      timetableId !== null
        ? await this.teachingLoadForUserOnTimetable(timetableId, lecturer.user_id)
        : 0;

    return {
      id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
      databaseId: lecturer.user_id,
      name: `${lecturer.user.first_name} ${lecturer.user.last_name}`,
      email: lecturer.user.email,
      department: lecturer.department.dept_name,
      departmentId: lecturer.dept_id,
      load,
      maxWorkload: STANDARD_MAX_WORKLOAD_HOURS,
      courses: lecturer.lecturer_can_teach_course.map((c) => c.course.course_code),
      isAvailable: lecturer.is_available,
    };
  }

  async create(dto: CreateLecturerDto) {
    // Find or create department
    let department = await this.prisma.department.findFirst({
      where: { dept_name: dto.department },
    });

    if (!department) {
      department = await this.prisma.department.create({
        data: { dept_name: dto.department },
      });
    }

    // Create user first
    const hashedPassword = await bcrypt.hash('tempPassword123', 10);
    const nameParts = dto.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role_name: 'LECTURER',
      },
    });

    // Create lecturer
    const lecturer = await this.prisma.lecturer.create({
      data: {
        user_id: user.user_id,
        dept_id: department.dept_id,
        max_workload: STANDARD_MAX_WORKLOAD_HOURS,
        is_available: true,
      },
    });

    // Add courses the lecturer can teach
    if (dto.courses && dto.courses.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: { course_code: { in: dto.courses } },
      });

      await this.prisma.lecturerCanTeachCourse.createMany({
        data: courses.map((course) => ({
          user_id: user.user_id,
          course_id: course.course_id,
        })),
      });
    }

    return {
      id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
      databaseId: lecturer.user_id,
      name: dto.name,
      email: dto.email,
      department: dto.department,
      departmentId: department.dept_id,
      load: 0,
      maxWorkload: STANDARD_MAX_WORKLOAD_HOURS,
      courses: dto.courses || [],
      isAvailable: true,
    };
  }

  async update(id: number, dto: UpdateLecturerDto) {
    const existing = await this.prisma.lecturer.findUnique({
      where: { user_id: id },
      include: { user: true },
    });

    if (!existing) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }

    // Update department if provided
    let deptId = existing.dept_id;
    if (dto.department) {
      let department = await this.prisma.department.findFirst({
        where: { dept_name: dto.department },
      });

      if (!department) {
        department = await this.prisma.department.create({
          data: { dept_name: dto.department },
        });
      }
      deptId = department.dept_id;
    }

    // Update user info
    if (dto.name || dto.email) {
      const nameParts = dto.name?.split(' ') || [];
      await this.prisma.user.update({
        where: { user_id: id },
        data: {
          ...(dto.name && {
            first_name: nameParts[0] || existing.user.first_name,
            last_name: nameParts.slice(1).join(' ') || existing.user.last_name,
          }),
          ...(dto.email && { email: dto.email }),
        },
      });
    }

    // Update lecturer
    await this.prisma.lecturer.update({
      where: { user_id: id },
      data: {
        dept_id: deptId,
        max_workload: STANDARD_MAX_WORKLOAD_HOURS,
      },
    });

    // Update courses if provided
    if (dto.courses !== undefined) {
      // Remove existing course assignments
      await this.prisma.lecturerCanTeachCourse.deleteMany({
        where: { user_id: id },
      });

      // Add new course assignments
      if (dto.courses.length > 0) {
        const courses = await this.prisma.course.findMany({
          where: { course_code: { in: dto.courses } },
        });

        await this.prisma.lecturerCanTeachCourse.createMany({
          data: courses.map((course) => ({
            user_id: id,
            course_id: course.course_id,
          })),
        });
      }
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.prisma.lecturer.findUnique({
      where: { user_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }

    // Delete lecturer (user will cascade)
    await this.prisma.user.delete({
      where: { user_id: id },
    });

    return { message: 'Lecturer deleted successfully' };
  }
}
