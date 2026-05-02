import * as XLSX from "xlsx"
import type { ExportFormat, ReportTypeId } from "./types"
import type { ReportDataset } from "./dataset"
import { getReportDefinition } from "./definitions"

function formatGeneratedAt(d: Date): string {
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

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

type PdfTableSection = {
  title: string
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
  return new Blob([zipped], { type: "application/zip" })
}

function timetableFootnote(ds: ReportDataset): string {
  const t = ds.timetable
  if (!t) {
    return "No timetable version is stored for this semester; room and workload tables reflect zero scheduled activity."
  }
  return `Source timetable #${t.timetableId} (${t.status}, v${t.versionNumber}, ${t.generationType}), generated ${formatGeneratedAt(new Date(t.generatedAt))}.`
}

async function buildPdf(
  title: string,
  timetableLabel: string,
  summaryLines: string[],
  tableHead: string[][],
  tableBody: (string | number)[][],
  extraNotes?: string[],
  appendSections?: PdfTableSection[],
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
  doc.text(`Academic period: ${timetableLabel}`, margin, y)
  y += 5
  doc.text(`Generated: ${formatGeneratedAt(new Date())}`, margin, y)
  y += 8

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
    didDrawPage(data) {
      doc.setFontSize(8)
      doc.setTextColor(140)
      doc.text(
        `Page ${data.pageNumber}`,
        pageW - margin - 12,
        doc.internal.pageSize.getHeight() - 8,
      )
      doc.setTextColor(0)
    },
  })

  if (appendSections?.length) {
    for (const section of appendSections) {
      const lastY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY
      const startY = (lastY ?? y) + 10
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.text(section.title, margin, startY)

      autoTable(doc, {
        startY: startY + 4,
        head: section.tableHead,
        body: section.tableBody,
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: margin, right: margin },
        tableWidth: "auto",
        showHead: "everyPage",
        didDrawPage(data) {
          doc.setFontSize(8)
          doc.setTextColor(140)
          doc.text(
            `Page ${data.pageNumber}`,
            pageW - margin - 12,
            doc.internal.pageSize.getHeight() - 8,
          )
          doc.setTextColor(0)
        },
      })
      doc.setFont("helvetica", "normal")
    }
  }

  return doc.output("blob")
}

function buildRoomExcel(ds: ReportDataset) {
  const { roomRows: rows, insights: ins, timetable: t } = ds
  const wb = XLSX.utils.book_new()

  const summaryData: (string | number)[][] = [
    ["Room Utilization Report"],
    ["Academic period", ds.semesterLabel],
    ["Generated", formatGeneratedAt(new Date())],
    [timetableFootnote(ds)],
    [],
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
      ins.totalSeatFillWeightedPct ?? "—",
    ],
    [
      "Solver room utilization rate (timetable metrics)",
      t?.roomUtilizationRate ?? "—",
    ],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary")

  const detail = rows.map((r) => ({
    "Room number": r.roomNumber,
    "Room type": r.roomTypeLabel,
    Capacity: r.capacity,
    "In service": r.isAvailable ? "Yes" : "No",
    "Sessions scheduled": r.sessionsCount,
    "Weekly instructional hours": r.weeklyInstructionalHours,
    "Relative load vs busiest room (%)": r.relativeLoadPct,
    "Avg seat fill — F2F/blended (%)": r.avgSeatFillPct ?? "—",
    "Busiest weekday": r.peakDay,
    "Online or blended sessions": r.onlineOrBlendedSessions,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Room detail")
  return wb
}

function buildLecturerExcel(ds: ReportDataset) {
  const { lecturerRows: rows, insights: ins } = ds
  const wb = XLSX.utils.book_new()
  const avgLoad =
    rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.loadIndex, 0) / rows.length) * 1000) /
        1000
      : 0
  const highLoad = rows.filter((r) => r.loadIndex >= 1.2).length
  const totalHrs = Math.round(rows.reduce((s, r) => s + r.weeklyContactHours, 0) * 100) / 100

  const summaryData: (string | number)[][] = [
    ["Lecturer Workload Report"],
    ["Academic period", ds.semesterLabel],
    ["Generated", formatGeneratedAt(new Date())],
    [timetableFootnote(ds)],
    [],
    ["Metric", "Value"],
    ["Lecturers with assignments", ins.lecturerCountScheduled],
    ["Lecturers with no assignments", ins.lecturersWithNoAssignments],
    ["Average load index (hours / max_workload)", avgLoad],
    ["Total scheduled weekly contact hours", totalHrs],
    ["Faculty at or above 1.20 load index", highLoad],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary")

  const detail = rows.map((r) => ({
    Lecturer: r.lecturerName,
    Department: r.department,
    "Max workload (DB)": r.maxWorkloadHours,
    Sections: r.sectionsScheduled,
    "Distinct courses": r.distinctCourses,
    "Lab sections": r.labSections,
    "Weekly contact hours": r.weeklyContactHours,
    "Load index": r.loadIndex,
    "% of personal max": r.loadPctOfMax ?? "—",
  }))
  const totalsRow = {
    Lecturer: "TOTAL",
    Department: "",
    "Max workload (DB)": "",
    Sections: rows.reduce((s, r) => s + r.sectionsScheduled, 0),
    "Distinct courses": rows.reduce((s, r) => s + r.distinctCourses, 0),
    "Lab sections": rows.reduce((s, r) => s + r.labSections, 0),
    "Weekly contact hours": Math.round(rows.reduce((s, r) => s + r.weeklyContactHours, 0) * 100) / 100,
    "Load index": "",
    "% of personal max": "",
  }
  const detailSheet = XLSX.utils.json_to_sheet([...detail, totalsRow])
  const totalRowNum = detail.length + 2
  for (const col of ["A", "B", "C", "D", "E", "F", "G", "H", "I"] as const) {
    const cell = detailSheet[`${col}${totalRowNum}`]
    if (cell) cell.s = { font: { bold: true } }
  }
  XLSX.utils.book_append_sheet(wb, detailSheet, "Workload detail")
  return wb
}

function buildCourseExcel(ds: ReportDataset) {
  const { courseDistributionRows: rows, insights: ins } = ds
  const wb = XLSX.utils.book_new()

  const summaryData: (string | number)[][] = [
    ["Course Distribution Report"],
    ["Academic period", ds.semesterLabel],
    ["Generated", formatGeneratedAt(new Date())],
    [timetableFootnote(ds)],
    [],
    ["Metric", "Value"],
    ["Departments listed", rows.length],
    ["Distinct courses on timetable", ins.distinctCoursesScheduled],
    ["Section instances", ins.totalScheduleEntries],
    ["Total registered students (sum of sections)", rows.reduce((s, r) => s + r.totalEnrollment, 0)],
    ["Departments with ≥1 section", ins.departmentsScheduled],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary")

  const detail = rows.map((r) => ({
    Department: r.department,
    "Courses in catalog": r.catalogCourseCount,
    "Courses on timetable": r.scheduledDistinctCourses,
    "Section instances": r.sectionInstances,
    "Total enrollment": r.totalEnrollment,
    "UG courses (scheduled, distinct)": r.undergraduateCourseCount,
    "Grad courses (scheduled, distinct)": r.graduateCourseCount,
    "Online sections": r.onlineSections,
    "Blended sections": r.blendedSections,
    "Face-to-face sections": r.faceToFaceSections,
    "Avg enrollment / section": r.avgSectionEnrollment,
  }))
  const totalSections = rows.reduce((s, r) => s + r.sectionInstances, 0)
  const totalEnrollment = rows.reduce((s, r) => s + r.totalEnrollment, 0)
  const totalsRow = {
    Department: "TOTAL",
    "Courses in catalog": rows.reduce((s, r) => s + r.catalogCourseCount, 0),
    "Courses on timetable": rows.reduce((s, r) => s + r.scheduledDistinctCourses, 0),
    "Section instances": totalSections,
    "Total enrollment": totalEnrollment,
    "UG courses (scheduled, distinct)": "",
    "Grad courses (scheduled, distinct)": "",
    "Online sections": rows.reduce((s, r) => s + r.onlineSections, 0),
    "Blended sections": rows.reduce((s, r) => s + r.blendedSections, 0),
    "Face-to-face sections": rows.reduce((s, r) => s + r.faceToFaceSections, 0),
    "Avg enrollment / section": totalSections > 0 ? Math.round((totalEnrollment / totalSections) * 100) / 100 : 0,
  }
  const detailSheet = XLSX.utils.json_to_sheet([...detail, totalsRow])
  const totalRowNum = detail.length + 2
  for (const col of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"] as const) {
    const cell = detailSheet[`${col}${totalRowNum}`]
    if (cell) cell.s = { font: { bold: true } }
  }
  XLSX.utils.book_append_sheet(wb, detailSheet, "By department")
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
}): Promise<{
  blob: Blob
  mimeType: string
  extension: string
  baseFilename: string
}> {
  const { reportTypeId, format, dataset: ds } = params
  const timetableLabel = ds.semesterLabel
  const base = getReportBaseFilename(reportTypeId, timetableLabel)

  const footnotes = [
    timetableFootnote(ds),
    "Undergraduate vs. graduate course counts use academic_level: levels below 500 count as undergraduate; 500+ as graduate.",
    "Weekly hours multiply slot length by the number of days in each timeslot’s days mask (recurring meetings per week).",
  ]

  if (reportTypeId === "room-utilization") {
    const rows = ds.roomRows
    const ins = ds.insights
    const official = ds.timetable?.roomUtilizationRate

    if (format === "csv") {
      const summaryCsv = rowsToCsvNoHeader(
        [
          ["Metric", "Value"],
          ["Report", "Room Utilization"],
          ["Academic period", timetableLabel],
          ["Generated", formatGeneratedAt(new Date())],
          ["Rooms in catalog", ins.totalRoomsInCatalog],
          ["Rooms with scheduled sessions", ins.roomsWithSchedule],
          ["Total section instances", ins.totalScheduleEntries],
          ["Total weekly instructional hours", ins.totalWeeklyScheduledHours],
          [
            "Weighted seat fill % (face-to-face & blended)",
            ins.totalSeatFillWeightedPct ?? "",
          ],
          ["Solver room utilization rate %", official ?? ""],
        ],
      )
      const detailCsv = rowsToCsv(
        [
          "Room number",
          "Room type",
          "Capacity",
          "Active",
          "Sessions scheduled",
          "Weekly hours",
          "Load %",
          "Seat fill %",
          "Peak day",
          "Online & Blended sessions",
        ],
        rows.map((r) => [
          r.roomNumber,
          r.roomTypeLabel,
          r.capacity,
          r.isAvailable ? "Yes" : "No",
          r.sessionsCount,
          r.weeklyInstructionalHours,
          r.relativeLoadPct,
          r.avgSeatFillPct ?? "",
          r.peakDay,
          r.onlineOrBlendedSessions,
        ]),
      )
      const blob = await buildCsvZip([
        {
          filename: `room-utilization-${slugFilePart(timetableLabel)}-summary.csv`,
          content: summaryCsv,
        },
        {
          filename: `room-utilization-${slugFilePart(timetableLabel)}-detail.csv`,
          content: detailCsv,
        },
      ])
      return { blob, mimeType: "application/zip", extension: "zip", baseFilename: base }
    }

    if (format === "excel") {
      const wb = buildRoomExcel(ds)
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
      `${ins.totalRoomsInCatalog} rooms exist in the facilities catalog; ${ins.roomsWithSchedule} host at least one scheduled section for this timetable.`,
      `${ins.totalScheduleEntries} section-timeslot assignments account for ${ins.totalWeeklyScheduledHours} total weekly instructional hours across the institution.`,
      ins.totalSeatFillWeightedPct != null
        ? `Where physical capacity applies (face-to-face and blended), hour-weighted mean seat occupancy is ${ins.totalSeatFillWeightedPct}% of section capacity.`
        : "Seat-fill averages apply only to face-to-face and blended deliveries; online-only sections are excluded from that metric.",
      official != null
        ? `The optimization run recorded an overall room utilization rate of ${official}% in timetable metrics.`
        : "No timetable metrics row is stored for this version; solver utilization is unavailable.",
      `“Relative load” expresses each room’s weekly hours as a percentage of the busiest room (${ins.maxWeeklyHoursAnyRoom} h/wk).`,
    ]

    const idleRooms = rows.filter((r) => r.isAvailable && r.sessionsCount === 0)
    const blob = await buildPdf(
      "Room Utilization Report",
      timetableLabel,
      summaryLines,
      [
        [
          "Room",
          "Type",
          "Capacity",
          "Active",
          "Sessions",
          "Hours/week",
          "Load %",
          "Seat fill %",
          "Peak day",
          "Online & Blended",
        ],
      ],
      rows.map((r) => [
        r.roomNumber,
        r.roomTypeLabel,
        r.capacity,
        r.isAvailable ? "Yes" : "No",
        r.sessionsCount,
        r.weeklyInstructionalHours,
        r.relativeLoadPct,
        r.avgSeatFillPct ?? "—",
        r.peakDay,
        r.onlineOrBlendedSessions,
      ]),
      footnotes,
      idleRooms.length
        ? [
            {
              title: "Idle rooms",
              tableHead: [["Room", "Type", "Capacity"]],
              tableBody: idleRooms.map((r) => [r.roomNumber, r.roomTypeLabel, r.capacity]),
            },
          ]
        : undefined,
    )
    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  if (reportTypeId === "lecturer-workload") {
    const rows = ds.lecturerRows
    const ins = ds.insights
    const avgLoad =
      rows.length > 0
        ? Math.round((rows.reduce((s, r) => s + r.loadIndex, 0) / rows.length) * 1000) /
          1000
        : 0
    const highLoad = rows.filter((r) => r.loadIndex >= 1.2).length
    const totalHrs =
      Math.round(rows.reduce((s, r) => s + r.weeklyContactHours, 0) * 100) / 100
    const noAssignments = ds.insights.lecturersWithNoAssignments

    if (format === "csv") {
      const summaryCsv = rowsToCsvNoHeader(
        [
          ["Metric", "Value"],
          ["Report", "Lecturer Workload"],
          ["Academic period", timetableLabel],
          ["Generated", formatGeneratedAt(new Date())],
          ["Lecturers with assignments", ins.lecturerCountScheduled],
          ["Lecturers with no assignments", noAssignments],
          ["Average load index", avgLoad],
          ["Total weekly contact hours", totalHrs],
          ["Lecturers at or above 1.20 load index", highLoad],
        ],
      )
      const detailCsv = rowsToCsv(
        [
          "Name",
          "Department",
          "Max hours",
          "Sections",
          "Courses",
          "Lab sections",
          "Weekly hours",
          "Load index",
          "% of max",
        ],
        rows.map((r) => [
          r.lecturerName,
          r.department,
          r.maxWorkloadHours,
          r.sectionsScheduled,
          r.distinctCourses,
          r.labSections,
          r.weeklyContactHours,
          r.loadIndex,
          r.loadPctOfMax ?? "",
        ]),
      )
      const blob = await buildCsvZip([
        {
          filename: `lecturer-workload-${slugFilePart(timetableLabel)}-summary.csv`,
          content: summaryCsv,
        },
        {
          filename: `lecturer-workload-${slugFilePart(timetableLabel)}-detail.csv`,
          content: detailCsv,
        },
      ])
      return { blob, mimeType: "application/zip", extension: "zip", baseFilename: base }
    }

    if (format === "excel") {
      const wb = buildLecturerExcel(ds)
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
      `${ins.lecturerCountScheduled} lecturers appear on the selected timetable, averaging ${avgLoad} load index (weekly hours ÷ personal max_workload from HR records).`,
      `Collectively they deliver ${totalHrs} weekly contact hours. ${highLoad} faculty meet or exceed a 1.20 load index.`,
      `${noAssignments} active lecturers currently have no scheduled sections this term.`,
      "Labs are counted separately so chairs can see experimental teaching intensity alongside lecture contact hours.",
    ]

    const blob = await buildPdf(
      "Lecturer Workload Report",
      timetableLabel,
      summaryLines,
      [
        [
          "Name",
          "Department",
          "Max hours",
          "Sections",
          "Courses",
          "Lab sections",
          "Weekly hours",
          "Load index",
          "% of max",
        ],
      ],
      rows.map((r) => [
        r.lecturerName,
        r.department,
        r.maxWorkloadHours,
        r.sectionsScheduled,
        r.distinctCourses,
        r.labSections,
        r.weeklyContactHours,
        r.loadIndex,
        r.loadPctOfMax ?? "",
      ]),
      footnotes,
    )

    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  if (reportTypeId === "course-distribution") {
    const rows = ds.courseDistributionRows
    const ins = ds.insights
    const totalEnroll = rows.reduce((s, r) => s + r.totalEnrollment, 0)

    if (format === "csv") {
      const totalSections = rows.reduce((s, r) => s + r.sectionInstances, 0)
      const weightedAvg = totalSections > 0 ? Math.round((totalEnroll / totalSections) * 100) / 100 : 0
      const summaryCsv = rowsToCsvNoHeader(
        [
          ["Metric", "Value"],
          ["Report", "Course Distribution"],
          ["Academic period", timetableLabel],
          ["Generated", formatGeneratedAt(new Date())],
          ["Departments", rows.length],
          ["Distinct courses scheduled", ins.distinctCoursesScheduled],
          ["Total section instances", ins.totalScheduleEntries],
          ["Total enrollment", totalEnroll],
          ["Departments with at least one section", ins.departmentsScheduled],
        ],
      )
      const detailCsv = rowsToCsv(
        [
          "Department",
          "Catalog courses",
          "Scheduled courses",
          "Sections",
          "Enrollment",
          "UG courses",
          "Grad courses",
          "Online",
          "Blended",
          "Face-to-face",
          "Avg enrollment",
        ],
        [
          ...rows.map((r) => [
            r.department,
            r.catalogCourseCount,
            r.scheduledDistinctCourses,
            r.sectionInstances,
            r.totalEnrollment,
            r.undergraduateCourseCount,
            r.graduateCourseCount,
            r.onlineSections,
            r.blendedSections,
            r.faceToFaceSections,
            r.avgSectionEnrollment,
          ]),
          [
            "TOTAL",
            rows.reduce((s, r) => s + r.catalogCourseCount, 0),
            rows.reduce((s, r) => s + r.scheduledDistinctCourses, 0),
            totalSections,
            totalEnroll,
            "",
            "",
            rows.reduce((s, r) => s + r.onlineSections, 0),
            rows.reduce((s, r) => s + r.blendedSections, 0),
            rows.reduce((s, r) => s + r.faceToFaceSections, 0),
            weightedAvg,
          ],
        ],
      )
      const blob = await buildCsvZip([
        {
          filename: `course-distribution-${slugFilePart(timetableLabel)}-summary.csv`,
          content: summaryCsv,
        },
        {
          filename: `course-distribution-${slugFilePart(timetableLabel)}-detail.csv`,
          content: detailCsv,
        },
      ])
      return { blob, mimeType: "application/zip", extension: "zip", baseFilename: base }
    }

    if (format === "excel") {
      const wb = buildCourseExcel(ds)
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
      `${rows.length} academic units are listed, combining catalog breadth with the live timetable.`,
      `${ins.distinctCoursesScheduled} distinct courses run this term in ${ins.totalScheduleEntries} section instances, enrolling ${totalEnroll.toLocaleString()} student seats in aggregate.`,
      `Modalities split as follows across all departments: ${rows.reduce((s, r) => s + r.onlineSections, 0)} online, ${rows.reduce((s, r) => s + r.blendedSections, 0)} blended, and ${rows.reduce((s, r) => s + r.faceToFaceSections, 0)} face-to-face section instances.`,
    ]

    const blob = await buildPdf(
      "Course Distribution Report",
      timetableLabel,
      summaryLines,
      [
        [
          "Department",
          "Catalog courses",
          "Scheduled courses",
          "Sections",
          "Enrollment",
          "UG courses",
          "Grad courses",
          "Online",
          "Blended",
          "Face-to-face",
          "Avg enrollment",
        ],
      ],
      (() => {
        const totalSections = rows.reduce((s, r) => s + r.sectionInstances, 0)
        const weightedAvg = totalSections > 0 ? Math.round((totalEnroll / totalSections) * 100) / 100 : 0
        return [
          ...rows.map((r) => [
            r.department,
            r.catalogCourseCount,
            r.scheduledDistinctCourses,
            r.sectionInstances,
            r.totalEnrollment,
            r.undergraduateCourseCount,
            r.graduateCourseCount,
            r.onlineSections,
            r.blendedSections,
            r.faceToFaceSections,
            r.avgSectionEnrollment,
          ]),
          [
            "TOTAL",
            rows.reduce((s, r) => s + r.catalogCourseCount, 0),
            rows.reduce((s, r) => s + r.scheduledDistinctCourses, 0),
            totalSections,
            totalEnroll,
            "",
            "",
            rows.reduce((s, r) => s + r.onlineSections, 0),
            rows.reduce((s, r) => s + r.blendedSections, 0),
            rows.reduce((s, r) => s + r.faceToFaceSections, 0),
            weightedAvg,
          ],
        ]
      })(),
      footnotes,
    )
    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  if (reportTypeId === "optimization-summary") {
    const runs = ds.optimizationRuns
    const active = runs.find((r) => r.isActive) ?? null
    const best = runs
      .filter((r) => r.fitnessScore != null)
      .sort((a, b) => (a.fitnessScore ?? Number.POSITIVE_INFINITY) - (b.fitnessScore ?? Number.POSITIVE_INFINITY))[0] ?? null
    const validRuns = runs.filter((r) => r.isValid === true).length

    if (format === "excel") {
      const wb = XLSX.utils.book_new()
      const summary = [
        ["Metric", "Value"],
        ["Report", "Optimization Summary"],
        ["Academic period", timetableLabel],
        ["Generated", formatGeneratedAt(new Date())],
        ["Total runs this semester", runs.length],
        ["Active version", active ? `v${active.versionNumber}` : "N/A"],
        ["Best fitness score", best ? `${best.fitnessScore} (v${best.versionNumber})` : "N/A"],
        ["Valid runs", `${validRuns} of ${runs.length}`],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary")
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          runs.map((r) => ({
            Version: `v${r.versionNumber}`,
            Type: r.generationTypeLabel,
            Status: r.status,
            Generated: formatGeneratedAt(new Date(r.generatedAt)),
            "Fitness score": r.fitnessScore ?? "",
            "Soft constraints score": r.softConstraintsScore ?? "",
            "Room utilization %": r.roomUtilizationRate ?? "",
            Valid: r.isValid ? "Yes" : "No",
            Sections: r.sectionsCount,
            Active: r.isActive ? "YES" : "",
          })),
        ),
        "Run comparison",
      )
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      return { blob: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", baseFilename: base }
    }

    const summaryLines = [
      `This semester has ${runs.length} optimizer run(s).`,
      active ? `Version v${active.versionNumber} is currently active.` : "No active version is currently set.",
      best ? `Best fitness score is ${best.fitnessScore} on version v${best.versionNumber} (lower is better).` : "No fitness scores were recorded.",
      `${validRuns} of ${runs.length} run(s) produced a valid schedule with zero hard conflicts.`,
    ]
    const blob = await buildPdf(
      "Optimization Summary Report",
      timetableLabel,
      summaryLines,
      [["Version", "Type", "Status", "Generated", "Fitness score", "Soft constraints score", "Room utilization %", "Valid", "Sections"]],
      runs.map((r) => [
        `v${r.versionNumber}`,
        r.generationTypeLabel,
        r.status,
        formatGeneratedAt(new Date(r.generatedAt)),
        r.fitnessScore ?? "—",
        r.softConstraintsScore ?? "—",
        r.roomUtilizationRate ?? "—",
        r.isValid ? "Yes" : "No",
        r.sectionsCount,
      ]),
      [
        "Fitness score: lower values indicate a better optimized schedule. A score of 0 represents a theoretically perfect solution.",
        "Soft constraints score: weighted sum of soft penalty violations including preference mismatches, gaps, and workload imbalance.",
        "Room utilization rate: percentage of available room-slot capacity occupied by a scheduled section.",
      ],
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
    const typeLabel = (t: string) =>
      ({ lecturer_double_booking: "Lecturer double-booking", room_double_booking: "Room double-booking", capacity_exceeded: "Capacity exceeded", lecturer_overload: "Lecturer overload", wrong_timeslot_type: "Wrong timeslot type", wrong_room_type: "Wrong room type", cohort_overlap: "Cohort overlap", preference_violation: "Preference violation" } as Record<string, string>)[t] ?? t

    if (format === "csv") {
      const summaryCsv = rowsToCsv(["Type", "Severity", "Count"], [
        ...[...byType.entries()].flatMap(([type, c]) => [
          ...(c.hard > 0 ? [[typeLabel(type), "hard", c.hard]] : []),
          ...(c.soft > 0 ? [[typeLabel(type), "soft", c.soft]] : []),
        ]),
        ["Total hard violations", "hard", hardCount],
        ["Total soft violations", "soft", softCount],
      ])
      const detailCsv = rowsToCsv(["Severity", "Type", "Course", "Section", "Lecturer", "Room", "Timeslot", "Detail"], conflicts.map((c) => [c.severity, typeLabel(c.type), c.courseCode, c.sectionNumber, c.lecturerName ?? "", c.roomNumber ?? "", c.timeslotLabel ?? "", c.detail]))
      const blob = await buildCsvZip([
        { filename: `conflict-analysis-${slugFilePart(timetableLabel)}-summary.csv`, content: summaryCsv },
        { filename: `conflict-analysis-${slugFilePart(timetableLabel)}-detail.csv`, content: detailCsv },
      ])
      return { blob, mimeType: "application/zip", extension: "zip", baseFilename: base }
    }

    if (format === "excel") {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Metric", "Value"],
        ["Report", "Conflict Analysis"],
        ["Academic period", timetableLabel],
        ["Generated", formatGeneratedAt(new Date())],
        ["Timetable version", ds.timetable ? `v${ds.timetable.versionNumber}` : "N/A"],
        ["Total hard violations", hardCount],
        ["Total soft violations", softCount],
        [],
        ["Type", "Hard count", "Soft count"],
        ...[...byType.entries()].map(([t, c]) => [typeLabel(t), c.hard, c.soft]),
      ]), "Summary")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(conflicts.map((c) => ({ Severity: c.severity === "hard" ? "Hard" : "Soft", Type: typeLabel(c.type), Course: c.courseCode, Section: c.sectionNumber, Lecturer: c.lecturerName ?? "", Room: c.roomNumber ?? "", Timeslot: c.timeslotLabel ?? "", Detail: c.detail }))), "Conflict detail")
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      return { blob: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", baseFilename: base }
    }

    const summaryLines = [
      `Total hard violations: ${hardCount}. Total soft violations: ${softCount}.`,
      `Breakdown by type: ${[...byType.entries()].map(([t, c]) => `${typeLabel(t)} (${c.hard + c.soft})`).join(", ") || "none"}.`,
      ...(conflicts.length === 0 ? ["No conflicts or violations were recorded for this timetable."] : []),
    ]
    const blob = await buildPdf(
      "Conflict Analysis Report",
      timetableLabel,
      summaryLines,
      [["Severity", "Type", "Course", "Section", "Lecturer", "Room", "Timeslot", "Detail"]],
      conflicts.map((c) => [c.severity === "hard" ? "Hard" : "Soft", typeLabel(c.type), c.courseCode, c.sectionNumber, c.lecturerName ?? "", c.roomNumber ?? "", c.timeslotLabel ?? "", c.detail]),
    )
    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  if (reportTypeId === "lecturer-preference-compliance") {
    const rows = ds.lecturerPreferenceRows
    const s = ds.lecturerPreferenceSummary
    if (format === "csv") {
      const summaryCsv = rowsToCsvNoHeader([
        ["Metric", "Value"],
        ["Report", "Lecturer Preference Compliance"],
        ["Academic period", timetableLabel],
        ["Generated", formatGeneratedAt(new Date())],
        ["Lecturers with preferences defined", s.lecturersWithPreferences],
        ["Lecturers with no preferences", s.lecturersWithoutPreferences],
        ["Total avoided-slot violations", s.totalAvoidedViolations],
        ["Total preferred-slot hits", s.totalPreferredHits],
        ["Lecturers requiring attention (>=1 avoided violation)", s.lecturersRequiringAttention],
      ])
      const detailCsv = rowsToCsv(["Lecturer", "Department", "Sessions assigned", "On preferred", "On avoided", "Neutral", "Compliance score"], rows.map((r) => [r.lecturerName, r.department, r.sessionsAssigned, r.onPreferred, r.onAvoided, r.neutral, r.hasPreferences ? `${r.complianceScore ?? 0}%` : "N/A"]))
      const blob = await buildCsvZip([
        { filename: `preference-compliance-${slugFilePart(timetableLabel)}-summary.csv`, content: summaryCsv },
        { filename: `preference-compliance-${slugFilePart(timetableLabel)}-detail.csv`, content: detailCsv },
      ])
      return { blob, mimeType: "application/zip", extension: "zip", baseFilename: base }
    }
    if (format === "excel") {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Metric", "Value"], ["Report", "Lecturer Preference Compliance"], ["Academic period", timetableLabel], ["Generated", formatGeneratedAt(new Date())], ["Lecturers with preferences defined", s.lecturersWithPreferences], ["Lecturers with no preferences", s.lecturersWithoutPreferences], ["Total avoided-slot violations", s.totalAvoidedViolations], ["Total preferred-slot hits", s.totalPreferredHits], ["Lecturers requiring attention (>=1 avoided violation)", s.lecturersRequiringAttention]]), "Summary")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map((r) => ({ Lecturer: r.lecturerName, Department: r.department, "Sessions assigned": r.sessionsAssigned, "On preferred": r.onPreferred, "On avoided": r.onAvoided, Neutral: r.neutral, "Compliance score": r.hasPreferences ? `${r.complianceScore ?? 0}%` : "N/A" }))), "Compliance detail")
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      return { blob: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", baseFilename: base }
    }
    const blob = await buildPdf("Lecturer Preference Compliance Report", timetableLabel, [
      `${s.lecturersWithPreferences} scheduled lecturers have preferences defined; ${s.lecturersWithoutPreferences} have none.`,
      `Institution-wide avoided-slot violations: ${s.totalAvoidedViolations}. Preferred-slot hits: ${s.totalPreferredHits}.`,
      `${s.lecturersRequiringAttention} lecturers have at least one avoided-slot violation and require attention.`,
    ], [["Lecturer", "Department", "Sessions assigned", "On preferred", "On avoided", "Neutral", "Compliance score"]], rows.map((r) => [r.lecturerName, r.department, r.sessionsAssigned, r.onPreferred, r.onAvoided, r.neutral, r.hasPreferences ? `${r.complianceScore ?? 0}%` : "No preferences defined"]), ["Compliance score = percentage of assigned sessions not falling on an avoided timeslot. 100% means no avoided-slot violations. Preferred-slot hits are tracked separately and do not affect the score."])
    return { blob, mimeType: "application/pdf", extension: "pdf", baseFilename: base }
  }

  if (reportTypeId === "room-type-matching") {
    const rows = ds.roomTypeRows
    const s = ds.roomTypeSummary
    const mismatches = rows.filter((r) => r.matchStatus !== "OK")
    if (format === "csv") {
      const summaryCsv = rowsToCsv(["Match status", "Count"], [["OK", s.okCount], ["Hard mismatch", s.hardMismatchCount], ["Soft mismatch", s.softMismatchCount]])
      const detailCsv = rowsToCsv(["Course", "Section", "Delivery", "Lab", "Room", "Room type", "Capacity", "Enrolled", "Match status", "Issue"], rows.map((r) => [r.courseCode, r.sectionNumber, r.deliveryLabel, r.isLab ? "Yes" : "No", r.roomNumber, r.roomTypeLabel, r.capacity, r.enrolled, r.matchStatus, r.issue]))
      const blob = await buildCsvZip([{ filename: `room-type-matching-${slugFilePart(timetableLabel)}-summary.csv`, content: summaryCsv }, { filename: `room-type-matching-${slugFilePart(timetableLabel)}-detail.csv`, content: detailCsv }])
      return { blob, mimeType: "application/zip", extension: "zip", baseFilename: base }
    }
    if (format === "excel") {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Metric", "Value"], ["Report", "Room Type Matching"], ["Academic period", timetableLabel], ["Generated", formatGeneratedAt(new Date())], ["Total sections", s.totalSections], ["Correctly matched", s.okCount], ["Hard mismatches", s.hardMismatchCount], ["Soft mismatches", s.softMismatchCount]]), "Summary")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map((r) => ({ Course: r.courseCode, Section: r.sectionNumber, Delivery: r.deliveryLabel, Lab: r.isLab ? "Yes" : "No", Room: r.roomNumber, "Room type": r.roomTypeLabel, Capacity: r.capacity, Enrolled: r.enrolled, "Match status": r.matchStatus, Issue: r.issue }))), "All sections")
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      return { blob: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", baseFilename: base }
    }
    const summaryLines = [
      `Total sections: ${s.totalSections}. Correctly matched: ${s.okCount}. Hard mismatches: ${s.hardMismatchCount}. Soft mismatches: ${s.softMismatchCount}.`,
      ...(mismatches.length === 0 ? ["All sections are assigned to appropriate room types."] : []),
    ]
    const blob = await buildPdf("Room Type Matching Report", timetableLabel, summaryLines, [["Course", "Section", "Delivery", "Lab", "Room", "Room type", "Capacity", "Enrolled", "Severity", "Issue"]], mismatches.map((r) => [r.courseCode, r.sectionNumber, r.deliveryLabel, r.isLab ? "Yes" : "No", r.roomNumber, r.roomTypeLabel, r.capacity, r.enrolled, r.severity === "hard" ? "Hard" : "Soft", r.issue]), ["Hard mismatch: a lab course is not in a lab or computer-lab room, or a non-lab course occupies a lab room. Soft mismatch: an online course is allocated a physical room, or an in-person section's enrollment approaches or exceeds room capacity."])
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
