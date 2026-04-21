import type { LectureConfig, RoomConfigValue, ScheduleConfig, ScheduleEntry } from "@/lib/schedule-data";
import type { TimeslotCatalogueEntry } from "@/lib/timetable-model";
import {
  catalogueById,
  normalizeTimeslotCatalogueEntry,
  timeslotLongLabel,
  uiSlotKindFromEngineSlotType,
} from "@/lib/timetable-model";

/** Mirrors `SLOT_TYPE_RULES` in `scripts/GWO-v6.py` (engine `slot_type` strings). */
const SLOT_TYPE_RULES: Record<string, readonly string[]> = {
  "inperson|lecture": ["lecture_mw", "lecture_stt"],
  "online|lecture": ["lecture_mw", "lecture_stt", "blended_mon", "blended_wed", "blended_st"],
  "blended|lecture": ["blended_mon", "blended_wed", "blended_st"],
  "inperson|lab": ["lab"],
  "online|lab": ["lab"],
  "blended|lab": ["lab"],
};

const ALL_ENGINE_SLOT_TYPES = [
  "lecture_mw",
  "lecture_stt",
  "blended_mon",
  "blended_wed",
  "blended_st",
  "lab",
] as const;

export function normDelivery(mode?: string): "inperson" | "online" | "blended" {
  const v = (mode || "inperson").toLowerCase().replace(/_/g, "");
  if (v === "online") return "online";
  if (v === "blended") return "blended";
  return "inperson";
}

export function normSession(st?: string): "lecture" | "lab" {
  return (st || "lecture").toLowerCase() === "lab" ? "lab" : "lecture";
}

export function entryNeedsRoom(e: ScheduleEntry): boolean {
  if (e.room_required != null) return e.room_required;
  if (e.requires_room != null) return e.requires_room;
  return normDelivery(e.delivery_mode) !== "online";
}

export function findLectureConfig(
  config: ScheduleConfig,
  entry: ScheduleEntry,
): LectureConfig | undefined {
  const lid = Number(entry.lecture_id);
  const lectures = config.lectures ?? [];
  if (Number.isFinite(lid)) {
    const byId = lectures.find((l) => Number(l.id) === lid);
    if (byId) return byId;
  }
  const code = (entry.course_code || "").trim();
  const sec = (entry as ScheduleEntry & { section_number?: string }).section_number;
  if (!code) return undefined;
  return lectures.find((l) => {
    const c = String(l.course || "").trim();
    if (c !== code) return false;
    if (sec == null || sec === "") return true;
    return (l.section_number || "") === sec;
  });
}

export function allowedEngineSlotTypesForLecture(lec: LectureConfig): readonly string[] {
  const dm = normDelivery(lec.delivery_mode);
  const st = normSession(lec.session_type);
  const key = `${dm}|${st}`;
  return SLOT_TYPE_RULES[key] ?? ALL_ENGINE_SLOT_TYPES;
}

export function engineSlotTypeForCatalogueRow(row: TimeslotCatalogueEntry | undefined): string {
  if (!row?.slot_type) return "lecture_mw";
  const st = row.slot_type.trim();
  if ((ALL_ENGINE_SLOT_TYPES as readonly string[]).includes(st)) return st;
  return uiSlotKindFromEngineSlotType(st) === "lab"
    ? "lab"
    : uiSlotKindFromEngineSlotType(st) === "blended"
      ? "blended_mon"
      : "lecture_mw";
}

export function isTimeslotAllowedForLecture(
  lec: LectureConfig,
  tsRow: TimeslotCatalogueEntry | undefined,
): boolean {
  if (!tsRow) return false;
  const allowed = allowedEngineSlotTypesForLecture(lec);
  const engine = engineSlotTypeForCatalogueRow(tsRow);
  return allowed.includes(engine);
}

/** Same idea as `_room_compatible_with_slot` in `send_schedule.py`. */
export function roomTypeCompatibleWithSlotType(roomType: string, slotEngineType: string): boolean {
  const rt = (roomType || "any").trim().toLowerCase();
  const st = (slotEngineType || "lecture_mw").trim().toLowerCase();
  if (rt === "any" || rt === "") return true;
  if (rt === "lab_room") return st === "lab";
  if (rt === "lecture_hall") return st !== "lab";
  return true;
}

function roomCfgType(rv: RoomConfigValue): string {
  return typeof rv === "number" ? "any" : (rv.room_type ?? "any");
}

function roomCfgCap(rv: RoomConfigValue): number {
  return typeof rv === "number" ? rv : (rv.capacity ?? 0);
}

export function allowedRoomNamesForLecture(
  config: ScheduleConfig,
  lec: LectureConfig,
  slotEngineType: string,
  classSize: number,
): string[] {
  const mode = normDelivery(lec.delivery_mode);
  const st = normSession(lec.session_type);
  if (mode === "online") return [];

  const needLab = st === "lab";
  const out: string[] = [];
  for (const [name, rv] of Object.entries(config.rooms ?? {})) {
    const rt = roomCfgType(rv);
    if (needLab) {
      if (rt !== "lab_room" && rt !== "any") continue;
    } else {
      if (rt === "lab_room") continue;
    }
    if (!roomTypeCompatibleWithSlotType(rt, slotEngineType)) continue;
    if (roomCfgCap(rv) < classSize) continue;
    out.push(name);
  }
  return out.sort();
}

export function allowedLecturerNamesForLecture(config: ScheduleConfig, lec: LectureConfig): string[] {
  const lecturers = config.lecturers ?? [];
  const idxs = (lec.allowed_lecturers ?? []) as unknown[];
  const names: string[] = [];
  const lecturerSet = new Set(lecturers.map((n) => n.trim().toLowerCase()));

  for (const raw of idxs) {
    if (typeof raw === "string") {
      const t = raw.trim();
      if (!t) continue;
      if (lecturerSet.has(t.toLowerCase())) {
        const exact = lecturers.find((n) => n.trim().toLowerCase() === t.toLowerCase())!;
        names.push(exact);
        continue;
      }
      const asNum = Number(t);
      if (Number.isFinite(asNum)) {
        const i = Math.trunc(asNum);
        const byIdx = lecturers[i];
        if (typeof byIdx === "string" && byIdx.trim()) {
          names.push(byIdx);
        }
      }
      continue;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      const i = Math.trunc(raw);
      const byIdx = lecturers[i];
      if (typeof byIdx === "string" && byIdx.trim()) {
        names.push(byIdx);
      }
    }
  }
  return [...new Set(names)].sort();
}

export function lecturerTimeslotAllowed(
  config: ScheduleConfig,
  lecturerName: string,
  timeslotId: string,
): boolean {
  const map = config.lecturer_availability ?? {};
  const name = lecturerName.trim();
  let list = map[name];
  if (!list || list.length === 0) {
    const key = Object.keys(map).find((k) => k.trim().toLowerCase() === name.toLowerCase());
    if (key) list = map[key];
  }
  if (!list || list.length === 0) return true;
  return list.includes(timeslotId);
}

export function allowedTimeslotIdsForEntry(
  config: ScheduleConfig,
  catalogue: TimeslotCatalogueEntry[],
  entry: ScheduleEntry,
  forLecturer?: string,
): string[] {
  const lec = findLectureConfig(config, entry);
  const lecturerName = (forLecturer ?? entry.lecturer).trim();
  if (!lec) return catalogue.map((c) => c.id).filter(Boolean);
  const catMap = catalogueById(catalogue);
  const out: string[] = [];
  for (const row of catalogue) {
    if (!row.id) continue;
    if (!isTimeslotAllowedForLecture(lec, row)) continue;
    const eng = engineSlotTypeForCatalogueRow(row);
    const mode = normDelivery(lec.delivery_mode);
    if (mode !== "online") {
      const roomsOk = allowedRoomNamesForLecture(config, lec, eng, lec.size ?? entry.class_size ?? 0);
      if (roomsOk.length === 0) continue;
    }
    out.push(row.id);
  }
  const filtered = out.filter((id) => lecturerTimeslotAllowed(config, lecturerName, id));
  return filtered.sort((a, b) => {
    const ra = catMap.get(a);
    const rb = catMap.get(b);
    const sa = ra ? normalizeTimeslotCatalogueEntry(ra).start_hour : 0;
    const sb = rb ? normalizeTimeslotCatalogueEntry(rb).start_hour : 0;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });
}

/** Lecture configs that are not yet placed on the current schedule (by `lecture_id`). */
export function listLectureConfigsNotOnSchedule(
  config: ScheduleConfig,
  scheduleEntries: ScheduleEntry[],
): LectureConfig[] {
  const used = new Set(scheduleEntries.map((e) => String(e.lecture_id)));
  return (config.lectures ?? []).filter((l) => !used.has(String(l.id)));
}

/** Human-readable hint when the add-section dialog finds zero matching courses. */
export function explainNoAddSectionCandidates(
  config: ScheduleConfig,
  scheduleEntries: ScheduleEntry[],
  targetCell: { rowKey: string; timeslotId: string },
  catalogue: TimeslotCatalogueEntry[],
): string {
  const notOn = listLectureConfigsNotOnSchedule(config, scheduleEntries);
  if (notOn.length === 0) {
    return "Every section from the planning configuration is already on the timetable. Remove a section first if you want to add a different placement.";
  }
  const catMap = catalogueById(catalogue);
  const tsRow = catMap.get(targetCell.timeslotId);
  if (!tsRow) {
    return "This timeslot id is missing from the merged catalogue (check config vs schedule timeslots).";
  }
  const isOnlineRow = targetCell.rowKey === "__online__";
  const eng = engineSlotTypeForCatalogueRow(tsRow);
  const roomKey = targetCell.rowKey;
  const roomRv = roomKey === "__online__" ? null : config.rooms?.[roomKey];
  const rt =
    isOnlineRow
      ? "any"
      : roomRv == null
        ? "missing"
        : typeof roomRv === "number"
          ? "any"
          : (roomCfgType(roomRv) || "any");

  if (!isOnlineRow && eng === "lab" && (rt === "lecture_hall" || rt === "missing")) {
    return "This timeslot is a lab period. Lab sections need a lab-capable room; this row is not a lab room. Use a lab room row, the Online row for online-only sections, or choose a non-lab timeslot column.";
  }
  if (!isOnlineRow && eng === "lab") {
    return "This timeslot only accepts lab sessions. Only lab courses can be placed here, and only in rooms marked as lab (or “any”) with enough capacity.";
  }
  if (isOnlineRow && eng === "lab") {
    return "This column is a lab timeslot; online-only sections normally use other slot patterns. Try a different empty cell.";
  }
  return "No remaining section fits this exact room and timeslot: slot pattern (lecture vs lab vs blended), room type/capacity, delivery mode (room vs online), and lecturer rules must all line up.";
}

/**
 * Builds a feasible `ScheduleEntry` for a config lecture (first allowed lecturer, timeslot, room).
 * Returns null if no valid combination exists.
 */
export function buildScheduleEntryFromLectureConfig(
  config: ScheduleConfig,
  lec: LectureConfig,
  catalogue: TimeslotCatalogueEntry[],
): ScheduleEntry | null {
  const lecturerNames = allowedLecturerNamesForLecture(config, lec);
  if (lecturerNames.length === 0) return null;

  const lecturer = lecturerNames[0]!;
  const stub: ScheduleEntry = {
    lecture_id: lec.id,
    course_code: String(lec.course).trim(),
    course_name: (lec.course_name && lec.course_name.trim()) || String(lec.course).trim(),
    room: null,
    timeslot: "",
    day: "",
    lecturer,
    delivery_mode: lec.delivery_mode,
    session_type: lec.session_type,
    class_size: lec.size,
    room_required: normDelivery(lec.delivery_mode) !== "online",
    requires_room: normDelivery(lec.delivery_mode) !== "online",
    allowed_lecturers: lecturerNames,
    preference_issues: [],
    has_pref_warning: false,
  };

  const tsIds = allowedTimeslotIdsForEntry(config, catalogue, stub, lecturer);
  if (tsIds.length === 0) return null;
  const tsId = tsIds[0]!;
  const catMap = catalogueById(catalogue);
  const row = catMap.get(tsId);

  if (normDelivery(lec.delivery_mode) === "online") {
    return mergeEntryWithPlacement(stub, catalogue, null, tsId, 0);
  }

  const eng = engineSlotTypeForCatalogueRow(row);
  const rooms = allowedRoomNamesForLecture(config, lec, eng, lec.size ?? 0);
  if (rooms.length === 0) return null;
  const rname = rooms[0]!;
  const rv = config.rooms?.[rname];
  const cap = rv == null ? 0 : roomCfgCap(rv);

  return mergeEntryWithPlacement(stub, catalogue, rname, tsId, cap);
}

export function mergeEntryWithPlacement(
  entry: ScheduleEntry,
  catalogue: TimeslotCatalogueEntry[],
  roomName: string | null,
  timeslotId: string,
  roomCapacity: number,
): ScheduleEntry {
  const catMap = catalogueById(catalogue);
  const row = catMap.get(timeslotId);
  const slotType = row?.slot_type ?? entry.slot_type;
  const norm = row ? normalizeTimeslotCatalogueEntry(row) : null;
  const tsLabel = row ? timeslotLongLabel(row) : entry.timeslot_label;
  return {
    ...entry,
    timeslot: timeslotId,
    timeslot_label: tsLabel,
    room: roomName,
    room_capacity: entryNeedsRoom(entry) ? roomCapacity : 0,
    slot_type: slotType,
    days: norm?.days ?? entry.days,
    start_hour: norm?.start_hour ?? entry.start_hour,
    duration: norm?.duration ?? entry.duration,
  };
}
