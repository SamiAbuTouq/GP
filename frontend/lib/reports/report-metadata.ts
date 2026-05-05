import type { ReportDataset } from "./dataset"
import {
  formatDateTime,
  DEFAULT_DATETIME_PREFS,
  type DateTimeFormatPreferences,
} from "@/lib/datetime-format"

/** Shown in PDF footers and Excel summary sheets for auditability. */
export const REPORT_EXPORT_VERSION = "1.2"

export function formatExportTimestamp(
  date: Date,
  prefs: DateTimeFormatPreferences = DEFAULT_DATETIME_PREFS,
): string {
  return formatDateTime(date, prefs)
}

/** Single paragraph for PDF / CSV describing which timetable row facts apply. */
export function timetableSourceFootnote(
  ds: ReportDataset,
  prefs: DateTimeFormatPreferences,
): string {
  const t = ds.timetable
  if (!t) {
    return "No timetable record is on file for this scope; scheduled metrics may be empty."
  }
  return `Source timetable #${t.timetableId} (${t.status}, v${t.versionNumber}, ${t.generationType}), generated ${formatDateTime(new Date(t.generatedAt), prefs)}.`
}

/** Human-readable timetable line for cover sheets (matches aggregate payload). */
export function timetableCoverLine(ds: ReportDataset): string {
  const t = ds.timetable
  if (!t) return "Timetable: none on file for this scope."
  return `Timetable #${t.timetableId} · ${t.status} · v${t.versionNumber} · ${t.generationType}`
}

/**
 * Opening rows for Excel “Summary” sheets — consistent ordering across reports.
 */
export function excelCoverBlock(
  reportTitle: string,
  ds: ReportDataset,
  prefs: DateTimeFormatPreferences,
): (string | number)[][] {
  const fmt = (d: Date) => formatExportTimestamp(d, prefs)
  const rows: (string | number)[][] = [
    [reportTitle],
    ["Export format version", REPORT_EXPORT_VERSION],
    ["Academic period", ds.semesterLabel],
    ["Academic year", ds.academicYear],
    ["Semester type", ds.semesterTypeName],
    ["Semester enrollment (headcount)", ds.totalStudents ?? "—"],
    ["Timetable", timetableCoverLine(ds)],
    ["Generated", fmt(new Date())],
    [timetableSourceFootnote(ds, prefs)],
    [],
  ]
  return rows
}

/** Lines under the PDF title (reporting context) before the executive summary. */
export function pdfSubtitleLines(
  ds: ReportDataset,
  prefs: DateTimeFormatPreferences,
): string[] {
  const lines = [
    `Reporting period: ${ds.semesterLabel}`,
    `Academic year: ${ds.academicYear} · ${ds.semesterTypeName}`,
    ds.totalStudents != null
      ? `Semester headcount (recorded): ${ds.totalStudents.toLocaleString()}`
      : "Semester headcount: not recorded for this period.",
    timetableCoverLine(ds),
    `Exported: ${formatExportTimestamp(new Date(), prefs)}`,
  ]
  return lines
}

/** Brand + version string for PDF footers. */
export function pdfBrandFooterLeft(): string {
  return `University Timetabling System · Export v${REPORT_EXPORT_VERSION}`
}

/** Rows for CSV summary files (after optional [["Metric","Value"]] header). */
export function csvStandardMetadataRows(
  ds: ReportDataset,
  prefs: DateTimeFormatPreferences,
  reportDisplayName: string,
): (string | number)[][] {
  return [
    ["Export format version", REPORT_EXPORT_VERSION],
    ["Report", reportDisplayName],
    ["Academic period", ds.semesterLabel],
    ["Academic year", ds.academicYear],
    ["Semester type", ds.semesterTypeName],
    ["Semester enrollment (headcount)", ds.totalStudents ?? ""],
    ["Timetable", timetableCoverLine(ds)],
    ["Generated", formatExportTimestamp(new Date(), prefs)],
    ["Source detail", timetableSourceFootnote(ds, prefs)],
  ]
}

export type ModalitySplit = {
  online: number
  blended: number
  faceToFace: number
  total: number
  pctOnline: number | null
  pctBlended: number | null
  pctFaceToFace: number | null
}

/** Aggregate modality counts from department rows (section-instance weighted). */
export function modalitySplitFromCourseRows(
  rows: ReportDataset["courseDistributionRows"],
): ModalitySplit {
  const online = rows.reduce((s, r) => s + r.onlineSections, 0)
  const blended = rows.reduce((s, r) => s + r.blendedSections, 0)
  const faceToFace = rows.reduce((s, r) => s + r.faceToFaceSections, 0)
  const total = online + blended + faceToFace
  const pct = (n: number) =>
    total > 0 ? Math.round((n / total) * 1000) / 10 : null
  return {
    online,
    blended,
    faceToFace,
    total,
    pctOnline: pct(online),
    pctBlended: pct(blended),
    pctFaceToFace: pct(faceToFace),
  }
}

export type DeptWorkloadRollup = {
  department: string
  lecturers: number
  sections: number
  weeklyContactHours: number
}

/** Department rollups for lecturer workload (scheduled lecturers only). */
export function lecturerDepartmentRollups(
  rows: ReportDataset["lecturerRows"],
): DeptWorkloadRollup[] {
  const byDept = new Map<
    string,
    { lecturers: number; sections: number; hours: number }
  >()
  for (const r of rows) {
    if (r.weeklyContactHours <= 0 && r.sectionsScheduled <= 0) continue
    const cur = byDept.get(r.department) ?? {
      lecturers: 0,
      sections: 0,
      hours: 0,
    }
    cur.lecturers += 1
    cur.sections += r.sectionsScheduled
    cur.hours += r.weeklyContactHours
    byDept.set(r.department, cur)
  }
  return [...byDept.entries()]
    .map(([department, v]) => ({
      department,
      lecturers: v.lecturers,
      sections: v.sections,
      weeklyContactHours: Math.round(v.hours * 100) / 100,
    }))
    .sort((a, b) => b.weeklyContactHours - a.weeklyContactHours)
}
