export declare class CreateLecturerDto {
    name: string;
    email: string;
    department: string;
    maxWorkload: number;
    courses?: string[];
    createPortalUser?: boolean;
}
export declare class UpdateLecturerDto {
    name?: string;
    email?: string;
    department?: string;
    maxWorkload?: number;
    courses?: string[];
}
