import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLecturerDto, UpdateLecturerDto } from './dto/lecturer.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class LecturersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const lecturers = await this.prisma.lecturer.findMany({
      include: {
        user: true,
        department: true,
        lecturer_can_teach_course: {
          include: {
            course: true,
          },
        },
        section_schedule_entries: true,
      },
      orderBy: { user: { first_name: 'asc' } },
    });

    return lecturers.map((lecturer) => {
      // Calculate teaching load based on assigned sections * credit hours
      const teachingLoad = lecturer.section_schedule_entries.reduce((acc, entry) => {
        return acc + 3; // Assuming 3 credit hours per section for now
      }, 0);

      return {
        id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
        databaseId: lecturer.user_id,
        name: `${lecturer.user.first_name} ${lecturer.user.last_name}`,
        email: lecturer.user.email,
        department: lecturer.department.dept_name,
        departmentId: lecturer.dept_id,
        load: teachingLoad,
        maxWorkload: lecturer.max_workload,
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
        section_schedule_entries: true,
      },
    });

    if (!lecturer) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }

    const teachingLoad = lecturer.section_schedule_entries.reduce((acc) => acc + 3, 0);

    return {
      id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
      databaseId: lecturer.user_id,
      name: `${lecturer.user.first_name} ${lecturer.user.last_name}`,
      email: lecturer.user.email,
      department: lecturer.department.dept_name,
      departmentId: lecturer.dept_id,
      load: teachingLoad,
      maxWorkload: lecturer.max_workload,
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
        max_workload: dto.maxWorkload,
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
      maxWorkload: dto.maxWorkload,
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
        ...(dto.maxWorkload !== undefined && { max_workload: dto.maxWorkload }),
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
