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
        sections: number;
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
        sections: number;
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
        sections: number;
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
        sections: number;
        isLab: boolean;
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
