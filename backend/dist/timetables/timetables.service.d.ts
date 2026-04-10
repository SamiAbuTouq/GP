import { PrismaService } from '../prisma/prisma.service';
export declare class TimetablesService {
    private prisma;
    constructor(prisma: PrismaService);
    list(semesterId?: number): Promise<{
        timetableId: number;
        semesterId: number;
        academicYear: string;
        semesterType: number;
        semester: string;
        generatedAt: Date;
        status: string;
        generationType: string;
        versionNumber: number;
        metrics: {
            roomUtilizationRate: import("@prisma/client-runtime-utils").Decimal;
            softConstraintsScore: import("@prisma/client-runtime-utils").Decimal;
            fitnessScore: import("@prisma/client-runtime-utils").Decimal;
            isValid: boolean;
            totalStudents: number;
        } | null;
    }[]>;
    listEntries(params: {
        timetableId: number;
        courseId?: number;
        lecturerUserId?: number;
        roomId?: number;
    }): Promise<{
        entryId: number;
        timetableId: number;
        slotId: number;
        courseId: number;
        courseCode: string;
        courseName: string;
        lecturerUserId: number;
        lecturerName: string;
        roomId: number;
        roomNumber: string;
        daysMask: number;
        days: string[];
        startTime: string;
        endTime: string;
        sectionNumber: string;
        isLab: boolean;
        registeredStudents: number;
        sectionCapacity: number;
    }[]>;
}
