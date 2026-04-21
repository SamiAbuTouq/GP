import { Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function decodeSemesterType(type: number): string {
  const map: Record<number, string> = {
    1: 'First Semester',
    2: 'Second Semester',
    3: 'Summer Semester',
  };
  return map[type] ?? `Semester ${type}`;
}

function formatTimeHHmm(d: Date): string {
  // Prisma maps Postgres TIME to Date; use ISO (UTC) to avoid locale surprises.
  return d.toISOString().slice(11, 16);
}

const dayByBit: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

function decodeDaysMask(daysMask: number): string[] {
  const days: string[] = [];
  for (let bit = 0; bit <= 6; bit += 1) {
    if (((daysMask >> bit) & 1) === 1) {
      const label = dayByBit[bit];
      if (label) days.push(label);
    }
  }
  return days;
}

@Injectable()
export class TimetablesService {
  constructor(private prisma: PrismaService) {}

  /**
   * @param semesterId When set to a positive DB id, only timetables for that semester.
   * @param draftsOnly When true, only timetables with no semester (e.g. GWO UI store draft).
   * When both omitted, returns all timetables.
   */
  async list(semesterId?: number, draftsOnly?: boolean) {
    const hasSemesterFilter =
      semesterId != null &&
      typeof semesterId === 'number' &&
      Number.isFinite(semesterId) &&
      semesterId > 0;

    // Prisma rejects `semester_id: null` in some versions; drafts are filtered in memory.
    const timetables = await this.prisma.timetable.findMany({
      where:
        draftsOnly || !hasSemesterFilter
          ? undefined
          : { semester_id: semesterId },
      include: {
        semester: true,
        timetable_metrics: true,
      },
      orderBy: [{ generated_at: 'desc' }, { timetable_id: 'desc' }],
    });

    const rows =
      draftsOnly && !hasSemesterFilter
        ? timetables.filter((t) => t.semester_id == null)
        : timetables;

    return rows.map((t) => ({
      timetableId: t.timetable_id,
      semesterId: t.semester_id,
      academicYear: t.semester?.academic_year ?? 'Unassigned',
      semesterType: t.semester?.semester_type ?? 0,
      semester: t.semester ? decodeSemesterType(t.semester.semester_type) : 'Unassigned draft',
      totalStudents: t.semester?.total_students ?? null,
      generatedAt: t.generated_at,
      status: t.status,
      generationType: t.generation_type,
      versionNumber: t.version_number,
      metrics: t.timetable_metrics
        ? {
            roomUtilizationRate: t.timetable_metrics.room_utilization_rate,
            softConstraintsScore: t.timetable_metrics.soft_constraints_score,
            fitnessScore: t.timetable_metrics.fitness_score,
            isValid: t.timetable_metrics.is_valid,
          }
        : null,
    }));
  }

  async listEntries(params: {
    timetableId: number;
    courseId?: number;
    lecturerUserId?: number;
    roomId?: number;
  }) {
    const timetable = await this.prisma.timetable.findUnique({
      where: { timetable_id: params.timetableId },
      select: { timetable_id: true },
    });

    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${params.timetableId} not found`);
    }

    const entries = await this.prisma.sectionScheduleEntry.findMany({
      where: {
        timetable_id: params.timetableId,
        ...(params.courseId ? { course_id: params.courseId } : {}),
        ...(params.lecturerUserId ? { user_id: params.lecturerUserId } : {}),
        ...(params.roomId ? { room_id: params.roomId } : {}),
      },
      include: {
        course: true,
        room: true,
        timeslot: true,
        lecturer: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ slot_id: 'asc' }, { course_id: 'asc' }, { section_number: 'asc' }],
    });

    return entries.map((e) => ({
      entryId: e.entry_id,
      timetableId: e.timetable_id,
      slotId: e.slot_id,
      courseId: e.course_id,
      courseCode: e.course.course_code,
      courseName: e.course.course_name,
      lecturerUserId: e.user_id,
      lecturerName: `${e.lecturer.user.first_name} ${e.lecturer.user.last_name}`.trim(),
      roomId: e.room_id,
      roomNumber: e.room.room_number,
      daysMask: e.timeslot.days_mask,
      days: decodeDaysMask(e.timeslot.days_mask),
      startTime: formatTimeHHmm(e.timeslot.start_time),
      endTime: formatTimeHHmm(e.timeslot.end_time),
      sectionNumber: e.section_number,
      isLab: e.course.is_lab,
      registeredStudents: e.registered_students,
      sectionCapacity: e.course.delivery_mode === DeliveryMode.ONLINE ? 0 : e.room.capacity,
      isOnline: e.course.delivery_mode === DeliveryMode.ONLINE,
    }));
  }
}

