import { CourseModificationRequestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCourseModificationRequestDto } from "./dto/create-course-modification-request.dto";
import { RejectCourseModificationRequestDto } from "./dto/reject-course-modification-request.dto";
import { NotificationsService } from "../notifications/notifications.service";
export declare class CourseModificationRequestsService {
    private readonly prisma;
    private readonly notifications;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    private normalizeCourseIds;
    private parseCourseIds;
    private mapCourse;
    private mapRequest;
    getMyAuthorizedCourses(lecturerUserId: number): Promise<{
        courseId: number;
        code: string;
        name: string;
        level: number;
        department: string;
    }[]>;
    getCatalogForLecturer(lecturerUserId: number): Promise<{
        courseId: number;
        code: string;
        name: string;
        level: number;
        department: string;
    }[]>;
    createForLecturer(lecturerUserId: number, dto: CreateCourseModificationRequestDto): Promise<{
        requestId: number;
        lecturerUserId: number;
        lecturerName: string;
        lecturerEmail: string;
        lecturerDepartment: string;
        addCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        removeCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        note: string | null;
        status: import(".prisma/client").$Enums.CourseModificationRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        reviewedAt: string | null;
        authorizedCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
    }>;
    listMine(lecturerUserId: number): Promise<{
        requestId: number;
        lecturerUserId: number;
        lecturerName: string;
        lecturerEmail: string;
        lecturerDepartment: string;
        addCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        removeCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        note: string | null;
        status: import(".prisma/client").$Enums.CourseModificationRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        reviewedAt: string | null;
        authorizedCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
    }[]>;
    cancelMine(lecturerUserId: number, requestId: number): Promise<{
        requestId: number;
        lecturerUserId: number;
        lecturerName: string;
        lecturerEmail: string;
        lecturerDepartment: string;
        addCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        removeCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        note: string | null;
        status: import(".prisma/client").$Enums.CourseModificationRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        reviewedAt: string | null;
        authorizedCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
    }>;
    listForAdmin(status?: CourseModificationRequestStatus): Promise<{
        requestId: number;
        lecturerUserId: number;
        lecturerName: string;
        lecturerEmail: string;
        lecturerDepartment: string;
        addCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        removeCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        note: string | null;
        status: import(".prisma/client").$Enums.CourseModificationRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        reviewedAt: string | null;
        authorizedCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
    }[]>;
    approveByAdmin(requestId: number): Promise<{
        requestId: number;
        lecturerUserId: number;
        lecturerName: string;
        lecturerEmail: string;
        lecturerDepartment: string;
        addCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        removeCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        note: string | null;
        status: import(".prisma/client").$Enums.CourseModificationRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        reviewedAt: string | null;
        authorizedCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
    }>;
    rejectByAdmin(requestId: number, dto: RejectCourseModificationRequestDto): Promise<{
        requestId: number;
        lecturerUserId: number;
        lecturerName: string;
        lecturerEmail: string;
        lecturerDepartment: string;
        addCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        removeCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
        note: string | null;
        status: import(".prisma/client").$Enums.CourseModificationRequestStatus;
        rejectionReason: string | null;
        submittedAt: string;
        reviewedAt: string | null;
        authorizedCourses: {
            courseId: number;
            code: string;
            name: string;
            level: number;
            department: string;
        }[];
    }>;
}
