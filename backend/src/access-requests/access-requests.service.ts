import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AccessRequestStatus, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccessRequestDto } from "./dto/create-access-request.dto";
import { RejectAccessRequestDto } from "./dto/reject-access-request.dto";
import { LecturersService } from "../lecturers/lecturers.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ADMIN_NOTIFICATION_PREF_KEYS } from "../notifications/notification-prefs";
import { MailService } from "../mail/mail.service";

const EXPIRY_DAYS = 14;
/** Avoid running the expiry sweep on every list request (tab switches); submit/approve still run it. */
const EXPIRE_SWEEP_MIN_INTERVAL_MS = 45_000;
const GENERIC_ELIGIBILITY_MESSAGE =
  "If this email is eligible for access, you will be contacted with further instructions.";

@Injectable()
export class AccessRequestsService {
  private lastExpireSweepAtMs = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lecturersService: LecturersService,
    private readonly notifications: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  private mapRow(row: {
    request_id: number;
    full_name: string;
    email: string;
    department: string;
    max_workload: number;
    courses: unknown;
    status: AccessRequestStatus;
    rejection_reason: string | null;
    submitted_at: Date;
    expires_at: Date;
    reviewed_at: Date | null;
  }) {
    return {
      requestId: row.request_id,
      fullName: row.full_name,
      email: row.email,
      department: row.department,
      maxWorkload: row.max_workload,
      courses: Array.isArray(row.courses)
        ? row.courses.filter((c): c is string => typeof c === "string")
        : [],
      status: row.status,
      rejectionReason: row.rejection_reason,
      submittedAt: row.submitted_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      reviewedAt: row.reviewed_at?.toISOString() ?? null,
    };
  }

  private async expirePendingRequests() {
    const now = new Date();
    await this.prisma.lecturerAccessRequest.updateMany({
      where: {
        status: AccessRequestStatus.PENDING,
        expires_at: { lte: now },
      },
      data: {
        status: AccessRequestStatus.REJECTED,
        rejection_reason: "This request expired after 14 days without review.",
        reviewed_at: now,
      },
    });
  }

  /** Throttled expiry for read-heavy paths (e.g. admin list tabs). */
  private async expirePendingRequestsThrottled() {
    const now = Date.now();
    if (now - this.lastExpireSweepAtMs < EXPIRE_SWEEP_MIN_INTERVAL_MS) return;
    this.lastExpireSweepAtMs = now;
    await this.expirePendingRequests();
  }

  async checkEmail(emailRaw: string) {
    await this.expirePendingRequests();
    const email = emailRaw.trim().toLowerCase();
    if (!email) throw new BadRequestException("Email is required.");

    const [user, pendingRequest] = await Promise.all([
      this.prisma.user.findUnique({
        where: { email },
        select: { user_id: true },
      }),
      this.prisma.lecturerAccessRequest.findFirst({
        where: { email, status: AccessRequestStatus.PENDING },
        select: { request_id: true },
      }),
    ]);

    return {
      existsAsUser: Boolean(user),
      hasPendingRequest: Boolean(pendingRequest),
    };
  }

  async submit(dto: CreateAccessRequestDto) {
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
        where: { email, status: AccessRequestStatus.PENDING },
        select: { request_id: true },
      }),
    ]);

    if (existingUser || pendingRequest) {
      throw new ConflictException(GENERIC_ELIGIBILITY_MESSAGE);
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );
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
    const courseNameByCode = new Map(
      courseRows.map((row) => [row.course_code, row.course_name] as const),
    );
    const coursesWithNames = courses.map((code) => {
      const name = courseNameByCode.get(code);
      return name ? `${code} - ${name}` : code;
    });

    void this.notifications
      .notifyAdmins(
        "New Lecturer Access Request",
        `${fullName} (${email}) submitted a lecturer access request.`,
        { preferenceKey: ADMIN_NOTIFICATION_PREF_KEYS.ACCESS_REQUESTS },
      )
      .catch(() => {});

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
      .catch(() => {});

    return this.mapRow(created);
  }

  async listByStatus(status: AccessRequestStatus) {
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
    const nameByCode = new Map(
      courseRows.map((c) => [c.course_code, c.course_name] as const),
    );
    return mapped.map((m) => ({
      ...m,
      courses: m.courses.map((code) => ({
        code,
        name: nameByCode.get(code) ?? null,
      })),
    }));
  }

  async approve(requestId: number) {
    await this.expirePendingRequests();
    const request = await this.prisma.lecturerAccessRequest.findUnique({
      where: { request_id: requestId },
    });
    if (!request) throw new NotFoundException("Access request not found.");
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException("Only pending requests can be approved.");
    }

    await this.lecturersService.create({
      name: request.full_name,
      email: request.email,
      department: request.department,
      maxWorkload: request.max_workload,
      courses: Array.isArray(request.courses)
        ? request.courses.filter((c): c is string => typeof c === "string")
        : [],
    });

    const updated = await this.prisma.lecturerAccessRequest.update({
      where: { request_id: requestId },
      data: {
        status: AccessRequestStatus.APPROVED,
        reviewed_at: new Date(),
        rejection_reason: null,
      },
    });
    return this.mapRow(updated);
  }

  async reject(requestId: number, dto: RejectAccessRequestDto) {
    await this.expirePendingRequests();
    const request = await this.prisma.lecturerAccessRequest.findUnique({
      where: { request_id: requestId },
    });
    if (!request) throw new NotFoundException("Access request not found.");
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException("Only pending requests can be rejected.");
    }

    const reason = dto.reason?.trim() || null;
    const updated = await this.prisma.lecturerAccessRequest.update({
      where: { request_id: requestId },
      data: {
        status: AccessRequestStatus.REJECTED,
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
      .catch(() => {});

    return this.mapRow(updated);
  }
}
