import type { DeliveryMode } from "@prisma/client";
import type { LectureConfig, RoomConfigValue, ScheduleConfig, TimeslotConfigEntry } from "./schedule-data";
import { prisma } from "./prisma";

/** Matches `daysToBitmask` in `prisma/seed.ts` (bit 0=Sun … bit 5=Sat; no Friday bit). */
function daysMaskToWeekdayNames(mask: number): string[] {
  const parts: { bit: number; name: string }[] = [
    { bit: 1, name: "Sunday" },
    { bit: 2, name: "Monday" },
    { bit: 4, name: "Tuesday" },
    { bit: 8, name: "Wednesday" },
    { bit: 16, name: "Thursday" },
    { bit: 32, name: "Saturday" },
  ];
  const out: string[] = [];
  for (const { bit, name } of parts) {
    if (mask & bit) out.push(name);
  }
  return out;
}

/** Prisma `@db.Time()` → fractional hour (UTC components; matches seed `parseTime`). */
function timeDateToHourFraction(d: Date): number {
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

function approxEq(a: number, b: number, eps = 0.08): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Map DB row + calendar pattern to GWO `slot_type` strings (`scripts/GWO-v6.py` SLOT_TYPE_RULES).
 * Seed stores human labels ("Lab", "Traditional Lecture"); GWO expects lecture_mw, lab, etc.
 */
function inferGwoSlotType(days: string[], durationHours: number, dbSlotType: string): string {
  const t = dbSlotType.trim();
  if (/lab/i.test(t) || durationHours >= 2.5) {
    return "lab";
  }

  const set = new Set(days);
  const has = (name: string) => set.has(name);
  const n = days.length;

  if (n === 2 && has("Monday") && has("Wednesday") && approxEq(durationHours, 1.5)) {
    return "lecture_mw";
  }
  if (n === 3 && has("Sunday") && has("Tuesday") && has("Thursday") && approxEq(durationHours, 1)) {
    return "lecture_stt";
  }
  if (n === 1 && has("Monday") && approxEq(durationHours, 1.5)) {
    return "blended_mon";
  }
  if (n === 1 && has("Wednesday") && approxEq(durationHours, 1.5)) {
    return "blended_wed";
  }
  if (n === 2 && has("Sunday") && has("Tuesday") && approxEq(durationHours, 1)) {
    return "blended_st";
  }

  if (/blended/i.test(t)) {
    if (n === 1 && has("Monday")) return "blended_mon";
    if (n === 1 && has("Wednesday")) return "blended_wed";
    if (has("Sunday") && has("Tuesday") && !has("Thursday")) return "blended_st";
    return "blended_st";
  }

  if (has("Monday") && has("Wednesday")) return "lecture_mw";
  if (has("Sunday") && has("Tuesday") && has("Thursday")) return "lecture_stt";
  if (n === 1 && has("Monday")) return "blended_mon";
  if (n === 1 && has("Wednesday")) return "blended_wed";
  return "lecture_stt";
}

/** Exposed for timetable persistence: maps a DB row to the canonical `slot_<id>` used in GWO / `schedule.json`. */
export function prismaTimeslotRowToConfig(row: {
  slot_id: number;
  start_time: Date;
  end_time: Date;
  days_mask: number;
  slot_type: string;
}): TimeslotConfigEntry | null {
  const days = daysMaskToWeekdayNames(row.days_mask);
  if (days.length === 0) return null;

  const startH = timeDateToHourFraction(row.start_time);
  const endH = timeDateToHourFraction(row.end_time);
  let duration = endH - startH;
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  const slot_type = inferGwoSlotType(days, duration, row.slot_type);

  return {
    id: `slot_${row.slot_id}`,
    days,
    start_hour: startH,
    duration,
    slot_type,
  };
}

/**
 * Loads structured timeslots from PostgreSQL for GWO / UI.
 * Returns null if no DB URL, on error, or when there are no usable rows.
 */
export async function loadTimeslotsFromDatabase(): Promise<TimeslotConfigEntry[] | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }

  const rows = await prisma.timeslot.findMany({
    where: { days_mask: { not: 0 } },
    orderBy: { slot_id: "asc" },
  });

  const out: TimeslotConfigEntry[] = [];
  for (const row of rows) {
    const entry = prismaTimeslotRowToConfig(row);
    if (entry) out.push(entry);
  }

  return out.length > 0 ? out : null;
}

/** Prisma `room_type`: 1 lecture hall, 2 lab, 3 online/virtual — GWO expects string labels. */
function prismaRoomTypeToGwo(rt: number): string {
  if (rt === 2) return "lab_room";
  if (rt === 1) return "lecture_hall";
  return "any";
}

function deliveryModeToGwo(dm: DeliveryMode): "inperson" | "online" | "blended" {
  if (dm === "ONLINE") return "online";
  if (dm === "BLENDED") return "blended";
  return "inperson";
}

function maxRoomCapacity(rooms: Record<string, RoomConfigValue>): number {
  let m = 1;
  for (const v of Object.values(rooms)) {
    const c = typeof v === "number" ? v : v.capacity;
    if (Number.isFinite(c) && c > m) m = c;
  }
  return m;
}

/**
 * Loads rooms, lecturers, preferences shell, and lectures from PostgreSQL (seeded schema).
 * Timeslots are loaded separately via `loadTimeslotsFromDatabase` and override `config.json`
 * when the `timeslot` table has rows (see `mergeFileConfigWithDatabase`).
 * gwo_params, soft_weights, study_plan_units stay from the merged file config.
 *
 * Scheduling rules from the DB:
 * - Lecturers: only rows with `is_available === true`; each slot may only use lecturers listed in
 *   `lecturer_can_teach_course` (mapped to indices in the `lecturers` array).
 * - Courses: `Course.sections` is the number of parallel sections to schedule; `0` means the
 *   course is omitted. Each section becomes one `LectureConfig` row (same course code, unique `id`).
 */
// BUG 2 + 4 FIX: extended return type includes availability and per-lecturer max workload.
export async function loadScheduleConfigEntitiesFromDatabase(): Promise<
  Pick<ScheduleConfig, "rooms" | "lecturers" | "lecturer_preferences" | "lectures"
    | "lecturer_availability" | "lecturer_max_workload"> | null
> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }

  const roomsRaw = await prisma.room.findMany({
    where: {
      is_available: true,
      room_type: { not: 3 },
    },
    orderBy: { room_id: "asc" },
  });

  if (roomsRaw.length === 0) {
    return null;
  }

  const rooms: Record<string, RoomConfigValue> = {};
  const usedKeys = new Set<string>();
  for (const r of roomsRaw) {
    const base = (r.room_number || `room_${r.room_id}`).trim().slice(0, 30) || `room_${r.room_id}`;
    let key = base;
    let n = 2;
    while (usedKeys.has(key)) {
      key = `${base.slice(0, 20)}__${n}`;
      n += 1;
    }
    usedKeys.add(key);
    rooms[key] = {
      capacity: Math.max(0, r.capacity),
      room_type: prismaRoomTypeToGwo(r.room_type),
    };
  }

  const maxCap = maxRoomCapacity(rooms);

  const lectRows = await prisma.lecturer.findMany({
    where: { is_available: true },
    include: {
      user: { select: { first_name: true, last_name: true } },
      lecturer_can_teach_course: { select: { course_id: true, user_id: true } },
    },
    orderBy: { user_id: "asc" },
  });

  const lecturers: string[] = [];
  const userIdToIndex = new Map<number, number>();
  for (const row of lectRows) {
    const fn = row.user.first_name?.trim() ?? "";
    const ln = row.user.last_name?.trim() ?? "";
    const full = `${fn} ${ln}`.trim();
    if (!full) continue;
    userIdToIndex.set(row.user_id, lecturers.length);
    lecturers.push(full);
  }

  if (lecturers.length === 0) {
    return null;
  }

  const lecturer_preferences: ScheduleConfig["lecturer_preferences"] = {};
  // BUG 2 FIX: per-timeslot availability map (constraint 4).
  const lecturer_availability: Record<string, string[]> = {};
  // BUG 4 FIX: per-lecturer credit-hour teaching ceiling (constraints 8 & 11).
  const lecturer_max_workload: Record<string, number> = {};

  for (const name of lecturers) {
    lecturer_preferences[name] = { preferred: [], unpreferred: [] };
    lecturer_availability[name] = [];  // empty = no restriction
  }

  // Populate per-lecturer max workload from the Lecturer.max_workload DB field.
  for (const row of lectRows) {
    const idx = userIdToIndex.get(row.user_id);
    if (idx == null) continue;
    const name = lecturers[idx];
    if (!name) continue;
    // max_workload is the credit-hour ceiling stored on the Lecturer model.
    lecturer_max_workload[name] = Math.max(0, (row as any).max_workload ?? 0);
  }

  const prefRows = await prisma.lecturerPreference.findMany();
  for (const p of prefRows) {
    const li = userIdToIndex.get(p.user_id);
    if (li === undefined) continue;
    const name = lecturers[li];
    const slotKey = `slot_${p.slot_id}`;
    if (p.is_preferred) {
      lecturer_preferences[name].preferred.push(slotKey);
    } else {
      lecturer_preferences[name].unpreferred.push(slotKey);
    }
  }

  // BUG 2 FIX: load LecturerOfficeHours to build per-timeslot availability.
  // Uses the same slot_${id} naming scheme as preferences and DB-sourced timeslots,
  // ensuring consistency when the Python solver resolves TIMESLOTS[t].
  try {
    const officeHourRows = await prisma.lecturerOfficeHours.findMany({
      include: { timeslot: { select: { slot_id: true } } },
    });
    for (const oh of officeHourRows) {
      const idx = userIdToIndex.get(oh.user_id);
      if (idx == null) continue;
      const name = lecturers[idx];
      if (!name) continue;
      const canonId = `slot_${oh.timeslot.slot_id}`;
      const slots = lecturer_availability[name]!;
      if (!slots.includes(canonId)) slots.push(canonId);
    }
  } catch {
    // LecturerOfficeHours table may not exist in all environments; silently skip.
    // Availability will remain empty (= no restriction) for all lecturers.
  }

  const maxByCourse = await prisma.sectionScheduleEntry.groupBy({
    by: ["course_id"],
    _max: { registered_students: true },
  });
  const regByCourse = new Map<number, number>();
  for (const row of maxByCourse) {
    regByCourse.set(row.course_id, row._max.registered_students ?? 0);
  }

  const courses = await prisma.course.findMany({
    include: {
      lecturer_can_teach_course: { select: { user_id: true } },
    },
    orderBy: { course_id: "asc" },
  });

  const maxCoursesEnv = process.env.GWO_MAX_COURSES?.trim();
  const maxCourses =
    maxCoursesEnv != null && maxCoursesEnv !== ""
      ? Math.max(0, parseInt(maxCoursesEnv, 10))
      : 0;

  const lectures: LectureConfig[] = [];
  let nextLectureId = 1;

  for (const c of courses) {
    if (c.sections <= 0) continue;

    const allowed: number[] = [
      ...new Set(
        c.lecturer_can_teach_course
          .map((ct: { user_id: number }) => userIdToIndex.get(ct.user_id))
          .filter((i): i is number => i !== undefined),
      ),
    ].sort((a, b) => a - b);

    if (allowed.length === 0) continue;

    const registered = regByCourse.get(c.course_id) ?? 0;
    const fallbackSize = Math.min(maxCap, Math.max(12, c.credit_hours * 10));
    const rawSize = registered > 0 ? registered : fallbackSize;
    const size = Math.min(Math.max(rawSize, 1), maxCap);

    for (let s = 0; s < c.sections; s++) {
      if (maxCourses > 0 && lectures.length >= maxCourses) break;

      lectures.push({
        id: nextLectureId++,
        course: c.course_code.trim(),
        course_name: c.course_name,
        allowed_lecturers: allowed,
        size,
        // BUG 5 FIX: credit_hours required for workload calculation (constraints 8 & 11).
        credit_hours: c.credit_hours,
        // Section label so parallel sections of the same course are distinguishable.
        section_number: `S${s + 1}`,
        delivery_mode: deliveryModeToGwo(c.delivery_mode),
        session_type: c.is_lab ? "lab" : "lecture",
      });
    }

    if (maxCourses > 0 && lectures.length >= maxCourses) break;
  }

  if (lectures.length === 0) {
    return null;
  }

  // BUG 2 + 4 FIX: return availability and max workload alongside existing fields.
  return { rooms, lecturers, lecturer_preferences, lectures, lecturer_availability, lecturer_max_workload };
}

export async function mergeFileConfigWithDatabase(
  fileBased: ScheduleConfig,
): Promise<ScheduleConfig> {
  let merged: ScheduleConfig = fileBased;

  try {
    const fromDb = await loadScheduleConfigEntitiesFromDatabase();
    if (fromDb) {
      merged = {
        ...merged,
        rooms: fromDb.rooms,
        lecturers: fromDb.lecturers,
        lecturer_preferences: fromDb.lecturer_preferences,
        lectures: fromDb.lectures,
        // BUG 2 FIX: write availability so Python enforces per-timeslot constraints.
        ...(fromDb.lecturer_availability && { lecturer_availability: fromDb.lecturer_availability }),
        // BUG 4 FIX: write per-lecturer workload ceilings for Hard-7 checks.
        ...(fromDb.lecturer_max_workload && { lecturer_max_workload: fromDb.lecturer_max_workload }),
      };
    }
  } catch (err) {
    console.error("[db-schedule-config] Prisma load failed; using file config for rooms/lectures.", err);
  }

  try {
    const dbSlots = await loadTimeslotsFromDatabase();
    if (dbSlots && dbSlots.length > 0) {
      merged = { ...merged, timeslots: dbSlots };
    }
  } catch (err) {
    console.error("[db-schedule-config] Timeslots load failed; using file timeslots.", err);
  }

  return merged;
}
