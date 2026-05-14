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
exports.AccessRequestsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const lecturers_service_1 = require("../lecturers/lecturers.service");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_prefs_1 = require("../notifications/notification-prefs");
const mail_service_1 = require("../mail/mail.service");
const EXPIRY_DAYS = 14;
const EXPIRE_SWEEP_MIN_INTERVAL_MS = 45_000;
const ACCESS_APPROVAL_BCRYPT_ROUNDS = 8;
const GENERIC_ELIGIBILITY_MESSAGE = "If this email is eligible for access, you will be contacted with further instructions.";
let AccessRequestsService = class AccessRequestsService {
    constructor(prisma, lecturersService, notifications, mailService) {
        this.prisma = prisma;
        this.lecturersService = lecturersService;
        this.notifications = notifications;
        this.mailService = mailService;
        this.lastExpireSweepAtMs = 0;
    }
    mapRow(row) {
        return {
            requestId: row.request_id,
            fullName: row.full_name,
            email: row.email,
            department: row.department,
            maxWorkload: row.max_workload,
            courses: Array.isArray(row.courses)
                ? row.courses.filter((c) => typeof c === "string")
                : [],
            status: row.status,
            rejectionReason: row.rejection_reason,
            submittedAt: row.submitted_at.toISOString(),
            expiresAt: row.expires_at.toISOString(),
            reviewedAt: row.reviewed_at?.toISOString() ?? null,
        };
    }
    async expirePendingRequests() {
        const now = new Date();
        await this.prisma.lecturerAccessRequest.updateMany({
            where: {
                status: client_1.AccessRequestStatus.PENDING,
                expires_at: { lte: now },
            },
            data: {
                status: client_1.AccessRequestStatus.REJECTED,
                rejection_reason: "This request expired after 14 days without review.",
                reviewed_at: now,
            },
        });
    }
    async expirePendingRequestsThrottled() {
        const now = Date.now();
        if (now - this.lastExpireSweepAtMs < EXPIRE_SWEEP_MIN_INTERVAL_MS)
            return;
        this.lastExpireSweepAtMs = now;
        await this.expirePendingRequests();
    }
    async checkEmail(emailRaw) {
        await this.expirePendingRequests();
        const email = emailRaw.trim().toLowerCase();
        if (!email)
            throw new common_1.BadRequestException("Email is required.");
        const [user, pendingRequest] = await Promise.all([
            this.prisma.user.findUnique({
                where: { email },
                select: { user_id: true },
            }),
            this.prisma.lecturerAccessRequest.findFirst({
                where: { email, status: client_1.AccessRequestStatus.PENDING },
                select: { request_id: true },
            }),
        ]);
        return {
            existsAsUser: Boolean(user),
            hasPendingRequest: Boolean(pendingRequest),
        };
    }
    async submit(dto) {
        await this.expirePendingRequests();
        const email = dto.email.trim().toLowerCase();
        const fullName = dto.fullName.trim();
        const department = dto.department.trim();
        const courses = (dto.courses ?? []).map((c) => c.trim()).filter(Boolean);
        const [existingUser, pendingRequest] = await Promise.all([
            this.prisma.user.findUnique({
                where: { email },
                select: { user_id: true },
            }),
            this.prisma.lecturerAccessRequest.findFirst({
                where: { email, status: client_1.AccessRequestStatus.PENDING },
                select: { request_id: true },
            }),
        ]);
        if (existingUser || pendingRequest) {
            throw new common_1.ConflictException(GENERIC_ELIGIBILITY_MESSAGE);
        }
        const now = new Date();
        const expiresAt = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        const created = await this.prisma.lecturerAccessRequest.create({
            data: {
                full_name: fullName,
                email,
                department,
                max_workload: dto.maxWorkload,
                courses,
                expires_at: expiresAt,
            },
        });
        const courseRows = courses.length
            ? await this.prisma.course.findMany({
                where: { course_code: { in: courses } },
                select: { course_code: true, course_name: true },
            })
            : [];
        const courseNameByCode = new Map(courseRows.map((row) => [row.course_code, row.course_name]));
        const coursesWithNames = courses.map((code) => {
            const name = courseNameByCode.get(code);
            return name ? `${code} - ${name}` : code;
        });
        void this.notifications
            .notifyAdmins("New Lecturer Access Request", `${fullName} (${email}) submitted a lecturer access request.`, { preferenceKey: notification_prefs_1.ADMIN_NOTIFICATION_PREF_KEYS.ACCESS_REQUESTS })
            .catch(() => { });
        void this.mailService
            .sendLecturerAccessRequestSubmittedEmail({
            to: email,
            fullName,
            department,
            maxWorkload: dto.maxWorkload,
            courses: coursesWithNames,
            submittedAtIso: created.submitted_at.toISOString(),
            expiresAtIso: created.expires_at.toISOString(),
        })
            .catch(() => { });
        return this.mapRow(created);
    }
    async listByStatus(status) {
        await this.expirePendingRequestsThrottled();
        const rows = await this.prisma.lecturerAccessRequest.findMany({
            where: { status },
            orderBy: { submitted_at: "desc" },
        });
        const mapped = rows.map((r) => this.mapRow(r));
        const allCodes = [...new Set(mapped.flatMap((m) => m.courses))];
        const courseRows = allCodes.length
            ? await this.prisma.course.findMany({
                where: { course_code: { in: allCodes } },
                select: { course_code: true, course_name: true },
            })
            : [];
        const nameByCode = new Map(courseRows.map((c) => [c.course_code, c.course_name]));
        return mapped.map((m) => ({
            ...m,
            courses: m.courses.map((code) => ({
                code,
                name: nameByCode.get(code) ?? null,
            })),
        }));
    }
    async approve(requestId) {
        await this.expirePendingRequestsThrottled();
        const request = await this.prisma.lecturerAccessRequest.findUnique({
            where: { request_id: requestId },
        });
        if (!request)
            throw new common_1.NotFoundException("Access request not found.");
        if (request.status !== client_1.AccessRequestStatus.PENDING) {
            throw new common_1.BadRequestException("Only pending requests can be approved.");
        }
        await this.lecturersService.create({
            name: request.full_name,
            email: request.email,
            department: request.department,
            maxWorkload: request.max_workload,
            courses: Array.isArray(request.courses)
                ? request.courses.filter((c) => typeof c === "string")
                : [],
        }, { bcryptRounds: ACCESS_APPROVAL_BCRYPT_ROUNDS });
        const updated = await this.prisma.lecturerAccessRequest.update({
            where: { request_id: requestId },
            data: {
                status: client_1.AccessRequestStatus.APPROVED,
                reviewed_at: new Date(),
                rejection_reason: null,
            },
        });
        return this.mapRow(updated);
    }
    async reject(requestId, dto) {
        await this.expirePendingRequestsThrottled();
        const request = await this.prisma.lecturerAccessRequest.findUnique({
            where: { request_id: requestId },
        });
        if (!request)
            throw new common_1.NotFoundException("Access request not found.");
        if (request.status !== client_1.AccessRequestStatus.PENDING) {
            throw new common_1.BadRequestException("Only pending requests can be rejected.");
        }
        const reason = dto.reason?.trim() || null;
        const updated = await this.prisma.lecturerAccessRequest.update({
            where: { request_id: requestId },
            data: {
                status: client_1.AccessRequestStatus.REJECTED,
                reviewed_at: new Date(),
                rejection_reason: reason,
            },
        });
        void this.mailService
            .sendLecturerAccessRequestRejectedEmail({
            to: request.email,
            fullName: request.full_name,
            reason,
        })
            .catch(() => { });
        return this.mapRow(updated);
    }
};
exports.AccessRequestsService = AccessRequestsService;
exports.AccessRequestsService = AccessRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        lecturers_service_1.LecturersService,
        notifications_service_1.NotificationsService,
        mail_service_1.MailService])
], AccessRequestsService);
//# sourceMappingURL=access-requests.service.js.map