import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

const DEFAULT_SOFT_WEIGHTS = {
  preferred_timeslot: 80,
  unpreferred_timeslot: 70,
  minimize_gaps: 60,
  room_utilization: 90,
  balanced_workload: 50,
  distribute_classes: 65,
  student_gaps: 70,
  single_session_day: 50,
};

@Injectable()
export class TimetablesService {
  constructor(private prisma: PrismaService) {}

  private mapTimetableSummary(t: any) {
    const isDraft = t.semester_id == null;
    const resultRunCount =
      typeof t._count?.scenario_runs_as_result === 'number'
        ? t._count.scenario_runs_as_result
        : 0;
    const isScenarioResult = t.generation_type === 'what_if' || resultRunCount > 0;
    const canUseAsScenarioBase =
      !isScenarioResult && (t.semester_id != null || t.generation_type === 'gwo_ui');
    const draftOrigin: 'optimizer' | 'scenario' | 'other' | null = isDraft
      ? isScenarioResult
        ? 'scenario'
        : t.generation_type === 'gwo_ui'
          ? 'optimizer'
          : 'other'
      : null;
    return {
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
      isDraft,
      isPublished: !isDraft,
      isScenarioResult,
      draftOrigin,
      /** Only published (semester-linked) schedules and GWO drafts from timetable generation — never scenario-result timetables. */
      canUseAsScenarioBase,
      timetableKind: isDraft ? 'draft' : 'published',
      metrics: t.timetable_metrics
        ? {
            roomUtilizationRate: t.timetable_metrics.room_utilization_rate,
            softConstraintsScore: t.timetable_metrics.soft_constraints_score,
            fitnessScore: t.timetable_metrics.fitness_score,
            isValid: t.timetable_metrics.is_valid,
          }
        : null,
    };
  }

  /**
   * @param semesterId When set to a positive DB id, only timetables for that semester.
   * @param draftsOnly When true, only timetables with no semester (e.g. GWO UI store draft).
   * When both omitted, returns all timetables.
   * scenarioRunBasesOnly: eligible bases for scenario runs — published schedules or GWO UI drafts only; excludes timetables that are scenario sandbox results (see ScenarioRun.result_timetable_id).
   */
  async list(semesterId?: number, draftsOnly?: boolean, scenarioRunBasesOnly?: boolean) {
    const hasSemesterFilter =
      semesterId != null &&
      typeof semesterId === 'number' &&
      Number.isFinite(semesterId) &&
      semesterId > 0;

    const scenarioBaseWhere = {
      AND: [
        { NOT: { scenario_runs_as_result: { some: {} } } },
        { generation_type: { notIn: ['what_if', 'what_if_applied'] } },
        {
          OR: [{ semester_id: { not: null } }, { generation_type: 'gwo_ui' }],
        },
      ],
    };

    let where: (typeof scenarioBaseWhere) | { semester_id: number } | undefined;
    if (scenarioRunBasesOnly) {
      where = scenarioBaseWhere;
    } else if (hasSemesterFilter && !draftsOnly) {
      where = { semester_id: semesterId! };
    } else {
      where = undefined;
    }

    // Prisma rejects `semester_id: null` in some versions; drafts are filtered in memory.
    const timetables = await this.prisma.timetable.findMany({
      ...(where ? { where } : {}),
      include: {
        semester: true,
        timetable_metrics: true,
        _count: { select: { scenario_runs_as_result: true } },
      },
      orderBy: [{ generated_at: 'desc' }, { timetable_id: 'desc' }],
    });

    const rows =
      draftsOnly && !hasSemesterFilter && !scenarioRunBasesOnly
        ? timetables.filter((t) => t.semester_id == null)
        : timetables;

    return rows.map((t) => this.mapTimetableSummary(t));
  }

  /**
   * Conflicts and validity for schedule viewer warnings and apply/publish acknowledgment.
   * Treat as needing acknowledgment when metrics say invalid or any conflict row exists.
   */
  async getTimetableConflictSummary(timetableId: number) {
    const timetable = await this.prisma.timetable.findUnique({
      where: { timetable_id: timetableId },
      select: {
        timetable_id: true,
        timetable_metrics: { select: { is_valid: true } },
      },
    });
    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${timetableId} not found`);
    }

    const conflicts = await this.prisma.timetableConflict.findMany({
      where: { timetable_id: timetableId },
      orderBy: { conflict_id: 'asc' },
    });

    const metricsIsValid =
      timetable.timetable_metrics != null ? timetable.timetable_metrics.is_valid : null;

    const requiresConflictAcknowledgment =
      metricsIsValid === false || conflicts.length > 0;

    const hardConflictCount =
      conflicts.length > 0 ? conflicts.length : metricsIsValid === false ? 1 : 0;

    return {
      timetableId: timetable.timetable_id,
      metricsIsValid,
      requiresConflictAcknowledgment,
      hardConflictCount,
      conflicts: conflicts.map((c) => ({
        conflictId: c.conflict_id,
        timetableId: c.timetable_id,
        conflictType: c.conflict_type,
        severity: c.severity,
        courseCode: c.course_code,
        sectionNumber: c.section_number,
        lecturerName: c.lecturer_name,
        roomNumber: c.room_number,
        timeslotLabel: c.timeslot_label,
        detail: c.detail,
      })),
    };
  }

  /**
   * Throws when this timetable has conflict indicators unless the client explicitly acknowledges.
   */
  async ensureHardConflictsAcknowledged(
    timetableId: number,
    acknowledgedHardConflicts: boolean | undefined,
  ): Promise<void> {
    const summary = await this.getTimetableConflictSummary(timetableId);
    if (!summary.requiresConflictAcknowledgment) return;
    if (acknowledgedHardConflicts !== true) {
      throw new BadRequestException(
        'This timetable has hard conflicts. Review them and send acknowledgedHardConflicts: true before applying or publishing.',
      );
    }
  }

  async publishDraftTimetable(
    timetableId: number,
    params: { academicYear?: string; semesterType?: number; acknowledgedHardConflicts?: boolean },
  ) {
    const academicYear = String(params.academicYear ?? '').trim();
    const semesterType = Number(params.semesterType);
    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
      throw new BadRequestException(
        'academicYear must be in YYYY-YYYY format (for example: 2025-2026).',
      );
    }
    if (![1, 2, 3].includes(semesterType)) {
      throw new BadRequestException('semesterType must be one of: 1 (First), 2 (Second), 3 (Summer).');
    }

    const timetable = await this.prisma.timetable.findUnique({
      where: { timetable_id: timetableId },
      include: {
        semester: true,
        timetable_metrics: true,
        _count: { select: { scenario_runs_as_result: true } },
      },
    });
    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${timetableId} not found`);
    }
    if (timetable.semester_id != null) {
      throw new BadRequestException('Timetable is already published.');
    }
    const isScenarioSandbox =
      timetable.generation_type === 'what_if' || timetable._count.scenario_runs_as_result > 0;
    if (isScenarioSandbox) {
      throw new BadRequestException(
        'Scenario-result timetables cannot be promoted to a published timetable. Run the scenario against an optimizer draft or published schedule; only those drafts may be published.',
      );
    }

    await this.ensureHardConflictsAcknowledged(
      timetableId,
      params.acknowledgedHardConflicts,
    );

    const semester = await this.prisma.semester.findFirst({
      where: { academic_year: academicYear, semester_type: semesterType },
      select: { semester_id: true },
    });
    if (!semester) {
      throw new BadRequestException(
        `Semester ${academicYear} (${decodeSemesterType(semesterType)}) does not exist.`,
      );
    }

    const updated = await this.prisma.timetable.update({
      where: { timetable_id: timetableId },
      data: {
        semester_id: semester.semester_id,
        status: 'active',
      },
      include: {
        semester: true,
        timetable_metrics: true,
        _count: { select: { scenario_runs_as_result: true } },
      },
    });

    return this.mapTimetableSummary(updated);
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
      lecturerName:
        e.lecturer && e.lecturer.user
          ? `${e.lecturer.user.first_name} ${e.lecturer.user.last_name}`.trim()
          : (e.lecturer_name_snapshot ?? 'Unknown Lecturer'),
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

  async buildSchedulePayload(timetableId: number) {
    const timetable = await this.prisma.timetable.findUnique({
      where: { timetable_id: timetableId },
      include: {
        semester: true,
        timetable_metrics: true,
      },
    });
    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${timetableId} not found`);
    }

    const isSummer = timetable.semester?.semester_type === 3;
    const [entries, allLecturers, allRooms, allTimeslots, conflicts, preferences] =
      await Promise.all([
        this.prisma.sectionScheduleEntry.findMany({
          where: { timetable_id: timetableId },
          include: {
            course: true,
            room: true,
            timeslot: true,
            lecturer: {
              include: {
                user: true,
                lecturer_can_teach_course: {
                  include: { course: { select: { course_code: true } } },
                },
              },
            },
          },
          orderBy: [{ slot_id: 'asc' }, { course_id: 'asc' }, { section_number: 'asc' }],
        }),
        this.prisma.lecturer.findMany({
          where: { is_available: true },
          include: { user: true },
        }),
        this.prisma.room.findMany({ where: { is_available: true }, orderBy: { room_id: 'asc' } }),
        this.prisma.timeslot.findMany({
          where: { is_active: true, is_summer: isSummer },
          orderBy: [{ start_time: 'asc' }, { slot_id: 'asc' }],
        }),
        this.prisma.timetableConflict.findMany({
          where: { timetable_id: timetableId },
          orderBy: { conflict_id: 'asc' },
        }),
        this.prisma.lecturerPreference.findMany({
          include: {
            lecturer: { include: { user: true } },
          },
        }),
      ]);

    const slotById = new Map(
      allTimeslots.map((slot) => [
        slot.slot_id,
        {
          id: `slot_${slot.slot_id}`,
          days: decodeDaysMask(slot.days_mask),
          start_hour:
            Number(formatTimeHHmm(slot.start_time).split(':')[0]) +
            Number(formatTimeHHmm(slot.start_time).split(':')[1]) / 60,
          duration:
            ((Number(formatTimeHHmm(slot.end_time).split(':')[0]) * 60 +
              Number(formatTimeHHmm(slot.end_time).split(':')[1]) -
              (Number(formatTimeHHmm(slot.start_time).split(':')[0]) * 60 +
                Number(formatTimeHHmm(slot.start_time).split(':')[1]))) ||
              90) / 60,
          slot_type: slot.slot_type,
          start_time: formatTimeHHmm(slot.start_time),
          duration_minutes:
            (Number(formatTimeHHmm(slot.end_time).split(':')[0]) * 60 +
              Number(formatTimeHHmm(slot.end_time).split(':')[1]) -
              (Number(formatTimeHHmm(slot.start_time).split(':')[0]) * 60 +
                Number(formatTimeHHmm(slot.start_time).split(':')[1]))) ||
            90,
        },
      ]),
    );

    const lecturerPreferences: Record<string, { preferred: string[]; unpreferred: string[] }> =
      {};
    for (const pref of preferences) {
      const name = `${pref.lecturer.user.first_name} ${pref.lecturer.user.last_name}`.trim();
      if (!name) continue;
      if (!lecturerPreferences[name]) {
        lecturerPreferences[name] = { preferred: [], unpreferred: [] };
      }
      const bucket = pref.is_preferred ? 'preferred' : 'unpreferred';
      lecturerPreferences[name][bucket].push(`slot_${pref.slot_id}`);
    }

    const roomTypesMap: Record<string, string> = {};
    for (const room of allRooms) {
      roomTypesMap[room.room_number] =
        room.room_type === 2 ? 'lab_room' : room.room_type === 1 ? 'lecture_hall' : 'any';
    }

    const schedule = entries.map((e) => {
      const lecturerName =
        e.lecturer?.user != null
          ? `${e.lecturer.user.first_name} ${e.lecturer.user.last_name}`.trim()
          : (e.lecturer_name_snapshot ?? 'Unknown Lecturer');
      const slot = slotById.get(e.slot_id);
      const sectionKey = `${e.course.course_code}|${e.section_number}`;
      const allowed =
        e.lecturer?.lecturer_can_teach_course
          .filter((canTeach) => canTeach.course.course_code === e.course.course_code)
          .map(() => lecturerName)
          .filter((n) => n.length > 0) ?? [];
      return {
        lecture_id: `${sectionKey}|${e.entry_id}`,
        template_lecture_id: String(e.course_id),
        section_number: e.section_number,
        course_code: e.course.course_code,
        course_name: e.course.course_name,
        room: e.course.delivery_mode === DeliveryMode.ONLINE ? null : e.room.room_number,
        room_capacity: e.room.capacity,
        class_size: e.registered_students,
        timeslot: `slot_${e.slot_id}`,
        timeslot_label:
          slot != null
            ? `${slot.days.map((d) => d.slice(0, 3)).join('/')} ${formatTimeHHmm(e.timeslot.start_time)}-${formatTimeHHmm(e.timeslot.end_time)}`
            : `slot_${e.slot_id}`,
        day: slot?.days[0] ?? '',
        lecturer: lecturerName,
        allowed_lecturers: allowed.length ? allowed : [lecturerName],
        preference_issues: [],
        has_pref_warning: false,
        delivery_mode:
          e.course.delivery_mode === DeliveryMode.ONLINE
            ? 'online'
            : e.course.delivery_mode === DeliveryMode.BLENDED
              ? 'blended'
              : 'inperson',
        session_type: e.course.is_lab ? 'lab' : 'lecture',
        slot_type: slot?.slot_type ?? e.timeslot.slot_type,
        days: slot?.days ?? [],
        start_hour: slot?.start_hour ?? 0,
        duration: slot?.duration ?? 1.5,
        room_type: roomTypesMap[e.room.room_number] ?? 'any',
        room_required: e.course.delivery_mode !== DeliveryMode.ONLINE,
      };
    });

    const lecturerLoad = new Map<string, number>();
    const lecturerCourses = new Map<string, Set<string>>();
    for (const e of entries) {
      const lecturerName =
        e.lecturer?.user != null
          ? `${e.lecturer.user.first_name} ${e.lecturer.user.last_name}`.trim()
          : (e.lecturer_name_snapshot ?? 'Unknown Lecturer');
      lecturerLoad.set(
        lecturerName,
        (lecturerLoad.get(lecturerName) ?? 0) + Number(e.course.credit_hours ?? 0),
      );
      if (!lecturerCourses.has(lecturerName)) lecturerCourses.set(lecturerName, new Set());
      lecturerCourses.get(lecturerName)?.add(e.course.course_code);
    }

    const lecturerSummary = allLecturers.map((l) => {
      const name = `${l.user.first_name} ${l.user.last_name}`.trim();
      const load = lecturerLoad.get(name) ?? 0;
      return {
        name,
        teaching_load: load,
        max_load: l.max_workload,
        overloaded: load > l.max_workload,
        courses: Array.from(lecturerCourses.get(name) ?? []),
        preferred_slots: lecturerPreferences[name]?.preferred ?? [],
        unpreferred_slots: lecturerPreferences[name]?.unpreferred ?? [],
        warning_count: 0,
        warnings: [],
        gap_count: 0,
      };
    });

    const usedRoomSlots = new Map<string, Set<string>>();
    for (const e of entries) {
      const room = e.room.room_number;
      if (!usedRoomSlots.has(room)) usedRoomSlots.set(room, new Set());
      usedRoomSlots.get(room)?.add(`slot_${e.slot_id}`);
    }

    const roomSummary = allRooms.map((room) => {
      const usedSlots = usedRoomSlots.get(room.room_number)?.size ?? 0;
      const totalSlots = allTimeslots.length;
      const roomEntries = entries.filter((e) => e.room.room_number === room.room_number);
      const totalWaste = roomEntries.reduce(
        (sum, e) => sum + Math.max(0, room.capacity - e.registered_students),
        0,
      );
      const avgWastePct =
        roomEntries.length > 0
          ? roomEntries.reduce(
              (sum, e) => sum + (room.capacity > 0 ? ((room.capacity - e.registered_students) / room.capacity) * 100 : 0),
              0,
            ) / roomEntries.length
          : 0;
      return {
        name: room.room_number,
        capacity: room.capacity,
        used_slots: usedSlots,
        total_slots: totalSlots,
        total_wasted_seats: Math.round(totalWaste),
        avg_waste_pct: Number(avgWastePct.toFixed(2)),
        room_type: roomTypesMap[room.room_number] ?? 'any',
      };
    });

    const distributionMap = new Map<string, number>();
    for (const e of entries) {
      const id = `slot_${e.slot_id}`;
      distributionMap.set(id, (distributionMap.get(id) ?? 0) + 1);
    }
    const distributionInfo = Array.from(distributionMap.entries()).map(([timeslot, classes]) => ({
      timeslot,
      classes,
      slot_type: slotById.get(Number(timeslot.replace('slot_', '')))?.slot_type,
    }));

    const workloadInfo = lecturerSummary.map((l) => ({
      lecturer: l.name,
      classes: l.teaching_load,
      credit_hour_load: l.teaching_load,
      max_workload: l.max_load,
      within_limit: l.teaching_load <= l.max_load,
    }));

    const utilizationInfo = entries.map((e) => ({
      room: e.room.room_number,
      course: e.course.course_code,
      timeslot: `slot_${e.slot_id}`,
      capacity: e.room.capacity,
      class_size: e.registered_students,
      wasted_seats: Math.max(0, e.room.capacity - e.registered_students),
      waste_pct: e.room.capacity > 0 ? Number((((e.room.capacity - e.registered_students) / e.room.capacity) * 100).toFixed(2)) : 0,
      is_empty: e.registered_students === 0,
      penalty: 0,
      room_type: roomTypesMap[e.room.room_number] ?? 'any',
      days: decodeDaysMask(e.timeslot.days_mask),
      start_hour:
        Number(formatTimeHHmm(e.timeslot.start_time).split(':')[0]) +
        Number(formatTimeHHmm(e.timeslot.start_time).split(':')[1]) / 60,
      duration:
        ((Number(formatTimeHHmm(e.timeslot.end_time).split(':')[0]) * 60 +
          Number(formatTimeHHmm(e.timeslot.end_time).split(':')[1]) -
          (Number(formatTimeHHmm(e.timeslot.start_time).split(':')[0]) * 60 +
            Number(formatTimeHHmm(e.timeslot.start_time).split(':')[1]))) ||
          90) / 60,
      slot_type: e.timeslot.slot_type,
    }));

    const wrongSlotTypeViolations = conflicts
      .filter((c) => c.conflict_type === 'wrong_timeslot_type')
      .map((c) => ({
        lecture: c.course_code,
        assigned_type: c.timeslot_label ?? '',
        delivery_mode: '',
        session_type: '',
      }));

    const unitConflictViolations = conflicts
      .filter((c) => c.conflict_type === 'cohort_overlap')
      .map((c) => ({
        unit: c.detail || 'Unknown unit',
        course_a: c.course_code,
        course_b: c.course_code,
        timeslot_a: c.timeslot_label ?? '',
        timeslot_b: c.timeslot_label ?? '',
      }));

    const totalSlots = allRooms.length * allTimeslots.length;
    const usedSlots = new Set(
      entries
        .filter((e) => e.course.delivery_mode !== DeliveryMode.ONLINE)
        .map((e) => `${e.room.room_id}|${e.slot_id}`),
    ).size;

    const roomUtilization =
      timetable.timetable_metrics != null
        ? Number(timetable.timetable_metrics.room_utilization_rate)
        : totalSlots > 0
          ? Number(((usedSlots / totalSlots) * 100).toFixed(2))
          : 0;

    return {
      schedule,
      metadata: {
        total_lectures: schedule.length,
        total_rooms: allRooms.length,
        total_timeslots: allTimeslots.length,
        total_lecturers: allLecturers.length,
        conflicts: conflicts.length,
        iterations: null,
        wolves: null,
        best_fitness:
          timetable.timetable_metrics != null
            ? Number(timetable.timetable_metrics.fitness_score)
            : null,
        generated_at: timetable.generated_at.toISOString(),
        algorithm: 'GWO',
        soft_preference_warnings: 0,
        gap_warnings: 0,
        overload_violations: lecturerSummary.filter((l) => l.overloaded).length,
        max_classes_per_lecturer: Math.max(
          0,
          ...allLecturers.map((l) => Number(l.max_workload ?? 0)),
        ),
        total_slots: totalSlots,
        used_slots: usedSlots,
        utilization_pct: roomUtilization,
        timetable_seat_utilization_pct: roomUtilization,
        workload_penalty: 0,
        distribution_penalty: 0,
        soft_weights: DEFAULT_SOFT_WEIGHTS,
        unit_conflict_count: unitConflictViolations.length,
        student_gap_count: 0,
        single_session_day_count: 0,
      },
      lecturer_summary: lecturerSummary,
      preference_warnings: [],
      gap_warnings: [],
      utilization_info: utilizationInfo,
      workload_info: workloadInfo,
      distribution_info: distributionInfo,
      room_summary: roomSummary,
      lecturer_preferences: lecturerPreferences,
      soft_weights: DEFAULT_SOFT_WEIGHTS,
      timeslots_catalogue: Array.from(slotById.values()),
      room_types_map: roomTypesMap,
      wrong_slot_type_violations: wrongSlotTypeViolations,
      study_plan_units: {},
      study_plan_summary: [],
      unit_conflict_violations: unitConflictViolations,
      student_gap_warnings: [],
      single_session_day_warnings: [],
    };
  }

  async replaceScheduleFromPayload(timetableId: number, scheduleRaw: unknown) {
    if (!Array.isArray(scheduleRaw) || scheduleRaw.length === 0) {
      throw new BadRequestException('schedule must be a non-empty array.');
    }

    const timetable = await this.prisma.timetable.findUnique({
      where: { timetable_id: timetableId },
      select: { timetable_id: true },
    });
    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${timetableId} not found`);
    }

    const lecturers = await this.prisma.lecturer.findMany({
      include: { user: { select: { first_name: true, last_name: true } } },
    });
    const lecturerByName = new Map<string, number>();
    for (const l of lecturers) {
      const full = `${l.user.first_name ?? ''} ${l.user.last_name ?? ''}`.trim().toLowerCase();
      if (full) lecturerByName.set(full, l.user_id);
    }

    const rooms = await this.prisma.room.findMany({
      select: { room_id: true, room_number: true, room_type: true },
      orderBy: { room_id: 'asc' },
    });
    const roomByNumber = new Map<string, number>();
    for (const r of rooms) {
      roomByNumber.set(r.room_number.trim().toLowerCase(), r.room_id);
    }
    const virtualRoomId =
      rooms.find((r) => r.room_type === 3)?.room_id ??
      rooms[0]?.room_id ??
      null;
    if (virtualRoomId == null) {
      throw new BadRequestException('No rooms found in database.');
    }

    const courseRows = await this.prisma.course.findMany({
      select: { course_id: true, course_code: true },
    });
    const courseByCode = new Map<string, number>();
    for (const c of courseRows) {
      courseByCode.set(c.course_code.trim().toLowerCase(), c.course_id);
    }

    const rowsToCreate: Array<{
      timetable_id: number;
      user_id: number;
      slot_id: number;
      course_id: number;
      room_id: number;
      registered_students: number;
      section_number: string;
    }> = [];

    for (const raw of scheduleRaw as Array<Record<string, unknown>>) {
      const courseCode = String(raw.course_code ?? '').trim();
      const lecturerName = String(raw.lecturer ?? '').trim();
      const timeslot = String(raw.timeslot ?? '').trim();
      const sectionNumber = String(raw.section_number ?? 'S1').trim() || 'S1';
      const classSize = Number(raw.class_size ?? 0);
      const deliveryMode = String(raw.delivery_mode ?? 'inperson').toLowerCase().replace(/_/g, '');
      const roomName = String(raw.room ?? '').trim();

      const slotMatch = /^slot_(\d+)$/i.exec(timeslot);
      if (!slotMatch) {
        throw new BadRequestException(
          `Unsupported timeslot id "${timeslot}". Expected DB slot id format "slot_<id>".`,
        );
      }
      const slotId = Number(slotMatch[1]);
      if (!Number.isFinite(slotId) || slotId <= 0) {
        throw new BadRequestException(`Invalid timeslot id "${timeslot}".`);
      }

      const courseId = courseByCode.get(courseCode.toLowerCase());
      if (courseId == null) {
        throw new BadRequestException(`Unknown course code "${courseCode}".`);
      }

      const userId = lecturerByName.get(lecturerName.toLowerCase());
      if (userId == null) {
        throw new BadRequestException(`Unknown lecturer "${lecturerName}".`);
      }

      let roomId = virtualRoomId;
      const needsRoom = deliveryMode !== 'online';
      if (needsRoom) {
        const mappedRoomId = roomByNumber.get(roomName.toLowerCase());
        if (mappedRoomId == null) {
          throw new BadRequestException(`Unknown room "${roomName}".`);
        }
        roomId = mappedRoomId;
      }

      rowsToCreate.push({
        timetable_id: timetableId,
        user_id: userId,
        slot_id: slotId,
        course_id: courseId,
        room_id: roomId,
        registered_students: Number.isFinite(classSize) ? Math.max(0, Math.round(classSize)) : 0,
        section_number: sectionNumber,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sectionScheduleEntry.deleteMany({
        where: { timetable_id: timetableId },
      });
      await tx.timetableConflict.deleteMany({
        where: { timetable_id: timetableId },
      });
      await tx.sectionScheduleEntry.createMany({
        data: rowsToCreate,
      });
      await tx.timetable.update({
        where: { timetable_id: timetableId },
        data: { generated_at: new Date() },
      });
    });

    return {
      ok: true,
      timetableId,
      entryCount: rowsToCreate.length,
    };
  }
}

