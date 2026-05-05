import { ApiClient } from "@/lib/api-client";

export type TimetableConflictRow = {
  conflictId: number
  timetableId: number
  conflictType: string
  severity: string
  courseCode: string
  sectionNumber: string
  lecturerName: string | null
  roomNumber: string | null
  timeslotLabel: string | null
  detail: string
}

export type TimetableConflictSummary = {
  timetableId: number
  metricsIsValid: boolean | null
  requiresConflictAcknowledgment: boolean
  hardConflictCount: number
  conflicts: TimetableConflictRow[]
}

/** Persisted timetable conflict totals keyed by timetable id (`GET /timetables/:id/conflicts`). */
export type HardConflictByTimetableId = Record<number, number>

/** Prefer DB `hardConflictCount` when loaded; otherwise fall back to optimizer run metrics snapshot. */
export function resolveHardConflictCount(
  timetableId: number | null | undefined,
  metricsSnapshotConflicts: number | null | undefined,
  hardByTimetableId: HardConflictByTimetableId,
): number | null {
  const id =
    timetableId != null && Number.isFinite(Number(timetableId)) && Number(timetableId) > 0
      ? Math.trunc(Number(timetableId))
      : null
  if (id != null && Object.prototype.hasOwnProperty.call(hardByTimetableId, id)) {
    const v = hardByTimetableId[id]
    return typeof v === "number" && Number.isFinite(v) ? v : null
  }
  if (
    metricsSnapshotConflicts != null &&
    typeof metricsSnapshotConflicts === "number" &&
    Number.isFinite(metricsSnapshotConflicts)
  ) {
    return metricsSnapshotConflicts
  }
  return null
}

export async function fetchTimetableConflictSummary(timetableId: number): Promise<TimetableConflictSummary> {
  return ApiClient.request<TimetableConflictSummary>(`/timetables/${timetableId}/conflicts`)
}

/** Single readable line for UI lists (banner, dialogs). */
export function formatConflictRowSummary(c: TimetableConflictRow): string {
  const locBits = [c.timeslotLabel, c.roomNumber, c.lecturerName].filter(Boolean).join(" · ")
  const headerParts = [
    c.conflictType,
    c.courseCode || c.sectionNumber ? `${c.courseCode}${c.sectionNumber ? ` · sec ${c.sectionNumber}` : ""}` : null,
    locBits ? `(${locBits})` : null,
  ].filter(Boolean)
  const head = headerParts.join(" — ")
  const tail = c.detail?.trim() ?? ""
  if (!tail) return head || "Conflict"
  if (!head) return tail
  return `${head}: ${tail}`
}
