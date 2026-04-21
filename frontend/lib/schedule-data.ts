
// ─── Config Types (Single Source of Truth) ───────────────────────────────────

export type RoomConfigValue =
  | number
  | { capacity: number; room_type?: string }

export type TimeslotConfigEntry = {
  id: string
  days: string[]
  start_hour?: number
  duration?: number
  slot_type?: string
  /** Shown in timetable column headers (e.g. T1); see legend for full times. */
  short_code?: string
  label?: string
  start_time?: string
  duration_minutes?: number
}

export type LectureConfig = {
  id: number
  course: string
  /** Full title for UI / exports (GWO reads `course` as the canonical code). */
  course_name?: string
  /** Lecturer indices into `config.lecturers`, and/or lecturer names (as in exported schedules). */
  allowed_lecturers: Array<number | string>
  size: number
  delivery_mode?: string
  session_type?: string
  /** BUG 5 FIX: credit hours of this course — used for workload calculation (constraints 8 & 11). */
  credit_hours?: number
  /** Section label, e.g. "S1", "S2". Distinguishes parallel sections of the same course. */
  section_number?: string
}

export type GWOParams = {
  num_wolves: number
  num_iterations: number
  mutation_rate: number
  stagnation_limit: number
  num_runs: number
  max_classes_per_lecturer: number
  perfect_threshold: number
}

// BUG FIX 4: New fields marked optional (?) for backward compatibility with
// existing code that constructs SoftWeights objects without them.
// The API layer always provides these values via DEFAULT_SOFT_WEIGHTS merging,
// so runtime access is safe — the ? only relaxes the TypeScript compile check.
export type SoftWeights = {
  preferred_timeslot:      number
  unpreferred_timeslot:    number
  minimize_gaps:           number
  room_utilization:        number
  balanced_workload:       number
  distribute_classes:      number
  // NEW: student-centric soft weights (optional for backward compat)
  student_gaps?:           number   // penalty for idle gaps between a student's lectures in a day
  /** Penalise a study-plan unit with only one session on a day (Python: `single_session_day`). */
  single_session_day?:   number
}

export type ScheduleConfig = {
  rooms: Record<string, RoomConfigValue>
  timeslots: TimeslotConfigEntry[] | string[]
  lecturers: string[]
  lecturer_preferences: Record<string, { preferred: string[]; unpreferred: string[] }>
  lectures: LectureConfig[]
  gwo_params: GWOParams
  soft_weights: SoftWeights
  /** Optional: maps unit IDs to their course code bundles (e.g. "CompEng_Y1S1" -> ["CS101","MATH101"]) */
  study_plan_units?: Record<string, string[]>
  /**
   * BUG 2 FIX: per-lecturer available timeslot IDs (constraint 4).
   * Key = lecturer display name, value = list of timeslot IDs they are free for.
   * An absent key or empty array means no restriction — all slots allowed.
   */
  lecturer_availability?: Record<string, string[]>
  /**
   * BUG 4 FIX: per-lecturer credit-hour teaching ceiling (constraints 8 & 11).
   * Key = lecturer display name, value = maximum total credit hours they may teach.
   * Falls back to gwo_params.max_classes_per_lecturer when absent.
   */
  lecturer_max_workload?: Record<string, number>
}

// ─── Schedule Types ───────────────────────────────────────────────────────────

export type ScheduleEntry = {
  lecture_id: string | number
  course_code: string
  course_name: string
  room: string | null
  room_capacity?: number
  class_size?: number
  timeslot: string
  timeslot_label?: string
  day: string
  lecturer: string
  allowed_lecturers?: string[]
  preference_issues?: string[]
  has_pref_warning?: boolean
  delivery_mode?: string
  session_type?: string
  slot_type?: string
  days?: string[]
  start_hour?: number
  duration?: number
  room_type?: string
  room_required?: boolean
  /** @deprecated use room_required */
  requires_room?: boolean
}

export type LecturerWarning = {
  lecturer: string
  course: string
  timeslot: string
  reason: string
  severity: "unpreferred" | "not_preferred"
}

export type GapWarning = {
  lecturer: string
  between: string
  gap?: number
  gap_hours?: number
}

export type UtilizationInfo = {
  room: string
  course: string
  timeslot: string
  capacity: number
  class_size: number
  wasted_seats: number
  waste_pct: number
  is_empty?: boolean
  penalty: number
  room_type?: string
  days?: string[]
  start_hour?: number
  duration?: number
  slot_type?: string
}

export type WorkloadInfo = {
  lecturer: string
  /** Credit-hour-weighted teaching load (BUG 3 FIX). Kept as 'classes' for UI backward compat. */
  classes: number
  /** Explicit alias for credit-hour load — same value as `classes`. */
  credit_hour_load?: number
  /** Per-lecturer ceiling from DB (BUG 4 FIX). */
  max_workload?: number
  /** True when load ≤ max_workload. */
  within_limit?: boolean
}

export type DistributionInfo = {
  timeslot: string
  classes: number
  slot_type?: string
}

export type WrongSlotTypeViolation = {
  lecture: string
  assigned_type: string
  delivery_mode: string
  session_type: string
}

export type LecturerSummary = {
  name: string
  teaching_load: number
  max_load: number
  overloaded: boolean
  courses: string[]
  preferred_slots: string[]
  unpreferred_slots: string[]
  warning_count: number
  warnings: LecturerWarning[]
  gap_count?: number
}

export type RoomSummary = {
  name: string
  capacity: number
  used_slots: number
  total_slots: number
  total_wasted_seats?: number
  avg_waste_pct?: number
  room_type?: string
}

export type SessionCounts = {
  inperson_lectures: number
  online_lectures: number
  blended_lectures: number
  lab_sessions: number
}

// ─── NEW: Study Plan Types ────────────────────────────────────────────────────

/** Two courses in the same semester unit scheduled at overlapping times (hard violation). */
export type UnitConflictViolation = {
  unit: string
  course_a: string
  course_b: string
  timeslot_a: string
  timeslot_b: string
}

/** A gap between consecutive sessions for students in a semester unit on a given day. */
export type StudentGapWarning = {
  unit: string
  day: string
  gap_hours: number
}

/** A study-plan unit with only one session on a given day (Python: `single_session_day_warnings`). */
export type SingleSessionDayWarning = {
  unit: string
  day?: string
  course: string
  reason: string
}

/** High-level per-unit summary for the dashboard. */
export type StudyPlanUnitSummary = {
  unit_id: string
  courses: string[]
  conflict_count: number
  gap_count: number
  single_session_day_count: number
}

// ─────────────────────────────────────────────────────────────────────────────

export type ScheduleMeta = {
  total_lectures: number
  total_rooms: number
  total_timeslots: number
  total_lecturers: number
  conflicts: number
  iterations: number | null
  wolves: number | null
  best_fitness: number | null
  generated_at: string | null
  algorithm?: string
  soft_preference_warnings: number
  gap_warnings: number
  overload_violations: number
  max_classes_per_lecturer: number
  total_slots?: number
  used_slots?: number
  utilization_pct: number
  /** Catalog room×timeslot seat fill (higher is better); optional on older schedule.json files. */
  timetable_seat_utilization_pct?: number
  workload_penalty: number
  distribution_penalty: number
  soft_weights: SoftWeights
  inperson_lectures?: number
  online_lectures?: number
  blended_lectures?: number
  lab_sessions?: number
  // NEW (optional — may be absent in older saved files)
  unit_conflict_count?:  number
  student_gap_count?:    number
  single_session_day_count?: number
}

export type SchedulePayload = {
  schedule: ScheduleEntry[]
  metadata: ScheduleMeta
  lecturer_summary: LecturerSummary[]
  preference_warnings: LecturerWarning[]
  gap_warnings: GapWarning[]
  utilization_info: UtilizationInfo[]
  workload_info: WorkloadInfo[]
  distribution_info: DistributionInfo[]
  room_summary: RoomSummary[]
  lecturer_preferences: Record<string, { preferred: string[]; unpreferred: string[] }>
  soft_weights: SoftWeights
  timeslots_catalogue?: import("./timetable-model").TimeslotCatalogueEntry[]
  room_types_map?: Record<string, string>
  session_counts?: SessionCounts
  wrong_slot_type_violations?: WrongSlotTypeViolation[]
  // NEW: study plan / student constraint data (optional — absent in older saved files)
  study_plan_units?:         Record<string, string[]>
  study_plan_summary?:       StudyPlanUnitSummary[]
  unit_conflict_violations?: UnitConflictViolation[]
  student_gap_warnings?:     StudentGapWarning[]
  single_session_day_warnings?: SingleSessionDayWarning[]
}

// ─── Lecturer colours ─────────────────────────────────────────────────────────

export const lecturerColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Alice:   { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-300",    dot: "bg-blue-500"    },
  Bob:     { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500" },
  Charlie: { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-300",   dot: "bg-amber-500"   },
  David:   { bg: "bg-rose-100",    text: "text-rose-800",    border: "border-rose-300",    dot: "bg-rose-500"    },
  Eva:     { bg: "bg-violet-100",  text: "text-violet-800",  border: "border-violet-300",  dot: "bg-violet-500"  },
  Frank:   { bg: "bg-cyan-100",    text: "text-cyan-800",    border: "border-cyan-300",    dot: "bg-cyan-500"    },
}

export const fallbackColor = {
  bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", dot: "bg-slate-400",
}

const dynamicPalette = [
  { bg: "bg-sky-100", text: "text-sky-800", border: "border-sky-300", dot: "bg-sky-500" },
  { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300", dot: "bg-orange-500" },
  { bg: "bg-lime-100", text: "text-lime-800", border: "border-lime-300", dot: "bg-lime-600" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-800", border: "border-fuchsia-300", dot: "bg-fuchsia-500" },
  { bg: "bg-teal-100", text: "text-teal-800", border: "border-teal-300", dot: "bg-teal-500" },
  { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300", dot: "bg-indigo-500" },
  { bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-300", dot: "bg-pink-500" },
  { bg: "bg-stone-100", text: "text-stone-800", border: "border-stone-300", dot: "bg-stone-500" },
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getLecturerColor(name: string) {
  const preset = lecturerColors[name];
  if (preset) return preset;
  const idx = hashString(name) % dynamicPalette.length;
  return dynamicPalette[idx] ?? fallbackColor;
}
