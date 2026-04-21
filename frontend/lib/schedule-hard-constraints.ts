import type { ScheduleConfig, ScheduleEntry } from "@/lib/schedule-data";
import type { TimeslotCatalogueEntry } from "@/lib/timetable-model";
import { buildUiConflicts } from "@/lib/schedule-ui";
import {
  allowedLecturerNamesForLecture,
  allowedRoomNamesForLecture,
  engineSlotTypeForCatalogueRow,
  entryNeedsRoom,
  findLectureConfig,
  isTimeslotAllowedForLecture,
  lecturerTimeslotAllowed,
  normDelivery,
  normSession,
  roomTypeCompatibleWithSlotType,
} from "@/lib/schedule-edit-rules";
import { catalogueById } from "@/lib/timetable-model";

function roomCfgType(config: ScheduleConfig, roomName: string): string {
  const rv = config.rooms?.[roomName];
  if (rv == null) return "any";
  return typeof rv === "number" ? "any" : (rv.room_type ?? "any");
}

function roomCfgCap(config: ScheduleConfig, roomName: string): number {
  const rv = config.rooms?.[roomName];
  if (rv == null) return 0;
  return typeof rv === "number" ? rv : (rv.capacity ?? 0);
}

/** Match schedule lecturer string to `lecturer_max_workload` keys (trim + case-insensitive). */
function resolveWorkloadCeiling(
  lecturerMax: Record<string, number>,
  lecturerName: string,
): number | undefined {
  const t = lecturerName.trim();
  if (!t) return undefined;
  if (Object.prototype.hasOwnProperty.call(lecturerMax, t)) {
    return lecturerMax[t];
  }
  const entries = Object.entries(lecturerMax);
  const lower = t.toLowerCase();
  for (const [k, v] of entries) {
    if (k.trim().toLowerCase() === lower) {
      return v;
    }
  }
  return undefined;
}

/**
 * Validates GWO-style **hard** feasibility rules for a full schedule snapshot.
 * Used to refuse manual edits that would break the same constraints the optimiser enforces
 * (excluding cohort / study-plan unit clashes — those are not recomputed client-side).
 */
export function validateScheduleHardConstraints(
  entries: ScheduleEntry[],
  config: ScheduleConfig,
  catalogue: TimeslotCatalogueEntry[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const catMap = catalogueById(catalogue);
  const maxClassCount = config.gwo_params?.max_classes_per_lecturer ?? 5;

  const creditByLecturer = new Map<string, number>();
  const lecturerMax = config.lecturer_max_workload ?? {};

  for (const e of entries) {
    const lec = findLectureConfig(config, e);
    if (!lec) {
      errors.push(`No lecture config matches section ${e.course_code} (lecture_id=${e.lecture_id}).`);
      continue;
    }

    const tsRow = catMap.get(e.timeslot);
    if (!tsRow) {
      errors.push(`${e.course_code}: unknown timeslot "${e.timeslot}".`);
    } else if (!isTimeslotAllowedForLecture(lec, tsRow)) {
      errors.push(
        `${e.course_code}: timeslot "${e.timeslot}" is not allowed for ${normDelivery(lec.delivery_mode)}/${normSession(lec.session_type)}.`,
      );
    }

    const allowedLecturers = allowedLecturerNamesForLecture(config, lec);
    if (!allowedLecturers.includes(e.lecturer.trim())) {
      errors.push(`${e.course_code}: lecturer "${e.lecturer}" is not allowed to teach this course.`);
    }

    if (!lecturerTimeslotAllowed(config, e.lecturer, e.timeslot)) {
      errors.push(`${e.course_code}: lecturer "${e.lecturer}" is not available in timeslot "${e.timeslot}".`);
    }

    const eng = engineSlotTypeForCatalogueRow(tsRow ?? { id: e.timeslot, days: [], slot_type: e.slot_type });

    if (entryNeedsRoom(e)) {
      const room = (e.room || "").trim();
      if (!room || room === "ONLINE") {
        errors.push(`${e.course_code}: a physical room is required for this delivery mode.`);
      } else {
        const cap = e.room_capacity ?? roomCfgCap(config, room);
        const allowedRooms = new Set(allowedRoomNamesForLecture(config, lec, eng, lec.size ?? e.class_size ?? 0));
        if (!allowedRooms.has(room)) {
          errors.push(`${e.course_code}: room "${room}" is not allowed for this session type / capacity.`);
        }
        const rt = roomCfgType(config, room);
        if (!roomTypeCompatibleWithSlotType(rt, eng)) {
          errors.push(`${e.course_code}: room type "${rt}" is incompatible with timeslot pattern "${eng}".`);
        }
        const size = e.class_size ?? lec.size ?? 0;
        if (cap > 0 && size > cap) {
          errors.push(`${e.course_code}: class size ${size} exceeds room capacity ${cap}.`);
        }
      }
    }

    const ch = typeof lec.credit_hours === "number" && lec.credit_hours > 0 ? lec.credit_hours : 1;
    const ln = e.lecturer.trim();
    creditByLecturer.set(ln, (creditByLecturer.get(ln) ?? 0) + ch);
  }

  // Credit-hour ceiling: only for lecturers with an explicit value in `lecturer_max_workload` (typically DB).
  // Never use `max_classes_per_lecturer` as a credit cap — that setting is a *section count* limit (see below).
  const hasAnyWorkloadRow = Object.keys(lecturerMax).length > 0;
  for (const [name, load] of creditByLecturer) {
    const ceiling = resolveWorkloadCeiling(lecturerMax, name);
    if (ceiling === undefined) continue;
    if (load > ceiling) {
      errors.push(
        `Lecturer "${name}" exceeds max teaching load (${load.toFixed(1)} credit hours > ${ceiling}).`,
      );
    }
  }

  // When no per-lecturer workload table exists, fall back to counting sections vs `max_classes_per_lecturer`.
  if (!hasAnyWorkloadRow) {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const ln = e.lecturer.trim();
      counts.set(ln, (counts.get(ln) ?? 0) + 1);
    }
    for (const [name, count] of counts) {
      if (count > maxClassCount) {
        errors.push(
          `Lecturer "${name}" teaches ${count} sections (max ${maxClassCount} without per-lecturer credit ceilings).`,
        );
      }
    }
  }

  const { conflicts } = buildUiConflicts(entries, catalogue);
  for (const c of conflicts) {
    errors.push(`${c.type} overlap: ${c.detail}`);
  }

  return { ok: errors.length === 0, errors };
}
