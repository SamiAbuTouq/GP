import { AccessRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { RejectAccessRequestDto } from './dto/reject-access-request.dto';
import { LecturersService } from '../lecturers/lecturers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
export declare class AccessRequestsService {
    private readonly prisma;
    private readonly lecturersService;
    private readonly notifications;
    private readonly mailService;
    constructor(prisma: PrismaService, lecturersService: LecturersService, notifications: NotificationsService, mailService: MailService);
    private mapRow;
    private expirePendingRequests;
    checkEmail(emailRaw: string): Promise<{
        existsAsUser: boolean;
        hasPendingRequest: boolean;
    }>;
    submit(dto: CreateAccessRequestDto): Promise<{
        requestId: number;
        fullName: string;
        email: string;
        department: string;
        maxWorkload: number;
        courses: string[];
        status: import(".prisma/client").$Enums.AccessRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        expiresAt: string;
        reviewedAt: string | null;
    }>;
    listByStatus(status: AccessRequestStatus): Promise<{
        requestId: number;
        fullName: string;
        email: string;
        department: string;
        maxWorkload: number;
        courses: string[];
        status: import(".prisma/client").$Enums.AccessRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        expiresAt: string;
        reviewedAt: string | null;
    }[]>;
    approve(requestId: number): Promise<{
        requestId: number;
        fullName: string;
        email: string;
        department: string;
        maxWorkload: number;
        courses: string[];
        status: import(".prisma/client").$Enums.AccessRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        expiresAt: string;
        reviewedAt: string | null;
    }>;
    reject(requestId: number, dto: RejectAccessRequestDto): Promise<{
        requestId: number;
        fullName: string;
        email: string;
        department: string;
        maxWorkload: number;
        courses: string[];
        status: import(".prisma/client").$Enums.AccessRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        expiresAt: string;
        reviewedAt: string | null;
    }>;
}
