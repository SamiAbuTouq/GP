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
exports.TimetablesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function decodeSemesterType(type) {
    const map = {
        1: 'First Semester',
        2: 'Second Semester',
        3: 'Summer Semester',
    };
    return map[type] ?? `Semester ${type}`;
}
function formatTimeHHmm(d) {
    return d.toISOString().slice(11, 16);
}
const dayByBit = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
};
function decodeDaysMask(daysMask) {
    const days = [];
    for (let bit = 0; bit <= 6; bit += 1) {
        if (((daysMask >> bit) & 1) === 1) {
            const label = dayByBit[bit];
            if (label)
                days.push(label);
        }
    }
    return days;
}
let TimetablesService = class TimetablesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(semesterId) {
        const timetables = await this.prisma.timetable.findMany({
            where: semesterId ? { semester_id: semesterId } : undefined,
            include: {
                semester: true,
                timetable_metrics: true,
            },
            orderBy: [{ generated_at: 'desc' }, { timetable_id: 'desc' }],
        });
        return timetables.map((t) => ({
            timetableId: t.timetable_id,
            semesterId: t.semester_id,
            academicYear: t.semester.academic_year,
            semesterType: t.semester.semester_type,
            semester: decodeSemesterType(t.semester.semester_type),
            generatedAt: t.generated_at,
            status: t.status,
            generationType: t.generation_type,
            versionNumber: t.version_number,
            metrics: t.timetable_metrics
                ? {
                    roomUtilizationRate: t.timetable_metrics.room_utilization_rate,
                    softConstraintsScore: t.timetable_metrics.soft_constraints_score,
                    fitnessScore: t.timetable_metrics.fitness_score,
                    isValid: t.timetable_metrics.is_valid,
                    totalStudents: t.timetable_metrics.total_students,
                }
                : null,
        }));
    }
    async listEntries(params) {
        const timetable = await this.prisma.timetable.findUnique({
            where: { timetable_id: params.timetableId },
            select: { timetable_id: true },
        });
        if (!timetable) {
            throw new common_1.NotFoundException(`Timetable with ID ${params.timetableId} not found`);
        }
        const entries = await this.prisma.sectionScheduleEntry.findMany({
            where: {
                timetable_id: params.timetableId,
                ...(params.courseId ? { course_id: params.courseId } : {}),
                ...(params.lecturerUserId ? { user_id: params.lecturerUserId } : {}),
                ...(params.roomId ? { room_id: params.roomId } : {}),
            },
            include: {
                course: true,
                room: true,
                timeslot: true,
                lecturer: {
                    include: {
                        user: true,
                    },
                },
            },
            orderBy: [{ slot_id: 'asc' }, { course_id: 'asc' }, { section_number: 'asc' }],
        });
        return entries.map((e) => ({
            entryId: e.entry_id,
            timetableId: e.timetable_id,
            slotId: e.slot_id,
            courseId: e.course_id,
            courseCode: e.course.course_code,
            courseName: e.course.course_name,
            lecturerUserId: e.user_id,
            lecturerName: `${e.lecturer.user.first_name} ${e.lecturer.user.last_name}`.trim(),
            roomId: e.room_id,
            roomNumber: e.room.room_number,
            daysMask: e.timeslot.days_mask,
            days: decodeDaysMask(e.timeslot.days_mask),
            startTime: formatTimeHHmm(e.timeslot.start_time),
            endTime: formatTimeHHmm(e.timeslot.end_time),
            sectionNumber: e.section_number,
            isLab: e.is_lab,
            registeredStudents: e.registered_students,
            sectionCapacity: e.section_capacity,
        }));
    }
};
exports.TimetablesService = TimetablesService;
exports.TimetablesService = TimetablesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TimetablesService);
//# sourceMappingURL=timetables.service.js.map