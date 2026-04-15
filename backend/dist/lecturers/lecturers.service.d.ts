import { PrismaService } from '../prisma/prisma.service';
import { CreateLecturerDto, UpdateLecturerDto } from './dto/lecturer.dto';
import { MailService } from '../mail/mail.service';
export declare class LecturersService {
    private prisma;
    private readonly mailService;
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
}
