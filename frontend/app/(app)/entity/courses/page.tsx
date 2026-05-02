"use client"

import { useState, useMemo, useEffect } from "react"
import { EntityLayout } from "@/components/entity-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Archive,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import {
  departments,
  deliveryModeOptions,
  formatDeliveryModeLabel,
  parseDeliveryMode,
  type Department,
  type DeliveryMode,
} from "@/lib/data"
import { academicLevelFromCourseCode } from "@/lib/academic-level"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Course = {
  id?: number
  code: string
  name: string
  creditHours: number
  academicLevel: number
  deliveryMode: DeliveryMode
  department: Department
  sectionsNormal: number
  sectionsSummer: number
  /** Distinct section labels in the newest term that has schedule rows (informational). */
  sectionsInLatestSchedule?: number
  isLab: boolean
}

const parseNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/** One row per course from `GET /api/courses/catalog` (distinct `course_code`). */
function mapCatalogRow(raw: unknown): Course | null {
  const item = (raw ?? {}) as Record<string, unknown>
  const code = String(item.code ?? "").trim()
  const name = String(item.name ?? "").trim()
  if (!code && !name) return null
  const parsedId = parseNumber(item.id, Number.NaN)
  return {
    id: Number.isFinite(parsedId) ? parsedId : undefined,
    code,
    name,
    creditHours: parseNumber(item.creditHours, 0),
    academicLevel: academicLevelFromCourseCode(code),
    deliveryMode: parseDeliveryMode(item.deliveryMode),
    department: String(item.department ?? "Computer Science") as Department,
    sectionsNormal: parseNumber(item.sectionsNormal, 1),
    sectionsSummer: parseNumber(item.sectionsSummer, 0),
    sectionsInLatestSchedule: parseNumber(item.sectionsInLatestSchedule, 0),
    isLab: typeof item.isLab === "boolean" ? item.isLab : false,
  }
}

type SortableColumn =
  | "code"
  | "name"
  | "creditHours"
  | "academicLevel"
  | "deliveryMode"
  | "isLab"
  | "sectionsNormal"
  | "sectionsSummer"

function sortCoursesCopy(
  list: Course[],
  sortColumn: SortableColumn | null,
  sortDirection: "asc" | "desc",
): Course[] {
  const copy = [...list]
  if (!sortColumn) return copy
  const mult = sortDirection === "asc" ? 1 : -1
  copy.sort((a, b) => {
    let cmp = 0
    switch (sortColumn) {
      case "code":
        cmp = a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" })
        break
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        break
      case "creditHours":
        cmp = a.creditHours - b.creditHours
        break
      case "academicLevel":
        cmp = a.academicLevel - b.academicLevel
        break
      case "deliveryMode":
        cmp = a.deliveryMode.localeCompare(b.deliveryMode)
        break
      case "isLab":
        cmp = Number(a.isLab) - Number(b.isLab)
        break
      case "sectionsNormal":
        cmp = a.sectionsNormal - b.sectionsNormal
        break
      case "sectionsSummer":
        cmp = a.sectionsSummer - b.sectionsSummer
        break
      default:
        break
    }
    if (cmp !== 0) return cmp * mult
    if (sortColumn === "code") return a.name.localeCompare(b.name) * mult
    if (sortColumn === "name") return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" }) * mult
    return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" }) * mult
  })
  return copy
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [archivedCourses, setArchivedCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [tab, setTab] = useState<"active" | "archived">("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [saving, setSaving] = useState(false)
  const [newCourse, setNewCourse] = useState<Course>({
    code: "",
    name: "",
    creditHours: 3,
    academicLevel: 1,
    deliveryMode: "FACE_TO_FACE",
    department: "Computer Science",
    sectionsNormal: 1,
    sectionsSummer: 0,
    sectionsInLatestSchedule: 0,
    isLab: false,
  })
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null)
  const [archivedCourseToPermanentlyDelete, setArchivedCourseToPermanentlyDelete] =
    useState<Course | null>(null)
  const [archivedCourseDeletionImpact, setArchivedCourseDeletionImpact] = useState<{
    entryCount: number
    timetables: { timetableId: number; generationType: string; status: string; versionNumber: number }[]
  } | null>(null)
  const [loadingDeletionImpact, setLoadingDeletionImpact] = useState(false)
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false)
  const { toast } = useToast()
  const formatTimetableLabel = (t: {
    timetableId: number
    generationType: string
    status: string
    versionNumber: number
  }) => `Timetable ${t.timetableId} (${t.status}, ${t.generationType} v${t.versionNumber})`

  // Fetch courses from API
  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (tab !== "archived") return
    fetchArchivedCourses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (tab !== "archived") return
    const interval = setInterval(() => {
      fetchArchivedCourses()
    }, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const fetchCourses = async (options?: { showFullLoading?: boolean }) => {
    const showFullLoading = options?.showFullLoading !== false
    try {
      if (showFullLoading) setLoading(true)
      const response = await fetch('/api/courses/catalog', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch courses')
      const body = (await response.json()) as {
        courses?: unknown[]
      }
      const rows = Array.isArray(body.courses) ? body.courses : []
      const normalizedCourses = rows
        .map(mapCatalogRow)
        .filter((c): c is Course => c != null)
      setCourses(normalizedCourses)
    } catch (error) {
      console.error('Error fetching courses:', error)
      toast({
        title: "Error",
        description: "Failed to load courses. Please try again.",
        variant: "destructive",
      })
    } finally {
      if (showFullLoading) setLoading(false)
    }
  }

  const fetchArchivedCourses = async () => {
    try {
      setLoadingArchived(true)
      const response = await fetch("/api/courses/archived/list", { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to fetch archived courses")
      const body = (await response.json()) as unknown[]
      const rows = Array.isArray(body) ? body : []
      const normalized = rows
        .map(mapCatalogRow)
        .filter((c): c is Course => c != null)
      setArchivedCourses(normalized)
    } catch (error) {
      console.error("Error fetching archived courses:", error)
      toast({
        title: "Error",
        description: "Failed to load archived courses. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingArchived(false)
    }
  }

  const filteredCourses = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return courses

    const toSearchableText = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : "")

    return courses.filter((course) => {
      const code = toSearchableText(course.code)
      const name = toSearchableText(course.name)
      const department = toSearchableText(course.department)
      const kind = course.isLab ? "lab" : "lecture"

      return (
        code.includes(normalizedQuery) ||
        name.includes(normalizedQuery) ||
        department.includes(normalizedQuery) ||
        kind.includes(normalizedQuery)
      )
    })
  }, [courses, searchQuery])

  const sortedFilteredCourses = useMemo(
    () => sortCoursesCopy(filteredCourses, sortColumn, sortDirection),
    [filteredCourses, sortColumn, sortDirection],
  )

  const sortedAllCourses = useMemo(
    () => sortCoursesCopy(courses, sortColumn, sortDirection),
    [courses, sortColumn, sortDirection],
  )

  const totalPages = Math.ceil(sortedFilteredCourses.length / pageSize)
  const maxPage = totalPages || 1
  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedFilteredCourses.slice(start, start + pageSize)
  }, [sortedFilteredCourses, currentPage, pageSize])

  const handleSortColumn = (col: SortableColumn) => {
    setCurrentPage(1)
    if (sortColumn !== col) {
      setSortColumn(col)
      setSortDirection("asc")
    } else {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    }
  }

  const getCourseRowKey = (course: Course, index: number) => {
    if (course.id != null) return `course-id-${course.id}`
    const normalizedCode = course.code?.trim()
    if (normalizedCode) return `course-code-${normalizedCode}-${index}`
    return `course-row-${index}`
  }

  const handleAddCourse = async () => {
    if (!newCourse.code.trim()) {
      toast({ title: "Validation Error", description: "Course code is required.", variant: "destructive" })
      return
    }
    if (!newCourse.name.trim()) {
      toast({ title: "Validation Error", description: "Course name is required.", variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCourse.code,
          name: newCourse.name,
          creditHours: newCourse.creditHours,
          academicLevel: newCourse.academicLevel,
          deliveryMode: newCourse.deliveryMode,
          department: newCourse.department,
          sectionsNormal: newCourse.sectionsNormal,
          sectionsSummer: newCourse.sectionsSummer,
          isLab: newCourse.isLab,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to create course. Please try again.",
          variant: "destructive",
        })
        return
      }

      await fetchCourses({ showFullLoading: false })
      setNewCourse({
        code: "",
        name: "",
        creditHours: 3,
        academicLevel: 1,
        deliveryMode: "FACE_TO_FACE",
        department: "Computer Science",
        sectionsNormal: 1,
        sectionsSummer: 0,
        sectionsInLatestSchedule: 0,
        isLab: false,
      })
      setIsAddDialogOpen(false)
      toast({
        title: "Success",
        description: "Course created successfully.",
      })
    } catch (error) {
      console.error('Error creating course:', error)
      toast({
        title: "Error",
        description: "Failed to create course. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEditCourse = async () => {
    if (!editingCourse) return

    try {
      setSaving(true)
      const response = await fetch(`/api/courses/${editingCourse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editingCourse.code,
          name: editingCourse.name,
          creditHours: editingCourse.creditHours,
          academicLevel: editingCourse.academicLevel,
          deliveryMode: editingCourse.deliveryMode,
          department: editingCourse.department,
          sectionsNormal: editingCourse.sectionsNormal,
          sectionsSummer: editingCourse.sectionsSummer,
          isLab: editingCourse.isLab,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to update course. Please try again.",
          variant: "destructive",
        })
        return
      }

      await fetchCourses({ showFullLoading: false })
      setEditingCourse(null)
      toast({
        title: "Success",
        description: "Course updated successfully.",
      })
    } catch (error) {
      console.error('Error updating course:', error)
      toast({
        title: "Error",
        description: "Failed to update course. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCourse = async (course: Course) => {
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      const errorMessage =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) ? data.message.join(", ") : undefined) ||
        data?.error

      if (!response.ok) {
        toast({
          title: "Error",
          description: errorMessage || "Failed to archive course. Please try again.",
          variant: "destructive",
        })
        return
      }

      await fetchCourses({ showFullLoading: false })
      await fetchArchivedCourses()
      toast({
        title: "Success",
        description: `${course.code} archived — it won't be used in future scheduling`,
      })
    } catch (error) {
      console.error('Error deleting course:', error)
      toast({
        title: "Error",
        description: "Failed to archive course. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRestoreArchivedCourse = async (course: Course) => {
    try {
      const response = await fetch(`/api/courses/${course.id}/restore`, { method: "PATCH" })
      const data = await response.json()
      const errorMessage =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) ? data.message.join(", ") : undefined) ||
        data?.error

      if (!response.ok) {
        toast({
          title: "Error",
          description: errorMessage || "Failed to restore course. Please try again.",
          variant: "destructive",
        })
        return
      }

      setArchivedCourses((prev) => prev.filter((c) => c.id !== course.id))
      await fetchCourses({ showFullLoading: false })
      toast({ title: "Success", description: "Course restored successfully." })
    } catch (error) {
      console.error("Error restoring course:", error)
      toast({
        title: "Error",
        description: "Failed to restore course. Please try again.",
        variant: "destructive",
      })
    }
  }

  const openPermanentDeleteCourseModal = async (course: Course) => {
    try {
      setLoadingDeletionImpact(true)
      const response = await fetch(`/api/courses/${course.id}/deletion-impact`, { cache: "no-store" })
      const data = await response.json()
      const errorMessage =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) ? data.message.join(", ") : undefined) ||
        data?.error

      if (!response.ok) {
        toast({
          title: "Error",
          description: errorMessage || "Failed to check deletion impact. Please try again.",
          variant: "destructive",
        })
        return
      }

      setArchivedCourseToPermanentlyDelete(course)
      setArchivedCourseDeletionImpact({
        entryCount: Number((data as { entryCount?: unknown }).entryCount ?? 0) || 0,
        timetables: Array.isArray((data as { timetables?: unknown }).timetables)
          ? ((data as { timetables: unknown[] }).timetables as {
              timetableId: number
              generationType: string
              status: string
              versionNumber: number
            }[])
          : [],
      })
    } catch (error) {
      console.error("Error checking deletion impact:", error)
      toast({
        title: "Error",
        description: "Failed to check deletion impact. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingDeletionImpact(false)
    }
  }

  const confirmPermanentDeleteArchivedCourse = async () => {
    if (!archivedCourseToPermanentlyDelete) return
    try {
      setPermanentlyDeleting(true)
      const response = await fetch(`/api/courses/${archivedCourseToPermanentlyDelete.id}/permanent`, {
        method: "DELETE",
      })
      const data = await response.json()
      const errorMessage =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) ? data.message.join(", ") : undefined) ||
        data?.error

      if (!response.ok) {
        toast({
          title: "Error",
          description: errorMessage || "Failed to permanently delete course. Please try again.",
          variant: "destructive",
        })
        return
      }

      setArchivedCourses((prev) => prev.filter((c) => c.id !== archivedCourseToPermanentlyDelete.id))
      setArchivedCourseToPermanentlyDelete(null)
      setArchivedCourseDeletionImpact(null)
      toast({ title: "Success", description: "Course permanently deleted successfully." })
    } catch (error) {
      console.error("Error permanently deleting course:", error)
      toast({
        title: "Error",
        description: "Failed to permanently delete course. Please try again.",
        variant: "destructive",
      })
    } finally {
      setPermanentlyDeleting(false)
    }
  }

  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return
    await handleDeleteCourse(courseToDelete)
    setCourseToDelete(null)
  }

  const courseColumns = [
    { key: "code" as const, label: "Code" },
    { key: "name" as const, label: "Name" },
    { key: "creditHours" as const, label: "Credit Hours" },
    { key: "academicLevel" as const, label: "Academic Level" },
    { key: "deliveryMode" as const, label: "Delivery Mode" },
    { key: "isLab" as const, label: "Lab" },
    { key: "department" as const, label: "Department" },
    { key: "sectionsNormal" as const, label: "Sections (normal)" },
    { key: "sectionsSummer" as const, label: "Sections (summer)" },
  ]

  const getDeliveryModeColor = (mode: DeliveryMode) => {
    switch (mode) {
      case "ONLINE":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      case "BLENDED":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      case "FACE_TO_FACE":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getDepartmentColor = (dept: Department) => {
    const colors: Record<string, string> = {
      "Computer Science": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      "Software Engineering": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
      "Data Science": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
      "Cyber Security": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      "Electrical Engineering": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      "Computer Engineering": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      "Communications Engineering": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
      "Business Administration": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      "Business Information Technology": "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
      "E-Marketing & Social Media": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
      "Computer Graphics": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
      "Basic Sciences": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
      "Accounting": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      "Coordination Unit for Service Courses": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
    }
    return colors[dept] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
  }

  if (loading) {
    return (
      <EntityLayout title="Course Management" description="Add, edit, and manage course catalog.">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </EntityLayout>
    )
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
      <EntityLayout
        title="Course Management"
        description="Add, edit, and manage course catalog."
        headerActions={
          <TabsList>
            <TabsTrigger value="active">Courses</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="active">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <div className="space-y-1">
                <CardTitle>Courses ({sortedFilteredCourses.length})</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Normal and summer columns are the scheduler targets stored on each course.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => setIsImportDialogOpen(true)}
                >
                  <ImportIcon className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <ExportDropdownWithDialog
                  allData={sortedAllCourses}
                  filteredData={paginatedCourses}
                  columns={courseColumns}
                  filenamePrefix="courses"
                  pdfTitle="Courses"
                  totalLabel={`${courses.length}`}
                  filteredLabel={`${paginatedCourses.length}`}
                  isFiltered={searchQuery !== "" || sortColumn != null}
                  filterDescription={
                    [
                      searchQuery ? `search: "${searchQuery}"` : null,
                      sortColumn ? `sort: ${sortColumn} ${sortDirection}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                />
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Course
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Course</DialogTitle>
                  <DialogDescription>Enter the course information below.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="course-code">Course Code</Label>
                      <Input
                        id="course-code"
                        value={newCourse.code}
                        onChange={(e) => {
                          const code = e.target.value
                          setNewCourse({
                            ...newCourse,
                            code,
                            academicLevel: academicLevelFromCourseCode(code),
                          })
                        }}
                        placeholder="e.g. 13432"
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="course-credits">Credit Hours</Label>
                      <Input
                        id="course-credits"
                        type="number"
                        min="1"
                        max="6"
                        value={newCourse.creditHours}
                        onChange={(e) =>
                          setNewCourse({ ...newCourse, creditHours: Number.parseInt(e.target.value) || 3 })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="course-sections-normal">Normal semester sections</Label>
                      <Input
                        id="course-sections-normal"
                        type="number"
                        min="0"
                        max="20"
                        value={newCourse.sectionsNormal}
                        onChange={(e) =>
                          setNewCourse({
                            ...newCourse,
                            sectionsNormal: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                          })
                        }
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="course-sections-summer">Summer semester sections</Label>
                      <Input
                        id="course-sections-summer"
                        type="number"
                        min="0"
                        max="20"
                        value={newCourse.sectionsSummer}
                        onChange={(e) =>
                          setNewCourse({
                            ...newCourse,
                            sectionsSummer: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                          })
                        }
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">
                        Set to 0 if this course is not offered in summer.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course-name">Course Name</Label>
                    <Input
                      id="course-name"
                      value={newCourse.name}
                      onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                      placeholder="Course Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">Academic Level</p>
                    <p className="text-xs text-muted-foreground">
                      From the 3rd digit of the code (updates when you change the code).{" "}
                      <span className="font-medium text-foreground" aria-live="polite">
                        Level {newCourse.academicLevel}
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="course-delivery">Delivery Mode</Label>
                      <Select
                        value={newCourse.deliveryMode}
                        onValueChange={(v) => setNewCourse({ ...newCourse, deliveryMode: v as DeliveryMode })}
                      >
                        <SelectTrigger id="course-delivery">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryModeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="course-department">Department</Label>
                      <Select
                        value={newCourse.department}
                        onValueChange={(v) => setNewCourse({ ...newCourse, department: v as Department })}
                      >
                        <SelectTrigger id="course-department">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="new-course-is-lab"
                      checked={newCourse.isLab}
                      onCheckedChange={(v) => setNewCourse({ ...newCourse, isLab: v === true })}
                    />
                    <Label htmlFor="new-course-is-lab" className="text-sm font-normal cursor-pointer">
                      Lab course
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCourse} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Course
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
              </div>
            </CardHeader>
            <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9 max-w-sm"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 font-medium hover:text-foreground",
                        sortColumn === "code" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => handleSortColumn("code")}
                    >
                      Code
                      {sortColumn === "code" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 font-medium hover:text-foreground",
                        sortColumn === "name" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => handleSortColumn("name")}
                    >
                      Name
                      {sortColumn === "name" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-center">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-1 font-medium hover:text-foreground",
                        sortColumn === "creditHours" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => handleSortColumn("creditHours")}
                    >
                      Credit Hours
                      {sortColumn === "creditHours" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-center">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-1 font-medium hover:text-foreground",
                        sortColumn === "academicLevel" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => handleSortColumn("academicLevel")}
                    >
                      Academic Level
                      {sortColumn === "academicLevel" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 font-medium hover:text-foreground",
                        sortColumn === "deliveryMode" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => handleSortColumn("deliveryMode")}
                    >
                      Delivery Mode
                      {sortColumn === "deliveryMode" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-center">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-1 font-medium hover:text-foreground",
                        sortColumn === "isLab" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => handleSortColumn("isLab")}
                    >
                      Lab
                      {sortColumn === "isLab" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-1 font-medium hover:text-foreground",
                        sortColumn === "sectionsNormal" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => handleSortColumn("sectionsNormal")}
                    >
                      Normal
                      {sortColumn === "sectionsNormal" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-center">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-1 font-medium hover:text-foreground",
                        sortColumn === "sectionsSummer" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onClick={() => handleSortColumn("sectionsSummer")}
                    >
                      Summer
                      {sortColumn === "sectionsSummer" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCourses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No courses found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCourses.map((course, index) => (
                    <TableRow key={getCourseRowKey(course, index)}>
                      <TableCell className="font-mono font-medium">{course.code}</TableCell>
                      <TableCell>{course.name}</TableCell>
                      <TableCell className="text-center">{course.creditHours}</TableCell>
                      <TableCell className="text-center">{course.academicLevel}</TableCell>
                      <TableCell>
                        <Badge className={getDeliveryModeColor(course.deliveryMode)}>
                          {formatDeliveryModeLabel(course.deliveryMode)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={course.isLab ? "default" : "secondary"}>{course.isLab ? "Yes" : "No"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getDepartmentColor(course.department)}>{course.department}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{course.sectionsNormal}</TableCell>
                      <TableCell className="text-center">{course.sectionsSummer}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setEditingCourse({
                                  ...course,
                                  academicLevel: academicLevelFromCourseCode(course.code),
                                })
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive hover:text-destructive focus:text-destructive data-[highlighted]:text-destructive"
                              onClick={() => setCourseToDelete(course)}
                            >
                              <Archive className="mr-2 h-4 w-4 text-destructive" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 15, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {maxPage}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                aria-label="Go to first page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Go to previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
                disabled={currentPage >= maxPage}
                aria-label="Go to next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(maxPage)}
                disabled={currentPage >= maxPage}
                aria-label="Go to last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle>Archived courses ({archivedCourses.length})</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Archived courses are excluded from future scheduling.
                </p>
              </div>
              {loadingArchived ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </CardHeader>
            <CardContent>
              {loadingArchived ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="w-[70px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedCourses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No archived courses
                          </TableCell>
                        </TableRow>
                      ) : (
                        archivedCourses.map((course, index) => (
                          <TableRow key={getCourseRowKey(course, index)}>
                            <TableCell className="font-mono font-medium">{course.code}</TableCell>
                            <TableCell>{course.name}</TableCell>
                            <TableCell>
                              <Badge className={getDepartmentColor(course.department)}>{course.department}</Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleRestoreArchivedCourse(course)}>
                                    Restore
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openPermanentDeleteCourseModal(course)}
                                    disabled={loadingDeletionImpact}
                                  >
                                    Permanently Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>Update the course information.</DialogDescription>
          </DialogHeader>
          {editingCourse && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="edit-course-code">Course Code</Label>
                  <Input id="edit-course-code" value={editingCourse.code} disabled />
                </div>
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="edit-course-credits">Credit Hours</Label>
                  <Input
                    id="edit-course-credits"
                    type="number"
                    min="1"
                    max="6"
                    value={editingCourse.creditHours}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, creditHours: Number.parseInt(e.target.value) || 3 })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="edit-course-sections-normal">Normal semester sections</Label>
                  <Input
                    id="edit-course-sections-normal"
                    type="number"
                    min="0"
                    max="20"
                    value={editingCourse.sectionsNormal}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        sectionsNormal: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                      })
                    }
                  />
                </div>
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="edit-course-sections-summer">Summer semester sections</Label>
                  <Input
                    id="edit-course-sections-summer"
                    type="number"
                    min="0"
                    max="20"
                    value={editingCourse.sectionsSummer}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        sectionsSummer: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Set to 0 if this course is not offered in summer.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Course Name</Label>
                <Input
                  value={editingCourse.name}
                  onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Academic Level</p>
                <p className="text-xs text-muted-foreground">
                  From the 3rd digit of the code (updates when you change the code).{" "}
                  <span className="font-medium text-foreground" aria-live="polite">
                    Level {editingCourse.academicLevel}
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 min-w-0">
                  <Label>Delivery Mode</Label>
                  <Select
                    value={editingCourse.deliveryMode}
                    onValueChange={(v) => setEditingCourse({ ...editingCourse, deliveryMode: v as DeliveryMode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryModeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 min-w-0">
                  <Label>Department</Label>
                  <Select
                    value={editingCourse.department}
                    onValueChange={(v) => setEditingCourse({ ...editingCourse, department: v as Department })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-course-is-lab"
                  checked={editingCourse.isLab}
                  onCheckedChange={(v) => setEditingCourse({ ...editingCourse, isLab: v === true })}
                />
                <Label htmlFor="edit-course-is-lab" className="text-sm font-normal cursor-pointer">
                  Lab course
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCourse(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditCourse} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Import Courses"
        description="Upload a CSV, Excel, or JSON file with course data."
        exampleHeaders={[
          "code",
          "name",
          "creditHours",
          "academicLevel",
          "deliveryMode",
          "department",
          "sectionsNormal",
          "sectionsSummer",
          "isLab",
        ]}
        columns={courseColumns}
        getRowKey={(row) => (typeof row.code === "string" ? row.code.toLowerCase() : "")}
        mapRow={(row: ParsedRow) => {
          const code = findColumn(row, "code", "course_code", "coursecode")
          if (!code) return null

          const dept = findColumn(row, "department", "dept", "department_name")
          if (!dept || !departments.includes(dept as Department)) return null

          const labRaw = findColumn(row, "isLab", "is_lab", "lab", "islab")
          const isLab =
            labRaw === "1" ||
            labRaw?.toLowerCase() === "true" ||
            labRaw?.toLowerCase() === "yes" ||
            labRaw?.toLowerCase() === "y"

          return {
            code,
            name: findColumn(row, "name", "course_name", "coursename") ?? "",
            creditHours: parseInt(findColumn(row, "creditHours", "credit_hours", "credithours", "credits") ?? "3", 10) || 3,
            academicLevel: academicLevelFromCourseCode(code),
            deliveryMode: parseDeliveryMode(
              findColumn(row, "deliveryMode", "delivery_mode", "deliverymode", "delivery") ?? "FACE_TO_FACE",
            ),
            department: dept as Department,
            sectionsNormal: (() => {
              const raw = findColumn(
                row,
                "sectionsNormal",
                "sections_normal",
                "numberOfSections",
                "sections",
                "section_count",
                "sectioncount",
              )
              const n = parseInt(raw ?? "1", 10)
              return Number.isFinite(n) ? Math.max(0, n) : 1
            })(),
            sectionsSummer: (() => {
              const raw = findColumn(row, "sectionsSummer", "sections_summer")
              const n = parseInt(raw ?? "0", 10)
              return Number.isFinite(n) ? Math.max(0, n) : 0
            })(),
            sectionsInLatestSchedule: 0,
            isLab,
          }
        }}
        onImport={async (data) => {
          let added = 0
          let duplicates = 0
          let errors = 0
          for (const course of data) {
            try {
              const response = await fetch('/api/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(course),
              })
              if (response.ok) {
                added++
              } else if (response.status === 409) {
                duplicates++
              } else {
                errors++
              }
            } catch (error) {
              console.error('Error importing course:', error)
              errors++
            }
          }
          if (added > 0) await fetchCourses({ showFullLoading: false })
          return { added, duplicates, errors }
        }}
      />

      <AlertDialog open={courseToDelete !== null} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive course?</AlertDialogTitle>
            <AlertDialogDescription>
              {courseToDelete
                ? `"${courseToDelete.code} - ${courseToDelete.name}" will be archived. Archived courses are excluded from future scheduling.`
                : "Archived courses are excluded from future scheduling."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteCourse}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={archivedCourseToPermanentlyDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchivedCourseToPermanentlyDelete(null)
            setArchivedCourseDeletionImpact(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete course?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will permanently remove this course and delete{" "}
                  <span className="font-semibold text-foreground">{archivedCourseDeletionImpact?.entryCount ?? 0}</span>{" "}
                  schedule entries.
                </p>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Affected Timetables
                  </p>
                  {(archivedCourseDeletionImpact?.timetables?.length ?? 0) === 0 ? (
                    <p>No timetables</p>
                  ) : (
                    <ul className="max-h-36 list-disc space-y-1 overflow-y-auto pl-5">
                      {(archivedCourseDeletionImpact?.timetables ?? []).map((t) => (
                        <li key={`${t.timetableId}-${t.versionNumber}`}>{formatTimetableLabel(t)}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="font-medium text-destructive">This cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permanentlyDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmPermanentDeleteArchivedCourse}
              disabled={permanentlyDeleting || archivedCourseDeletionImpact == null}
            >
              {permanentlyDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </EntityLayout>
    </Tabs>
  )
}
