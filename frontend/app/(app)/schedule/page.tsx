"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ApiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/export-utils"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, ArrowUpDown, Calendar, Check, ChevronsUpDown, Grid3X3, List, Loader2, Printer, Upload, X } from "lucide-react"
import { ChevronDownIcon } from "@/components/ui/chevron-down-icon"

type ViewType = "grid" | "list" | "calendar"

type SemesterDto = {
  semesterId: number
  academicYear: string
  semesterType: number
  semester: string
  totalStudents: number | null
  startDate: string
  endDate: string
}

/** Which timetables to list before picking a version (includes GWO drafts with no semester). */
type TimetableSource = "all" | "drafts" | "published"

const PUBLISHED_SEMESTER_TYPES: { value: number; label: string }[] = [
  { value: 1, label: "First Semester" },
  { value: 2, label: "Second Semester" },
  { value: 3, label: "Summer Semester" },
]

type TimetableDto = {
  timetableId: number
  semesterId: number | null
  academicYear: string
  semesterType: number
  semester: string
  /** Semester enrollment headcount (`semester.total_students`). */
  totalStudents: number | null
  generatedAt: string
  status: string
  generationType: string
  versionNumber: number
  metrics: null | {
    roomUtilizationRate: number
    softConstraintsScore: number
    fitnessScore: number
    isValid: boolean
  }
}

function formatTimetableGeneratedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.length > 16 ? iso.slice(0, 16) : iso
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

/**
 * Groups unassigned drafts into "lines": v1→v2→v3 is one line; after v2 a new v1 starts a new line.
 * Uses chronological order (no explicit parent id in the DB).
 */
function assignDraftRunNumbers(drafts: TimetableDto[]): Map<number, number> {
  const map = new Map<number, number>()
  if (drafts.length === 0) return map
  const chronological = [...drafts].sort((a, b) => {
    const ta = new Date(a.generatedAt).getTime()
    const tb = new Date(b.generatedAt).getTime()
    if (ta !== tb) return ta - tb
    return a.timetableId - b.timetableId
  })
  let runIndex = 0
  for (let i = 0; i < chronological.length; i += 1) {
    const cur = chronological[i]!
    const prev = chronological[i - 1]
    if (i > 0 && prev) {
      const startNewLine = cur.versionNumber === 1 && prev.versionNumber !== cur.versionNumber - 1
      if (startNewLine) runIndex += 1
    }
    map.set(cur.timetableId, runIndex + 1)
  }
  return map
}

type TimetableEntryDto = {
  entryId: number
  timetableId: number
  slotId: number
  courseId: number
  courseCode: string
  courseName: string
  lecturerUserId: number
  lecturerName: string
  roomId: number
  roomNumber: string
  daysMask: number
  days: string[]
  startTime: string
  endTime: string
  sectionNumber: string
  isLab: boolean
  registeredStudents: number
  sectionCapacity: number
}

type ExpandedEntry = TimetableEntryDto & {
  day: string
  timeRange: string
}

type ListEntry = TimetableEntryDto & {
  day: string
  timeRange: string
}

type ListSortField =
  | "day"
  | "time"
  | "duration"
  | "courseCode"
  | "course"
  | "section"
  | "lecturer"
  | "room"
  | "type"
  | "enrollment"

type SortDirection = "asc" | "desc"

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

const COLOR_PALETTE = [
  { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-900 dark:text-blue-100" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-900 dark:text-emerald-100" },
  { bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800", text: "text-violet-900 dark:text-violet-100" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-950 dark:text-amber-100" },
  { bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800", text: "text-rose-900 dark:text-rose-100" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-950 dark:text-cyan-100" },
  { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", border: "border-fuchsia-200 dark:border-fuchsia-800", text: "text-fuchsia-900 dark:text-fuchsia-100" },
  { bg: "bg-teal-50 dark:bg-teal-950/30", border: "border-teal-200 dark:border-teal-800", text: "text-teal-900 dark:text-teal-100" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", text: "text-orange-950 dark:text-orange-100" },
  { bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-900 dark:text-indigo-100" },
  { bg: "bg-lime-50 dark:bg-lime-950/30", border: "border-lime-200 dark:border-lime-800", text: "text-lime-950 dark:text-lime-100" },
  { bg: "bg-sky-50 dark:bg-sky-950/30", border: "border-sky-200 dark:border-sky-800", text: "text-sky-950 dark:text-sky-100" },
  { bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800", text: "text-pink-900 dark:text-pink-100" },
  { bg: "bg-slate-50 dark:bg-slate-950/30", border: "border-slate-200 dark:border-slate-700", text: "text-slate-900 dark:text-slate-100" },
]

const PDF_PALETTE = [
  { bg: "#eff6ff", border: "#60a5fa", text: "#1e3a8a" },
  { bg: "#ecfdf5", border: "#34d399", text: "#065f46" },
  { bg: "#f5f3ff", border: "#a78bfa", text: "#4c1d95" },
  { bg: "#fffbeb", border: "#fbbf24", text: "#78350f" },
  { bg: "#fff1f2", border: "#fb7185", text: "#881337" },
  { bg: "#ecfeff", border: "#22d3ee", text: "#164e63" },
  { bg: "#fdf4ff", border: "#e879f9", text: "#701a75" },
  { bg: "#f0fdfa", border: "#2dd4bf", text: "#134e4a" },
  { bg: "#fff7ed", border: "#fb923c", text: "#7c2d12" },
  { bg: "#eef2ff", border: "#818cf8", text: "#312e81" },
  { bg: "#f7fee7", border: "#a3e635", text: "#365314" },
  { bg: "#f0f9ff", border: "#38bdf8", text: "#0c4a6e" },
  { bg: "#fdf2f8", border: "#f472b6", text: "#831843" },
  { bg: "#f8fafc", border: "#94a3b8", text: "#0f172a" },
]

function stableHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function getColorForKey(key: string) {
  return COLOR_PALETTE[stableHash(key) % COLOR_PALETTE.length]
}

function getPdfColorForKey(key: string) {
  return PDF_PALETTE[stableHash(key) % PDF_PALETTE.length]
}

function getDurationLabel(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  if (![sh, sm, eh, em].every(Number.isFinite)) return "-"
  const totalMinutes = eh * 60 + em - (sh * 60 + sm)
  if (totalMinutes <= 0) return "-"
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

function getDurationMinutes(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  if (![sh, sm, eh, em].every(Number.isFinite)) return -1
  const totalMinutes = eh * 60 + em - (sh * 60 + sm)
  return totalMinutes > 0 ? totalMinutes : -1
}

function getDisplayCourseName(courseName: string, isLab: boolean) {
  if (!isLab) return courseName
  return /\blab\b/i.test(courseName) ? courseName : `${courseName} Lab`
}

function highlightMatch(text: string, rawQuery: string): ReactNode {
  const query = rawQuery.trim()
  if (!query) return text
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const index = lower.indexOf(q)
  if (index === -1) return text
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-yellow-200/80 px-0.5 text-current dark:bg-yellow-400/40">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  )
}

function expandEntries(entries: TimetableEntryDto[]): ExpandedEntry[] {
  return entries.flatMap((e) =>
    (e.days?.length ? e.days : [""]).map((day) => ({
      ...e,
      day,
      timeRange: `${e.startTime}-${e.endTime}`,
    })),
  )
}

function compactEntries(entries: TimetableEntryDto[]): ListEntry[] {
  const dayAbbrev: Record<string, string> = {
    Sunday: "Sun",
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
  }

  return entries.map((e) => ({
    ...e,
    day: (e.days?.length ? e.days : [""])
      .map((d) => dayAbbrev[d] ?? d)
      .join(" "),
    timeRange: `${e.startTime}-${e.endTime}`,
  }))
}

function openPrintWindow(html: string) {
  const w = window.open("", "_blank")
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
}

function SessionCard({
  entry,
  colorKey,
  showTime = true,
  compact = false,
  searchQuery = "",
}: {
  entry: ExpandedEntry
  colorKey?: string
  showTime?: boolean
  compact?: boolean
  searchQuery?: string
}) {
  const c = getColorForKey(colorKey ?? entry.courseCode)
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={cn(
            "w-full rounded-lg border text-left transition-shadow hover:shadow-sm",
            compact ? "p-2 text-xs" : "p-3 text-sm",
            c.bg,
            c.border,
            c.text,
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className={cn("truncate font-semibold", compact ? "text-xs" : "text-sm")}>
                {highlightMatch(getDisplayCourseName(entry.courseName, entry.isLab), searchQuery)}
              </div>
              <div className="mt-0.5 truncate text-[11px] opacity-85">
                {highlightMatch(`${entry.courseCode}-${entry.sectionNumber}`, searchQuery)}
              </div>
            </div>
            {showTime ? <span className="shrink-0 text-[10px] opacity-70">{highlightMatch(entry.timeRange, searchQuery)}</span> : null}
          </div>
          <div className="mt-1 truncate text-[11px] opacity-90">{highlightMatch(entry.lecturerName, searchQuery)}</div>
          <div className="mt-1 flex items-center justify-between text-[11px] opacity-80">
            <span className="truncate">{highlightMatch(entry.roomNumber, searchQuery)}</span>
            <span className="shrink-0">
              {entry.registeredStudents}/{entry.sectionCapacity}
            </span>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {getDisplayCourseName(entry.courseName, entry.isLab)} ({entry.courseCode}) — Section {entry.sectionNumber}
          </DialogTitle>
          <DialogDescription>
            {entry.day}, {entry.startTime}-{entry.endTime}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Lecturer</div>
            <div className="font-medium">{entry.lecturerName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Room</div>
            <div className="font-medium">{entry.roomNumber}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Type</div>
            <div className="font-medium">{entry.isLab ? "Lab" : "Lecture"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Enrollment</div>
            <div className="font-medium">
              {entry.registeredStudents} / {entry.sectionCapacity}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type FilterOption = {
  value: string
  label: string
}

function SearchableFilterSelect({
  value,
  onChange,
  allValue = "all",
  allLabel,
  placeholder,
  options,
  disabled,
  searchPlaceholder,
  emptyLabel,
}: {
  value: string
  onChange: (next: string) => void
  allValue?: string
  allLabel: string
  placeholder: string
  options: FilterOption[]
  disabled?: boolean
  searchPlaceholder: string
  emptyLabel: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value === allValue ? null : options.find((option) => option.value === value) ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">{selected?.label ?? allLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandItem
              value={allLabel}
              onSelect={() => {
                onChange(allValue)
                setOpen(false)
              }}
            >
              <Check className={cn("mr-2 h-4 w-4", value === allValue ? "opacity-100" : "opacity-0")} />
              {allLabel}
            </CommandItem>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                {option.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function CompactCollapsibleCard({
  title,
  children,
  contentClassName,
}: {
  title: string
  children: ReactNode
  contentClassName?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between px-4 text-left"
      >
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <ChevronDownIcon
          size={16}
          className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen ? <CardContent className={cn("space-y-3 px-4 pb-3 pt-0", contentClassName)}>{children}</CardContent> : null}
    </Card>
  )
}

export function ScheduleViewerPage({
  enableMySchedule = false,
  hideScheduleSelection = false,
  autoSelectLatestTimetable = false,
  hideVersionInTitle = false,
}: {
  enableMySchedule?: boolean
  hideScheduleSelection?: boolean
  autoSelectLatestTimetable?: boolean
  hideVersionInTitle?: boolean
} = {}) {
  const { user } = useAuth()
  const myLecturerId = user?.role === "LECTURER" ? String(user.id) : null
  const [viewType, setViewType] = useState<ViewType>("grid")
  const [listSortField, setListSortField] = useState<ListSortField>("courseCode")
  const [listSortDirection, setListSortDirection] = useState<SortDirection>("asc")
  const [semesters, setSemesters] = useState<SemesterDto[]>([])
  const [timetableSource, setTimetableSource] = useState<TimetableSource>("all")
  const [publishedYear, setPublishedYear] = useState<string>("")
  const [publishedSemesterType, setPublishedSemesterType] = useState<number>(1)

  const [timetables, setTimetables] = useState<TimetableDto[]>([])
  const [timetableId, setTimetableId] = useState<number | null>(null)

  const [allEntries, setAllEntries] = useState<TimetableEntryDto[]>([])
  const [entries, setEntries] = useState<TimetableEntryDto[]>([])
  const [courseFilter, setCourseFilter] = useState("all")
  const [lecturerFilter, setLecturerFilter] = useState("all")
  const [roomFilter, setRoomFilter] = useState("all")
  const [myScheduleOnly, setMyScheduleOnly] = useState(false)
  const [searchText, setSearchText] = useState("")

  const [loadingSemesters, setLoadingSemesters] = useState(true)
  const [loadingTimetables, setLoadingTimetables] = useState(false)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load semesters
  useEffect(() => {
    if (autoSelectLatestTimetable) {
      setLoadingSemesters(false)
      return
    }
    let mounted = true
    setLoadingSemesters(true)
    setError(null)
    ApiClient.request<SemesterDto[]>("/semesters")
      .then((data) => {
        if (!mounted) return
        setSemesters(data)
        if (data.length > 0) {
          setPublishedYear((prev) => prev || data[0].academicYear)
          setPublishedSemesterType((prev) => {
            const firstType = data[0].semesterType
            const hasPrev = data.some((s) => s.semesterType === prev)
            return hasPrev ? prev : firstType
          })
        }
      })
      .catch((e) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : "Failed to load semesters.")
      })
      .finally(() => {
        if (!mounted) return
        setLoadingSemesters(false)
      })
    return () => {
      mounted = false
    }
  }, [autoSelectLatestTimetable])

  const academicYears = useMemo(() => {
    const ys = new Set(semesters.map((s) => s.academicYear))
    return Array.from(ys).sort()
  }, [semesters])

  const semesterTypesForYear = useMemo(() => {
    if (!publishedYear.trim()) return PUBLISHED_SEMESTER_TYPES
    const types = new Set(
      semesters.filter((s) => s.academicYear === publishedYear).map((s) => s.semesterType),
    )
    const opts = PUBLISHED_SEMESTER_TYPES.filter((o) => types.has(o.value))
    return opts.length > 0 ? opts : PUBLISHED_SEMESTER_TYPES
  }, [semesters, publishedYear])

  useEffect(() => {
    if (timetableSource !== "published") return
    if (semesterTypesForYear.length === 0) return
    if (!semesterTypesForYear.some((o) => o.value === publishedSemesterType)) {
      setPublishedSemesterType(semesterTypesForYear[0].value)
    }
  }, [timetableSource, semesterTypesForYear, publishedSemesterType])

  const resolvedPublishedSemesterId = useMemo(() => {
    if (timetableSource !== "published") return null
    if (!publishedYear.trim()) return null
    const row = semesters.find(
      (s) => s.academicYear === publishedYear && s.semesterType === publishedSemesterType,
    )
    return row?.semesterId ?? null
  }, [timetableSource, publishedYear, publishedSemesterType, semesters])

  const timetableVersionSelectModel = useMemo(() => {
    const drafts = timetables.filter((t) => t.semesterId == null)
    const published = timetables.filter((t) => t.semesterId != null)
    const draftRunById = assignDraftRunNumbers(drafts)
    const runs = new Map<number, TimetableDto[]>()
    for (const d of drafts) {
      const r = draftRunById.get(d.timetableId) ?? 1
      const arr = runs.get(r) ?? []
      arr.push(d)
      runs.set(r, arr)
    }
    for (const arr of runs.values()) {
      arr.sort((a, b) => {
        const tb = new Date(b.generatedAt).getTime()
        const ta = new Date(a.generatedAt).getTime()
        if (tb !== ta) return tb - ta
        return b.timetableId - a.timetableId
      })
    }
    const runOrder = [...runs.keys()].sort((a, b) => {
      const timesA = (runs.get(a) ?? []).map((t) => new Date(t.generatedAt).getTime())
      const timesB = (runs.get(b) ?? []).map((t) => new Date(t.generatedAt).getTime())
      const newestA = timesA.length ? Math.max(...timesA) : 0
      const newestB = timesB.length ? Math.max(...timesB) : 0
      return newestB - newestA
    })
    const publishedSorted = [...published].sort((a, b) => {
      const tb = new Date(b.generatedAt).getTime()
      const ta = new Date(a.generatedAt).getTime()
      if (tb !== ta) return tb - ta
      return b.timetableId - a.timetableId
    })
    return { draftRunById, runs, runOrder, published: publishedSorted }
  }, [timetables])

  // Load timetables when scope changes (all, drafts only, or one semester).
  useEffect(() => {
    if (autoSelectLatestTimetable) return
    let mounted = true

    setLoadingTimetables(true)
    setError(null)
    setTimetables([])
    setTimetableId(null)

    if (timetableSource === "published" && resolvedPublishedSemesterId == null) {
      setLoadingTimetables(false)
      return () => {
        mounted = false
      }
    }

    let endpoint = "/timetables"
    if (timetableSource === "drafts") {
      endpoint = "/timetables?draftsOnly=true"
    } else if (timetableSource === "published" && resolvedPublishedSemesterId != null) {
      endpoint = `/timetables?semesterId=${resolvedPublishedSemesterId}`
    }

    ApiClient.request<TimetableDto[]>(endpoint)
      .then((data) => {
        if (!mounted) return
        setTimetables(data)
        const first = data[0] ?? null
        setTimetableId(first?.timetableId ?? null)
      })
      .catch((e) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : "Failed to load timetables.")
      })
      .finally(() => {
        if (!mounted) return
        setLoadingTimetables(false)
      })

    return () => {
      mounted = false
    }
  }, [timetableSource, resolvedPublishedSemesterId, autoSelectLatestTimetable])

  // Auto-select latest timetable (newest first from backend ordering).
  useEffect(() => {
    let mounted = true
    if (!autoSelectLatestTimetable) {
      return () => {
        mounted = false
      }
    }

    setError(null)
    setLoadingTimetables(true)
    setTimetables([])
    setTimetableId(null)

    ApiClient.request<TimetableDto[]>("/timetables")
      .then((data) => {
        if (!mounted) return
        setTimetables(data)
        const latest = data[0] ?? null
        if (latest?.semesterId != null) {
          setTimetableSource("published")
          setPublishedYear(latest.academicYear)
          setPublishedSemesterType(latest.semesterType)
        } else {
          setTimetableSource("drafts")
        }
        setTimetableId(latest?.timetableId ?? null)
      })
      .catch((e) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : "Failed to load latest timetable.")
      })
      .finally(() => {
        if (!mounted) return
        setLoadingTimetables(false)
      })

    return () => {
      mounted = false
    }
  }, [autoSelectLatestTimetable])

  useEffect(() => {
    setCourseFilter("all")
    setLecturerFilter("all")
    setRoomFilter("all")
    setMyScheduleOnly(false)
    setSearchText("")
  }, [timetableId])

  // Load entries for selected timetable
  useEffect(() => {
    let mounted = true
    if (!timetableId) {
      setAllEntries([])
      return () => {
        mounted = false
      }
    }

    ApiClient.request<TimetableEntryDto[]>(`/timetables/${timetableId}/entries`)
      .then((data) => {
        if (!mounted) return
        setAllEntries(data)
      })
      .catch(() => {
        if (!mounted) return
        setAllEntries([])
      })

    return () => {
      mounted = false
    }
  }, [timetableId])

  // Load entries for selected timetable
  useEffect(() => {
    let mounted = true
    if (!timetableId) {
      setEntries([])
      return () => {
        mounted = false
      }
    }

    setError(null)
    setLoadingEntries(true)
    setEntries([])

    const query = new URLSearchParams()
    if (courseFilter !== "all") {
      const [courseIdRaw, typeRaw] = courseFilter.split(":")
      const courseId = Number(courseIdRaw)
      if (Number.isFinite(courseId)) query.set("courseId", String(courseId))
      if (typeRaw === "lab" || typeRaw === "lecture") query.set("isLab", String(typeRaw === "lab"))
    }
    const effectiveLecturerFilter = myScheduleOnly && myLecturerId ? myLecturerId : lecturerFilter
    if (effectiveLecturerFilter !== "all") query.set("lecturerUserId", effectiveLecturerFilter)
    if (roomFilter !== "all") query.set("roomId", roomFilter)

    const queryString = query.toString()
    const endpoint = `/timetables/${timetableId}/entries${queryString ? `?${queryString}` : ""}`

    ApiClient.request<TimetableEntryDto[]>(endpoint)
      .then((data) => {
        if (!mounted) return
        setEntries(data)
      })
      .catch((e) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : "Failed to load timetable entries.")
      })
      .finally(() => {
        if (!mounted) return
        setLoadingEntries(false)
      })

    return () => {
      mounted = false
    }
  }, [timetableId, courseFilter, lecturerFilter, roomFilter, myScheduleOnly, myLecturerId])
  const strictlyFilteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (courseFilter !== "all") {
        const [courseIdRaw, typeRaw] = courseFilter.split(":")
        const selectedCourseId = Number(courseIdRaw)
        if (Number.isFinite(selectedCourseId) && entry.courseId !== selectedCourseId) return false
        if (typeRaw === "lab" && !entry.isLab) return false
        if (typeRaw === "lecture" && entry.isLab) return false
      }
      if (myScheduleOnly && myLecturerId && String(entry.lecturerUserId) !== myLecturerId) return false
      if (lecturerFilter !== "all" && String(entry.lecturerUserId) !== lecturerFilter) return false
      if (roomFilter !== "all" && String(entry.roomId) !== roomFilter) return false
      return true
    })
  }, [entries, courseFilter, lecturerFilter, roomFilter, myScheduleOnly, myLecturerId])
  const visibleBaseEntries = useMemo(
    () =>
      strictlyFilteredEntries.filter(
        (entry) => !(entry.registeredStudents === 0 && entry.sectionCapacity === 0),
      ),
    [strictlyFilteredEntries],
  )
  const expandedDisplayedEntries = useMemo(() => expandEntries(visibleBaseEntries), [visibleBaseEntries])
  const listDisplayedEntries = useMemo(() => compactEntries(visibleBaseEntries), [visibleBaseEntries])

  const searchFilteredExpanded = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return expandedDisplayedEntries
    return expandedDisplayedEntries.filter((e) => {
      const searchable = [
        e.courseCode,
        e.courseName,
        e.sectionNumber,
        e.lecturerName,
        e.roomNumber,
        e.day,
        e.startTime,
        e.endTime,
        e.isLab ? "lab" : "lecture",
      ]
      return searchable.some((field) => field.toLowerCase().includes(q))
    })
  }, [expandedDisplayedEntries, searchText])

  const searchFilteredList = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return listDisplayedEntries
    return listDisplayedEntries.filter((e) => {
      const searchable = [
        e.courseCode,
        e.courseName,
        e.sectionNumber,
        e.lecturerName,
        e.roomNumber,
        e.day,
        e.startTime,
        e.endTime,
        e.isLab ? "lab" : "lecture",
      ]
      return searchable.some((field) => field.toLowerCase().includes(q))
    })
  }, [listDisplayedEntries, searchText])

  const sortedListEntries = useMemo(() => {
    const firstDay = (dayLabel: string) => dayLabel.split(/\s+/)[0] ?? dayLabel
    const dayIndex = (day: string) => {
      const idx = DAY_ORDER.indexOf(firstDay(day) as (typeof DAY_ORDER)[number])
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
    }

    const compare = (a: ListEntry, b: ListEntry) => {
      switch (listSortField) {
        case "day":
          return dayIndex(a.day) - dayIndex(b.day)
        case "time":
          return a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)
        case "duration":
          return getDurationMinutes(a.startTime, a.endTime) - getDurationMinutes(b.startTime, b.endTime)
        case "courseCode":
          return a.courseCode.localeCompare(b.courseCode)
        case "course":
          return a.courseName.localeCompare(b.courseName)
        case "section":
          return a.sectionNumber.localeCompare(b.sectionNumber)
        case "lecturer":
          return a.lecturerName.localeCompare(b.lecturerName)
        case "room":
          return a.roomNumber.localeCompare(b.roomNumber)
        case "type":
          return (a.isLab ? "Lab" : "Lecture").localeCompare(b.isLab ? "Lab" : "Lecture")
        case "enrollment":
          return a.registeredStudents - b.registeredStudents || a.sectionCapacity - b.sectionCapacity
        default:
          return 0
      }
    }

    return searchFilteredList
      .slice()
      .sort((a, b) => {
        const primary = compare(a, b)
        const directional = listSortDirection === "asc" ? primary : -primary
        return directional || a.day.localeCompare(b.day) || a.startTime.localeCompare(b.startTime) || a.courseCode.localeCompare(b.courseCode)
      })
  }, [searchFilteredList, listSortField, listSortDirection])

  const days = useMemo(() => {
    return DAY_ORDER.slice(0, 5) as unknown as string[]
  }, [])

  const timeSlots = useMemo(() => {
    const set = new Set(searchFilteredExpanded.map((e) => e.timeRange))
    const arr = Array.from(set)
    arr.sort((a, b) => a.localeCompare(b))
    return arr
  }, [searchFilteredExpanded])
  const entriesByDayTime = useMemo(() => {
    const grouped = new Map<string, ExpandedEntry[]>()
    for (const entry of searchFilteredExpanded) {
      const key = `${entry.day}__${entry.timeRange}`
      const existing = grouped.get(key)
      if (existing) existing.push(entry)
      else grouped.set(key, [entry])
    }
    return grouped
  }, [searchFilteredExpanded])

  const timetable = useMemo(
    () => timetables.find((t) => t.timetableId === timetableId) ?? null,
    [timetables, timetableId],
  )

  const scheduleTitle = useMemo(() => {
    if (!timetable) return "Schedule Viewer"
    if (hideVersionInTitle) return `${timetable.academicYear} • ${timetable.semester}`
    if (timetable.semesterId == null) {
      const line = timetableVersionSelectModel.draftRunById.get(timetable.timetableId)
      const linePart = line != null ? `Draft line ${line} · ` : ""
      return `${linePart}v${timetable.versionNumber} · ${formatTimetableGeneratedAt(timetable.generatedAt)}`
    }
    return `${timetable.academicYear} • ${timetable.semester} • v${timetable.versionNumber}`
  }, [timetable, hideVersionInTitle, timetableVersionSelectModel.draftRunById])

  const useSectionColors = courseFilter !== "all" || lecturerFilter !== "all" || roomFilter !== "all"
  const getEntryColorKey = (entry: ExpandedEntry) => (useSectionColors ? `section-${entry.entryId}` : entry.courseCode)

  const exportRows = useMemo(() => {
    const source = viewType === "list" ? searchFilteredList : searchFilteredExpanded
    return source.map((e) => ({
      course: e.courseCode,
      section: e.sectionNumber,
      name: getDisplayCourseName(e.courseName, e.isLab),
      lecturer: e.lecturerName,
      room: e.roomNumber,
      day: e.day,
      start: e.startTime,
      end: e.endTime,
      type: e.isLab ? "Lab" : "Lecture",
      students: e.registeredStudents,
      capacity: e.sectionCapacity,
    }))
  }, [searchFilteredExpanded, searchFilteredList, viewType])
  const uniqueSectionCount = useMemo(() => {
    const sectionIds = new Set(searchFilteredList.map((e) => e.entryId))
    return sectionIds.size
  }, [searchFilteredList])

  const courseOptions = useMemo(() => {
    const dedup = new Map<string, { value: string; label: string }>()
    for (const e of allEntries) {
      const value = `${e.courseId}:${e.isLab ? "lab" : "lecture"}`
      if (!dedup.has(value)) {
        dedup.set(value, {
          value,
          label: `${e.courseCode} - ${getDisplayCourseName(e.courseName, e.isLab)}`,
        })
      }
    }
    return Array.from(dedup.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [allEntries])

  const lecturerOptions = useMemo(() => {
    const dedup = new Map<string, string>()
    for (const e of allEntries) {
      const key = String(e.lecturerUserId)
      if (!dedup.has(key)) dedup.set(key, e.lecturerName)
    }
    return Array.from(dedup.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [allEntries])

  const roomOptions = useMemo(() => {
    const dedup = new Map<string, string>()
    for (const e of allEntries) {
      const key = String(e.roomId)
      if (!dedup.has(key)) dedup.set(key, e.roomNumber)
    }
    return Array.from(dedup.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [allEntries])

  const hasActiveFilters =
    courseFilter !== "all" || lecturerFilter !== "all" || roomFilter !== "all" || myScheduleOnly || !!searchText.trim()
  const activeCourseLabel = courseOptions.find((o) => o.value === courseFilter)?.label ?? courseFilter
  const activeLecturerLabel = lecturerOptions.find((o) => o.value === lecturerFilter)?.label ?? lecturerFilter
  const activeRoomLabel = roomOptions.find((o) => o.value === roomFilter)?.label ?? roomFilter
  const trimmedSearch = searchText.trim()

  function handlePrint() {
    if (viewType === "list") {
      exportToPDF(
        exportRows,
        [
          { key: "course", label: "Course" },
          { key: "section", label: "Section" },
          { key: "name", label: "Course Name" },
          { key: "lecturer", label: "Lecturer" },
          { key: "room", label: "Room" },
          { key: "day", label: "Day" },
          { key: "start", label: "Start" },
          { key: "end", label: "End" },
          { key: "type", label: "Type" },
        ],
        scheduleTitle,
        `${exportRows.length} sessions`,
        false,
      )
      return
    }

    const subtitle = `${exportRows.length} sessions`

    if (viewType === "calendar") {
      const byDay: Record<string, ExpandedEntry[]> = {}
      for (const d of days) byDay[d] = []
      for (const e of searchFilteredExpanded) {
        if (!byDay[e.day]) byDay[e.day] = []
        byDay[e.day].push(e)
      }
      for (const d of Object.keys(byDay)) byDay[d].sort((a, b) => a.startTime.localeCompare(b.startTime))

      const columns = days
        .map((day) => {
          const cards = (byDay[day] ?? []).length
            ? (byDay[day] ?? [])
                .map((e) => {
                  const c = getPdfColorForKey(getEntryColorKey(e))
                  return `<div style="background:${c.bg};border-left:4px solid ${c.border};color:${c.text};padding:10px 12px;border-radius:8px;font-size:11px;margin-bottom:8px;break-inside:avoid;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                      <span style="font-weight:700;font-size:13px;">${e.courseCode}-${e.sectionNumber}${e.isLab ? " (Lab)" : ""}</span>
                      <span style="font-size:10px;opacity:0.75;">${e.timeRange}</span>
                    </div>
                    <div style="margin-bottom:2px;font-size:11px;opacity:0.85;">${getDisplayCourseName(e.courseName, e.isLab)}</div>
                    <div style="margin-bottom:2px;">${e.lecturerName}</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;opacity:0.75;font-size:10px;">
                      <span>${e.roomNumber}</span>
                      <span>${e.registeredStudents} students</span>
                    </div>
                  </div>`
                })
                .join("")
            : `<div style="text-align:center;color:#9ca3af;font-size:12px;padding:32px 0;">No sessions</div>`

          return `<div style="flex:1;min-width:0;break-inside:avoid;page-break-inside:avoid;">
            <div style="background:#111827;color:#ffffff;padding:10px 12px;border-radius:8px 8px 0 0;text-align:center;font-weight:700;font-size:14px;">${day}</div>
            <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:10px 8px;min-height:200px;background:#ffffff;">
              ${cards}
            </div>
          </div>`
        })
        .join("")

      const html = `<!DOCTYPE html><html><head><title>${scheduleTitle}</title>
        <style>
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: landscape; margin: 14mm; }
          }
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 20px; color: #111827; margin: 0; background: #f8fafc; }
          .sheet { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
          .header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:14px; border-bottom:1px solid #e5e7eb; padding-bottom:10px; }
          .header h1 { font-size:20px; font-weight:700; margin:0 0 4px 0; }
          .header p { color:#6b7280; margin:0; font-size:13px; }
          .badge { text-align:right; font-size:11px; color:#1e3a8a; background:#eff6ff; border:1px solid #bfdbfe; border-radius:999px; padding:4px 10px; }
          .columns { display:flex; gap:10px; align-items:stretch; }
        </style>
      </head><body>
        <div class="sheet">
          <div class="header">
            <div>
              <h1>${scheduleTitle}</h1>
              <p>${subtitle}</p>
            </div>
            <div class="badge">Calendar View</div>
          </div>
          <div class="columns" style="margin-top:10px;">
            ${columns}
          </div>
        </div>
      </body></html>`

      openPrintWindow(html)
      return
    }

    // Grid view
    const grid: Record<string, Record<string, ExpandedEntry[]>> = {}
    for (const day of days) {
      grid[day] = {}
      for (const t of timeSlots) grid[day][t] = []
    }
    for (const e of searchFilteredExpanded) {
      if (!grid[e.day]) grid[e.day] = {}
      if (!grid[e.day][e.timeRange]) grid[e.day][e.timeRange] = []
      grid[e.day][e.timeRange].push(e)
    }

    const renderCell = (cellEntries: ExpandedEntry[]) => {
      if (!cellEntries.length) return ""
      return cellEntries
        .map((e) => {
          const c = getPdfColorForKey(getEntryColorKey(e))
          return `<div style="background:${c.bg};border-left:4px solid ${c.border};color:${c.text};padding:8px 10px;border-radius:6px;font-size:12px;margin-bottom:4px;break-inside:avoid;page-break-inside:avoid;">
            <div style="font-weight:700;font-size:13px;">${getDisplayCourseName(e.courseName, e.isLab)}</div>
            <div style="opacity:0.9;font-size:11px;margin-top:2px;">${e.courseCode}-${e.sectionNumber}${e.isLab ? " (Lab)" : ""}</div>
            <div style="opacity:0.9;">${e.lecturerName}</div>
            <div style="opacity:0.75;">${e.roomNumber}</div>
          </div>`
        })
        .join("")
    }

    const headerCells = days
      .map(
        (d) =>
          `<th style="padding:10px 8px;font-weight:700;font-size:13px;text-align:center;border-bottom:2px solid #bfdbfe;border-right:1px solid #e5e7eb;background:#eff6ff;color:#1e3a8a;">${d}</th>`,
      )
      .join("")

    const bodyRows = timeSlots
      .map((t, rowIndex) => {
        const dayCells = days
          .map(
            (d) =>
              `<td style="padding:8px;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb;vertical-align:top;background:${rowIndex % 2 ? "#fcfcfd" : "#ffffff"};">${renderCell(
                grid[d]?.[t] ?? [],
              )}</td>`,
          )
          .join("")
        return `<tr>
          <td style="padding:12px 12px;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb;font-size:12px;color:#1e3a8a;font-weight:700;vertical-align:middle;white-space:nowrap;background:#eff6ff;">${t}</td>
          ${dayCells}
        </tr>`
      })
      .join("")

    const html = `<!DOCTYPE html><html><head><title>${scheduleTitle}</title>
      <style>
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: landscape; margin: 14mm; }
        }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 20px; color: #111827; margin: 0; background:#f8fafc; }
        .sheet { background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; padding:16px; }
        .header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px; border-bottom:1px solid #e5e7eb; padding-bottom:10px; }
        .header h1 { font-size:20px; font-weight:700; margin:0 0 4px 0; }
        .header p { color:#6b7280; margin:0; font-size:13px; }
        .badge { text-align:right; font-size:11px; color:#1e3a8a; background:#eff6ff; border:1px solid #bfdbfe; border-radius:999px; padding:4px 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #e5e7eb; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
      </style>
    </head><body>
      <div class="sheet">
        <div class="header">
          <div>
            <h1>${scheduleTitle}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="badge">Grid View</div>
        </div>
        <table>
          <thead><tr>
            <th style="padding:10px 12px;font-weight:700;font-size:13px;text-align:left;border-bottom:2px solid #bfdbfe;border-right:1px solid #e5e7eb;color:#1e3a8a;background:#eff6ff;">Time</th>
            ${headerCells}
          </tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </body></html>`

    openPrintWindow(html)
  }

  function handleExportCSV() {
    exportToCSV(
      exportRows,
      [
        { key: "course", label: "Course" },
        { key: "section", label: "Section" },
        { key: "name", label: "Course Name" },
        { key: "lecturer", label: "Lecturer" },
        { key: "room", label: "Room" },
        { key: "day", label: "Day" },
        { key: "start", label: "Start" },
        { key: "end", label: "End" },
        { key: "type", label: "Type" },
        { key: "students", label: "Students" },
        { key: "capacity", label: "Capacity" },
      ],
      `${scheduleTitle} — ${viewType}`.replaceAll("•", "-"),
    )
  }

  function handleExportExcel() {
    exportToExcel(
      exportRows,
      [
        { key: "course", label: "Course" },
        { key: "section", label: "Section" },
        { key: "name", label: "Course Name" },
        { key: "lecturer", label: "Lecturer" },
        { key: "room", label: "Room" },
        { key: "day", label: "Day" },
        { key: "start", label: "Start" },
        { key: "end", label: "End" },
        { key: "type", label: "Type" },
        { key: "students", label: "Students" },
        { key: "capacity", label: "Capacity" },
      ],
      `${scheduleTitle} — ${viewType}`.replaceAll("•", "-"),
    )
  }

  function toggleListSort(field: ListSortField) {
    if (listSortField === field) {
      setListSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setListSortField(field)
    setListSortDirection("asc")
  }

  const isReady = !loadingTimetables && !!timetableId
  const isViewerLoading = loadingSemesters || loadingTimetables || loadingEntries

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px]">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-balance text-foreground">Schedule Viewer</h1>
              <p className="hidden text-sm text-muted-foreground lg:block">
                Browse GWO-generated drafts and published timetables from the database, then switch grid, list, or
                calendar and export what you see.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {enableMySchedule && myLecturerId ? (
                <Button
                  variant={myScheduleOnly ? "default" : "outline"}
                  onClick={() => setMyScheduleOnly((prev) => !prev)}
                  disabled={!isReady || loadingEntries}
                >
                  My Schedule
                </Button>
              ) : null}
              <Button variant="outline" onClick={handlePrint} disabled={!isReady || loadingEntries}>
                <Printer className="mr-2 h-4 w-4" />
                Print / PDF
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={!isReady || loadingEntries}>
                    <Upload className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleExportCSV}>Export CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel}>Export Excel (.xlsx)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {error && (
            <Card className="mb-6 border-destructive/30">
              <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {!hideScheduleSelection ? (
            <CompactCollapsibleCard title="Schedule Selection">
                  <CardDescription className="text-xs">
                    List GWO drafts (no semester), everything, or published timetables for a specific academic year and
                    term. Then pick a version to view.
                  </CardDescription>
                  <div className="grid gap-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Timetable source</div>
                        <Select
                          value={timetableSource}
                          onValueChange={(v) => setTimetableSource(v as TimetableSource)}
                          disabled={loadingSemesters}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Choose source…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All timetables (drafts + published)</SelectItem>
                            <SelectItem value="drafts">Drafts only</SelectItem>
                            <SelectItem value="published">Published only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Timetable version</div>
                        <Select
                          value={timetableId ? String(timetableId) : ""}
                          onValueChange={(v) => setTimetableId(v ? Number(v) : null)}
                          disabled={
                            loadingTimetables ||
                            timetables.length === 0 ||
                            (timetableSource === "published" && resolvedPublishedSemesterId == null)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder={loadingTimetables ? "Loading timetables..." : "Select timetable"} />
                          </SelectTrigger>
                          <SelectContent>
                            {timetableVersionSelectModel.runOrder.map((runNum) => {
                              const items = timetableVersionSelectModel.runs.get(runNum) ?? []
                              const oldest = items[items.length - 1]
                              const lineStarted = oldest ? formatTimetableGeneratedAt(oldest.generatedAt) : ""
                              return (
                                <SelectGroup key={`draft-line-${runNum}`}>
                                  <SelectLabel>
                                    Draft line {runNum}
                                    {lineStarted ? ` · from ${lineStarted}` : ""}
                                  </SelectLabel>
                                  {items.map((tt) => (
                                    <SelectItem key={tt.timetableId} value={String(tt.timetableId)}>
                                      v{tt.versionNumber} · {formatTimetableGeneratedAt(tt.generatedAt)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              )
                            })}
                            {timetableVersionSelectModel.published.length > 0 ? (
                              <>
                                {timetableVersionSelectModel.runOrder.length > 0 ? <SelectSeparator /> : null}
                                <SelectGroup>
                                  <SelectLabel>Published timetables</SelectLabel>
                                  {timetableVersionSelectModel.published.map((tt) => (
                                    <SelectItem key={tt.timetableId} value={String(tt.timetableId)}>
                                      v{tt.versionNumber} · {tt.academicYear} {tt.semester} ·{" "}
                                      {formatTimetableGeneratedAt(tt.generatedAt)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {timetableSource === "published" ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Academic year</div>
                          <Select
                            value={publishedYear || (academicYears[0] ?? "")}
                            onValueChange={(v) => setPublishedYear(v)}
                            disabled={loadingSemesters || academicYears.length === 0}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                              {academicYears.map((y) => (
                                <SelectItem key={y} value={y}>
                                  {y}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Semester</div>
                          <Select
                            value={String(publishedSemesterType)}
                            onValueChange={(v) => setPublishedSemesterType(Number(v))}
                            disabled={loadingSemesters || semesterTypesForYear.length === 0}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select semester" />
                            </SelectTrigger>
                            <SelectContent>
                              {semesterTypesForYear.map((opt) => (
                                <SelectItem key={opt.value} value={String(opt.value)}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {resolvedPublishedSemesterId == null && publishedYear ? (
                          <p className="text-xs text-amber-800 dark:text-amber-200 md:col-span-2">
                            No semester row matches this year and term in the database. Check entity data or pick
                            another combination.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
            </CompactCollapsibleCard>
            ) : null}

            <CompactCollapsibleCard title="Filters" contentClassName="pb-0">
                  <CardDescription className="text-xs">
                    Backend filters narrow the dataset; text search refines what appears in views and exports.
                  </CardDescription>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Course + Type</div>
                      <SearchableFilterSelect
                        value={courseFilter}
                        onChange={setCourseFilter}
                        allLabel="All courses"
                        placeholder="All courses"
                        options={courseOptions}
                        disabled={!timetableId || loadingEntries}
                        searchPlaceholder="Search courses..."
                        emptyLabel="No courses found."
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Lecturer</div>
                      <SearchableFilterSelect
                        value={lecturerFilter}
                        onChange={setLecturerFilter}
                        allLabel="All lecturers"
                        placeholder="All lecturers"
                        options={lecturerOptions}
                        disabled={!timetableId || loadingEntries}
                        searchPlaceholder="Search lecturers..."
                        emptyLabel="No lecturers found."
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Room</div>
                      <SearchableFilterSelect
                        value={roomFilter}
                        onChange={setRoomFilter}
                        allLabel="All rooms"
                        placeholder="All rooms"
                        options={roomOptions}
                        disabled={!timetableId || loadingEntries}
                        searchPlaceholder="Search rooms..."
                        emptyLabel="No rooms found."
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Text Search</div>
                      <Input
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Code, name, section, lecturer, room, day/time..."
                        disabled={!timetableId}
                        className="h-8"
                      />
                    </div>
                  </div>

                  <div className="mt-0 rounded-lg bg-background/60 px-2 py-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="py-0 font-medium">
                        Showing {uniqueSectionCount} sections
                      </Badge>
                      {courseFilter !== "all" && (
                        <Badge variant="secondary" className="gap-1 py-0">
                          Course: {activeCourseLabel}
                          <button type="button" onClick={() => setCourseFilter("all")} aria-label="Remove course filter">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {lecturerFilter !== "all" && (
                        <Badge variant="secondary" className="gap-1 py-0">
                          Lecturer: {activeLecturerLabel}
                          <button type="button" onClick={() => setLecturerFilter("all")} aria-label="Remove lecturer filter">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {roomFilter !== "all" && (
                        <Badge variant="secondary" className="gap-1 py-0">
                          Room: {activeRoomLabel}
                          <button type="button" onClick={() => setRoomFilter("all")} aria-label="Remove room filter">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {myScheduleOnly && (
                        <Badge variant="secondary" className="gap-1 py-0">
                          Scope: My schedule
                          <button type="button" onClick={() => setMyScheduleOnly(false)} aria-label="Remove my schedule filter">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {trimmedSearch && (
                        <Badge variant="outline" className="gap-1 py-0">
                          Search: {trimmedSearch}
                          <button type="button" onClick={() => setSearchText("")} aria-label="Clear search">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {hasActiveFilters && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCourseFilter("all")
                            setLecturerFilter("all")
                            setRoomFilter("all")
                            setMyScheduleOnly(false)
                            setSearchText("")
                          }}
                          className="h-6 px-2"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                  </div>

            </CompactCollapsibleCard>

            {/* Viewer */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">{scheduleTitle}</CardTitle>
                      <CardDescription>
                        {timetableId ? (
                          <span>
                            {timetable ? `${formatTimetableGeneratedAt(timetable.generatedAt)} • ` : ""}
                            {uniqueSectionCount} sections
                          </span>
                        ) : (
                          "No schedule selected."
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border p-1">
                      <Button
                        variant={viewType === "grid" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewType("grid")}
                        className="gap-1.5"
                        disabled={!timetableId}
                      >
                        <Grid3X3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Grid</span>
                      </Button>
                      <Button
                        variant={viewType === "list" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewType("list")}
                        className="gap-1.5"
                        disabled={!timetableId}
                      >
                        <List className="h-4 w-4" />
                        <span className="hidden sm:inline">List</span>
                      </Button>
                      <Button
                        variant={viewType === "calendar" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewType("calendar")}
                        className="gap-1.5"
                        disabled={!timetableId}
                      >
                        <Calendar className="h-4 w-4" />
                        <span className="hidden sm:inline">Calendar</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {isViewerLoading ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading schedule…
                    </div>
                  ) : !autoSelectLatestTimetable && !loadingTimetables && timetables.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground">
                      No timetables match this source. Try &quot;All timetables&quot; or store a schedule from GWO
                      first.
                    </div>
                  ) : !timetableId ? (
                    <div className="p-6 text-sm text-muted-foreground">
                      {autoSelectLatestTimetable
                        ? "No schedule found in the database yet."
                        : "No schedule selected. Please select a schedule to view."}
                    </div>
                  ) : exportRows.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground">No sessions found for this timetable.</div>
                  ) : viewType === "grid" ? (
                    <ScrollArea className="w-full">
                      <div className="min-w-[900px]">
                        <div className="grid border-b" style={{ gridTemplateColumns: `130px repeat(${days.length}, minmax(140px, 1fr))` }}>
                          <div className="p-3 text-sm font-medium text-muted-foreground border-r text-center">Time</div>
                          {days.map((day) => (
                            <div key={day} className="p-3 text-sm font-medium text-center border-r last:border-r-0">
                              {day}
                            </div>
                          ))}
                        </div>

                        {timeSlots.map((t) => (
                          <div
                            key={t}
                            className="grid border-b last:border-b-0"
                            style={{ gridTemplateColumns: `130px repeat(${days.length}, minmax(140px, 1fr))` }}
                          >
                            <div className="border-r bg-muted/20 p-3 text-center text-sm text-muted-foreground flex items-center justify-center">
                              {t}
                            </div>
                            {days.map((day) => {
                              const cell = entriesByDayTime.get(`${day}__${t}`) ?? []
                              return (
                                <div key={`${day}-${t}`} className="border-r p-2 last:border-r-0 min-h-[104px] odd:bg-muted/5">
                                  <div className="space-y-2">
                                    {cell.map((e) => {
                                      return (
                                        <SessionCard
                                          key={`${e.entryId}-${e.day}-${e.timeRange}`}
                                          entry={e}
                                          colorKey={getEntryColorKey(e)}
                                          showTime={false}
                                          compact
                                          searchQuery={trimmedSearch}
                                        />
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  ) : viewType === "calendar" ? (
                    <div className="grid gap-4 p-4 md:grid-cols-5">
                      {days.slice(0, 5).map((day) => {
                        const dayEntries = searchFilteredExpanded
                          .filter((e) => e.day === day)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                        return (
                          <Card key={day} className="min-h-[320px]">
                            <CardHeader className="pb-2 pt-3 px-3">
                              <CardTitle className="text-sm font-semibold text-center">{day}</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 space-y-2">
                              {dayEntries.length === 0 ? (
                                <div className="py-8 text-center text-xs text-muted-foreground">No sessions</div>
                              ) : (
                                dayEntries.map((e) => {
                                  return (
                                    <SessionCard key={`${e.entryId}-${e.day}`} entry={e} colorKey={getEntryColorKey(e)} searchQuery={trimmedSearch} />
                                  )
                                })
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full min-w-[980px] border-collapse text-sm">
                          <thead className="bg-muted/40">
                            <tr className="border-b">
                              {[
                                { key: "courseCode", label: "Course Code" },
                                { key: "course", label: "Course" },
                                { key: "lecturer", label: "Lecturer" },
                                { key: "section", label: "Section" },
                                { key: "day", label: "Day" },
                                { key: "time", label: "Time" },
                                { key: "duration", label: "Duration" },
                                { key: "room", label: "Room" },
                                { key: "type", label: "Type" },
                                { key: "enrollment", label: "Enrollment" },
                              ].map((col) => {
                                const isActive = listSortField === col.key
                                const headerAlignClass =
                                  col.key === "courseCode"
                                    ? "text-left"
                                    : col.key === "course"
                                      ? "text-left"
                                    : col.key === "enrollment"
                                      ? "text-right"
                                      : "text-center"
                                const buttonAlignClass =
                                  col.key === "courseCode"
                                    ? "justify-start"
                                    : col.key === "course"
                                      ? "justify-start"
                                    : col.key === "enrollment"
                                      ? "justify-end"
                                      : "justify-center"
                                const noWrapClass = col.key === "courseCode" ? "whitespace-nowrap" : ""
                                return (
                                  <th key={col.key} className={cn("px-3 py-2 font-semibold text-muted-foreground", headerAlignClass)}>
                                    <button
                                      type="button"
                                      onClick={() => toggleListSort(col.key as ListSortField)}
                                      className={cn("inline-flex w-full items-center gap-1.5 hover:text-foreground", buttonAlignClass, noWrapClass)}
                                    >
                                      {col.label}
                                      {isActive ? (
                                        listSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                                      )}
                                    </button>
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedListEntries.map((e) => (
                                <tr key={`${e.entryId}-${e.day}-${e.startTime}`} className="border-b last:border-b-0 odd:bg-muted/10 hover:bg-muted/25">
                                  <td className="px-3 py-2.5 font-medium">{highlightMatch(e.courseCode, trimmedSearch)}</td>
                                  <td className="px-3 py-2.5 text-left">{highlightMatch(getDisplayCourseName(e.courseName, e.isLab), trimmedSearch)}</td>
                                  <td className="px-3 py-2.5 text-center">{highlightMatch(e.lecturerName, trimmedSearch)}</td>
                                  <td className="px-3 py-2.5 text-center">{highlightMatch(e.sectionNumber, trimmedSearch)}</td>
                                  <td className="px-3 py-2.5 text-center">{highlightMatch(e.day, trimmedSearch)}</td>
                                  <td className="px-3 py-2.5 text-center tabular-nums whitespace-nowrap">{highlightMatch(`${e.startTime}-${e.endTime}`, trimmedSearch)}</td>
                                  <td className="px-3 py-2.5 text-center">{getDurationLabel(e.startTime, e.endTime)}</td>
                                  <td className="px-3 py-2.5 text-center">{highlightMatch(e.roomNumber, trimmedSearch)}</td>
                                  <td className="px-3 py-2.5 text-center">{highlightMatch(e.isLab ? "Lab" : "Lecture", trimmedSearch)}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">
                                    {e.registeredStudents}/{e.sectionCapacity}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function AdminScheduleViewerPage() {
  return <ScheduleViewerPage />
}
