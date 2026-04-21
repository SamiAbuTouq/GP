/** Timeslot catalogue entry (from config / schedule payload). */
export type TimeslotCatalogueEntry = {
  id: string
  days: string[]
  start_hour?: number
  duration?: number
  slot_type?: string
  /** Optional compact header code shown in the timetable (e.g. T1, T2). */
  short_code?: string
  label?: string
  start_time?: string
  duration_minutes?: number
}

export type SlotFamily = "regular" | "blended" | "lab"

/** UI / v6 config uses regular | blended | lab; engine uses lecture_mw, blended_mon, etc. */
export function uiSlotKindFromEngineSlotType(slotType?: string): SlotFamily {
  if (!slotType) return "regular"
  if (slotType === "regular" || slotType === "blended" || slotType === "lab") return slotType
  if (slotType.startsWith("blended")) return "blended"
  if (slotType.startsWith("lecture")) return "regular"
  return "regular"
}

export function slotFamilyFromSlotType(slotType?: string): SlotFamily {
  return uiSlotKindFromEngineSlotType(slotType)
}

export function hourFloatToLabel(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60) % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

export function parseStartTimeToHour(s?: string): number | undefined {
  if (!s) return undefined
  const parts = String(s).trim().split(":")
  const hh = parseInt(parts[0], 10)
  const mm = parts[1] != null ? parseInt(parts[1], 10) : 0
  if (Number.isNaN(hh)) return undefined
  return hh + (Number.isNaN(mm) ? 0 : mm) / 60
}

export function normalizeTimeslotCatalogueEntry(t: TimeslotCatalogueEntry): Required<
  Pick<TimeslotCatalogueEntry, "start_hour" | "duration" | "days">
> &
  TimeslotCatalogueEntry {
  const start_hour = t.start_hour ?? parseStartTimeToHour(t.start_time) ?? 0
  const duration = t.duration ?? (t.duration_minutes != null ? t.duration_minutes / 60 : 1.5)
  return { ...t, days: t.days ?? [], start_hour, duration }
}

/** Human-readable day/time range (ignores short_code). */
export function timeslotScheduleLabel(t: TimeslotCatalogueEntry): string {
  const n = normalizeTimeslotCatalogueEntry(t)
  const dayPart = (n.days || []).map((d) => d.slice(0, 3)).join("/") || "—"
  return `${dayPart} ${hourFloatToLabel(n.start_hour)}–${hourFloatToLabel(n.start_hour + n.duration)}`
}

/** Long label for tooltips and legends: optional custom label, else schedule range. */
export function timeslotLongLabel(t: TimeslotCatalogueEntry): string {
  if (t.label?.trim()) return t.label.trim()
  return timeslotScheduleLabel(t)
}

/** Compact label for grid headers: short_code, else same as long. */
export function timeslotCompactLabel(t: TimeslotCatalogueEntry): string {
  if (t.short_code?.trim()) return t.short_code.trim()
  return timeslotLongLabel(t)
}

export function derivedTimeslotLabel(t: TimeslotCatalogueEntry): string {
  return timeslotCompactLabel(t)
}

/** Merge engine catalogue rows with short_code (and optional label) from config by id. */
export function mergeCatalogueWithConfigTimeslots(
  catalogue: TimeslotCatalogueEntry[] | undefined,
  configRows: TimeslotCatalogueEntry[],
): TimeslotCatalogueEntry[] {
  if (!catalogue?.length) return []
  const cfgById = new Map(configRows.map((r) => [r.id, r]))
  return catalogue.map((row) => {
    const cfg = cfgById.get(row.id)
    if (!cfg) return row
    return {
      ...row,
      ...(cfg.short_code != null && cfg.short_code !== ""
        ? { short_code: cfg.short_code }
        : {}),
      ...(cfg.label != null && cfg.label !== "" ? { label: cfg.label } : {}),
      // When the schedule catalogue row is missing engine slot_type, inherit from config so
      // add/move validation (lab vs lecture) matches the solver inputs.
      ...(cfg.slot_type != null &&
      cfg.slot_type !== "" &&
      (row.slot_type == null || String(row.slot_type).trim() === "")
        ? { slot_type: cfg.slot_type }
        : {}),
    }
  })
}

export function shortCodeSortKey(code: string): number {
  const m = /^T(\d+)$/i.exec(code.trim())
  return m ? parseInt(m[1], 10) : 9999
}

/** Sort order for timetable columns: by start time, then engine id. */
export function compareTimeslotGridOrder(
  a: string,
  b: string,
  catMap: Map<string, TimeslotCatalogueEntry>,
): number {
  const ca = catMap.get(a)
  const cb = catMap.get(b)
  const sa = ca != null ? normalizeTimeslotCatalogueEntry(ca).start_hour : 0
  const sb = cb != null ? normalizeTimeslotCatalogueEntry(cb).start_hour : 0
  if (sa !== sb) return sa - sb
  return a.localeCompare(b)
}

export function catalogueById(
  catalogue: TimeslotCatalogueEntry[] | undefined,
): Map<string, TimeslotCatalogueEntry> {
  const m = new Map<string, TimeslotCatalogueEntry>()
  if (!catalogue) return m
  for (const t of catalogue) m.set(t.id, t)
  return m
}

export function timeslotLabelForId(
  id: string,
  catalogue?: TimeslotCatalogueEntry[],
): string {
  const row = catalogue?.find((t) => t.id === id)
  if (!row) return id
  return derivedTimeslotLabel(row)
}

/** Replace raw timeslot ids in a string (e.g. gap warnings) with catalogue labels. */
export function injectTimeslotIdsWithLabels(text: string, catalogue?: TimeslotCatalogueEntry[]): string {
  if (!catalogue?.length) return text
  let out = text
  const sorted = [...catalogue].sort((a, b) => b.id.length - a.id.length)
  for (const t of sorted) {
    const lab = timeslotLongLabel(t)
    if (t.id) out = out.split(t.id).join(lab)
  }
  return out
}

function daySetOverlap(a: string[], b: string[]): boolean {
  const sa = new Set(a)
  for (const d of b) if (sa.has(d)) return true
  return false
}

function windowsOverlap(
  a: Pick<TimeslotCatalogueEntry, "start_hour" | "duration">,
  b: Pick<TimeslotCatalogueEntry, "start_hour" | "duration">,
): boolean {
  const s1 = a.start_hour ?? 0
  const e1 = s1 + (a.duration ?? 1.5)
  const s2 = b.start_hour ?? 0
  const e2 = s2 + (b.duration ?? 1.5)
  return s1 < e2 && s2 < e1
}

export function slotsOverlap(a: TimeslotCatalogueEntry, b: TimeslotCatalogueEntry): boolean {
  if (!daySetOverlap(a.days || [], b.days || [])) return false
  const na = normalizeTimeslotCatalogueEntry(a)
  const nb = normalizeTimeslotCatalogueEntry(b)
  return windowsOverlap(na, nb)
}

export type ScheduleEntryLike = {
  lecture_id: string | number
  timeslot: string
  room: string | null
  lecturer: string
  course_code: string
  timeslot_label?: string
  duration?: number
  start_hour?: number
}

export type ScheduleConflict = {
  type: "room" | "lecturer"
  entries: ScheduleEntryLike[]
  timeslot_label: string
  detail: string
}

export function detectScheduleConflicts(
  entries: ScheduleEntryLike[],
  catalogue?: TimeslotCatalogueEntry[],
): ScheduleConflict[] {
  const catMap = catalogueById(catalogue)
  const resolve = (id: string) => catMap.get(id)

  const conflicts: ScheduleConflict[] = []

  const roomEntries = entries.filter((e) => e.room != null && e.room !== "")
  for (let i = 0; i < roomEntries.length; i++) {
    for (let j = i + 1; j < roomEntries.length; j++) {
      const a = roomEntries[i]
      const b = roomEntries[j]
      if (a.room !== b.room) continue
      if (a.lecture_id === b.lecture_id) continue
      const ca = resolve(a.timeslot)
      const cb = resolve(b.timeslot)
      if (!ca || !cb) continue
      if (slotsOverlap(ca, cb)) {
        conflicts.push({
          type: "room",
          entries: [a, b],
          timeslot_label: `${a.timeslot_label || ca.label || a.timeslot} / ${b.timeslot_label || cb.label || b.timeslot}`,
          detail: String(a.room),
        })
      }
    }
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      if (a.lecturer !== b.lecturer) continue
      if (a.lecture_id === b.lecture_id) continue
      const ca = resolve(a.timeslot)
      const cb = resolve(b.timeslot)
      if (!ca || !cb) continue
      if (slotsOverlap(ca, cb)) {
        conflicts.push({
          type: "lecturer",
          entries: [a, b],
          timeslot_label: `${a.timeslot_label || ca.label || a.timeslot} / ${b.timeslot_label || cb.label || b.timeslot}`,
          detail: a.lecturer,
        })
      }
    }
  }

  return conflicts
}

export function conflictingLectureIds(conflicts: ScheduleConflict[]): Set<string> {
  const ids = new Set<string>()
  for (const c of conflicts) {
    for (const e of c.entries) ids.add(String(e.lecture_id))
  }
  return ids
}

export function formatDeliveryMode(dm?: string): string {
  const v = (dm || "inperson").replace(/_/g, "").toLowerCase()
  if (v === "inperson") return "In-person"
  if (v === "online") return "Online"
  if (v === "blended") return "Blended"
  return dm || "—"
}

/** Course session_type is lecture | lab; slotFamily describes the timeslot pattern. */
export function formatSessionKind(sessionType?: string, slotFamily?: SlotFamily): string {
  if (sessionType === "lab") return "Lab"
  if (slotFamily === "blended") return "Lecture · blended timetable"
  if (slotFamily === "lab") return "Lecture · lab timetable"
  return "Lecture · regular timetable"
}

export function formatSlotPatternFamily(slotFamily: SlotFamily): string {
  if (slotFamily === "lab") return "Lab block (3 hours)"
  if (slotFamily === "blended") return "Blended pattern"
  return "Regular pattern"
}

export function labBlockHours(duration?: number, durationMinutes?: number): boolean {
  if (durationMinutes != null && durationMinutes >= 170) return true
  return duration != null && duration >= 2.75
}
