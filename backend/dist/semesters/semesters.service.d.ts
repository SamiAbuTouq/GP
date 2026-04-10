import { PrismaService } from '../prisma/prisma.service';
export declare class SemestersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        semesterId: number;
        academicYear: string;
        semesterType: number;
        semester: string;
        totalStudents: number | null;
        startDate: Date;
        endDate: Date;
    }[]>;
}
