/**
 * Central date/time formatting for the UI. All user-visible dates and times
 * should be produced through this module (or the React hook that wraps it)
 * so preferences stay consistent and reactive.
 */

export type UserDateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
export type UserTimeFormat = "12" | "24"

export interface DateTimeFormatPreferences {
  dateFormat: UserDateFormat
  timeFormat: UserTimeFormat
}

export const DEFAULT_DATETIME_PREFS: DateTimeFormatPreferences = {
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24",
}

const ALLOWED_DATE: readonly UserDateFormat[] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]

export function normalizeDateFormat(raw?: string | null): UserDateFormat {
  if (raw && (ALLOWED_DATE as readonly string[]).includes(raw)) {
    return raw as UserDateFormat
  }
  return "DD/MM/YYYY"
}

export function normalizeTimeFormat(raw?: string | null): UserTimeFormat {
  return raw === "12" ? "12" : "24"
}

export function prefsFromProfile(
  profile?: { date_format?: string | null; time_format?: string | null } | null,
): DateTimeFormatPreferences {
  return {
    dateFormat: normalizeDateFormat(profile?.date_format),
    timeFormat: normalizeTimeFormat(profile?.time_format),
  }
}

export function safeParseDate(input: Date | string | number): Date | null {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null
    return input
  }
  const s = String(input).trim()
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (isoDate) {
    const y = Number(isoDate[1])
    const mo = Number(isoDate[2])
    const d = Number(isoDate[3])
    const dt = new Date(y, mo - 1, d, 12, 0, 0, 0)
    if (Number.isNaN(dt.getTime())) return null
    return dt
  }
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

function pad2(n: number): string {
  return String(Math.trunc(n)).padStart(2, "0")
}

export function formatDateOnly(parsed: Date, dateFormat: UserDateFormat): string {
  const y = parsed.getFullYear()
  const m = parsed.getMonth() + 1
  const day = parsed.getDate()
  const dd = pad2(day)
  const mm = pad2(m)
  const yyyy = String(y)
  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`
    default:
      return `${dd}/${mm}/${yyyy}`
  }
}

export function formatClockFromDate(
  parsed: Date,
  timeFormat: UserTimeFormat,
  options?: { includeSeconds?: boolean },
): string {
  let h = parsed.getHours()
  const min = parsed.getMinutes()
  const s = parsed.getSeconds()
  const incS = options?.includeSeconds ?? false
  if (timeFormat === "24") {
    return incS
      ? `${pad2(h)}:${pad2(min)}:${pad2(s)}`
      : `${pad2(h)}:${pad2(min)}`
  }
  const period = h >= 12 ? "PM" : "AM"
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return incS
    ? `${h12}:${pad2(min)}:${pad2(s)} ${period}`
    : `${h12}:${pad2(min)} ${period}`
}

export function formatDateTime(input: Date | string | number, prefs: DateTimeFormatPreferences): string {
  const d = safeParseDate(input)
  if (!d) return "—"
  return `${formatDateOnly(d, prefs.dateFormat)}, ${formatClockFromDate(d, prefs.timeFormat)}`
}

/** Date and time separated by a middle dot (compact tables). */
export function formatDateTimeCompact(input: Date | string | number, prefs: DateTimeFormatPreferences): string {
  const d = safeParseDate(input)
  if (!d) return "—"
  return `${formatDateOnly(d, prefs.dateFormat)} · ${formatClockFromDate(d, prefs.timeFormat)}`
}

export function formatHourFloatAsClock(hourFloat: number, timeFormat: UserTimeFormat): string {
  const totalMinutes = Math.round(hourFloat * 60)
  const h = Math.floor(totalMinutes / 60) % 24
  const m = ((totalMinutes % 60) + 60) % 60
  const d = new Date(2000, 0, 1, h, m, 0, 0)
  return formatClockFromDate(d, timeFormat)
}

export function formatTimeslotClockRange(
  startHour: number,
  durationHours: number,
  timeFormat: UserTimeFormat,
): string {
  return `${formatHourFloatAsClock(startHour, timeFormat)}–${formatHourFloatAsClock(startHour + durationHours, timeFormat)}`
}

/** `HH:MM` wall-clock from API/session DTOs → user-preferred 12h or 24h label. */
export function formatWallClockFromHhMm(hhmm: string, timeFormat: UserTimeFormat): string {
  const s = hhmm.trim()
  if (!s) return "—"
  const parts = s.split(":")
  const h = parseInt(parts[0] ?? "", 10)
  const m = parseInt(parts[1] ?? "0", 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return s
  const dh = ((h % 24) + 24) % 24
  const dmin = ((m % 60) + 60) % 60
  return formatClockFromDate(new Date(2000, 0, 1, dh, dmin, 0, 0), timeFormat)
}

/** Canonical range `HH:MM-HH:MM` (from `timeRange` or built from start/end) → display label. */
export function formatSessionTimeRangeLabel(range: string, timeFormat: UserTimeFormat): string {
  const raw = range.trim()
  const idx = raw.indexOf("-")
  if (idx === -1) return formatWallClockFromHhMm(raw, timeFormat)
  const a = raw.slice(0, idx).trim()
  const b = raw.slice(idx + 1).trim()
  return `${formatWallClockFromHhMm(a, timeFormat)}–${formatWallClockFromHhMm(b, timeFormat)}`
}
