import { PrismaService } from '../prisma/prisma.service';
import { CreateLecturerDto, UpdateLecturerDto } from './dto/lecturer.dto';
import { MailService } from '../mail/mail.service';
export declare class LecturersService {
    private prisma;
    private readonly mailService;
    private readonly logger;
    constructor(prisma: PrismaService, mailService: MailService);
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
    create(dto: CreateLecturerDto): Promise<{
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
