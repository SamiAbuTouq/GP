import * as XLSX from "xlsx"
import type { ExportFormat, ReportTypeId } from "./types"
import type { ReportDataset } from "./dataset"
import { getReportDefinition } from "./definitions"
import {
  DEFAULT_DATETIME_PREFS,
  formatDateTime,
  type DateTimeFormatPreferences,
} from "@/lib/datetime-format"
import {
  csvStandardMetadataRows,
  excelCoverBlock,
  lecturerDepartmentRollups,
  modalitySplitFromCourseRows,
  pdfBrandFooterLeft,
  pdfSubtitleLines,
  timetableSourceFootnote,
} from "./report-metadata"

function slugFilePart(label: string) {
  return label
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

function csvEscape(cell: string | number): string {
  const s = String(cell)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(headers: string[], data: (string | number)[][]): string {
  const lines = [headers.map(csvEscape).join(",")]
  for (const row of data) {
    lines.push(row.map(csvEscape).join(","))
  }
  return lines.join("\r\n") + "\r\n"
}

function rowsToCsvNoHeader(data: (string | number)[][]): string {
  return data.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n"
}

/** Blank Excel cells for optional numeric fields (keeps columns numeric when present). */
function xlOptNum(n: number | null | undefined): number | "" {
  if (n == null || Number.isNaN(n)) return ""
  return n
}

function applyDetailSheetLayout(ws: XLSX.WorkSheet) {
  if (!ws["!ref"]) return
  ws["!autofilter"] = { ref: ws["!ref"] }
}

/** Summary sheets use a Metric | Value layout — wide columns avoid truncated labels (e.g. “Export format version”). */
function applyTwoColumnKeyValueWidths(ws: XLSX.WorkSheet) {
  ws["!cols"] = [{ wch: 44 }, { wch: 56 }]
}

type PdfTableSection = {
  title: string
  /** Optional paragraph(s) rendered after the section title and before the table. */
  introLines?: string[]
  tableHead: string[][]
  tableBody: (string | number)[][]
}

async function buildCsvZip(files: { filename: string; content: string }[]): Promise<Blob> {
  const { strToU8, zipSync } = await import("fflate")
  const archive: Record<string, Uint8Array> = {}
  for (const f of files) {
    archive[f.filename] = strToU8(f.content)
  }
  const zipped = zipSync(archive, { level: 6 })
  return new Blob([new Uint8Array(zipped)], { type: "application/zip" })
}

async function buildPdf(
  title: string,
  subtitleLines: string[],
  summaryLines: string[],
  tableHead: string[][],
  tableBody: (string | number)[][],
  extraNotes?: string[],
  appendSections?: PdfTableSection[],
  fmtGen: (d: Date) => string = (d) => formatDateTime(d, DEFAULT_DATETIME_PREFS),
  preMainTableSections?: PdfTableSection[],
): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 16

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(title, margin, y)
  y += 7

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(80)
  for (const line of subtitleLines) {
    const wrapped = doc.splitTextToSize(line, pageW - margin * 2)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 4.5 + 1
  }
  y += 4

  doc.setTextColor(0)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Executive summary", margin, y)
  y += 6
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  for (const line of summaryLines) {
    const wrapped = doc.splitTextToSize(line, pageW - margin * 2)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 4.5 + 1
  }
  if (extraNotes?.length) {
    y += 2
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8.5)
    doc.setTextColor(90)
    for (const line of extraNotes) {
      const wrapped = doc.splitTextToSize(line, pageW - margin * 2)
      doc.text(wrapped, margin, y)
      y += wrapped.length * 4 + 0.5
    }
    doc.setTextColor(0)
    doc.setFont("helvetica", "normal")
    y += 2
  }
  y += 4

  const drawPdfFooter = (data: { pageNumber: number }) => {
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFontSize(7.5)
    doc.setTextColor(130)
    doc.text(pdfBrandFooterLeft(), margin, pageH - 8)
    doc.text(`Page ${data.pageNumber}`, pageW - margin - 14, pageH - 8)
    doc.setTextColor(0)
  }

  const drawPdfTableSection = (section: PdfTableSection, startY: number): number => {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    if (section.title) doc.text(section.title, margin, startY)
    let tableStartY = section.title ? startY + 5 : startY
    if (section.introLines?.length) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9.5)
      doc.setTextColor(60)
      for (const line of section.introLines) {
        const wrapped = doc.splitTextToSize(line, pageW - margin * 2)
        doc.text(wrapped, margin, tableStartY)
        tableStartY += wrapped.length * 4.5 + 1
      }
      doc.setTextColor(0)
      tableStartY += 3
    }

    autoTable(doc, {
      startY: tableStartY,
      head: section.tableHead,
      body: section.tableBody,
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: margin, right: margin },
      tableWidth: "auto",
      showHead: "everyPage",
      didDrawPage: drawPdfFooter,
    })
    doc.setFont("helvetica", "normal")
    return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? tableStartY
  }

  if (preMainTableSections?.length) {
    for (const section of preMainTableSections) {
      y = drawPdfTableSection(section, y) + 10
    }
  }

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: margin, right: margin },
    tableWidth: "auto",
    showHead: "everyPage",
    didDrawPage: drawPdfFooter,
  })

  if (appendSections?.length) {
    for (const section of appendSections) {
      const lastY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY
      drawPdfTableSection(section, (lastY ?? y) + 10)
    }
  }

  return doc.output("blob")
}

function buildRoomExcel(ds: ReportDataset, prefs: DateTimeFormatPreferences) {
  const { roomRows: rows, insights: ins, timetable: t } = ds
  const wb = XLSX.utils.book_new()

  const summaryData: (string | number)[][] = [
    ...excelCoverBlock("Room Utilization Report", ds, prefs),
    ["Metric", "Value"],
    ["Rooms in catalog", ins.totalRoomsInCatalog],
    ["Rooms with scheduled sessions", ins.roomsWithSchedule],
    ["Scheduled section instances (all rooms)", ins.totalScheduleEntries],
    ["Total weekly instructional hours (sum)", ins.totalWeeklyScheduledHours],
    ["Peak room weekly hours (max)", ins.maxWeeklyHoursAnyRoom],
    [
      "Avg weekly hours per room in use",
      ins.avgWeeklyHoursPerUsedRoom,
    ],
    [
      "Weighted avg seat fill (face-to-face & blended, hours-weighted)",
      xlOptNum(ins.totalSeatFillWeightedPct),
    ],
    ["Solver room utilization rate (timetable metrics)", xlOptNum(t?.roomUtilizationRate ?? null)],
  ]
  const summaryWsRoom = XLSX.utils.aoa_to_sheet(summaryData)
  applyTwoColumnKeyValueWidths(summaryWsRoom)
  XLSX.utils.book_append_sheet(wb, summaryWsRoom, "Summary")

  const detail = rows.map((r) => ({
    "Room number": r.roomNumber,
    "Room type": r.roomTypeLabel,
    Capacity: r.capacity,
    "In service": r.isAvailable ? "Yes" : "No",
    "Sessions scheduled": r.sessionsCount,
    "Online/blended sessions": r.onlineOrBlendedSessions,
    "Weekly instructional hours": r.weeklyInstructionalHours,
    "Share of peak room load (%)": r.relativeLoadPct,
    "Avg seat fill — F2F/blended (%)": xlOptNum(r.avgSeatFillPct),
    "Busiest weekday (by session count)": r.peakDay,
  }))
  const detailWs = XLSX.utils.json_to_sheet(detail)
  applyDetailSheetLayout(detailWs)
  XLSX.utils.book_append_sheet(wb, detailWs, "Room detail")
  return wb
}

type TimetableCoverageRow = {
  department: string
  catalogCount: number
  scheduledCount: number
  gap: number
  coveragePct: number
}

function computeTimetableCoverage(ds: ReportDataset): {
  coverageRows: TimetableCoverageRow[]
  totalCatalog: number
  totalScheduled: number
  totalGap: number
  depsWithGaps: number
  depsFullCoverage: number
  institutionCoveragePct: number
} {
  const coverageRows = ds.courseDistributionRows
    .map((r) => ({
      department: r.department,
      catalogCount: r.catalogCourseCount,
      scheduledCount: r.scheduledDistinctCourses,
      gap: r.catalogCourseCount - r.scheduledDistinctCourses,
      coveragePct:
        r.catalogCourseCount > 0
          ? Math.round((r.scheduledDistinctCourses / r.catalogCourseCount) * 1000) / 10
          : 100,
    }))
    .sort((a, b) => b.gap - a.gap)
  const totalCatalog = coverageRows.reduce((s, r) => s + r.catalogCount, 0)
  const totalScheduled = coverageRows.reduce((s, r) => s + r.scheduledCount, 0)
  const totalGap = totalCatalog - totalScheduled
  const depsWithGaps = coverageRows.filter((r) => r.gap > 0).length
  const depsFullCoverage = coverageRows.filter((r) => r.gap === 0).length
  const institutionCoveragePct =
    totalCatalog > 0 ? Math.round((totalScheduled / totalCatalog) * 1000) / 10 : 100
  return {
    coverageRows,
    totalCatalog,
    totalScheduled,
    totalGap,
    depsWithGaps,
    depsFullCoverage,
    institutionCoveragePct,
  }
}

function buildLecturerExcel(ds: ReportDataset, prefs: DateTimeFormatPreferences) {
  const { lecturerRows: rows, insights: ins, lecturerPreferenceSummary: prefSummary } = ds
  const wb = XLSX.utils.book_new()
  const avgLoad =
    rows.length > 0
      ? (() => {
          const withIdx = rows.filter((r) => r.loadIndex != null)
          if (withIdx.length === 0) return null
          return (
            Math.round(
              (withIdx.reduce((s, r) => s + (r.loadIndex as number), 0) / withIdx.length) * 1000,
            ) / 1000
          )
        })()
      : null
  const highLoad = rows.filter((r) => r.loadIndex != null && r.loadIndex >= 1.2).length
  const totalHrs = Math.round(rows.reduce((s, r) => s + r.weeklyContactHours, 0) * 100) / 100

  const summaryData: (string | number)[][] = [
    ...excelCoverBlock("Lecturer Workload Report", ds, prefs),
    ["Metric", "Value"],
    ["Lecturers with assignments", ins.lecturerCountScheduled],
    ["Lecturers with no assignments", ins.lecturersWithNoAssignments],
    ["Average load index (hours / max_workload)", xlOptNum(avgLoad)],
    ["Total scheduled weekly contact hours", totalHrs],
    ["Faculty at or above 1.20 load index", highLoad],
    [],
    ["Preference compliance", ""],
    ["Lecturers with preferences defined", prefSummary.lecturersWithPreferences],
    ["Lecturers with no preferences", prefSummary.lecturersWithoutPreferences],
    ["Total avoided-slot violations", prefSummary.totalAvoidedViolations],
    ["Lecturers requiring attention (≥1 avoided violation)", prefSummary.lecturersRequiringAttention],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  applyTwoColumnKeyValueWidths(summaryWs)
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

  const detail = rows.map((r) => ({
    Lecturer: r.lecturerName,
    Department: r.department,
    "Max workload (DB)": r.maxWorkloadHours,
    Sections: r.sectionsScheduled,
    "Distinct courses (per lecturer)": r.distinctCourses,
    "Unique course titles (institution total)": "",
    "Lab sections": r.labSections,
    "Weekly contact hours": r.weeklyContactHours,
    "Load index": xlOptNum(r.loadIndex),
    "% of personal max": xlOptNum(r.loadPctOfMax),
  }))
  const totalsRow = {
    Lecturer: "TOTAL",
    Department: "",
    "Max workload (DB)": "",
    Sections: rows.reduce((s, r) => s + r.sectionsScheduled, 0),
    "Distinct courses (per lecturer)": "",
    "Unique course titles (institution total)": ins.distinctCoursesScheduled,
    "Lab sections": rows.reduce((s, r) => s + r.labSections, 0),
    "Weekly contact hours": Math.round(rows.reduce((s, r) => s + r.weeklyContactHours, 0) * 100) / 100,
    "Load index": "",
    "% of personal max": "",
  }
  const detailSheet = XLSX.utils.json_to_sheet([...detail, totalsRow])
  const totalRowNum = detail.length + 2
  for (const col of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const) {
    const cell = detailSheet[`${col}${totalRowNum}`]
    if (cell) cell.s = { font: { bold: true } }
  }
  applyDetailSheetLayout(detailSheet)
  XLSX.utils.book_append_sheet(wb, detailSheet, "Workload detail")

  const rollup = lecturerDepartmentRollups(rows)
  const rollupWs = XLSX.utils.json_to_sheet(
    rollup.map((r) => ({
      Department: r.department,
      "Lecturers (scheduled)": r.lecturers,
      Sections: r.sections,
      "Weekly contact hours": r.weeklyContactHours,
    })),
  )
  applyDetailSheetLayout(rollupWs)
  XLSX.utils.book_append_sheet(wb, rollupWs, "By department")

  const prefWs = XLSX.utils.json_to_sheet(
    ds.lecturerPreferenceRows.map((r) => ({
      Lecturer: r.lecturerName,
      Department: r.department,
      "Sessions assigned": r.sessionsAssigned,
      "On preferred": r.onPreferred,
      "On avoided": r.onAvoided,
      Neutral: r.neutral,
      "Compliance score": r.hasPreferences ? xlOptNum(r.complianceScore) : "",
      "Has preferences": r.hasPreferences ? "Yes" : "No",
    })),
  )
  applyDetailSheetLayout(prefWs)
  XLSX.utils.book_append_sheet(wb, prefWs, "Preference detail")

  return wb
}

function lecturerWorkloadPdfAvoidedViolations(
  workloadRow: ReportDataset["lecturerRows"][number],
  prefByUserId: Map<number, ReportDataset["lecturerPreferenceRows"][number]>,
): string | number {
  const pref = prefByUserId.get(workloadRow.userId)
  if (!pref) return "—"
  if (!pref.hasPreferences) return "—"
  return pref.onAvoided
}

function buildCourseExcel(ds: ReportDataset, prefs: DateTimeFormatPreferences) {
  const { courseDistributionRows: rows, insights: ins } = ds
  const wb = XLSX.utils.book_new()
  const mod = modalitySplitFromCourseRows(rows)
  const coverage = computeTimetableCoverage(ds)
  const COVERAGE_NOTE =
    "This report cannot distinguish intentional absences from scheduling errors."
  const coverLines = excelCoverBlock("Course Distribution Report", ds, prefs)

  const summaryData: (string | number)[][] = [
    ...coverLines.slice(0, -1),
    ["⚠ Note:", COVERAGE_NOTE],
    [],
    ["Metric", "Value"],
    ["Departments listed", rows.length],
    ["Distinct courses on timetable", ins.distinctCoursesScheduled],
    ["Section instances", ins.totalScheduleEntries],
    ["Total registered students (sum of sections)", rows.reduce((s, r) => s + r.totalEnrollment, 0)],
    ["Departments with ≥1 section", ins.departmentsScheduled],
    [],
    ["Modality (section instances)", "Count"],
    ["Online", mod.online],
    ["Blended", mod.blended],
    ["Face-to-face", mod.faceToFace],
    ["% of section instances — online", xlOptNum(mod.pctOnline)],
    ["% of section instances — blended", xlOptNum(mod.pctBlended)],
    ["% of section instances — face-to-face", xlOptNum(mod.pctFaceToFace)],
    [],
    ["Catalog vs. timetable coverage", ""],
    ["Total catalog courses", coverage.totalCatalog],
    ["Courses on timetable", coverage.totalScheduled],
    ["Institution coverage %", coverage.institutionCoveragePct],
    ["Departments with ≥1 unscheduled catalog course", coverage.depsWithGaps],
    ["Departments with full coverage", coverage.depsFullCoverage],
    ["Total unscheduled course titles (all departments)", coverage.totalGap],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  applyTwoColumnKeyValueWidths(summaryWs)
  const noteRowNum = coverLines.length
  const noteA = summaryWs[`A${noteRowNum}`]
  if (noteA) noteA.s = { font: { bold: true } }
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

  const detail = rows.map((r) => {
    const gap = r.catalogCourseCount - r.scheduledDistinctCourses
    const coveragePct =
      r.catalogCourseCount > 0
        ? Math.round((r.scheduledDistinctCourses / r.catalogCourseCount) * 1000) / 10
        : 100
    return {
      Department: r.department,
      "Courses in catalog": r.catalogCourseCount,
      "Courses on timetable": r.scheduledDistinctCourses,
      Gap: gap,
      "Coverage %": coveragePct,
      "Section instances": r.sectionInstances,
      "Total enrollment": r.totalEnrollment,
      "UG course titles (scheduled)": r.undergraduateCourseCount,
      "Grad course titles (scheduled)": r.graduateCourseCount,
      "Online sections": r.onlineSections,
      "Blended sections": r.blendedSections,
      "Face-to-face sections": r.faceToFaceSections,
      "Avg enrollment / section": r.avgSectionEnrollment,
      "% sections online (dept)":
        r.sectionInstances > 0
          ? Math.round((r.onlineSections / r.sectionInstances) * 1000) / 10
          : "",
    }
  })
  const totalSections = rows.reduce((s, r) => s + r.sectionInstances, 0)
  const totalEnrollment = rows.reduce((s, r) => s + r.totalEnrollment, 0)
  const totalsRow = {
    Department: "TOTAL",
    "Courses in catalog": rows.reduce((s, r) => s + r.catalogCourseCount, 0),
    "Courses on timetable": rows.reduce((s, r) => s + r.scheduledDistinctCourses, 0),
    Gap: coverage.totalGap,
    "Coverage %": coverage.institutionCoveragePct,
    "Section instances": totalSections,
    "Total enrollment": totalEnrollment,
    "UG course titles (scheduled)": "",
    "Grad course titles (scheduled)": "",
    "Online sections": rows.reduce((s, r) => s + r.onlineSections, 0),
    "Blended sections": rows.reduce((s, r) => s + r.blendedSections, 0),
    "Face-to-face sections": rows.reduce((s, r) => s + r.faceToFaceSections, 0),
    "Avg enrollment / section": totalSections > 0 ? Math.round((totalEnrollment / totalSections) * 100) / 100 : 0,
    "% sections online (dept)": "",
  }
  const detailSheet = XLSX.utils.json_to_sheet([...detail, totalsRow])
  const totalRowNum = detail.length + 2
  for (const col of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"] as const) {
    const cell = detailSheet[`${col}${totalRowNum}`]
    if (cell) cell.s = { font: { bold: true } }
  }
  applyDetailSheetLayout(detailSheet)
  XLSX.utils.book_append_sheet(wb, detailSheet, "By department")
  return wb
}

const TIMESLOT_PRESSURE_FOOTNOTE =
  "Slot pressure % = rooms in use ÷ total active rooms × 100. Shown as — when total room count is zero."

function buildTimeslotDemandExcel(ds: ReportDataset, prefs: DateTimeFormatPreferences) {
  const rows = ds.timeslotDemandRows
  const totalRooms = ds.insights.totalActiveRooms
  const busiest = rows[0]
  const highPressure = rows.filter((r) => (r.slotPressurePct ?? 0) >= 80).length
  const wb = XLSX.utils.book_new()
  const summaryData: (string | number)[][] = [
    ...excelCoverBlock("Timeslot Demand Report", ds, prefs),
    ["Metric", "Value"],
    ["Timeslots with ≥1 section", rows.length],
    [
      "Busiest slot",
      busiest
        ? `${busiest.days} ${busiest.startTime}–${busiest.endTime} (${busiest.sections} sections)`
        : "N/A",
    ],
    ["Slots at ≥80% room pressure", highPressure],
    [],
    ["Note", TIMESLOT_PRESSURE_FOOTNOTE],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  applyTwoColumnKeyValueWidths(summaryWs)
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

  const detailWs = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      Days: r.days,
      "Start time": r.startTime,
      "End time": r.endTime,
      Sections: r.sections,
      "Rooms in use": r.roomsUsed,
      "Total rooms": totalRooms,
      "Total enrollment": r.totalEnrollment,
      "Slot pressure %": xlOptNum(r.slotPressurePct),
    })),
  )
  applyDetailSheetLayout(detailWs)
  XLSX.utils.book_append_sheet(wb, detailWs, "Slot detail")
  return wb
}

function timetableHealthConflictTypeLabel(t: string): string {
  return (
    {
      lecturer_double_booking: "Lecturer double-booking",
      room_double_booking: "Room double-booking",
      capacity_exceeded: "Capacity exceeded",
      lecturer_overload: "Lecturer overload",
      wrong_timeslot_type: "Wrong timeslot type",
      wrong_room_type: "Wrong room type",
      cohort_overlap: "Cohort overlap",
      preference_violation: "Preference violation",
    } as Record<string, string>
  )[t] ?? t
}

type ConflictHotspotCounts = { hard: number; soft: number }

function lecturerDepartmentLookup(
  ds: ReportDataset,
): Map<string, string> {
  const m = new Map(Object.entries(ds.lecturerNameToDepartment))
  for (const r of ds.lecturerRows) {
    const name = r.lecturerName.trim()
    if (name && !m.has(name)) m.set(name, r.department)
  }
  for (const r of ds.lecturerPreferenceRows) {
    const name = r.lecturerName.trim()
    if (name && !m.has(name)) m.set(name, r.department)
  }
  return m
}

function buildTimetableHealthConflictHotspots(
  conflicts: ReportDataset["conflicts"],
  deptLookup: Map<string, string>,
) {
  const lectMap = new Map<string, ConflictHotspotCounts>()
  const roomMap = new Map<string, ConflictHotspotCounts>()
  for (const c of conflicts) {
    const name = c.lecturerName?.trim()
    if (name) {
      const cur = lectMap.get(name) ?? { hard: 0, soft: 0 }
      if (c.severity === "hard") cur.hard++
      else cur.soft++
      lectMap.set(name, cur)
    }
    const room = c.roomNumber?.trim()
    if (room) {
      const cur = roomMap.get(room) ?? { hard: 0, soft: 0 }
      if (c.severity === "hard") cur.hard++
      else cur.soft++
      roomMap.set(room, cur)
    }
  }
  const lecturers = [...lectMap.entries()]
    .map(([name, counts]) => ({
      name,
      department: deptLookup.get(name) ?? "—",
      hard: counts.hard,
      soft: counts.soft,
      total: counts.hard + counts.soft,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, 5)
  const rooms = [...roomMap.entries()]
    .map(([roomNumber, counts]) => ({
      roomNumber,
      hard: counts.hard,
      soft: counts.soft,
      total: counts.hard + counts.soft,
    }))
    .sort((a, b) => b.total - a.total || a.roomNumber.localeCompare(b.roomNumber))
    .slice(0, 5)
  return { lecturers, rooms }
}

function timetableHealthHotspotExcelRows(ds: ReportDataset): (string | number)[][] {
  if (ds.conflicts.length === 0) return []
  const { lecturers, rooms } = buildTimetableHealthConflictHotspots(
    ds.conflicts,
    lecturerDepartmentLookup(ds),
  )
  const rows: (string | number)[][] = [
    [],
    ["Conflict hotspots", ""],
    ["Top 5 lecturers (by total conflict count)", ""],
    ["Lecturer", "Department", "Hard", "Soft", "Total"],
  ]
  if (lecturers.length === 0) {
    rows.push(["—", "—", 0, 0, 0])
  } else {
    for (const l of lecturers) {
      rows.push([l.name, l.department, l.hard, l.soft, l.total])
    }
  }
  rows.push([], ["Top 5 rooms (by total conflict count)", ""], ["Room", "Hard", "Soft", "Total"])
  if (rooms.length === 0) {
    rows.push(["—", 0, 0, 0])
  } else {
    for (const r of rooms) {
      rows.push([r.roomNumber, r.hard, r.soft, r.total])
    }
  }
  return rows
}

function timetableHealthHotspotPdfSections(ds: ReportDataset): PdfTableSection[] {
  if (ds.conflicts.length === 0) return []
  const { lecturers, rooms } = buildTimetableHealthConflictHotspots(
    ds.conflicts,
    lecturerDepartmentLookup(ds),
  )
  return [
    {
      title: "Conflict hotspots",
      introLines: ["Top 5 lecturers by total conflict count"],
      tableHead: [["Lecturer", "Department", "Hard", "Soft", "Total"]],
      tableBody:
        lecturers.length > 0
          ? lecturers.map((l) => [l.name, l.department, l.hard, l.soft, l.total])
          : [["—", "—", 0, 0, 0]],
    },
    {
      title: "",
      introLines: ["Top 5 rooms by total conflict count"],
      tableHead: [["Room", "Hard", "Soft", "Total"]],
      tableBody:
        rooms.length > 0
          ? rooms.map((r) => [r.roomNumber, r.hard, r.soft, r.total])
          : [["—", 0, 0, 0]],
    },
  ]
}

function optimizerRunValidPdfLabel(
  r: ReportDataset["optimizationRuns"][number],
): string {
  let base: string
  if (r.isValid === true) base = "✓ Valid"
  else if (r.isValid === false) base = "✗ Invalid"
  else base = "Unknown"
  if (r.fitnessScore != null) base = `${base} (fitness: ${r.fitnessScore})`
  return base
}

function buildTimetableHealthExcel(ds: ReportDataset, prefs: DateTimeFormatPreferences) {
  const conflicts = [...ds.conflicts].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "hard" ? -1 : 1
    return a.type.localeCompare(b.type)
  })
  const hardCount = conflicts.filter((c) => c.severity === "hard").length
  const softCount = conflicts.filter((c) => c.severity === "soft").length
  const s = ds.roomTypeSummary
  const runs = ds.optimizationRuns
  const active = runs.find((r) => r.isActive) ?? null
  const validRunCount = runs.filter((r) => r.isValid === true).length
  const fmtGen = (d: Date) => formatDateTime(d, prefs)

  const wb = XLSX.utils.book_new()

  const summaryData: (string | number)[][] = [
    ...excelCoverBlock("Timetable Health Report", ds, prefs),
    ["Metric", "Value"],
    ["Total hard violations", hardCount],
    ["Total soft violations", softCount],
    [],
    ["Room assignments (section-level)", ""],
    ["Total sections evaluated", s.totalSections],
    ["OK (matched)", s.okCount],
    ["Hard mismatches", s.hardMismatchCount],
    ["Soft mismatches", s.softMismatchCount],
    [],
    ["Optimizer runs", ""],
    ["Total runs", runs.length],
    ["Active version", active ? `v${active.versionNumber}` : "N/A"],
    ["Valid runs (isValid === true)", validRunCount],
    ...timetableHealthHotspotExcelRows(ds),
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  applyTwoColumnKeyValueWidths(summaryWs)
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

  const violationsWs = XLSX.utils.json_to_sheet(
    conflicts.map((c) => ({
      Severity: c.severity === "hard" ? "Hard" : "Soft",
      Type: timetableHealthConflictTypeLabel(c.type),
      Course: c.courseCode,
      Section: c.sectionNumber,
      Lecturer: c.lecturerName ?? "",
      Room: c.roomNumber ?? "",
      Timeslot: c.timeslotLabel ?? "",
      Detail: c.detail,
    })),
  )
  applyDetailSheetLayout(violationsWs)
  XLSX.utils.book_append_sheet(wb, violationsWs, "Violations")

  const roomWs = XLSX.utils.json_to_sheet(
    ds.roomTypeRows.map((r) => ({
      Course: r.courseCode,
      Section: r.sectionNumber,
      Delivery: r.deliveryLabel,
      Lab: r.isLab ? "Yes" : "No",
      Room: r.roomNumber,
      "Room type": r.roomTypeLabel,
      Capacity: r.capacity,
      Enrolled: r.enrolled,
      "Match status": r.matchStatus,
      Issue: r.issue,
    })),
  )
  applyDetailSheetLayout(roomWs)
  XLSX.utils.book_append_sheet(wb, roomWs, "Room assignments")

  const runsWs = XLSX.utils.json_to_sheet(
    runs.map((r) => ({
      Version: `v${r.versionNumber}`,
      Type: r.generationTypeLabel,
      Status: r.status,
      Generated: fmtGen(new Date(r.generatedAt)),
      "Fitness score": xlOptNum(r.fitnessScore),
      "Soft constraints score": xlOptNum(r.softConstraintsScore),
      "Room utilization %": xlOptNum(r.roomUtilizationRate),
      Valid:
        r.isValid === true ? "Yes" : r.isValid === false ? "No" : "",
      Sections: r.sectionsCount,
      Active: r.isActive ? "Yes" : "",
    })),
  )
  applyDetailSheetLayout(runsWs)
  XLSX.utils.book_append_sheet(wb, runsWs, "Optimizer runs")

  return wb
}

export function getReportBaseFilename(
  reportTypeId: ReportTypeId,
  timetableLabel: string,
) {
  const def = getReportDefinition(reportTypeId)
  const name = def?.shortName.replace(/\s+/g, "-") ?? "report"
  return `${name}-${slugFilePart(timetableLabel)}`
}

export async function generateReportBlob(params: {
  reportTypeId: ReportTypeId
  format: ExportFormat
  dataset: ReportDataset
  dateTimePrefs?: DateTimeFormatPreferences
}): Promise<{
  blob: Blob
  mimeType: string
  extension: string
  baseFilename: string
}> {
  const { reportTypeId, format, dataset: ds, dateTimePrefs: dateTimePrefsArg } = params
  const dateTimePrefs = dateTimePrefsArg ?? DEFAULT_DATETIME_PREFS
  const fmtGen = (d: Date) => formatDateTime(d, dateTimePrefs)
  const timetableLabel = ds.semesterLabel
  const base = getReportBaseFilename(reportTypeId, timetableLabel)

  const footnotes = [
    timetableSourceFootnote(ds, dateTimePrefs),
    "Undergraduate vs. graduate course counts use academic_level: levels below 500 count as undergraduate; 500+ as graduate.",
    "Weekly hours multiply slot length by the number of days in each timeslot’s days mask (recurring meetings per week).",
  ]

  const roomFootnotes = [
    ...footnotes,
    "Share of peak room load (%): Percentage of this room's weekly hours relative to the most-used room. Not a capacity-based utilization rate.",
  ]

  const courseFootnotes = [
    ...footnotes,
    "% Online and % Blended: share of that department’s section instances in each modality (— when the department has no sections).",
  ]

  if (reportTypeId === "room-utilization") {
    const rows = ds.roomRows
    const ins = ds.insights
    const idleCount = rows.filter((r) => r.isAvailable && r.sessionsCount === 0).length

    if (format === "excel") {
      const wb = buildRoomExcel(ds, dateTimePrefs)
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      return {
        blob,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        baseFilename: base,
      }
    }

    const summaryLines = [
      idleCount === 0
        ? "No rooms are idle — no available facility has zero scheduled sessions for this timetable."
        : `${idleCount} room${idleCount === 1 ? "" : "s"} ${idleCount === 1 ? "is" : "are"} idle (listed as available but with zero scheduled sessions).`,
      ins.totalSeatFillWeightedPct != null
        ? `Institution-wide weighted seat fill (face-to-face and blended, hours-weighted) is ${ins.totalSeatFillWeightedPct}% of section capacity.`
        : "Seat-fill averages apply only to face-to-face and blended deliveries; online-only sections are excluded from that metric.",
      `${ins.totalWeeklyScheduledHours} total weekly instructional hours are scheduled across all rooms.`,
      `${ins.totalRoomsInCatalog} rooms exist in the facilities catalog; ${ins.roomsWithSchedule} host at least one scheduled section for this timetable.`,
    ]

    const idleRooms = rows.filter((r) => r.isAvailable && r.sessionsCount === 0)
    const blob = await buildPdf(
      "Room Utilization Report",
      pdfSubtitleLines(ds, dateTimePrefs),
      summaryLines,
      [
        [
          "Room",
          "Type",
          "Capacity",
          "Active",
          "Sessions",
          "Online/blended",
          "Hours/week",
          "Share of peak room load (%)",
          "Seat fill %",
        ],
      ],
      rows.map((r) => [
        r.roomNumber,
        r.roomTypeLabel,
        r.capacity,
        r.isAvailable ? "Yes" : "No",
        r.sessionsCount,
        r.onlineOrBlendedSessions,
        r.weeklyInstructionalHours,
        r.relativeLoadPct,
        r.avgSeatFillPct ?? "—",
      ]),
      roomFootnotes,
      idleRooms.length
        ? [
            {
              title: "Idle rooms",
              tableHead: [["Room", "Type", "Capacity"]],
              tableBody: idleRooms.map((r) => [r.roomNumber, r.roomTypeLabel, r.capacity]),
            },
          ]
        : undefined,
      fmtGen,
    )
    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  if (reportTypeId === "lecturer-workload") {
    const rows = ds.lecturerRows
    const ins = ds.insights
    const avgLoad =
      rows.length > 0
        ? (() => {
            const withIdx = rows.filter((r) => r.loadIndex != null)
            if (withIdx.length === 0) return null
            return (
              Math.round(
                (withIdx.reduce((s, r) => s + (r.loadIndex as number), 0) / withIdx.length) * 1000,
              ) / 1000
            )
          })()
        : null
    const highLoad = rows.filter((r) => r.loadIndex != null && r.loadIndex >= 1.2).length
    const totalHrs =
      Math.round(rows.reduce((s, r) => s + r.weeklyContactHours, 0) * 100) / 100
    const noAssignments = ds.insights.lecturersWithNoAssignments
    const prefByUserId = new Map(
      ds.lecturerPreferenceRows.map((p) => [p.userId, p] as const),
    )
    const prefSum = ds.lecturerPreferenceSummary
    const avoidedViolationCount = prefSum.totalAvoidedViolations
    const requireAttention = prefSum.lecturersRequiringAttention

    if (format === "excel") {
      const wb = buildLecturerExcel(ds, dateTimePrefs)
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      return {
        blob,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        baseFilename: base,
      }
    }

    const summaryLines = [
      avgLoad != null
        ? `${ins.lecturerCountScheduled} lecturers appear on the selected timetable, averaging ${avgLoad} load index (weekly hours ÷ personal max_workload from HR records).`
        : `${ins.lecturerCountScheduled} lecturers appear on the selected timetable; average load index is unavailable because max workload is not set for some or all faculty.`,
      `Collectively they deliver ${totalHrs} weekly contact hours. ${highLoad} faculty meet or exceed a 1.20 load index.`,
      `${noAssignments} active lecturers currently have no scheduled sections this term.`,
      "Labs are counted separately so chairs can see experimental teaching intensity alongside lecture contact hours.",
      "A “By department” roll-up follows the workload table (also in the Excel “By department” sheet). Preference detail is Excel-only.",
      prefSum.lecturersWithPreferences === 0
        ? "No lecturers have timeslot preferences defined — avoided-slot compliance is not applicable this semester."
        : `${requireAttention} lecturer(s) have at least one avoided-slot violation (${avoidedViolationCount} total violations). These appear in the 'Avoided violations' column.`,
    ]

    const deptRollup = lecturerDepartmentRollups(rows)
    const blob = await buildPdf(
      "Lecturer Workload Report",
      pdfSubtitleLines(ds, dateTimePrefs),
      summaryLines,
      [
        [
          "Lecturer",
          "Department",
          "Max hours",
          "Sections",
          "Lab sections",
          "Weekly hours",
          "Load index",
          "% of max",
          "Avoided violations",
        ],
      ],
      rows.map((r) => [
        r.lecturerName,
        r.department,
        r.maxWorkloadHours,
        r.sectionsScheduled,
        r.labSections,
        r.weeklyContactHours,
        r.loadIndex != null ? r.loadIndex : "—",
        r.loadPctOfMax != null ? r.loadPctOfMax : "—",
        lecturerWorkloadPdfAvoidedViolations(r, prefByUserId),
      ]),
      footnotes,
      deptRollup.length
        ? [
            {
              title: "By department",
              tableHead: [
                ["Department", "Lecturers scheduled", "Sections", "Weekly hours"],
              ],
              tableBody: deptRollup.map((r) => [
                r.department,
                r.lecturers,
                r.sections,
                r.weeklyContactHours,
              ]),
            },
          ]
        : undefined,
      fmtGen,
    )

    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  if (reportTypeId === "course-distribution") {
    const rows = ds.courseDistributionRows
    const ins = ds.insights
    const totalEnroll = rows.reduce((s, r) => s + r.totalEnrollment, 0)

    if (format === "excel") {
      const wb = buildCourseExcel(ds, dateTimePrefs)
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      return {
        blob,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        baseFilename: base,
      }
    }

    const modPdf = modalitySplitFromCourseRows(rows)
    const covPdf = computeTimetableCoverage(ds)
    const summaryLines = [
      "This report cannot distinguish intentional absences from scheduling errors.",
      `${rows.length} academic units are listed, combining catalog breadth with the live timetable.`,
      `${ins.distinctCoursesScheduled} distinct courses run this term in ${ins.totalScheduleEntries} section instances, enrolling ${totalEnroll.toLocaleString()} student seats in aggregate.`,
      modPdf.total > 0
        ? `Institution-wide delivery split: ${modPdf.pctFaceToFace ?? 0}% face-to-face, ${modPdf.pctOnline ?? 0}% online, ${modPdf.pctBlended ?? 0}% blended (by section count).`
        : "Institution-wide modality split is unavailable (no modality-tagged section instances).",
      `${covPdf.totalScheduled} of ${covPdf.totalCatalog} catalog courses appear on the timetable (${covPdf.institutionCoveragePct}% coverage).`,
      `${covPdf.depsWithGaps} department(s) have at least one unscheduled catalog course; ${covPdf.depsFullCoverage} have full coverage.`,
      `Total unscheduled course titles across all departments: ${covPdf.totalGap}.`,
    ]

    const blob = await buildPdf(
      "Course Distribution Report",
      pdfSubtitleLines(ds, dateTimePrefs),
      summaryLines,
      [
        [
          "Department",
          "Courses in catalog",
          "Courses on timetable",
          "Gap",
          "Coverage %",
          "Sections",
          "Total enrollment",
          "Avg enrollment/section",
          "% Online",
          "% Blended",
        ],
      ],
      (() => {
        const totalSections = rows.reduce((s, r) => s + r.sectionInstances, 0)
        const weightedAvg = totalSections > 0 ? Math.round((totalEnroll / totalSections) * 100) / 100 : 0
        const pctOnlineInst =
          totalSections > 0 && modPdf.pctOnline != null ? modPdf.pctOnline : null
        const pctBlendedInst =
          totalSections > 0 && modPdf.pctBlended != null ? modPdf.pctBlended : null
        return [
          ...rows.map((r) => {
            const gap = r.catalogCourseCount - r.scheduledDistinctCourses
            const coveragePct =
              r.catalogCourseCount > 0
                ? Math.round((r.scheduledDistinctCourses / r.catalogCourseCount) * 1000) / 10
                : 100
            return [
              r.department,
              r.catalogCourseCount,
              r.scheduledDistinctCourses,
              gap,
              coveragePct,
              r.sectionInstances,
              r.totalEnrollment,
              r.avgSectionEnrollment,
              r.sectionInstances === 0
                ? "—"
                : Math.round((r.onlineSections / r.sectionInstances) * 1000) / 10,
              r.sectionInstances === 0
                ? "—"
                : Math.round((r.blendedSections / r.sectionInstances) * 1000) / 10,
            ]
          }),
          [
            "TOTAL",
            rows.reduce((s, r) => s + r.catalogCourseCount, 0),
            rows.reduce((s, r) => s + r.scheduledDistinctCourses, 0),
            covPdf.totalGap,
            covPdf.institutionCoveragePct,
            totalSections,
            totalEnroll,
            weightedAvg,
            pctOnlineInst != null ? pctOnlineInst : "—",
            pctBlendedInst != null ? pctBlendedInst : "—",
          ],
        ]
      })(),
      courseFootnotes,
      undefined,
      fmtGen,
    )
    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  if (reportTypeId === "timeslot-demand") {
    const rows = ds.timeslotDemandRows
    const totalRooms = ds.insights.totalActiveRooms
    const busiestSlot = rows[0]
    const highPressureSlots = rows.filter((r) => (r.slotPressurePct ?? 0) >= 80)
    const timeslotFootnotes = [...footnotes, TIMESLOT_PRESSURE_FOOTNOTE]

    if (format === "excel") {
      const wb = buildTimeslotDemandExcel(ds, dateTimePrefs)
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      return {
        blob: new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        baseFilename: base,
      }
    }

    const summaryLines = [
      `${rows.length} active timeslots with at least one scheduled section.`,
      busiestSlot
        ? `Busiest slot: ${busiestSlot.days} ${busiestSlot.startTime}–${busiestSlot.endTime} with ${busiestSlot.sections} sections.`
        : "No scheduled sections — no busiest slot.",
      `${highPressureSlots.length} slot(s) are using 80% or more of available rooms simultaneously.`,
    ]

    const blob = await buildPdf(
      "Timeslot Demand Report",
      pdfSubtitleLines(ds, dateTimePrefs),
      summaryLines,
      [
        [
          "Days",
          "Time",
          "Sections",
          "Rooms in use",
          "Total rooms",
          "Total enrollment",
          "Slot pressure %",
        ],
      ],
      rows.map((r) => [
        r.days,
        `${r.startTime}–${r.endTime}`,
        r.sections,
        r.roomsUsed,
        totalRooms,
        r.totalEnrollment,
        r.slotPressurePct != null ? r.slotPressurePct : "—",
      ]),
      timeslotFootnotes,
      undefined,
      fmtGen,
    )
    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  if (reportTypeId === "conflict-analysis") {
    const conflicts = [...ds.conflicts].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "hard" ? -1 : 1
      return a.type.localeCompare(b.type)
    })
    const hardCount = conflicts.filter((c) => c.severity === "hard").length
    const softCount = conflicts.filter((c) => c.severity === "soft").length
    const byType = new Map<string, { hard: number; soft: number }>()
    for (const c of conflicts) {
      const slot = byType.get(c.type) ?? { hard: 0, soft: 0 }
      if (c.severity === "hard") slot.hard++
      else slot.soft++
      byType.set(c.type, slot)
    }
    const s = ds.roomTypeSummary
    const runs = ds.optimizationRuns
    const activeRun = runs.find((r) => r.isActive) ?? null
    const validRunCount = runs.filter((r) => r.isValid === true).length

    if (format === "csv") {
      const metricsCsv = rowsToCsvNoHeader([
        ["Metric", "Value"],
        ...csvStandardMetadataRows(ds, dateTimePrefs, "Timetable Health Report"),
        ["Timetable version", ds.timetable ? `v${ds.timetable.versionNumber}` : "N/A"],
        ["Total hard violations", hardCount],
        ["Total soft violations", softCount],
        ["Room assignments — total sections evaluated", s.totalSections],
        ["Room assignments — OK", s.okCount],
        ["Room assignments — hard mismatches", s.hardMismatchCount],
        ["Room assignments — soft mismatches", s.softMismatchCount],
        ["Optimizer runs — total", runs.length],
        ["Optimizer runs — active version", activeRun ? `v${activeRun.versionNumber}` : "N/A"],
        ["Optimizer runs — valid run count", validRunCount],
      ])
      const byTypeCsv = rowsToCsv(
        ["Conflict type", "Hard count", "Soft count", "Total"],
        [
          ...[...byType.entries()].map(([t, c]) => [
            timetableHealthConflictTypeLabel(t),
            c.hard,
            c.soft,
            c.hard + c.soft,
          ]),
          ["All types", hardCount, softCount, hardCount + softCount],
        ],
      )
      const summaryCsv = `${metricsCsv}\r\n${byTypeCsv}`
      const detailCsv = rowsToCsv(
        ["Severity", "Type", "Course", "Section", "Lecturer", "Room", "Timeslot", "Detail"],
        conflicts.map((c) => [
          c.severity === "hard" ? "Hard" : "Soft",
          timetableHealthConflictTypeLabel(c.type),
          c.courseCode,
          c.sectionNumber,
          c.lecturerName ?? "",
          c.roomNumber ?? "",
          c.timeslotLabel ?? "",
          c.detail,
        ]),
      )
      const roomAssignCsv = rowsToCsv(
        ["Course", "Section", "Delivery", "Lab", "Room", "Room type", "Capacity", "Enrolled", "Match status", "Issue"],
        ds.roomTypeRows.map((r) => [
          r.courseCode,
          r.sectionNumber,
          r.deliveryLabel,
          r.isLab ? "Yes" : "No",
          r.roomNumber,
          r.roomTypeLabel,
          r.capacity,
          r.enrolled,
          r.matchStatus,
          r.issue,
        ]),
      )
      const blob = await buildCsvZip([
        { filename: `conflict-analysis-${slugFilePart(timetableLabel)}-summary.csv`, content: summaryCsv },
        { filename: `conflict-analysis-${slugFilePart(timetableLabel)}-detail.csv`, content: detailCsv },
        {
          filename: `conflict-analysis-${slugFilePart(timetableLabel)}-room-assignments.csv`,
          content: roomAssignCsv,
        },
      ])
      return { blob, mimeType: "application/zip", extension: "zip", baseFilename: base }
    }

    if (format === "excel") {
      const wb = buildTimetableHealthExcel(ds, dateTimePrefs)
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      return {
        blob,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        baseFilename: base,
      }
    }

    const hardConflicts = conflicts.filter((c) => c.severity === "hard")
    const softConflicts = conflicts.filter((c) => c.severity !== "hard")
    const tableHead: string[][] = [
      ["Severity", "Type", "Course", "Section", "Lecturer", "Room", "Timeslot", "Detail"],
    ]
    const mapConflictPdfRow = (c: (typeof conflicts)[number]) =>
      [
        c.severity === "hard" ? "Hard" : "Soft",
        timetableHealthConflictTypeLabel(c.type),
        c.courseCode,
        c.sectionNumber,
        c.lecturerName ?? "",
        c.roomNumber ?? "",
        c.timeslotLabel ?? "",
        c.detail,
      ] as (string | number)[]

    let mainBody: (string | number)[][]

    if (conflicts.length === 0) {
      mainBody = [["", "", "", "", "", "", "", "No conflict records for this timetable version."]]
    } else {
      mainBody =
        hardConflicts.length > 0
          ? hardConflicts.map((c) => mapConflictPdfRow(c))
          : [["", "", "", "", "", "", "", "No hard violations."]]
    }

    const roomTypeRows = ds.roomTypeRows
    const mismatches = roomTypeRows.filter((r) => r.matchStatus !== "OK")
    const roomQualitySection: PdfTableSection = {
      title: "Room Assignment Quality",
      introLines: [
        `${s.totalSections} sections evaluated: ${s.okCount} correctly matched, ${s.hardMismatchCount} hard mismatches, ${s.softMismatchCount} soft mismatches.`,
      ],
      tableHead: [["Course", "Section", "Room", "Room type", "Severity", "Issue"]],
      tableBody: mismatches.length
        ? mismatches.map((r) => [
            r.courseCode,
            r.sectionNumber,
            r.roomNumber,
            r.roomTypeLabel,
            r.severity === "hard" ? "Hard" : r.severity === "soft" ? "Soft" : "—",
            r.issue,
          ])
        : [
            [
              "All sections satisfy room-type and capacity rules.",
              "",
              "",
              "",
              "",
              "",
            ],
          ],
    }

    const optimizerSection: PdfTableSection = {
      title: "Optimizer Runs",
      tableHead: [["Version", "Type", "Status", "Valid", "Sections scheduled", "Active"]],
      tableBody:
        runs.length > 0
          ? runs.map((r) => [
              `v${r.versionNumber}`,
              r.generationTypeLabel,
              r.status,
              optimizerRunValidPdfLabel(r),
              r.sectionsCount,
              r.isActive ? "Active" : "",
            ])
          : [["No optimizer runs recorded for this dataset.", "", "", "", "", ""]],
    }

    const appendPdfSections: PdfTableSection[] = []
    if (conflicts.length > 0) {
      appendPdfSections.push({
        title: "Soft violations",
        tableHead,
        tableBody:
          softConflicts.length > 0
            ? softConflicts.map((c) => mapConflictPdfRow(c))
            : [["", "", "", "", "", "", "", "No soft violations."]],
      })
    }
    appendPdfSections.push(roomQualitySection, optimizerSection)

    const summaryLines = [
      `Total hard violations: ${hardCount}. Total soft violations: ${softCount}.`,
      `Breakdown by type: ${[...byType.entries()].map(([t, c]) => `${timetableHealthConflictTypeLabel(t)} (${c.hard + c.soft})`).join(", ") || "none"}.`,
      ...(conflicts.length === 0 ? ["No conflicts or violations were recorded for this timetable."] : []),
      ...(conflicts.length > 0
        ? [
            "First table: hard violations. The following sections list soft violations (or state if there are none), then room assignment quality and optimizer runs.",
          ]
        : []),
    ]

    const blob = await buildPdf(
      "Timetable Health Report",
      pdfSubtitleLines(ds, dateTimePrefs),
      summaryLines,
      tableHead,
      mainBody,
      undefined,
      appendPdfSections,
      fmtGen,
      timetableHealthHotspotPdfSections(ds),
    )
    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  throw new Error(`Unsupported report type: ${reportTypeId}`)
}

export function triggerDownload(
  blob: Blob,
  filename: string,
  mimeType: string,
) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 250)
}
