"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoursesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const academic_level_util_1 = require("./academic-level.util");
let CoursesService = class CoursesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
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
            academicLevel: (0, academic_level_util_1.academicLevelFromCourseCode)(course.course_code),
            deliveryMode: course.delivery_mode,
            department: course.department.dept_name,
            departmentId: course.dept_id,
            sectionsNormal: course.sections_normal,
            sectionsSummer: course.sections_summer,
            isLab: course.is_lab,
        }));
    }
    async findOne(id) {
        const course = await this.prisma.course.findUnique({
            where: { course_id: id },
            include: {
                department: true,
            },
        });
        if (!course) {
            throw new common_1.NotFoundException(`Course with ID ${id} not found`);
        }
        return {
            id: course.course_id,
            code: course.course_code,
            name: course.course_name,
            creditHours: course.credit_hours,
            academicLevel: (0, academic_level_util_1.academicLevelFromCourseCode)(course.course_code),
            deliveryMode: course.delivery_mode,
            department: course.department.dept_name,
            departmentId: course.dept_id,
            sectionsNormal: course.sections_normal,
            sectionsSummer: course.sections_summer,
            isLab: course.is_lab,
        };
    }
    async create(dto) {
        let department = await this.prisma.department.findFirst({
            where: { dept_name: dto.department },
        });
        if (!department) {
            department = await this.prisma.department.create({
                data: { dept_name: dto.department },
            });
        }
        const level = (0, academic_level_util_1.academicLevelFromCourseCode)(dto.code);
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
        }));
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
    async update(id, dto) {
        const existing = await this.prisma.course.findUnique({
            where: { course_id: id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Course with ID ${id} not found`);
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
        const syncedLevel = (0, academic_level_util_1.academicLevelFromCourseCode)(existing.course_code);
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
        }));
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
    async remove(id) {
        const existing = await this.prisma.course.findUnique({
            where: { course_id: id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Course with ID ${id} not found`);
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
            academicLevel: (0, academic_level_util_1.academicLevelFromCourseCode)(course.course_code),
            deliveryMode: course.delivery_mode,
            department: course.department.dept_name,
            departmentId: course.dept_id,
            sectionsNormal: course.sections_normal,
            sectionsSummer: course.sections_summer,
            isLab: course.is_lab,
        }));
    }
    async restoreArchived(id) {
        const course = await this.prisma.course.findUnique({
            where: { course_id: id },
            select: { course_id: true },
        });
        if (!course) {
            throw new common_1.NotFoundException(`Course with ID ${id} not found`);
        }
        await this.prisma.course.update({
            where: { course_id: id },
            data: { is_active: true },
        });
        return { message: 'Course restored successfully' };
    }
    async getDeletionImpact(id) {
        const course = await this.prisma.course.findUnique({
            where: { course_id: id },
            select: { course_id: true, course_code: true, course_name: true },
        });
        if (!course) {
            throw new common_1.NotFoundException(`Course with ID ${id} not found`);
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
    async permanentlyDeleteArchived(id) {
        const course = await this.prisma.course.findUnique({
            where: { course_id: id },
            select: { course_id: true, is_active: true },
        });
        if (!course) {
            throw new common_1.NotFoundException(`Course with ID ${id} not found`);
        }
        if (course.is_active) {
            throw new common_1.ConflictException('Only archived courses can be permanently deleted.');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.sectionScheduleEntry.deleteMany({ where: { course_id: id } });
            await tx.lecturerCanTeachCourse.deleteMany({ where: { course_id: id } });
            await tx.course.delete({ where: { course_id: id } });
        });
        return { message: 'Course permanently deleted successfully' };
    }
};
exports.CoursesService = CoursesService;
exports.CoursesService = CoursesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CoursesService);
//# sourceMappingURL=courses.service.js.map