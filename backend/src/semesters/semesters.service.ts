import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function decodeSemesterType(type: number): string {
  const map: Record<number, string> = {
    1: 'First Semester',
    2: 'Second Semester',
    3: 'Summer Semester',
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
      orderBy: [{ academic_year: 'asc' }, { semester_type: 'asc' }],
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
}

