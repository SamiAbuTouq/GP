import { SemestersService } from './semesters.service';
export declare class SemestersController {
    private readonly semestersService;
    constructor(semestersService: SemestersService);
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
