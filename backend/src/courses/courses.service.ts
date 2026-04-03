import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const courses = await this.prisma.course.findMany({
      include: {
        department: true,
        _count: {
          select: { section_schedule_entries: true },
        },
      },
      orderBy: { course_code: 'asc' },
    });

    return courses.map((course) => ({
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      creditHours: course.credit_hours,
      academicLevel: course.academic_level,
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      sections: course._count.section_schedule_entries,
    }));
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: id },
      include: {
        department: true,
        _count: {
          select: { section_schedule_entries: true },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return {
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      creditHours: course.credit_hours,
      academicLevel: course.academic_level,
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      sections: course._count.section_schedule_entries,
    };
  }

  async create(dto: CreateCourseDto) {
    // Find or create department
    let department = await this.prisma.department.findFirst({
      where: { dept_name: dto.department },
    });

    if (!department) {
      department = await this.prisma.department.create({
        data: { dept_name: dto.department },
      });
    }

    const course = await this.prisma.course.create({
      data: {
        course_code: dto.code,
        course_name: dto.name,
        credit_hours: dto.creditHours,
        academic_level: dto.academicLevel,
        delivery_mode: dto.deliveryMode,
        dept_id: department.dept_id,
      },
      include: {
        department: true,
      },
    });

    return {
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      creditHours: course.credit_hours,
      academicLevel: course.academic_level,
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      sections: 0,
    };
  }

  async update(id: number, dto: UpdateCourseDto) {
    const existing = await this.prisma.course.findUnique({
      where: { course_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

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

    const course = await this.prisma.course.update({
      where: { course_id: id },
      data: {
        course_name: dto.name,
        credit_hours: dto.creditHours,
        academic_level: dto.academicLevel,
        delivery_mode: dto.deliveryMode,
        dept_id: deptId,
      },
      include: {
        department: true,
        _count: {
          select: { section_schedule_entries: true },
        },
      },
    });

    return {
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      creditHours: course.credit_hours,
      academicLevel: course.academic_level,
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      sections: course._count.section_schedule_entries,
    };
  }

  async remove(id: number) {
    const existing = await this.prisma.course.findUnique({
      where: { course_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    await this.prisma.course.delete({
      where: { course_id: id },
    });

    return { message: 'Course deleted successfully' };
  }
}
