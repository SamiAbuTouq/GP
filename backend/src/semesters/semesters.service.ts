import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  parseAcademicYearStart,
  semesterDateRange,
} from "./semester-dates.util";

function decodeSemesterType(type: number): string {
  const map: Record<number, string> = {
    1: "First Semester",
    2: "Second Semester",
    3: "Summer Semester",
  };
  return map[type] ?? `Semester ${type}`;
}

@Injectable()
export class SemestersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const semesters = await this.prisma.semester.findMany({
      select: {
        semester_id: true,
        academic_year: true,
        semester_type: true,
        total_students: true,
        start_date: true,
        end_date: true,
      },
      orderBy: [{ academic_year: "asc" }, { semester_type: "asc" }],
    });

    return semesters.map((s) => ({
      semesterId: s.semester_id,
      academicYear: s.academic_year,
      semesterType: s.semester_type,
      semester: decodeSemesterType(s.semester_type),
      totalStudents: s.total_students,
      startDate: s.start_date,
      endDate: s.end_date,
    }));
  }

  /**
   * Returns an existing semester row or creates one for publish / planning flows.
   */
  async findOrCreateSemester(academicYear: string, semesterType: number) {
    if (![1, 2, 3].includes(semesterType)) {
      throw new BadRequestException(
        "semesterType must be one of: 1 (First), 2 (Second), 3 (Summer).",
      );
    }

    const year = academicYear.trim();
    const existing = await this.prisma.semester.findFirst({
      where: { academic_year: year, semester_type: semesterType },
      select: { semester_id: true },
    });
    if (existing) return existing;

    const yearStart = parseAcademicYearStart(year);
    const { startDate, endDate } = semesterDateRange(yearStart, semesterType);
    return this.prisma.semester.create({
      data: {
        academic_year: year,
        semester_type: semesterType,
        start_date: startDate,
        end_date: endDate,
        total_students: null,
      },
      select: { semester_id: true },
    });
  }
}
