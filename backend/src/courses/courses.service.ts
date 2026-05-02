import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  is_lab: boolean;
  delivery_mode: DeliveryMode;
  dept_id: number;
  sections_normal: number;
  sections_summer: number;
  department: { dept_name: string };
};

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const courses = await this.prisma.course.findMany({
      where: { is_active: true },
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
      sectionsNormal: course.sections_normal,
      sectionsSummer: course.sections_summer,
      isLab: course.is_lab,
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
      sectionsNormal: course.sections_normal,
      sectionsSummer: course.sections_summer,
      isLab: course.is_lab,
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
        delivery_mode: dto.deliveryMode,
        dept_id: department.dept_id,
        sections_normal: dto.sectionsNormal ?? 1,
        sections_summer: dto.sectionsSummer ?? 0,
        is_lab: dto.isLab ?? false,
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
      sectionsNormal: course.sections_normal,
      sectionsSummer: course.sections_summer,
      isLab: course.is_lab,
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
        ...(dto.deliveryMode !== undefined ? { delivery_mode: dto.deliveryMode } : {}),
        dept_id: deptId,
        ...(dto.sectionsNormal !== undefined ? { sections_normal: dto.sectionsNormal } : {}),
        ...(dto.sectionsSummer !== undefined ? { sections_summer: dto.sectionsSummer } : {}),
        ...(dto.isLab !== undefined ? { is_lab: dto.isLab } : {}),
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
      sectionsNormal: course.sections_normal,
      sectionsSummer: course.sections_summer,
      isLab: course.is_lab,
    };
  }

  async remove(id: number) {
    const existing = await this.prisma.course.findUnique({
      where: { course_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    await this.prisma.course.update({
      where: { course_id: id },
      data: { is_active: false },
    });

    return { message: 'Course archived successfully', archived: true };
  }

  async findArchived() {
    const courses = await this.prisma.course.findMany({
      where: { is_active: false },
      include: { department: true },
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
      sectionsNormal: course.sections_normal,
      sectionsSummer: course.sections_summer,
      isLab: course.is_lab,
    }));
  }

  async restoreArchived(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: id },
      select: { course_id: true },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    await this.prisma.course.update({
      where: { course_id: id },
      data: { is_active: true },
    });

    return { message: 'Course restored successfully' };
  }

  async getDeletionImpact(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: id },
      select: { course_id: true, course_code: true, course_name: true },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    const entries = await this.prisma.sectionScheduleEntry.findMany({
      where: { course_id: id },
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
      courseId: course.course_id,
      courseCode: course.course_code,
      courseName: course.course_name,
      entryCount: await this.prisma.sectionScheduleEntry.count({ where: { course_id: id } }),
      timetables: entries.map((entry) => ({
        timetableId: entry.timetable_id,
        generationType: entry.timetable.generation_type,
        status: entry.timetable.status,
        versionNumber: entry.timetable.version_number,
      })),
    };
  }

  async permanentlyDeleteArchived(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: id },
      select: { course_id: true, is_active: true },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    if (course.is_active) {
      throw new ConflictException('Only archived courses can be permanently deleted.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sectionScheduleEntry.deleteMany({ where: { course_id: id } });
      await tx.lecturerCanTeachCourse.deleteMany({ where: { course_id: id } });
      await tx.course.delete({ where: { course_id: id } });
    });

    return { message: 'Course permanently deleted successfully' };
  }
}
