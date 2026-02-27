"use client"

import { useState, useCallback, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Printer, Filter, ChevronLeft, ChevronRight, Calendar, List, Grid3X3, FileSpreadsheet, FileText, FileDown, FileJson } from "lucide-react"
import { ExportIcon } from "@/components/custom-icons"
import { mockScheduleEntries, mockCourses, mockLecturers, mockRooms } from "@/lib/data"
import { downloadBlob } from "@/lib/export-utils"
import * as XLSX from "xlsx"

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
const timeSlots = ["08:00-09:30", "10:00-11:30", "12:00-13:30", "14:00-15:30", "16:00-17:30"]

const courseColors: Record<string, string> = {
  CS101: "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-200",
  CS201: "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200",
  CS301: "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-200",
  CS401: "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200",
  SE201: "bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900/40 dark:border-pink-700 dark:text-pink-200",
  DS301: "bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-900/40 dark:border-cyan-700 dark:text-cyan-200",
}

// PDF color map for course blocks (pastel backgrounds with left border accents)
const coursePdfColors: Record<string, { bg: string; border: string; text: string }> = {
  CS101: { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a5f" },
  CS201: { bg: "#dcfce7", border: "#22c55e", text: "#14532d" },
  CS301: { bg: "#f3e8ff", border: "#a855f7", text: "#4a1d7a" },
  CS401: { bg: "#fef9c3", border: "#eab308", text: "#713f12" },
  SE201: { bg: "#fce7f3", border: "#ec4899", text: "#831843" },
  DS301: { bg: "#cffafe", border: "#06b6d4", text: "#164e63" },
}

function generateWeekLabel(weekOffset: number) {
  const baseDate = new Date(2024, 8, 1) // Sep 1 2024 - Fall start
  const startDate = new Date(baseDate)
  startDate.setDate(startDate.getDate() + weekOffset * 7)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 4)
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return { weekNum: weekOffset + 1, range: `${fmt(startDate)} - ${fmt(endDate)}` }
}

type ExportFormat = "csv" | "json" | "pdf" | "xlsx"

export default function ScheduleViewerPage() {
  const [viewType, setViewType] = useState<"grid" | "list" | "calendar">("grid")
  const [filterType, setFilterType] = useState<"all" | "course" | "lecturer" | "room">("all")
  const [filterValue, setFilterValue] = useState("")
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedEntry, setSelectedEntry] = useState<(typeof mockScheduleEntries)[0] | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv")
  const [exportScope, setExportScope] = useState<"all" | "filtered">("filtered")

  const weekInfo = generateWeekLabel(weekOffset)

  const filteredEntries = useMemo(() => {
    return mockScheduleEntries.filter((entry) => {
      if (filterType === "all") return true
      if (filterType === "course" && filterValue) return entry.course === filterValue
      if (filterType === "lecturer" && filterValue) return entry.lecturer.includes(filterValue)
      if (filterType === "room" && filterValue) return entry.room === filterValue
      return true
    })
  }, [filterType, filterValue])

  const getScheduleForSlot = useCallback(
    (day: string, time: string) => filteredEntries.filter((entry) => entry.day === day && entry.time === time),
    [filteredEntries],
  )

  const isFiltered = filterType !== "all" && filterValue !== ""

  const getExportData = useCallback(() => {
    return exportScope === "all" ? mockScheduleEntries : filteredEntries
  }, [exportScope, filteredEntries])

  // --- Export CSV ---
  const exportCSV = useCallback((data: typeof mockScheduleEntries) => {
    const header = "Course,Section,Course Name,Lecturer,Room,Building,Day,Time,Students"
    const rows = data.map((e) => {
      const courseName = mockCourses.find((c) => c.code === e.course)?.name ?? ""
      const building = mockRooms.find((r) => r.id === e.room)?.building ?? ""
      return `${e.course},${e.section},"${courseName}","${e.lecturer}",${e.room},"${building}",${e.day},${e.time},${e.students}`
    })
    const csv = [header, ...rows].join("\n")
    downloadBlob(csv, `schedule-week-${weekInfo.weekNum}.csv`, "text/csv;charset=utf-8;")
  }, [weekInfo.weekNum])

  // --- Export JSON ---
  const exportJSON = useCallback((data: typeof mockScheduleEntries) => {
    const enriched = data.map((e) => ({
      ...e,
      courseName: mockCourses.find((c) => c.code === e.course)?.name ?? "",
      building: mockRooms.find((r) => r.id === e.room)?.building ?? "",
    }))
    const json = JSON.stringify(enriched, null, 2)
    downloadBlob(json, `schedule-week-${weekInfo.weekNum}.json`, "application/json")
  }, [weekInfo.weekNum])

  // --- Export Excel (.xlsx) ---
  const exportExcel = useCallback((data: typeof mockScheduleEntries) => {
    const wsData = [
      ["Course", "Section", "Course Name", "Lecturer", "Room", "Building", "Day", "Time", "Students"],
      ...data.map((e) => [
        e.course,
        e.section,
        mockCourses.find((c) => c.code === e.course)?.name ?? "",
        e.lecturer,
        e.room,
        mockRooms.find((r) => r.id === e.room)?.building ?? "",
        e.day,
        e.time,
        e.students,
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Schedule")
    XLSX.writeFile(wb, `schedule-week-${weekInfo.weekNum}.xlsx`)
  }, [weekInfo.weekNum])

  // --- Export PDF (view-aware) ---
  const exportPDF = useCallback((data: typeof mockScheduleEntries) => {
    if (viewType === "calendar") {
      // Calendar view: 5 day-columns with stacked course cards, matching the on-screen calendar layout
      const dayEntries: Record<string, typeof data> = {}
      days.forEach((day) => {
        dayEntries[day] = data.filter((e) => e.day === day).sort((a, b) => a.time.localeCompare(b.time))
      })

      const renderCard = (e: (typeof data)[0]) => {
        const colors = coursePdfColors[e.course] || { bg: "#f3f4f6", border: "#9ca3af", text: "#1f2937" }
        const lecturerLast = e.lecturer.split(" ").pop()
        const courseName = mockCourses.find((c) => c.code === e.course)?.name ?? ""
        return `<div style="background:${colors.bg};border-left:4px solid ${colors.border};color:${colors.text};padding:10px 12px;border-radius:8px;font-size:11px;margin-bottom:8px;break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:700;font-size:13px;">${e.course}-${e.section}</span>
            <span style="font-size:10px;opacity:0.75;">${e.time}</span>
          </div>
          <div style="margin-bottom:2px;font-size:11px;opacity:0.85;">${courseName}</div>
          <div style="margin-bottom:2px;">${lecturerLast}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;opacity:0.7;font-size:10px;">
            <span>${e.room}</span>
            <span>${e.students} students</span>
          </div>
        </div>`
      }

      const dayColumns = days.map((day) => {
        const cards = dayEntries[day].length > 0
          ? dayEntries[day].map(renderCard).join("")
          : `<div style="text-align:center;color:#9ca3af;font-size:12px;padding:32px 0;">No classes</div>`
        return `<div style="flex:1;min-width:0;">
          <div style="background:#1e3a5f;color:#ffffff;padding:10px 12px;border-radius:8px 8px 0 0;text-align:center;font-weight:700;font-size:14px;letter-spacing:0.3px;">${day}</div>
          <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:10px 8px;min-height:200px;background:#ffffff;">
            ${cards}
          </div>
        </div>`
      }).join("")

      // Legend
      const legendItems = Object.entries(coursePdfColors).map(([code, c]) =>
        `<div style="display:flex;align-items:center;gap:6px;margin-right:16px;">
          <div style="width:14px;height:14px;border-radius:3px;background:${c.bg};border:2px solid ${c.border};"></div>
          <span style="font-size:12px;color:#374151;">${code}</span>
        </div>`
      ).join("")

      const html = `<!DOCTYPE html><html><head><title>University Course Timetable - Calendar View</title>
        <style>
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: landscape; margin: 16mm; } }
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 32px 36px; color: #1a1a1a; margin: 0; background: #ffffff; }
        </style>
      </head><body>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;">
          <div>
            <h1 style="font-size:22px;font-weight:700;margin:0 0 4px 0;color:#111827;">University Course Timetable</h1>
            <p style="color:#6b7280;margin:0;font-size:14px;">Fall 2024 &mdash; Week ${weekInfo.weekNum} (${weekInfo.range})</p>
          </div>
          <div style="text-align:right;font-size:11px;color:#9ca3af;">Calendar View &middot; ${filteredEntries.length} entries${isFiltered ? ` (filtered)` : ""}</div>
        </div>
        <div style="display:flex;gap:12px;">
          ${dayColumns}
        </div>
        <div style="margin-top:20px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;display:flex;align-items:center;flex-wrap:wrap;">
          <span style="font-size:12px;font-weight:600;color:#6b7280;margin-right:12px;">Legend:</span>
          ${legendItems}
        </div>
      </body></html>`

      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        setTimeout(() => { printWindow.print() }, 500)
      }
    } else if (viewType === "grid") {
      // Grid view: timetable grid style
      const grid: Record<string, Record<string, typeof data>> = {}
      days.forEach((day) => {
        grid[day] = {}
        timeSlots.forEach((time) => {
          grid[day][time] = data.filter((e) => e.day === day && e.time === time)
        })
      })

      const cellWidth = "16%"
      const timeCellWidth = "12%"

      const renderCell = (entries: typeof data) => {
        if (entries.length === 0) return ""
        return entries.map((e) => {
          const colors = coursePdfColors[e.course] || { bg: "#f3f4f6", border: "#9ca3af", text: "#1f2937" }
          const lecturerLast = e.lecturer.split(" ").pop()
          return `<div style="background:${colors.bg};border-left:4px solid ${colors.border};color:${colors.text};padding:8px 10px;border-radius:6px;font-size:12px;margin-bottom:4px;">
            <div style="font-weight:700;font-size:13px;">${e.course}-${e.section}</div>
            <div>${lecturerLast}</div>
            <div style="opacity:0.7;">${e.room}</div>
          </div>`
        }).join("")
      }

      const headerCells = days.map((day) =>
        `<th style="padding:12px 8px;font-weight:700;font-size:14px;text-align:center;border-bottom:2px solid #e5e7eb;border-right:1px solid #e5e7eb;width:${cellWidth};">${day}</th>`
      ).join("")

      const bodyRows = timeSlots.map((time) => {
        const dayCells = days.map((day) =>
          `<td style="padding:8px;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb;vertical-align:top;width:${cellWidth};">${renderCell(grid[day][time])}</td>`
        ).join("")
        return `<tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb;font-size:13px;color:#dc2626;font-weight:500;vertical-align:middle;width:${timeCellWidth};white-space:nowrap;">${time}</td>
          ${dayCells}
        </tr>`
      }).join("")

      const html = `<!DOCTYPE html><html><head><title>University Course Timetable</title>
        <style>
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: landscape; margin: 20mm; } }
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 40px 48px; color: #1a1a1a; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #e5e7eb; }
        </style>
      </head><body>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 6px 0;color:#111827;">University Course Timetable</h1>
        <p style="color:#6b7280;margin:0;font-size:14px;">Fall 2024 - Week ${weekInfo.weekNum} (${weekInfo.range})</p>
        <table>
          <thead><tr>
            <th style="padding:12px 16px;font-weight:500;font-size:13px;text-align:left;border-bottom:2px solid #e5e7eb;border-right:1px solid #e5e7eb;color:#6b7280;width:${timeCellWidth};">Time</th>
            ${headerCells}
          </tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body></html>`

      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        setTimeout(() => { printWindow.print() }, 500)
      }
    } else {
      // List view: table-style PDF
      const thStyle = `padding:12px 16px;font-size:13px;font-weight:600;color:#991b1b;text-align:left;border-bottom:2px solid #991b1b;`
      const tdStyle = `padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1a1a1a;`

      const columns = [
        { key: "courseSection", label: "Course" },
        { key: "courseName", label: "Name" },
        { key: "lecturer", label: "Lecturer" },
        { key: "room", label: "Room" },
        { key: "day", label: "Day" },
        { key: "time", label: "Time" },
        { key: "students", label: "Students" },
      ]

      const enriched = data.map((e) => ({
        courseSection: `${e.course}-${e.section}`,
        courseName: mockCourses.find((c) => c.code === e.course)?.name ?? "",
        lecturer: e.lecturer,
        room: e.room,
        day: e.day,
        time: e.time,
        students: e.students,
      }))

      const headerRow = columns.map((c) => `<th style="${thStyle}">${c.label}</th>`).join("")
      const bodyRows = enriched
        .map((row) =>
          `<tr>${columns.map((c) => `<td style="${tdStyle}">${String(row[c.key as keyof typeof row] ?? "")}</td>`).join("")}</tr>`
        )
        .join("")

      const html = `<!DOCTYPE html><html><head><title>Schedule - Fall 2024 - Week ${weekInfo.weekNum}</title>
        <style>
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: landscape; margin: 20mm; } }
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 40px 48px; color: #1a1a1a; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        </style>
      </head><body>
        <h1 style="font-size:20px;font-weight:700;margin:0 0 4px 0;color:#111827;">Schedule - Fall 2024 - Week ${weekInfo.weekNum}</h1>
        <p style="color:#6b7280;margin:0;font-size:14px;font-style:italic;">${weekInfo.range}</p>
        <table>
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body></html>`

      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        setTimeout(() => { printWindow.print() }, 500)
      }
    }
  }, [weekInfo, viewType, filteredEntries, isFiltered])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleExportConfirm = useCallback(() => {
    const data = getExportData()
    switch (exportFormat) {
      case "csv":
        exportCSV(data)
        break
      case "json":
        exportJSON(data)
        break
      case "xlsx":
        exportExcel(data)
        break
      case "pdf":
        exportPDF(data)
        break
    }
    setExportDialogOpen(false)
  }, [exportFormat, getExportData, exportCSV, exportJSON, exportExcel, exportPDF])

  const openExportDialog = useCallback((format: ExportFormat) => {
    setExportFormat(format)
    setExportScope("filtered")
    setExportDialogOpen(true)
  }, [])

  // Calendar View Helpers
  const calendarDayEntries = useMemo(() => {
    const map: Record<string, typeof filteredEntries> = {}
    days.forEach((day) => {
      map[day] = filteredEntries.filter((e) => e.day === day).sort((a, b) => a.time.localeCompare(b.time))
    })
    return map
  }, [filteredEntries])

  const formatLabel = (f: ExportFormat) => {
    switch (f) {
      case "csv": return "CSV"
      case "json": return "JSON"
      case "xlsx": return "Excel (.xlsx)"
      case "pdf": return "PDF"
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-balance">Schedule Viewer</h1>
              <p className="text-muted-foreground">View and export the generated timetable.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <ExportIcon className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openExportDialog("csv")}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openExportDialog("json")}>
                    <FileJson className="mr-2 h-4 w-4" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openExportDialog("xlsx")}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export as Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openExportDialog("pdf")}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Export Scope Dialog */}
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Export Schedule</DialogTitle>
                <DialogDescription>
                  Choose which records to export as {formatLabel(exportFormat)}.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <RadioGroup value={exportScope} onValueChange={(v) => setExportScope(v as "all" | "filtered")} className="gap-4">
                  <div className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExportScope("all")}>
                    <RadioGroupItem value="all" id="export-all" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="export-all" className="font-medium cursor-pointer">All Records</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Export all {mockScheduleEntries.length} schedule entries regardless of filters.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExportScope("filtered")}>
                    <RadioGroupItem value="filtered" id="export-filtered" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="export-filtered" className="font-medium cursor-pointer">
                        Currently Displayed Records
                        {isFiltered && <Badge variant="secondary" className="ml-2">Filtered</Badge>}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Export {filteredEntries.length} entries currently shown on the page.
                        {isFiltered && ` (filtered by ${filterType}: ${filterValue})`}
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleExportConfirm}>
                  <ExportIcon className="mr-2 h-4 w-4" />
                  Export {formatLabel(exportFormat)}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Filters and View Toggle */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={filterType}
                    onValueChange={(v: "all" | "course" | "lecturer" | "room") => {
                      setFilterType(v)
                      setFilterValue("")
                    }}
                  >
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Filter by" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="course">Course</SelectItem>
                      <SelectItem value="lecturer">Lecturer</SelectItem>
                      <SelectItem value="room">Room</SelectItem>
                    </SelectContent>
                  </Select>

                  {filterType === "course" && (
                    <Select value={filterValue} onValueChange={setFilterValue}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Select course" /></SelectTrigger>
                      <SelectContent>
                        {mockCourses.map((course) => (
                          <SelectItem key={course.code} value={course.code}>{course.code} - {course.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {filterType === "lecturer" && (
                    <Select value={filterValue} onValueChange={setFilterValue}>
                      <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select lecturer" /></SelectTrigger>
                      <SelectContent>
                        {mockLecturers.map((lecturer) => (
                          <SelectItem key={lecturer.id} value={lecturer.name}>{lecturer.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {filterType === "room" && (
                    <Select value={filterValue} onValueChange={setFilterValue}>
                      <SelectTrigger className="w-[140px]"><SelectValue placeholder="Select room" /></SelectTrigger>
                      <SelectContent>
                        {mockRooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>{room.id} - {room.building}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex items-center gap-1 rounded-lg border p-1">
                  <Button variant={viewType === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewType("grid")} className="gap-1.5">
                    <Grid3X3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Grid</span>
                  </Button>
                  <Button variant={viewType === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewType("list")} className="gap-1.5">
                    <List className="h-4 w-4" />
                    <span className="hidden sm:inline">List</span>
                  </Button>
                  <Button variant={viewType === "calendar" ? "default" : "ghost"} size="sm" onClick={() => setViewType("calendar")} className="gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Calendar</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Week Navigation */}
          <div className="mb-4 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} disabled={weekOffset === 0}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous Week
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Fall 2024 - Week {weekInfo.weekNum}</span>
              <span className="text-sm text-muted-foreground hidden sm:inline">({weekInfo.range})</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => Math.min(15, w + 1))} disabled={weekOffset === 15}>
              Next Week
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Grid View */}
          {viewType === "grid" && (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-6 border-b">
                      <div className="p-3 font-medium text-muted-foreground text-sm border-r">Time</div>
                      {days.map((day) => (
                        <div key={day} className="p-3 font-medium text-center border-r last:border-r-0">{day}</div>
                      ))}
                    </div>
                    {timeSlots.map((time) => (
                      <div key={time} className="grid grid-cols-6 border-b last:border-b-0 min-h-[100px]">
                        <div className="p-3 text-sm text-muted-foreground border-r flex items-center">{time}</div>
                        {days.map((day) => {
                          const entries = getScheduleForSlot(day, time)
                          return (
                            <div key={`${day}-${time}`} className="p-2 border-r last:border-r-0">
                              {entries.map((entry) => (
                                <Dialog key={entry.id}>
                                  <DialogTrigger asChild>
                                    <button
                                      className={`w-full text-left p-2 rounded-md border text-xs cursor-pointer transition-all hover:shadow-md ${courseColors[entry.course] || "bg-muted border-border"}`}
                                      onClick={() => setSelectedEntry(entry)}
                                    >
                                      <div className="font-semibold">{entry.course}-{entry.section}</div>
                                      <div className="truncate">{entry.lecturer.split(" ").slice(-1)}</div>
                                      <div className="opacity-75">{entry.room}</div>
                                    </button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>{entry.course} - Section {entry.section}</DialogTitle>
                                      <DialogDescription>{mockCourses.find((c) => c.code === entry.course)?.name}</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div><p className="text-sm text-muted-foreground">Lecturer</p><p className="font-medium">{entry.lecturer}</p></div>
                                      <div><p className="text-sm text-muted-foreground">Room</p><p className="font-medium">{entry.room} ({mockRooms.find((r) => r.id === entry.room)?.building})</p></div>
                                      <div><p className="text-sm text-muted-foreground">Day & Time</p><p className="font-medium">{entry.day}, {entry.time}</p></div>
                                      <div><p className="text-sm text-muted-foreground">Enrolled Students</p><p className="font-medium">{entry.students}</p></div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* List View */}
          {viewType === "list" && (
            <Card>
              <CardHeader>
                <CardTitle>Schedule List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredEntries.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No entries match the current filter.</p>
                  ) : (
                    filteredEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <Badge className={courseColors[entry.course] || "bg-muted"}>
                            {entry.course}-{entry.section}
                          </Badge>
                          <div>
                            <p className="font-medium">{mockCourses.find((c) => c.code === entry.course)?.name}</p>
                            <p className="text-sm text-muted-foreground">{entry.lecturer}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <p className="font-medium">{entry.day}</p>
                            <p className="text-muted-foreground">{entry.time}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{entry.room}</p>
                            <p className="text-muted-foreground">{entry.students} students</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calendar View */}
          {viewType === "calendar" && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {days.map((day) => (
                <Card key={day} className="min-h-[300px]">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-sm font-semibold text-center">{day}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-3 space-y-2">
                    {calendarDayEntries[day]?.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No classes</p>
                    ) : (
                      calendarDayEntries[day]?.map((entry) => (
                        <Dialog key={entry.id}>
                          <DialogTrigger asChild>
                            <button
                              className={`w-full text-left p-2.5 rounded-lg border text-xs cursor-pointer transition-all hover:shadow-md ${courseColors[entry.course] || "bg-muted border-border"}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold">{entry.course}-{entry.section}</span>
                                <span className="opacity-70 text-[10px]">{entry.time}</span>
                              </div>
                              <div className="truncate">{entry.lecturer.split(" ").slice(-1)}</div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="opacity-75">{entry.room}</span>
                                <span className="opacity-60">{entry.students} stu.</span>
                              </div>
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{entry.course} - Section {entry.section}</DialogTitle>
                              <DialogDescription>{mockCourses.find((c) => c.code === entry.course)?.name}</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4">
                              <div><p className="text-sm text-muted-foreground">Lecturer</p><p className="font-medium">{entry.lecturer}</p></div>
                              <div><p className="text-sm text-muted-foreground">Room</p><p className="font-medium">{entry.room} ({mockRooms.find((r) => r.id === entry.room)?.building})</p></div>
                              <div><p className="text-sm text-muted-foreground">Day & Time</p><p className="font-medium">{entry.day}, {entry.time}</p></div>
                              <div><p className="text-sm text-muted-foreground">Enrolled Students</p><p className="font-medium">{entry.students}</p></div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Legend */}
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(courseColors).map(([course, color]) => (
                  <div key={course} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border ${color}`} />
                    <span className="text-sm">{course}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
