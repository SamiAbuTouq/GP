"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LecturersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const mail_service_1 = require("../mail/mail.service");
const STANDARD_MAX_WORKLOAD_HOURS = 15;
let LecturersService = class LecturersService {
    constructor(prisma, mailService) {
        this.prisma = prisma;
        this.mailService = mailService;
    }
    generateTemporaryPassword(length = 16) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
        const bytes = (0, crypto_1.randomBytes)(length);
        return Array.from(bytes)
            .map((byte) => chars[byte % chars.length])
            .join('');
    }
    async resolveLatestTimetableId() {
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
        if (timetables.length === 0)
            return null;
        const activeWithAssignments = timetables.find((t) => t.status === 'active' && t._count.section_schedule_entries > 0);
        if (activeWithAssignments)
            return activeWithAssignments.timetable_id;
        const latestWithAssignments = timetables.find((t) => t._count.section_schedule_entries > 0);
        if (latestWithAssignments)
            return latestWithAssignments.timetable_id;
        const latestActive = timetables.find((t) => t.status === 'active');
        return latestActive?.timetable_id ?? timetables[0].timetable_id;
    }
    async teachingLoadByUserIdForTimetable(timetableId) {
        const rows = await this.prisma.sectionScheduleEntry.findMany({
            where: { timetable_id: timetableId },
            distinct: ['user_id', 'course_id', 'section_number'],
            select: {
                user_id: true,
                course: { select: { credit_hours: true } },
            },
        });
        const map = new Map();
        for (const row of rows) {
            const ch = row.course.credit_hours;
            map.set(row.user_id, (map.get(row.user_id) ?? 0) + ch);
        }
        return map;
    }
    async teachingLoadForUserOnTimetable(timetableId, userId) {
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
            : new Map();
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
                maxWorkload: lecturer.max_workload ?? STANDARD_MAX_WORKLOAD_HOURS,
                courses: lecturer.lecturer_can_teach_course.map((c) => c.course.course_code),
                isAvailable: lecturer.is_available,
            };
        });
    }
    async findOne(id) {
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
            throw new common_1.NotFoundException(`Lecturer with ID ${id} not found`);
        }
        const timetableId = await this.resolveLatestTimetableId();
        const load = timetableId !== null
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
    async create(dto) {
        let department = await this.prisma.department.findFirst({
            where: { dept_name: dto.department },
        });
        if (!department) {
            department = await this.prisma.department.create({
                data: { dept_name: dto.department },
            });
        }
        const temporaryPassword = this.generateTemporaryPassword();
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        const nameParts = dto.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                password_hash: hashedPassword,
                must_change_password: true,
                first_name: firstName,
                last_name: lastName,
                role_name: 'LECTURER',
            },
        });
        const lecturer = await this.prisma.lecturer.create({
            data: {
                user_id: user.user_id,
                dept_id: department.dept_id,
                max_workload: dto.maxWorkload ?? STANDARD_MAX_WORKLOAD_HOURS,
                is_available: true,
            },
        });
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
        await this.mailService.sendLecturerWelcomeEmail({
            to: dto.email,
            fullName: dto.name,
            temporaryPassword,
        });
        return {
            id: `LEC${String(lecturer.user_id).padStart(3, '0')}`,
            databaseId: lecturer.user_id,
            name: dto.name,
            email: dto.email,
            department: dto.department,
            departmentId: department.dept_id,
            load: 0,
            maxWorkload: lecturer.max_workload ?? STANDARD_MAX_WORKLOAD_HOURS,
            courses: dto.courses || [],
            isAvailable: true,
        };
    }
    async update(id, dto) {
        const existing = await this.prisma.lecturer.findUnique({
            where: { user_id: id },
            include: { user: true },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Lecturer with ID ${id} not found`);
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
        await this.prisma.lecturer.update({
            where: { user_id: id },
            data: {
                dept_id: deptId,
                ...(dto.maxWorkload !== undefined ? { max_workload: dto.maxWorkload } : {}),
            },
        });
        if (dto.courses !== undefined) {
            await this.prisma.lecturerCanTeachCourse.deleteMany({
                where: { user_id: id },
            });
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
    async remove(id) {
        const existing = await this.prisma.lecturer.findUnique({
            where: { user_id: id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Lecturer with ID ${id} not found`);
        }
        await this.prisma.user.delete({
            where: { user_id: id },
        });
        return { message: 'Lecturer deleted successfully' };
    }
};
exports.LecturersService = LecturersService;
exports.LecturersService = LecturersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mail_service_1.MailService])
], LecturersService);
//# sourceMappingURL=lecturers.service.js.map