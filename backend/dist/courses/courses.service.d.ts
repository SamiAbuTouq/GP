import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
export declare class CoursesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: number;
        code: string;
        name: string;
        creditHours: number;
        academicLevel: number;
        deliveryMode: import(".prisma/client").$Enums.DeliveryMode;
        department: string;
        departmentId: number;
        sectionsNormal: number;
        sectionsSummer: number;
        isLab: boolean;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        code: string;
        name: string;
        creditHours: number;
        academicLevel: number;
        deliveryMode: import(".prisma/client").$Enums.DeliveryMode;
        department: string;
        departmentId: number;
        sectionsNormal: number;
        sectionsSummer: number;
        isLab: boolean;
    }>;
    create(dto: CreateCourseDto): Promise<{
        id: number;
        code: string;
        name: string;
        creditHours: number;
        academicLevel: number;
        deliveryMode: import(".prisma/client").$Enums.DeliveryMode;
        department: string;
        departmentId: number;
        sectionsNormal: number;
        sectionsSummer: number;
        isLab: boolean;
    }>;
    update(id: number, dto: UpdateCourseDto): Promise<{
        id: number;
        code: string;
        name: string;
        creditHours: number;
        academicLevel: number;
        deliveryMode: import(".prisma/client").$Enums.DeliveryMode;
        department: string;
        departmentId: number;
        sectionsNormal: number;
        sectionsSummer: number;
        isLab: boolean;
    }>;
    remove(id: number): Promise<{
        message: string;
        archived: boolean;
    }>;
    findArchived(): Promise<{
        id: number;
        code: string;
        name: string;
        creditHours: number;
        academicLevel: number;
        deliveryMode: import(".prisma/client").$Enums.DeliveryMode;
        department: string;
        departmentId: number;
        sectionsNormal: number;
        sectionsSummer: number;
        isLab: boolean;
    }[]>;
    restoreArchived(id: number): Promise<{
        message: string;
    }>;
    getDeletionImpact(id: number): Promise<{
        courseId: number;
        courseCode: string;
        courseName: string;
        entryCount: number;
        timetables: {
            timetableId: number;
            generationType: string;
            status: string;
            versionNumber: number;
        }[];
    }>;
    permanentlyDeleteArchived(id: number): Promise<{
        message: string;
    }>;
}
