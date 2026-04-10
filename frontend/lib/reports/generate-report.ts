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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "By room")
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Workload detail")
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "By department")
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
      const headers = [
        "Room number",
        "Room type",
        "Capacity",
        "In service",
        "Sessions",
        "Weekly instructional hours",
        "Relative load %",
        "Avg seat fill % (F2F/blended)",
        "Peak weekday",
        "Online or blended sessions",
      ]
      const data = rows.map((r) => [
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
      ])
      const meta = rowsToCsv(
        ["Field", "Value"],
        [
          ["Report", "Room Utilization"],
          ["Academic period", timetableLabel],
          ["Generated", formatGeneratedAt(new Date())],
          ["Rooms in catalog", ins.totalRoomsInCatalog],
          ["Rooms in use", ins.roomsWithSchedule],
          ["Section instances", ins.totalScheduleEntries],
          ["Total weekly instructional hours", ins.totalWeeklyScheduledHours],
          [
            "Weighted seat fill % (F2F/blended)",
            ins.totalSeatFillWeightedPct ?? "",
          ],
          ["Solver utilization %", official ?? ""],
        ],
      )
      const body = rowsToCsv(headers, data)
      const blob = new Blob([meta + "\r\n" + body], {
        type: "text/csv;charset=utf-8",
      })
      return { blob, mimeType: "text/csv", extension: "csv", baseFilename: base }
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

    const blob = await buildPdf(
      "Room Utilization Report",
      timetableLabel,
      summaryLines,
      [
        [
          "Room",
          "Type",
          "Cap.",
          "Active",
          "Sessions",
          "Hrs/wk",
          "Load %",
          "Seat %",
          "Peak",
          "O/B",
        ],
      ],
      rows.map((r) => [
        r.roomNumber,
        r.roomTypeLabel,
        r.capacity,
        r.isAvailable ? "Y" : "N",
        r.sessionsCount,
        r.weeklyInstructionalHours,
        r.relativeLoadPct,
        r.avgSeatFillPct ?? "—",
        r.peakDay,
        r.onlineOrBlendedSessions,
      ]),
      footnotes,
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

    if (format === "csv") {
      const headers = [
        "Lecturer",
        "Department",
        "Max workload (DB)",
        "Sections",
        "Distinct courses",
        "Lab sections",
        "Weekly contact hours",
        "Load index",
        "% of max",
      ]
      const data = rows.map((r) => [
        r.lecturerName,
        r.department,
        r.maxWorkloadHours,
        r.sectionsScheduled,
        r.distinctCourses,
        r.labSections,
        r.weeklyContactHours,
        r.loadIndex,
        r.loadPctOfMax ?? "",
      ])
      const meta = rowsToCsv(
        ["Field", "Value"],
        [
          ["Report", "Lecturer Workload"],
          ["Academic period", timetableLabel],
          ["Generated", formatGeneratedAt(new Date())],
          ["Lecturers scheduled", rows.length],
          ["Average load index", avgLoad],
          ["Total weekly contact hours", totalHrs],
          ["Faculty ≥ 1.20 load index", highLoad],
        ],
      )
      const body = rowsToCsv(headers, data)
      const blob = new Blob([meta + "\r\n" + body], {
        type: "text/csv;charset=utf-8",
      })
      return { blob, mimeType: "text/csv", extension: "csv", baseFilename: base }
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
      "Labs are counted separately so chairs can see experimental teaching intensity alongside lecture contact hours.",
    ]

    const blob = await buildPdf(
      "Lecturer Workload Report",
      timetableLabel,
      summaryLines,
      [
        ["Name", "Dept", "Max", "Sec.", "Crs", "Lab", "Hrs", "Idx", "%Max"],
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
      const headers = [
        "Department",
        "Catalog courses",
        "Scheduled courses",
        "Section instances",
        "Total enrollment",
        "UG scheduled (distinct)",
        "Grad scheduled (distinct)",
        "Online",
        "Blended",
        "Face-to-face",
        "Avg section enrollment",
      ]
      const data = rows.map((r) => [
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
      ])
      const meta = rowsToCsv(
        ["Field", "Value"],
        [
          ["Report", "Course Distribution"],
          ["Academic period", timetableLabel],
          ["Generated", formatGeneratedAt(new Date())],
          ["Departments", rows.length],
          ["Distinct courses scheduled", ins.distinctCoursesScheduled],
          ["Section instances", ins.totalScheduleEntries],
          ["Total enrollment", totalEnroll],
        ],
      )
      const body = rowsToCsv(headers, data)
      const blob = new Blob([meta + "\r\n" + body], {
        type: "text/csv;charset=utf-8",
      })
      return { blob, mimeType: "text/csv", extension: "csv", baseFilename: base }
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
          "Cat",
          "Sched",
          "Secs",
          "Enroll",
          "UG",
          "Grad",
          "On",
          "Hyb",
          "F2F",
          "Avg",
        ],
      ],
      rows.map((r) => [
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
      footnotes,
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
