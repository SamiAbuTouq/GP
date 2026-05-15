const ACADEMIC_YEAR_RE = /^(\d{4})-(\d{4})$/

/** Calendar year that starts the current academic year (Sep boundary). */
export function currentAcademicYearStart(now = new Date()): number {
  const y = now.getFullYear()
  return now.getMonth() >= 8 ? y : y - 1
}

export function parseAcademicYearStart(year: string): number | null {
  const match = ACADEMIC_YEAR_RE.exec(year.trim())
  if (!match) return null
  const start = Number(match[1])
  const end = Number(match[2])
  return end === start + 1 ? start : null
}

export function formatAcademicYear(startYear: number): string {
  return `${startYear}-${startYear + 1}`
}

export function isValidAcademicYear(year: string): boolean {
  return parseAcademicYearStart(year) != null
}

/** Trim and return canonical YYYY-YYYY when valid. */
export function normalizeAcademicYear(year: string): string | null {
  const trimmed = year.trim()
  const start = parseAcademicYearStart(trimmed)
  if (start == null) return null
  return formatAcademicYear(start)
}

/** Distinct academic years from semester records (for autocomplete hints). */
export function academicYearsFromSemesters(knownYears: Iterable<string>): string[] {
  const set = new Set<string>()
  for (const y of knownYears) {
    const normalized = normalizeAcademicYear(y)
    if (normalized) set.add(normalized)
  }
  return Array.from(set).sort((a, b) => {
    const as = parseAcademicYearStart(a) ?? 0
    const bs = parseAcademicYearStart(b) ?? 0
    return as - bs
  })
}
