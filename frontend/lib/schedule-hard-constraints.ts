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

function lectureIdKey(id: string | number): string {
  return String(id);
}

/** One actionable hard-rule breach with a stable key and severity for before/after comparison. */
export type ScheduleHardViolation = {
  /** Stable id for this constraint instance (not for display). */
  key: string;
  /** Higher means strictly worse (more overload, new overlap pair, etc.). */
  severity: number;
  message: string;
};

function pushViolation(out: ScheduleHardViolation[], key: string, severity: number, message: string) {
  out.push({ key, severity, message });
}

function maxSeverityByKey(violations: ScheduleHardViolation[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of violations) {
    m.set(v.key, Math.max(m.get(v.key) ?? 0, v.severity));
  }
  return m;
}

/**
 * Violations that appear in `after` with strictly greater severity than in `before`
 * (including keys that did not exist before). Used to block manual edits that introduce
 * new problems or worsen existing ones while allowing corrective edits.
 */
export function hardViolationsIntroducedOrWorsened(
  before: ScheduleHardViolation[],
  after: ScheduleHardViolation[],
): ScheduleHardViolation[] {
  const bm = maxSeverityByKey(before);
  const worsened: ScheduleHardViolation[] = [];
  const seen = new Set<string>();
  for (const v of after) {
    const prev = bm.get(v.key) ?? 0;
    if (v.severity > prev && !seen.has(v.key)) {
      seen.add(v.key);
      worsened.push(v);
    }
  }
  return worsened;
}

/**
 * Collect GWO-style **hard** feasibility breaches for a full schedule snapshot.
 * Same rules as {@link validateScheduleHardConstraints}, structured for diffing.
 */
export function collectScheduleHardViolations(
  entries: ScheduleEntry[],
  config: ScheduleConfig,
  catalogue: TimeslotCatalogueEntry[],
): ScheduleHardViolation[] {
  const out: ScheduleHardViolation[] = [];
  const catMap = catalogueById(catalogue);
  const maxClassCount = config.gwo_params?.max_classes_per_lecturer ?? 5;

  const creditByLecturer = new Map<string, number>();
  const lecturerMax = config.lecturer_max_workload ?? {};

  for (const e of entries) {
    const lid = lectureIdKey(e.lecture_id);
    const lec = findLectureConfig(config, e);
    if (!lec) {
      pushViolation(
        out,
        `entry:${lid}:no_lecture_config`,
        1,
        `No lecture config matches section ${e.course_code} (lecture_id=${e.lecture_id}).`,
      );
      continue;
    }

    const tsRow = catMap.get(e.timeslot);
    if (!tsRow) {
      pushViolation(
        out,
        `entry:${lid}:unknown_timeslot`,
        1,
        `${e.course_code}: unknown timeslot "${e.timeslot}".`,
      );
    } else if (!isTimeslotAllowedForLecture(lec, tsRow)) {
      pushViolation(
        out,
        `entry:${lid}:timeslot_not_allowed`,
        1,
        `${e.course_code}: timeslot "${e.timeslot}" is not allowed for ${normDelivery(lec.delivery_mode)}/${normSession(lec.session_type)}.`,
      );
    }

    const allowedLecturers = allowedLecturerNamesForLecture(config, lec);
    if (!allowedLecturers.includes(e.lecturer.trim())) {
      pushViolation(
        out,
        `entry:${lid}:lecturer_not_allowed`,
        1,
        `${e.course_code}: lecturer "${e.lecturer}" is not allowed to teach this course.`,
      );
    }

    if (!lecturerTimeslotAllowed(config, e.lecturer, e.timeslot)) {
      pushViolation(
        out,
        `entry:${lid}:lecturer_unavailable_slot`,
        1,
        `${e.course_code}: lecturer "${e.lecturer}" is not available in timeslot "${e.timeslot}".`,
      );
    }

    const eng = engineSlotTypeForCatalogueRow(tsRow ?? { id: e.timeslot, days: [], slot_type: e.slot_type });

    if (entryNeedsRoom(e)) {
      const room = (e.room || "").trim();
      if (!room || room === "ONLINE") {
        pushViolation(
          out,
          `entry:${lid}:room_required`,
          1,
          `${e.course_code}: a physical room is required for this delivery mode.`,
        );
      } else {
        const cap = e.room_capacity ?? roomCfgCap(config, room);
        const allowedRooms = new Set(allowedRoomNamesForLecture(config, lec, eng, lec.size ?? e.class_size ?? 0));
        if (!allowedRooms.has(room)) {
          pushViolation(
            out,
            `entry:${lid}:room_not_allowed`,
            1,
            `${e.course_code}: room "${room}" is not allowed for this session type / capacity.`,
          );
        }
        const rt = roomCfgType(config, room);
        if (!roomTypeCompatibleWithSlotType(rt, eng)) {
          pushViolation(
            out,
            `entry:${lid}:room_type_mismatch`,
            1,
            `${e.course_code}: room type "${rt}" is incompatible with timeslot pattern "${eng}".`,
          );
        }
        const size = e.class_size ?? lec.size ?? 0;
        if (cap > 0 && size > cap) {
          const over = size - cap;
          pushViolation(
            out,
            `entry:${lid}:capacity`,
            over,
            `${e.course_code}: class size ${size} exceeds room capacity ${cap}.`,
          );
        }
      }
    }

    const ch = typeof lec.credit_hours === "number" && lec.credit_hours > 0 ? lec.credit_hours : 1;
    const ln = e.lecturer.trim();
    creditByLecturer.set(ln, (creditByLecturer.get(ln) ?? 0) + ch);
  }

  const hasAnyWorkloadRow = Object.keys(lecturerMax).length > 0;
  for (const [name, load] of creditByLecturer) {
    const ceiling = resolveWorkloadCeiling(lecturerMax, name);
    if (ceiling === undefined) continue;
    if (load > ceiling) {
      const over = load - ceiling;
      const key = `workload_credit:${name.trim().toLowerCase()}`;
      pushViolation(
        out,
        key,
        over,
        `Lecturer "${name}" exceeds max teaching load (${load.toFixed(1)} credit hours > ${ceiling}).`,
      );
    }
  }

  if (!hasAnyWorkloadRow) {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const ln = e.lecturer.trim();
      counts.set(ln, (counts.get(ln) ?? 0) + 1);
    }
    for (const [name, count] of counts) {
      if (count > maxClassCount) {
        const over = count - maxClassCount;
        const key = `workload_sections:${name.trim().toLowerCase()}`;
        pushViolation(
          out,
          key,
          over,
          `Lecturer "${name}" teaches ${count} sections (max ${maxClassCount} without per-lecturer credit ceilings).`,
        );
      }
    }
  }

  const { conflicts } = buildUiConflicts(entries, catalogue);
  for (const c of conflicts) {
    const [x, y] = c.entries;
    const a = lectureIdKey(x!.lecture_id);
    const b = lectureIdKey(y!.lecture_id);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const resource = c.detail.trim().toLowerCase();
    const pairKey =
      c.type === "room" ? `overlap:room:${resource}:${lo}:${hi}` : `overlap:lecturer:${resource}:${lo}:${hi}`;
    pushViolation(out, pairKey, 1, `${c.type} overlap: ${c.detail}`);
  }

  return out;
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
  const violations = collectScheduleHardViolations(entries, config, catalogue);
  const errors = violations.map((v) => v.message);
  return { ok: errors.length === 0, errors };
}
