import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLecturerDto, UpdateLecturerDto } from './dto/lecturer.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';

/** Policy max workload (hours) shown and stored for all lecturers. */
const STANDARD_MAX_WORKLOAD_HOURS = 15;

@Injectable()
export class LecturersService {
  private readonly logger = new Logger(LecturersService.name);

  constructor(
    private prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private generateTemporaryPassword(length = 16): string {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    const bytes = randomBytes(length);
    return Array.from(bytes)
      .map((byte) => chars[byte % chars.length])
      .join('');
  }

  /**
   * Resolve the latest schedule stored in DB.
   * Prefer an `active` timetable with section assignments; otherwise fall back
   * to the newest timetable that contains section assignments.
   */
  private async resolveLatestTimetableId(): Promise<number | null> {
    const timetables = await this.prisma.timetable.findMany({
      include: {
        _count: {
          select: { section_schedule_entries: true },
        },
      },
      orderBy: [
        { generated_at: 'desc' },
        { version_number: 'desc' },
        { timetable_id: 'desc' },
      ],
    });

    if (timetables.length === 0) return null;

    const activeWithAssignments = timetables.find(
      (t) => t.status === 'active' && t._count.section_schedule_entries > 0,
    );
    if (activeWithAssignments) return activeWithAssignments.timetable_id;

    const latestWithAssignments = timetables.find(
      (t) => t._count.section_schedule_entries > 0,
    );
    if (latestWithAssignments) return latestWithAssignments.timetable_id;

    const latestActive = timetables.find((t) => t.status === 'active');
    return latestActive?.timetable_id ?? timetables[0].timetable_id;
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
      if (row.user_id == null) {
        continue;
      }
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
    const timetableId = await this.resolveLatestTimetableId();
    const loadByUserId = timetableId
      ? await this.teachingLoadByUserIdForTimetable(timetableId)
      : new Map<number, number>();

    const lecturers = await this.prisma.lecturer.findMany({
      where: { user: { is_active: true } },
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
        maxWorkload: lecturer.max_workload ?? STANDARD_MAX_WORKLOAD_HOURS,
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
    if (!lecturer.user.is_active) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }

    const timetableId = await this.resolveLatestTimetableId();
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
      maxWorkload: lecturer.max_workload ?? STANDARD_MAX_WORKLOAD_HOURS,
      courses: lecturer.lecturer_can_teach_course.map((c) => c.course.course_code),
      isAvailable: lecturer.is_available,
    };
  }

  async create(dto: CreateLecturerDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { user_id: true, role_name: true },
    });

    if (existingUser) {
      const existingLecturer = await this.prisma.lecturer.findUnique({
        where: { user_id: existingUser.user_id },
        select: { user_id: true },
      });
      if (existingLecturer) {
        throw new ConflictException(
          'A lecturer with this email already exists.',
        );
      }
      throw new ConflictException(
        'This email is already registered to another account. Use a different email or update the existing user.',
      );
    }

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
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const nameParts = dto.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    let user: { user_id: number };
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          password_hash: hashedPassword,
          must_change_password: true,
          first_name: firstName,
          last_name: lastName,
          role_name: 'LECTURER',
        },
        select: { user_id: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const targets = (e.meta?.target as string[] | undefined) ?? [];
        if (targets.includes('email')) {
          throw new ConflictException(
            'A user with this email already exists.',
          );
        }
        throw new ConflictException('This record conflicts with existing data.');
      }
      throw e;
    }

    // Create lecturer
    const lecturer = await this.prisma.lecturer.create({
      data: {
        user_id: user.user_id,
        dept_id: department.dept_id,
        max_workload: dto.maxWorkload ?? STANDARD_MAX_WORKLOAD_HOURS,
        is_available: true,
      },
    });

    // Add courses the lecturer can teach
    if (dto.courses && dto.courses.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: { course_code: { in: dto.courses }, is_active: true },
      });

      await this.prisma.lecturerCanTeachCourse.createMany({
        data: courses.map((course) => ({
          user_id: user.user_id,
          course_id: course.course_id,
        })),
      });
    }

    try {
      await this.mailService.sendLecturerWelcomeEmail({
        to: email,
        fullName: dto.name,
        temporaryPassword,
      });
    } catch (error) {
      // Email delivery should not block successful lecturer creation.
      this.logger.warn(
        `Lecturer ${user.user_id} was created but welcome email failed for ${email}.`,
      );
      this.logger.debug(
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
    }

    return {
      id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
      databaseId: lecturer.user_id,
      name: dto.name,
      email,
      department: dto.department,
      departmentId: department.dept_id,
      load: 0,
      maxWorkload: lecturer.max_workload ?? STANDARD_MAX_WORKLOAD_HOURS,
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
        ...(dto.maxWorkload !== undefined ? { max_workload: dto.maxWorkload } : {}),
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
          where: { course_code: { in: dto.courses }, is_active: true },
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
      include: { user: { select: { is_active: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }

    if (!existing.user.is_active) {
      return { message: 'Lecturer already deactivated' };
    }

    await this.prisma.user.update({
      where: { user_id: id },
      data: { is_active: false },
    });

    return { message: 'Lecturer deactivated successfully' };
  }

  async findDeactivated() {
    const lecturers = await this.prisma.lecturer.findMany({
      where: { user: { is_active: false } },
      include: {
        user: true,
        department: true,
      },
      orderBy: { user: { first_name: 'asc' } },
    });

    return lecturers.map((lecturer) => ({
      id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
      databaseId: lecturer.user_id,
      name: `${lecturer.user.first_name} ${lecturer.user.last_name}`,
      email: lecturer.user.email,
      department: lecturer.department.dept_name,
      departmentId: lecturer.dept_id,
      maxWorkload: lecturer.max_workload ?? STANDARD_MAX_WORKLOAD_HOURS,
      isAvailable: lecturer.is_available,
    }));
  }

  async reactivate(id: number) {
    const existing = await this.prisma.lecturer.findUnique({
      where: { user_id: id },
      include: { user: { select: { user_id: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }

    await this.prisma.user.update({
      where: { user_id: id },
      data: { is_active: true },
    });
    return { message: 'Lecturer reactivated successfully' };
  }

  async getPurgeImpact(id: number) {
    const lecturer = await this.prisma.lecturer.findUnique({
      where: { user_id: id },
      include: {
        user: { select: { first_name: true, last_name: true, is_active: true } },
      },
    });
    if (!lecturer) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }

    const entries = await this.prisma.sectionScheduleEntry.findMany({
      where: { user_id: id },
      select: {
        timetable_id: true,
        timetable: {
          select: { generation_type: true, status: true, version_number: true },
        },
      },
      distinct: ['timetable_id'],
      orderBy: { timetable_id: 'asc' },
    });

    return {
      lecturerUserId: id,
      lecturerName: `${lecturer.user.first_name} ${lecturer.user.last_name}`.trim(),
      isActive: lecturer.user.is_active,
      entryCount: await this.prisma.sectionScheduleEntry.count({ where: { user_id: id } }),
      timetables: entries.map((entry) => ({
        timetableId: entry.timetable_id,
        generationType: entry.timetable.generation_type,
        status: entry.timetable.status,
        versionNumber: entry.timetable.version_number,
      })),
    };
  }

  async purgeDeactivated(id: number) {
    const lecturer = await this.prisma.lecturer.findUnique({
      where: { user_id: id },
      include: {
        user: { select: { first_name: true, last_name: true, is_active: true } },
      },
    });
    if (!lecturer) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }
    if (lecturer.user.is_active) {
      throw new ConflictException('Deactivate lecturer before purging.');
    }

    const fullName = `${lecturer.user.first_name} ${lecturer.user.last_name}`.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.sectionScheduleEntry.updateMany({
        where: { user_id: id },
        data: {
          lecturer_name_snapshot: fullName,
          user_id: null,
        },
      });
      await tx.user.delete({
        where: { user_id: id },
      });
    });

    return { message: 'Lecturer purged successfully' };
  }
}
