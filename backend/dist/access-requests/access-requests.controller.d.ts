import { AccessRequestsService } from './access-requests.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { RejectAccessRequestDto } from './dto/reject-access-request.dto';
export declare class AccessRequestsController {
    private readonly service;
    constructor(service: AccessRequestsService);
    checkEmail(email?: string): Promise<{
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
    list(status?: string): Promise<{
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
    approve(id: number): Promise<{
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
    reject(id: number, dto: RejectAccessRequestDto): Promise<{
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
