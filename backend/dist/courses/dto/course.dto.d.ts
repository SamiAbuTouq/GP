export declare class CreateCourseDto {
    code: string;
    name: string;
    creditHours: number;
    academicLevel: number;
    deliveryMode: string;
    department: string;
}
export declare class UpdateCourseDto {
    name?: string;
    creditHours?: number;
    academicLevel?: number;
    deliveryMode?: string;
    department?: string;
}
