/**
 * Wall-clock times for Prisma `@db.Time()` values.
 * Seed uses `new Date(1970, 0, 1, h, m)` (local); DB stores UTC → read in campus TZ.
 */
const SCHEDULE_TIMEZONE = process.env.SCHEDULE_TIMEZONE ?? 'Asia/Amman'

const HH_MM_RE = /^(\d{1,2}):(\d{2})/
const HH_MM_PARSE_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i

function formatDateInScheduleTz(value: Date): string {
  if (Number.isNaN(value.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHEDULE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(value)

  const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/** `HH:mm` (24h) for API rows and analytics. */
export function formatPrismaTimeAsHhMm(value: Date | string | null | undefined): string {
  if (value == null || value === '') return ''

  if (typeof value === 'string') {
    const trimmed = value.trim()
    const hm = HH_MM_RE.exec(trimmed)
    if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`

    const d = new Date(trimmed)
    if (!Number.isNaN(d.getTime())) return formatDateInScheduleTz(d)
    return ''
  }

  return formatDateInScheduleTz(value)
}

/** Parse `HH:mm` / `HH:mm:ss` (optional AM/PM) to minutes from midnight; null if invalid. */
export function parseWallClockTimeToMinutes(t?: string): number | null {
  if (!t) return null
  const normalized = t.trim().toUpperCase()
  const match = HH_MM_PARSE_RE.exec(normalized)
  if (!match) return null

  let hh = Number(match[1])
  const mm = Number(match[2])
  const meridiem = match[3]?.toUpperCase()

  if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm < 0 || mm > 59) return null

  if (meridiem) {
    if (hh < 1 || hh > 12) return null
    if (meridiem === 'AM' && hh === 12) hh = 0
    if (meridiem === 'PM' && hh !== 12) hh += 12
  } else if (hh < 0 || hh > 23) {
    return null
  }

  return hh * 60 + mm
}

/** Two-digit hour key from `Start_Time` / `formatPrismaTimeAsHhMm` output. */
export function startHourKeyFromHhMm(hhmm: string): string {
  const mins = parseWallClockTimeToMinutes(hhmm)
  if (mins == null) return ''
  return String(Math.floor(mins / 60)).padStart(2, '0')
}
