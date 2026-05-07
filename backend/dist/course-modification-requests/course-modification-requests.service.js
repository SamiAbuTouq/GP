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
exports.CourseModificationRequestsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_prefs_1 = require("../notifications/notification-prefs");
let CourseModificationRequestsService = class CourseModificationRequestsService {
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
    }
    normalizeCourseIds(input) {
        const ids = Array.isArray(input)
            ? input
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
            : [];
        return [...new Set(ids)];
    }
    parseCourseIds(raw) {
        if (!Array.isArray(raw))
            return [];
        return raw
            .map((v) => Number(v))
            .filter((id) => Number.isInteger(id) && id > 0);
    }
    mapCourse(course) {
        return {
            courseId: course.course_id,
            code: course.course_code,
            name: course.course_name,
            level: course.academic_level,
            department: course.department.dept_name,
        };
    }
    async mapRequest(row) {
        const addIds = this.parseCourseIds(row.courses_to_add);
        const removeIds = this.parseCourseIds(row.courses_to_remove);
        const requestedIds = [...new Set([...addIds, ...removeIds])];
        const courses = requestedIds.length
            ? await this.prisma.course.findMany({
                where: { course_id: { in: requestedIds } },
                include: { department: true },
            })
            : [];
        const byId = new Map(courses.map((c) => [c.course_id, this.mapCourse(c)]));
        const authorizedRows = await this.prisma.lecturerCanTeachCourse.findMany({
            where: { user_id: row.lecturer_user_id },
            include: {
                course: {
                    include: { department: true },
                },
            },
            orderBy: [{ course: { course_code: "asc" } }],
        });
        return {
            requestId: row.request_id,
            lecturerUserId: row.lecturer_user_id,
            lecturerName: `${row.lecturer.user.first_name} ${row.lecturer.user.last_name}`.trim(),
            lecturerEmail: row.lecturer.user.email,
            lecturerDepartment: row.lecturer.department.dept_name,
            addCourses: addIds
                .map((id) => byId.get(id))
                .filter((c) => Boolean(c)),
            removeCourses: removeIds
                .map((id) => byId.get(id))
                .filter((c) => Boolean(c)),
            note: row.note,
            status: row.status,
            rejectionReason: row.rejection_reason,
            submittedAt: row.submitted_at.toISOString(),
            reviewedAt: row.reviewed_at?.toISOString() ?? null,
            authorizedCourses: authorizedRows.map((r) => this.mapCourse(r.course)),
        };
    }
    async getMyAuthorizedCourses(lecturerUserId) {
        const lecturer = await this.prisma.lecturer.findUnique({
            where: { user_id: lecturerUserId },
            select: { user_id: true },
        });
        if (!lecturer)
            throw new common_1.NotFoundException("Lecturer profile not found.");
        const rows = await this.prisma.lecturerCanTeachCourse.findMany({
            where: { user_id: lecturerUserId },
            include: {
                course: {
                    include: { department: true },
                },
            },
            orderBy: [{ course: { course_code: "asc" } }],
        });
        return rows.map((r) => this.mapCourse(r.course));
    }
    async getCatalogForLecturer(lecturerUserId) {
        const lecturer = await this.prisma.lecturer.findUnique({
            where: { user_id: lecturerUserId },
            select: { user_id: true },
        });
        if (!lecturer)
            throw new common_1.NotFoundException("Lecturer profile not found.");
        const rows = await this.prisma.course.findMany({
            where: { is_active: true },
            include: { department: true },
            orderBy: { course_code: "asc" },
        });
        return rows.map((c) => this.mapCourse(c));
    }
    async createForLecturer(lecturerUserId, dto) {
        const lecturer = await this.prisma.lecturer.findUnique({
            where: { user_id: lecturerUserId },
            select: { user_id: true },
        });
        if (!lecturer)
            throw new common_1.NotFoundException("Lecturer profile not found.");
        const addCourseIds = this.normalizeCourseIds(dto.addCourseIds);
        const removeCourseIds = this.normalizeCourseIds(dto.removeCourseIds);
        if (addCourseIds.length === 0 && removeCourseIds.length === 0) {
            throw new common_1.BadRequestException("At least one course must be selected to add or remove.");
        }
        if (addCourseIds.some((id) => removeCourseIds.includes(id))) {
            throw new common_1.BadRequestException("A course cannot be requested for both add and remove.");
        }
        const authorizedRows = await this.prisma.lecturerCanTeachCourse.findMany({
            where: { user_id: lecturerUserId },
            select: { course_id: true },
        });
        const authorized = new Set(authorizedRows.map((r) => r.course_id));
        const invalidRemovals = removeCourseIds.filter((id) => !authorized.has(id));
        if (invalidRemovals.length > 0) {
            throw new common_1.BadRequestException("Remove list must only include currently authorized courses.");
        }
        const invalidAdds = addCourseIds.filter((id) => authorized.has(id));
        if (invalidAdds.length > 0) {
            throw new common_1.BadRequestException("Add list cannot include already authorized courses.");
        }
        const requestedIds = [...new Set([...addCourseIds, ...removeCourseIds])];
        const existingCourses = requestedIds.length
            ? await this.prisma.course.findMany({
                where: { course_id: { in: requestedIds }, is_active: true },
                select: { course_id: true },
            })
            : [];
        if (existingCourses.length !== requestedIds.length) {
            throw new common_1.BadRequestException("One or more selected courses are invalid.");
        }
        const created = await this.prisma.courseModificationRequest.create({
            data: {
                lecturer_user_id: lecturerUserId,
                courses_to_add: addCourseIds,
                courses_to_remove: removeCourseIds,
                note: dto.note?.trim() || null,
            },
            include: {
                lecturer: {
                    include: {
                        department: {
                            select: { dept_name: true },
                        },
                        user: {
                            select: { first_name: true, last_name: true, email: true },
                        },
                    },
                },
            },
        });
        const lecturerName = `${created.lecturer.user.first_name} ${created.lecturer.user.last_name}`.trim();
        const totalChanges = addCourseIds.length + removeCourseIds.length;
        void this.notifications
            .notifyAdmins("New Course Modification Request", `${lecturerName} (${created.lecturer.user.email}) submitted course modification request #${created.request_id} with ${totalChanges} requested change${totalChanges === 1 ? "" : "s"}.`, { preferenceKey: notification_prefs_1.ADMIN_NOTIFICATION_PREF_KEYS.COURSE_MODIFICATION_REQUESTS })
            .catch(() => { });
        return this.mapRequest(created);
    }
    async listMine(lecturerUserId) {
        const rows = await this.prisma.courseModificationRequest.findMany({
            where: { lecturer_user_id: lecturerUserId },
            include: {
                lecturer: {
                    include: {
                        department: {
                            select: { dept_name: true },
                        },
                        user: {
                            select: { first_name: true, last_name: true, email: true },
                        },
                    },
                },
            },
            orderBy: { submitted_at: "desc" },
        });
        return Promise.all(rows.map((row) => this.mapRequest(row)));
    }
    async cancelMine(lecturerUserId, requestId) {
        const row = await this.prisma.courseModificationRequest.findUnique({
            where: { request_id: requestId },
            include: {
                lecturer: {
                    include: {
                        department: {
                            select: { dept_name: true },
                        },
                        user: {
                            select: { first_name: true, last_name: true, email: true },
                        },
                    },
                },
            },
        });
        if (!row || row.lecturer_user_id !== lecturerUserId) {
            throw new common_1.NotFoundException("Course modification request not found.");
        }
        if (row.status !== client_1.CourseModificationRequestStatus.PENDING) {
            throw new common_1.BadRequestException("Only pending requests can be cancelled.");
        }
        const updated = await this.prisma.courseModificationRequest.update({
            where: { request_id: requestId },
            data: {
                status: client_1.CourseModificationRequestStatus.CANCELLED,
                reviewed_at: new Date(),
            },
            include: {
                lecturer: {
                    include: {
                        department: {
                            select: { dept_name: true },
                        },
                        user: {
                            select: { first_name: true, last_name: true, email: true },
                        },
                    },
                },
            },
        });
        return this.mapRequest(updated);
    }
    async listForAdmin(status) {
        const rows = await this.prisma.courseModificationRequest.findMany({
            where: status ? { status } : undefined,
            include: {
                lecturer: {
                    include: {
                        department: {
                            select: { dept_name: true },
                        },
                        user: {
                            select: { first_name: true, last_name: true, email: true },
                        },
                    },
                },
            },
            orderBy: { submitted_at: "desc" },
        });
        return Promise.all(rows.map((row) => this.mapRequest(row)));
    }
    async approveByAdmin(requestId) {
        const row = await this.prisma.courseModificationRequest.findUnique({
            where: { request_id: requestId },
            include: {
                lecturer: {
                    include: {
                        department: {
                            select: { dept_name: true },
                        },
                        user: {
                            select: { first_name: true, last_name: true, email: true },
                        },
                    },
                },
            },
        });
        if (!row)
            throw new common_1.NotFoundException("Course modification request not found.");
        if (row.status !== client_1.CourseModificationRequestStatus.PENDING) {
            throw new common_1.BadRequestException("Only pending requests can be approved.");
        }
        const addIds = this.parseCourseIds(row.courses_to_add);
        const removeIds = this.parseCourseIds(row.courses_to_remove);
        const activeAddCourses = addIds.length
            ? await this.prisma.course.findMany({
                where: { course_id: { in: addIds }, is_active: true },
                select: { course_id: true },
            })
            : [];
        if (activeAddCourses.length !== addIds.length) {
            throw new common_1.BadRequestException("One or more courses to add are no longer available.");
        }
        await this.prisma.$transaction(async (tx) => {
            if (removeIds.length > 0) {
                await tx.lecturerCanTeachCourse.deleteMany({
                    where: {
                        user_id: row.lecturer_user_id,
                        course_id: { in: removeIds },
                    },
                });
            }
            if (addIds.length > 0) {
                await tx.lecturerCanTeachCourse.createMany({
                    data: addIds.map((courseId) => ({
                        user_id: row.lecturer_user_id,
                        course_id: courseId,
                    })),
                    skipDuplicates: true,
                });
            }
            await tx.courseModificationRequest.update({
                where: { request_id: requestId },
                data: {
                    status: client_1.CourseModificationRequestStatus.APPROVED,
                    reviewed_at: new Date(),
                    rejection_reason: null,
                },
            });
        });
        void this.notifications
            .createForUser(row.lecturer_user_id, "Course Modification Request Approved", `Your course modification request #${row.request_id} has been approved.`)
            .catch(() => { });
        const refreshed = await this.prisma.courseModificationRequest.findUnique({
            where: { request_id: requestId },
            include: {
                lecturer: {
                    include: {
                        department: {
                            select: { dept_name: true },
                        },
                        user: {
                            select: { first_name: true, last_name: true, email: true },
                        },
                    },
                },
            },
        });
        if (!refreshed)
            throw new common_1.NotFoundException("Course modification request not found.");
        return this.mapRequest(refreshed);
    }
    async rejectByAdmin(requestId, dto) {
        const row = await this.prisma.courseModificationRequest.findUnique({
            where: { request_id: requestId },
            include: {
                lecturer: {
                    include: {
                        department: {
                            select: { dept_name: true },
                        },
                        user: {
                            select: { first_name: true, last_name: true, email: true },
                        },
                    },
                },
            },
        });
        if (!row)
            throw new common_1.NotFoundException("Course modification request not found.");
        if (row.status !== client_1.CourseModificationRequestStatus.PENDING) {
            throw new common_1.BadRequestException("Only pending requests can be rejected.");
        }
        const updated = await this.prisma.courseModificationRequest.update({
            where: { request_id: requestId },
            data: {
                status: client_1.CourseModificationRequestStatus.REJECTED,
                rejection_reason: dto.reason?.trim() || null,
                reviewed_at: new Date(),
            },
            include: {
                lecturer: {
                    include: {
                        department: {
                            select: { dept_name: true },
                        },
                        user: {
                            select: { first_name: true, last_name: true, email: true },
                        },
                    },
                },
            },
        });
        void this.notifications
            .createForUser(row.lecturer_user_id, "Course Modification Request Rejected", `Your course modification request #${row.request_id} was rejected.`)
            .catch(() => { });
        return this.mapRequest(updated);
    }
};
exports.CourseModificationRequestsService = CourseModificationRequestsService;
exports.CourseModificationRequestsService = CourseModificationRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService])
], CourseModificationRequestsService);
//# sourceMappingURL=course-modification-requests.service.js.map