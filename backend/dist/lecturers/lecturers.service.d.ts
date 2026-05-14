import { PrismaService } from "../prisma/prisma.service";
import { CreateLecturerDto, UpdateLecturerDto } from "./dto/lecturer.dto";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
export type CreateLecturerOptions = {
    bcryptRounds?: number;
};
export declare class LecturersService {
    private prisma;
    private readonly mailService;
    private readonly notifications;
    private readonly logger;
    constructor(prisma: PrismaService, mailService: MailService, notifications: NotificationsService);
    private generateTemporaryPassword;
    private resolveLatestTimetableId;
    private teachingLoadByUserIdForTimetable;
    private teachingLoadForUserOnTimetable;
    findAll(): Promise<{
        id: string;
        databaseId: number;
        name: string;
        email: string;
        department: string;
        departmentId: number;
        load: number;
        maxWorkload: number;
        courses: string[];
        isAvailable: boolean;
    }[]>;
    findOne(id: number): Promise<{
        id: string;
        databaseId: number;
        name: string;
        email: string;
        department: string;
        departmentId: number;
        load: number;
        maxWorkload: number;
        courses: string[];
        isAvailable: boolean;
    }>;
    create(dto: CreateLecturerDto, options?: CreateLecturerOptions): Promise<{
        id: string;
        databaseId: number;
        name: string;
        email: string;
        department: string;
        departmentId: number;
        load: number;
        maxWorkload: number;
        courses: string[];
        isAvailable: boolean;
    }>;
    update(id: number, dto: UpdateLecturerDto): Promise<{
        id: string;
        databaseId: number;
        name: string;
        email: string;
        department: string;
        departmentId: number;
        load: number;
        maxWorkload: number;
        courses: string[];
        isAvailable: boolean;
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
    findDeactivated(): Promise<{
        id: string;
        databaseId: number;
        name: string;
        email: string;
        department: string;
        departmentId: number;
        maxWorkload: number;
        isAvailable: boolean;
    }[]>;
    reactivate(id: number): Promise<{
        message: string;
    }>;
    getPurgeImpact(id: number): Promise<{
        lecturerUserId: number;
        lecturerName: string;
        isActive: boolean;
        entryCount: number;
        timetables: {
            timetableId: number;
            generationType: string;
            status: string;
            versionNumber: number;
        }[];
    }>;
    purgeDeactivated(id: number): Promise<{
        message: string;
    }>;
}
