import { DeliveryMode } from '@prisma/client';
export declare class CreateCourseDto {
    code: string;
    name: string;
    creditHours: number;
    academicLevel: number;
    deliveryMode: DeliveryMode;
    department: string;
    sections?: number;
    isLab?: boolean;
}
export declare class UpdateCourseDto {
    name?: string;
    creditHours?: number;
    academicLevel?: number;
    deliveryMode?: DeliveryMode;
    department?: string;
    sections?: number;
    isLab?: boolean;
}
