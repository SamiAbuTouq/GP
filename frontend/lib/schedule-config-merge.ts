import type { ScheduleConfig } from "./schedule-data";

/** Defaults when `data/config.json` is missing or incomplete (matches `app/api/config/route.ts`). */
export const SCHEDULE_CONFIG_DEFAULTS: Omit<
  ScheduleConfig,
  "timeslots" | "lecturers" | "lecturer_preferences" | "lectures" | "rooms"
> & {
  rooms: ScheduleConfig["rooms"];
  timeslots: ScheduleConfig["timeslots"];
  lecturers: ScheduleConfig["lecturers"];
  lecturer_preferences: ScheduleConfig["lecturer_preferences"];
  lectures: ScheduleConfig["lectures"];
} = {
  rooms: {
    R1: 30,
    R2: 50,
    R3: 40,
    R4: 60,
    R5: 35,
  },
  timeslots: ["T1", "T2", "T3", "T4", "T5"],
  lecturers: ["Alice", "Bob", "Charlie", "David", "Eva", "Frank"],
  lecturer_preferences: {
    Alice: { preferred: ["T1", "T2"], unpreferred: ["T5"] },
    Bob: { preferred: ["T3"], unpreferred: ["T1"] },
    Charlie: { preferred: ["T2", "T3"], unpreferred: [] },
    David: { preferred: [], unpreferred: ["T4", "T5"] },
    Eva: { preferred: ["T1"], unpreferred: ["T3"] },
    Frank: { preferred: ["T4", "T5"], unpreferred: ["T1", "T2"] },
  },
  lectures: [
    { id: 1, course: "Course_1", allowed_lecturers: [0, 2], size: 28 },
    { id: 2, course: "Course_2", allowed_lecturers: [1, 3, 4], size: 45 },
    { id: 3, course: "Course_3", allowed_lecturers: [0, 1, 5], size: 38 },
    { id: 4, course: "Course_4", allowed_lecturers: [2, 3], size: 55 },
    { id: 5, course: "Course_5", allowed_lecturers: [1, 4, 5], size: 30 },
    { id: 6, course: "Course_6", allowed_lecturers: [0, 3, 4], size: 25 },
    { id: 7, course: "Course_7", allowed_lecturers: [2, 5], size: 40 },
    { id: 8, course: "Course_8", allowed_lecturers: [0, 1, 2], size: 32 },
    { id: 9, course: "Course_9", allowed_lecturers: [3, 4, 5], size: 58 },
    { id: 10, course: "Course_10", allowed_lecturers: [1, 2, 3], size: 35 },
    { id: 11, course: "Course_11", allowed_lecturers: [0, 5], size: 22 },
    { id: 12, course: "Course_12", allowed_lecturers: [1, 3, 5], size: 48 },
    { id: 13, course: "Course_13", allowed_lecturers: [0, 2, 4], size: 30 },
    { id: 14, course: "Course_14", allowed_lecturers: [3, 4], size: 60 },
    { id: 15, course: "Course_15", allowed_lecturers: [1, 2, 5], size: 36 },
  ],
  gwo_params: {
    num_wolves: 30,
    num_iterations: 200,
    mutation_rate: 0.5,
    stagnation_limit: 10,
    num_runs: 5,
    max_classes_per_lecturer: 5,
    perfect_threshold: 0.000001,
  },
  soft_weights: {
    preferred_timeslot: 80,
    unpreferred_timeslot: 70,
    minimize_gaps: 60,
    room_utilization: 90,
    balanced_workload: 50,
    distribute_classes: 65,
    student_gaps: 70,
    single_session_day: 50,
  },
  study_plan_units: {},
  last_allowed_hour: null,
};

export function mergeConfigWithDefaults(parsed: Record<string, unknown>): ScheduleConfig {
  const rawSoft = { ...(parsed.soft_weights as Record<string, number> | undefined) };
  if (rawSoft.single_session_day == null && rawSoft.early_thursday_penalty != null) {
    rawSoft.single_session_day = rawSoft.early_thursday_penalty;
  }
  return {
    ...SCHEDULE_CONFIG_DEFAULTS,
    ...parsed,
    rooms: { ...SCHEDULE_CONFIG_DEFAULTS.rooms, ...(parsed.rooms as object) },
    timeslots: (parsed.timeslots as ScheduleConfig["timeslots"]) ?? SCHEDULE_CONFIG_DEFAULTS.timeslots,
    lecturers: (parsed.lecturers as string[]) ?? SCHEDULE_CONFIG_DEFAULTS.lecturers,
    lecturer_preferences: {
      ...SCHEDULE_CONFIG_DEFAULTS.lecturer_preferences,
      ...(parsed.lecturer_preferences as object),
    },
    lectures: (parsed.lectures as ScheduleConfig["lectures"]) ?? SCHEDULE_CONFIG_DEFAULTS.lectures,
    gwo_params: {
      ...SCHEDULE_CONFIG_DEFAULTS.gwo_params,
      ...((parsed.gwo_params as object) ?? {}),
    },
    soft_weights: {
      ...SCHEDULE_CONFIG_DEFAULTS.soft_weights,
      ...rawSoft,
    },
    study_plan_units: {
      ...SCHEDULE_CONFIG_DEFAULTS.study_plan_units,
      ...((parsed.study_plan_units as object) ?? {}),
    },
    last_allowed_hour:
      parsed.last_allowed_hour === undefined
        ? SCHEDULE_CONFIG_DEFAULTS.last_allowed_hour
        : parsed.last_allowed_hour === null
          ? null
          : String(parsed.last_allowed_hour),
  };
}
