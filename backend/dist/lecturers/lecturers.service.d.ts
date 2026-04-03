import { PrismaService } from '../prisma/prisma.service';
import { CreateLecturerDto, UpdateLecturerDto } from './dto/lecturer.dto';
export declare class LecturersService {
    private prisma;
    constructor(prisma: PrismaService);
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
