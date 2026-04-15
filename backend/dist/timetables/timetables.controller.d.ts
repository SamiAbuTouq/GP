import { TimetablesService } from './timetables.service';
export declare class TimetablesController {
    private readonly timetablesService;
    constructor(timetablesService: TimetablesService);
    list(semesterIdRaw?: string): Promise<{
        timetableId: number;
        semesterId: number;
        academicYear: string;
        semesterType: number;
        semester: string;
        totalStudents: number | null;
        generatedAt: Date;
        status: string;
        generationType: string;
        versionNumber: number;
        metrics: {
            roomUtilizationRate: import("@prisma/client-runtime-utils").Decimal;
            softConstraintsScore: import("@prisma/client-runtime-utils").Decimal;
            fitnessScore: import("@prisma/client-runtime-utils").Decimal;
            isValid: boolean;
        } | null;
    }[]>;
    listEntries(id: number, courseIdRaw?: string, lecturerUserIdRaw?: string, roomIdRaw?: string): Promise<{
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
        isOnline: boolean;
    }[]>;
}
