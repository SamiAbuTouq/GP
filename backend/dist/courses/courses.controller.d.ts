import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
export declare class CoursesController {
    private readonly coursesService;
    constructor(coursesService: CoursesService);
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
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
