import { User } from "@prisma/client";
import { CourseModificationRequestsService } from "./course-modification-requests.service";
import { CreateCourseModificationRequestDto } from "./dto/create-course-modification-request.dto";
import { RejectCourseModificationRequestDto } from "./dto/reject-course-modification-request.dto";
export declare class CourseModificationRequestsController {
    private readonly service;
    constructor(service: CourseModificationRequestsService);
    getMyAuthorizedCourses(user: User): Promise<{
        courseId: number;
        code: string;
        name: string;
        level: number;
        department: string;
    }[]>;
    getCatalogForLecturer(user: User): Promise<{
        courseId: number;
        code: string;
        name: string;
        level: number;
        department: string;
    }[]>;
    listMine(user: User): Promise<{
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
    submit(user: User, dto: CreateCourseModificationRequestDto): Promise<{
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
    cancelMine(user: User, id: number): Promise<{
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
    listForAdmin(status?: string): Promise<{
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
    approve(id: number): Promise<{
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
    reject(id: number, dto: RejectCourseModificationRequestDto): Promise<{
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
