import * as fs from "fs";
import * as path from "path";

export type LecturerPreferenceWarning = {
  lecturer: string;
  course: string;
  timeslot: string;
  reason: string;
  severity: "unpreferred" | "not_preferred";
};

export type GapWarning = {
  lecturer: string;
  between: string;
  gap_hours: number;
  gap: number;
};

export type StudentGapWarning = {
  unit: string;
  day: string;
  gap_hours: number;
};

export type SingleSessionDayWarning = {
  unit: string;
  day: string;
  course: string;
  reason: string;
};

export type ScheduleEntryForSoftMetrics = {
  lecturer: string;
  course_code: string;
  timeslot: string;
  timeslot_label?: string;
  delivery_mode?: string;
  days?: string[];
  start_hour?: number;
  duration?: number;
};

export type LecturerPreferencesMap = Record<
  string,
  { preferred: string[]; unpreferred: string[] }
>;

export type SoftMetricsResult = {
  preference_warnings: LecturerPreferenceWarning[];
  gap_warnings: GapWarning[];
  student_gap_warnings: StudentGapWarning[];
  single_session_day_warnings: SingleSessionDayWarning[];
  study_plan_units: Record<string, string[]>;
  study_plan_summary: Array<{
    unit_id: string;
    courses: string[];
    conflict_count: number;
    gap_count: number;
    single_session_day_count: number;
  }>;
};

type SessionSpan = {
  start: number;
  end: number;
  timeslot: string;
  courseCode: string;
};

function normalizeCourseKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isOnlineDelivery(mode: string | undefined): boolean {
  return String(mode ?? "")
    .trim()
    .toLowerCase() === "online";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Resolve programs.json course ids to course codes using DB course rows. */
export function buildCourseLookup(
  courses: Array<{ course_id: number; course_code: string }>,
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const c of courses) {
    const code = String(c.course_code).trim();
    if (!code) continue;
    lookup.set(normalizeCourseKey(code), code);
    lookup.set(normalizeCourseKey(c.course_id), code);
  }
  return lookup;
}

export function loadStudyPlanUnitsFromPrograms(
  courseLookup: Map<string, string>,
): Record<string, string[]> {
  const candidates = [
    path.join(process.cwd(), "frontend", "programs.json"),
    path.join(process.cwd(), "programs.json"),
    path.join(process.cwd(), "..", "frontend", "programs.json"),
    path.join(__dirname, "..", "..", "..", "frontend", "programs.json"),
  ];

  let raw: unknown = null;
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        break;
      }
    } catch {
      // try next path
    }
  }
  if (raw == null || typeof raw !== "object" || raw === null) {
    return {};
  }

  const units: Record<string, string[]> = {};
  for (const [programName, years] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (typeof years !== "object" || years === null) continue;
    for (const [yearName, semesters] of Object.entries(
      years as Record<string, unknown>,
    )) {
      if (typeof semesters !== "object" || semesters === null) continue;
      for (const [semesterName, courseIds] of Object.entries(
        semesters as Record<string, unknown>,
      )) {
        if (!Array.isArray(courseIds)) continue;
        const unitId = `${programName} | ${yearName} | ${semesterName}`;
        const codes: string[] = [];
        for (const id of courseIds) {
          const resolved = courseLookup.get(normalizeCourseKey(id));
          if (resolved) codes.push(resolved);
        }
        if (codes.length > 0) {
          units[unitId] = [...new Set(codes)];
        }
      }
    }
  }
  return units;
}

export function computePreferenceWarnings(
  schedule: ScheduleEntryForSoftMetrics[],
  lecturerPreferences: LecturerPreferencesMap,
): LecturerPreferenceWarning[] {
  const warnings: LecturerPreferenceWarning[] = [];
  for (const entry of schedule) {
    const prefs = lecturerPreferences[entry.lecturer] ?? {
      preferred: [],
      unpreferred: [],
    };
    const timeslotId = entry.timeslot;
    if (prefs.unpreferred.includes(timeslotId)) {
      warnings.push({
        lecturer: entry.lecturer,
        course: entry.course_code,
        timeslot: timeslotId,
        reason: "assigned to unpreferred timeslot",
        severity: "unpreferred",
      });
    } else if (
      prefs.preferred.length > 0 &&
      !prefs.preferred.includes(timeslotId)
    ) {
      warnings.push({
        lecturer: entry.lecturer,
        course: entry.course_code,
        timeslot: timeslotId,
        reason: "not assigned to a preferred timeslot",
        severity: "not_preferred",
      });
    }
  }
  return warnings;
}

function appendSessionSpan(
  map: Map<string, Map<string, SessionSpan[]>>,
  entityKey: string,
  day: string,
  span: SessionSpan,
): void {
  if (!map.has(entityKey)) map.set(entityKey, new Map());
  const dayMap = map.get(entityKey)!;
  if (!dayMap.has(day)) dayMap.set(day, []);
  dayMap.get(day)!.push(span);
}

function entryToSessionSpan(entry: ScheduleEntryForSoftMetrics): SessionSpan | null {
  const start = Number(entry.start_hour ?? 0);
  const duration = Number(entry.duration ?? 0);
  if (!Number.isFinite(start) || !Number.isFinite(duration)) return null;
  return {
    start,
    end: start + duration,
    timeslot: entry.timeslot,
    courseCode: entry.course_code,
  };
}

export function computeLecturerGapWarnings(
  schedule: ScheduleEntryForSoftMetrics[],
  timeslotLabelById: Map<string, string>,
): GapWarning[] {
  const byLecturer = new Map<string, Map<string, SessionSpan[]>>();
  for (const entry of schedule) {
    if (isOnlineDelivery(entry.delivery_mode)) continue;
    const span = entryToSessionSpan(entry);
    if (!span) continue;
    const days = entry.days?.length ? entry.days : [""];
    for (const day of days) {
      appendSessionSpan(byLecturer, entry.lecturer, day, span);
    }
  }

  const warnings: GapWarning[] = [];
  for (const [lecturer, dayMap] of byLecturer) {
    for (const spans of dayMap.values()) {
      if (spans.length < 2) continue;
      const sorted = [...spans].sort((a, b) => a.start - b.start);
      for (let i = 0; i < sorted.length - 1; i += 1) {
        const gap = round2(sorted[i + 1].start - sorted[i].end);
        if (gap <= 0) continue;
        const labelA =
          timeslotLabelById.get(sorted[i].timeslot) ?? sorted[i].timeslot;
        const labelB =
          timeslotLabelById.get(sorted[i + 1].timeslot) ??
          sorted[i + 1].timeslot;
        warnings.push({
          lecturer,
          between: `${labelA} and ${labelB}`,
          gap_hours: gap,
          gap,
        });
      }
    }
  }
  return warnings;
}

export function computeStudentGapWarnings(
  schedule: ScheduleEntryForSoftMetrics[],
  studyPlanUnits: Record<string, string[]>,
): StudentGapWarning[] {
  const warnings: StudentGapWarning[] = [];
  for (const [unitId, courses] of Object.entries(studyPlanUnits)) {
    const courseSet = new Set(courses.map((c) => normalizeCourseKey(c)));
    const byDay = new Map<string, SessionSpan[]>();
    for (const entry of schedule) {
      if (!courseSet.has(normalizeCourseKey(entry.course_code))) continue;
      if (isOnlineDelivery(entry.delivery_mode)) continue;
      const span = entryToSessionSpan(entry);
      if (!span) continue;
      const days = entry.days?.length ? entry.days : [""];
      for (const day of days) {
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(span);
      }
    }
    for (const [day, spans] of byDay) {
      if (spans.length < 2) continue;
      const sorted = [...spans].sort((a, b) => a.start - b.start);
      for (let i = 0; i < sorted.length - 1; i += 1) {
        const gap = round2(sorted[i + 1].start - sorted[i].end);
        if (gap > 0) {
          warnings.push({ unit: unitId, day, gap_hours: gap });
        }
      }
    }
  }
  return warnings;
}

export function computeSingleSessionDayWarnings(
  schedule: ScheduleEntryForSoftMetrics[],
  studyPlanUnits: Record<string, string[]>,
): SingleSessionDayWarning[] {
  const warnings: SingleSessionDayWarning[] = [];

  // Student cohorts (study-plan units) — matches GWO validate_schedule output.
  for (const [unitId, courses] of Object.entries(studyPlanUnits)) {
    const courseSet = new Set(courses.map((c) => normalizeCourseKey(c)));
    const byDay = new Map<string, Set<string>>();
    for (const entry of schedule) {
      if (!courseSet.has(normalizeCourseKey(entry.course_code))) continue;
      if (isOnlineDelivery(entry.delivery_mode)) continue;
      const days = entry.days?.length ? entry.days : [""];
      for (const day of days) {
        if (!byDay.has(day)) byDay.set(day, new Set());
        byDay.get(day)!.add(entry.course_code);
      }
    }
    for (const [day, courseCodes] of byDay) {
      if (courseCodes.size !== 1) continue;
      const course = [...courseCodes][0]!;
      warnings.push({
        unit: unitId,
        day,
        course,
        reason: `Only one session on ${day} — students commute for just one class`,
      });
    }
  }

  // Lecturers with only one session on a given day.
  const byLecturer = new Map<string, Map<string, Set<string>>>();
  for (const entry of schedule) {
    if (isOnlineDelivery(entry.delivery_mode)) continue;
    const days = entry.days?.length ? entry.days : [""];
    for (const day of days) {
      if (!byLecturer.has(entry.lecturer)) {
        byLecturer.set(entry.lecturer, new Map());
      }
      const dayMap = byLecturer.get(entry.lecturer)!;
      if (!dayMap.has(day)) dayMap.set(day, new Set());
      dayMap.get(day)!.add(entry.course_code);
    }
  }
  for (const [lecturer, dayMap] of byLecturer) {
    for (const [day, courseCodes] of dayMap) {
      if (courseCodes.size !== 1) continue;
      const course = [...courseCodes][0]!;
      warnings.push({
        unit: lecturer,
        day,
        course,
        reason: `Only one session on ${day} — lecturer has a single class that day`,
      });
    }
  }

  return warnings;
}

export function buildStudyPlanSummary(
  studyPlanUnits: Record<string, string[]>,
  unitConflictViolations: Array<{ unit: string }>,
  studentGapWarnings: StudentGapWarning[],
  singleSessionDayWarnings: SingleSessionDayWarning[],
): SoftMetricsResult["study_plan_summary"] {
  return Object.entries(studyPlanUnits).map(([unitId, courses]) => ({
    unit_id: unitId,
    courses,
    conflict_count: unitConflictViolations.filter((v) => v.unit === unitId)
      .length,
    gap_count: studentGapWarnings.filter((w) => w.unit === unitId).length,
    single_session_day_count: singleSessionDayWarnings.filter(
      (w) => w.unit === unitId,
    ).length,
  }));
}

export function computeSoftMetrics(
  schedule: ScheduleEntryForSoftMetrics[],
  lecturerPreferences: LecturerPreferencesMap,
  studyPlanUnits: Record<string, string[]>,
  unitConflictViolations: Array<{ unit: string }>,
  timeslotLabelById: Map<string, string>,
): SoftMetricsResult {
  const preference_warnings = computePreferenceWarnings(
    schedule,
    lecturerPreferences,
  );
  const gap_warnings = computeLecturerGapWarnings(schedule, timeslotLabelById);
  const student_gap_warnings = computeStudentGapWarnings(
    schedule,
    studyPlanUnits,
  );
  const single_session_day_warnings = computeSingleSessionDayWarnings(
    schedule,
    studyPlanUnits,
  );

  return {
    preference_warnings,
    gap_warnings,
    student_gap_warnings,
    single_session_day_warnings,
    study_plan_units: studyPlanUnits,
    study_plan_summary: buildStudyPlanSummary(
      studyPlanUnits,
      unitConflictViolations,
      student_gap_warnings,
      single_session_day_warnings,
    ),
  };
}
