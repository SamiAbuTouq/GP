import { Injectable, NotFoundException } from '@nestjs/common';
import type { DeliveryMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { academicLevelFromCourseCode } from './academic-level.util';

type CourseWithDepartment = {
  course_id: number;
  course_code: string;
  course_name: string;
  credit_hours: number;
  academic_level: number;
  delivery_mode: DeliveryMode;
  dept_id: number;
  sections: number;
  department: { dept_name: string };
};

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const courses = await this.prisma.course.findMany({
      include: {
        department: true,
      },
      orderBy: { course_code: 'asc' },
    });

    return courses.map((course) => ({
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      creditHours: course.credit_hours,
      academicLevel: academicLevelFromCourseCode(course.course_code),
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      sections: course.sections,
    }));
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: id },
      include: {
        department: true,
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
      academicLevel: academicLevelFromCourseCode(course.course_code),
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      sections: course.sections,
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

    const level = academicLevelFromCourseCode(dto.code);

    const course = (await this.prisma.course.create({
      data: {
        course_code: dto.code,
        course_name: dto.name,
        credit_hours: dto.creditHours,
        academic_level: level,
        delivery_mode: dto.deliveryMode as DeliveryMode,
        dept_id: department.dept_id,
        sections: dto.sections ?? 1,
      },
      include: {
        department: true,
      },
    })) as CourseWithDepartment;

    return {
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      creditHours: course.credit_hours,
      academicLevel: level,
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      sections: course.sections,
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

    const syncedLevel = academicLevelFromCourseCode(existing.course_code);

    const course = (await this.prisma.course.update({
      where: { course_id: id },
      data: {
        ...(dto.name !== undefined ? { course_name: dto.name } : {}),
        ...(dto.creditHours !== undefined ? { credit_hours: dto.creditHours } : {}),
        academic_level: syncedLevel,
        ...(dto.deliveryMode !== undefined
          ? { delivery_mode: dto.deliveryMode as DeliveryMode }
          : {}),
        dept_id: deptId,
        ...(dto.sections !== undefined ? { sections: dto.sections } : {}),
      },
      include: {
        department: true,
      },
    })) as CourseWithDepartment;

    return {
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      creditHours: course.credit_hours,
      academicLevel: syncedLevel,
      deliveryMode: course.delivery_mode,
      department: course.department.dept_name,
      departmentId: course.dept_id,
      sections: course.sections,
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
