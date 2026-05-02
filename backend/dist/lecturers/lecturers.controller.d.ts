import { LecturersService } from './lecturers.service';
import { CreateLecturerDto, UpdateLecturerDto } from './dto/lecturer.dto';
export declare class LecturersController {
    private readonly lecturersService;
    constructor(lecturersService: LecturersService);
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
    purge(id: number): Promise<{
        message: string;
    }>;
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
}
