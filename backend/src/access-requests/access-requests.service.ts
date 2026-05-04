import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessRequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { RejectAccessRequestDto } from './dto/reject-access-request.dto';
import { LecturersService } from '../lecturers/lecturers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

const EXPIRY_DAYS = 14;

@Injectable()
export class AccessRequestsService {
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
        ? row.courses.filter((c): c is string => typeof c === 'string')
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
        rejection_reason: 'This request expired after 14 days without review.',
        reviewed_at: now,
      },
    });
  }

  async checkEmail(emailRaw: string) {
    await this.expirePendingRequests();
    const email = emailRaw.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email is required.');

    const [user, pendingRequest] = await Promise.all([
      this.prisma.user.findUnique({ where: { email }, select: { user_id: true } }),
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
      this.prisma.user.findUnique({ where: { email }, select: { user_id: true } }),
      this.prisma.lecturerAccessRequest.findFirst({
        where: { email, status: AccessRequestStatus.PENDING },
        select: { request_id: true },
      }),
    ]);

    if (existingUser) {
      throw new ConflictException('This email is already registered in the system.');
    }
    if (pendingRequest) {
      throw new ConflictException('A pending access request already exists for this email.');
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

    void this.notifications
      .notifyAdmins(
        'New Lecturer Access Request',
        `${fullName} (${email}) submitted a lecturer access request.`,
      )
      .catch(() => {});

    return this.mapRow(created);
  }

  async listByStatus(status: AccessRequestStatus) {
    await this.expirePendingRequests();
    const rows = await this.prisma.lecturerAccessRequest.findMany({
      where: { status },
      orderBy: { submitted_at: 'desc' },
    });
    return rows.map((r) => this.mapRow(r));
  }

  async approve(requestId: number) {
    await this.expirePendingRequests();
    const request = await this.prisma.lecturerAccessRequest.findUnique({
      where: { request_id: requestId },
    });
    if (!request) throw new NotFoundException('Access request not found.');
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved.');
    }

    await this.lecturersService.create({
      name: request.full_name,
      email: request.email,
      department: request.department,
      maxWorkload: request.max_workload,
      courses: Array.isArray(request.courses)
        ? request.courses.filter((c): c is string => typeof c === 'string')
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
    if (!request) throw new NotFoundException('Access request not found.');
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be rejected.');
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
