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
        deliveryMode: string;
        department: string;
        departmentId: number;
        sections: number;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        code: string;
        name: string;
        creditHours: number;
        academicLevel: number;
        deliveryMode: string;
        department: string;
        departmentId: number;
        sections: number;
    }>;
    create(dto: CreateCourseDto): Promise<{
        id: number;
        code: string;
        name: string;
        creditHours: number;
        academicLevel: number;
        deliveryMode: string;
        department: string;
        departmentId: number;
        sections: number;
    }>;
    update(id: number, dto: UpdateCourseDto): Promise<{
        id: number;
        code: string;
        name: string;
        creditHours: number;
        academicLevel: number;
        deliveryMode: string;
        department: string;
        departmentId: number;
        sections: number;
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
