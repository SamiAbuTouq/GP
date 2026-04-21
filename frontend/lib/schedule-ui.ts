import type { ScheduleEntry } from "./schedule-data"
import {
  detectScheduleConflicts,
  conflictingLectureIds,
  type ScheduleConflict,
  type TimeslotCatalogueEntry,
  type ScheduleEntryLike,
} from "./timetable-model"

export function entriesForConflictDetection(entries: ScheduleEntry[]): ScheduleEntryLike[] {
  return entries.map((e) => {
    const req = e.room_required ?? e.requires_room ?? true
    const r = e.room
    const noRoom =
      !req ||
      r == null ||
      r === "" ||
      r === "ONLINE"
    return {
      lecture_id: e.lecture_id,
      timeslot: e.timeslot,
      room: noRoom ? null : r,
      lecturer: e.lecturer,
      course_code: e.course_code,
      timeslot_label: e.timeslot_label,
    }
  })
}

export function buildUiConflicts(
  entries: ScheduleEntry[],
  catalogue?: TimeslotCatalogueEntry[],
): { conflicts: ScheduleConflict[]; conflictIds: Set<string> } {
  const conflicts = detectScheduleConflicts(entriesForConflictDetection(entries), catalogue)
  return { conflicts, conflictIds: conflictingLectureIds(conflicts) }
}

export type WrongSlotTypeViolation = {
  lecture: string
  assigned_type: string
  delivery_mode: string
  session_type: string
}
