"use client"

import { useState, useEffect, useMemo } from "react"
import { EntityLayout } from "@/components/entity-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Plus,
  Trash2,
  MoreHorizontal,
  Edit,
  Archive,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react"
import { ChevronDownIcon } from "@/components/ui/chevron-down-icon"
import { ImportIcon } from "@/components/custom-icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { slotTypes, type SlotType } from "@/lib/data"
import { ImportDialog } from "@/components/import-dialog"
import { findColumn, type ParsedRow } from "@/lib/import-utils"
import { ExportDropdownWithDialog } from "@/components/export-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TimeSlot = {
  id: number
  days: string[]
  start: string
  end: string
  slotType: SlotType
  isSummer: boolean
}

type TimeslotListFilter = "all" | "normal" | "summer"

function filterSlotsBySemester(slots: TimeSlot[], filter: TimeslotListFilter): TimeSlot[] {
  if (filter === "all") return slots
  if (filter === "summer") return slots.filter((s) => s.isSummer)
  return slots.filter((s) => !s.isSummer)
}

const allDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
type SortField = "days" | "duration"
type SortDirection = "asc" | "desc"
type WeeklyOverviewGroupBy = "days" | "type"

const getDayIndex = (day: string) => allDays.indexOf(day)

const sortDaysByWeekOrder = (days: string[]) =>
  [...days].sort((a, b) => {
    const aIndex = getDayIndex(a)
    const bIndex = getDayIndex(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

const normalizeSlotTypeLabel = (value: string) => value.trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ")

const getCanonicalSlotType = (value: string) => {
  const normalized = normalizeSlotTypeLabel(value)
  const canonicalMatch = slotTypes.find((slotType) => normalizeSlotTypeLabel(slotType) === normalized)
  return canonicalMatch ?? value.trim()
}

export default function TimeSlotsPage() {
  /** Full list from API (all semester kinds); list vs weekly filters apply client-side. */
  const [allTimeSlots, setAllTimeSlots] = useState<TimeSlot[]>([])
  const [archivedTimeSlots, setArchivedTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [tab, setTab] = useState<"active" | "archived">("active")
  const [saving, setSaving] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null)
  const [newSlot, setNewSlot] = useState<TimeSlot>({
    id: 0,
    days: [],
    start: "",
    end: "",
    slotType: "Traditional Lecture",
    isSummer: false,
  })
  const [listFilter, setListFilter] = useState<TimeslotListFilter>("all")
  const [weeklyOverviewFilter, setWeeklyOverviewFilter] =
    useState<TimeslotListFilter>("all")
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [weeklyOverviewGroupBy, setWeeklyOverviewGroupBy] = useState<WeeklyOverviewGroupBy>("days")
  const [collapsedOuterGroups, setCollapsedOuterGroups] = useState<Record<string, boolean>>({})
  const [slotToDelete, setSlotToDelete] = useState<TimeSlot | null>(null)
  const [archivedSlotToPermanentlyDelete, setArchivedSlotToPermanentlyDelete] =
    useState<TimeSlot | null>(null)
  const [archivedSlotDeletionImpact, setArchivedSlotDeletionImpact] = useState<{
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

  useEffect(() => {
    fetchTimeSlots()
  }, [])

  useEffect(() => {
    if (tab !== "archived") return
    fetchArchivedTimeSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, listFilter])

  useEffect(() => {
    if (tab !== "archived") return
    const interval = setInterval(() => {
      fetchArchivedTimeSlots()
    }, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, listFilter])

  const fetchTimeSlots = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/timeslots")
      if (!response.ok) throw new Error('Failed to fetch timeslots')
      const data = (await response.json()) as unknown[]
      const normalized: TimeSlot[] = (Array.isArray(data) ? data : []).map((raw) => {
        const row = raw as Record<string, unknown>
        return {
          id: Number(row.id),
          days: Array.isArray(row.days) ? (row.days as string[]) : [],
          start: String(row.start ?? ""),
          end: String(row.end ?? ""),
          slotType: getCanonicalSlotType(String(row.slotType ?? "Traditional Lecture")) as SlotType,
          isSummer: Boolean(row.isSummer),
        }
      })
      setAllTimeSlots(normalized)
    } catch (error) {
      console.error('Error fetching timeslots:', error)
      toast({
        title: "Error",
        description: "Failed to load time slots. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchArchivedTimeSlots = async () => {
    try {
      setLoadingArchived(true)
      const qs = listFilter !== "all" ? `?filter=${encodeURIComponent(listFilter)}` : ""
      const response = await fetch(`/api/timeslots/archived/list${qs}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to fetch archived timeslots")
      const data = (await response.json()) as unknown[]
      const normalized: TimeSlot[] = (Array.isArray(data) ? data : []).map((raw) => {
        const row = raw as Record<string, unknown>
        return {
          id: Number(row.id),
          days: Array.isArray(row.days) ? (row.days as string[]) : [],
          start: String(row.start ?? ""),
          end: String(row.end ?? ""),
          slotType: getCanonicalSlotType(String(row.slotType ?? "Traditional Lecture")) as SlotType,
          isSummer: Boolean(row.isSummer),
        }
      })
      setArchivedTimeSlots(normalized)
    } catch (error) {
      console.error("Error fetching archived timeslots:", error)
      toast({
        title: "Error",
        description: "Failed to load archived time slots. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingArchived(false)
    }
  }

  const handleAddSlot = async () => {
    if (newSlot.days.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one day.", variant: "destructive" })
      return
    }
    if (!newSlot.start) {
      toast({ title: "Validation Error", description: "Start time is required.", variant: "destructive" })
      return
    }
    if (!newSlot.end) {
      toast({ title: "Validation Error", description: "End time is required.", variant: "destructive" })
      return
    }

    // Frontend validation: end time must be after start time
    const [startH, startM] = newSlot.start.split(":").map(Number)
    const [endH, endM] = newSlot.end.split(":").map(Number)
    if (endH * 60 + endM <= startH * 60 + startM) {
      toast({ title: "Validation Error", description: "End time must be after start time.", variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/timeslots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: newSlot.days,
          start: newSlot.start,
          end: newSlot.end,
          slotType: newSlot.slotType,
          isSummer: newSlot.isSummer,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to create time slot. Please try again.",
          variant: "destructive",
        })
        return
      }

      setAllTimeSlots([
        ...allTimeSlots,
        {
          ...data,
          isSummer: Boolean((data as { isSummer?: boolean }).isSummer),
        } as TimeSlot,
      ])
      setNewSlot({ id: 0, days: [], start: "", end: "", slotType: "Traditional Lecture", isSummer: false })
      setIsAddDialogOpen(false)
      toast({
        title: "Success",
        description: "Time slot created successfully.",
      })
    } catch (error) {
      console.error('Error creating timeslot:', error)
      toast({
        title: "Error",
        description: "Failed to create time slot. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEditSlot = async () => {
    if (!editingSlot) return

    if (editingSlot.days.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one day.", variant: "destructive" })
      return
    }
    if (!editingSlot.start) {
      toast({ title: "Validation Error", description: "Start time is required.", variant: "destructive" })
      return
    }
    if (!editingSlot.end) {
      toast({ title: "Validation Error", description: "End time is required.", variant: "destructive" })
      return
    }

    // Frontend validation: end time must be after start time
    const [startH, startM] = editingSlot.start.split(":").map(Number)
    const [endH, endM] = editingSlot.end.split(":").map(Number)
    if (endH * 60 + endM <= startH * 60 + startM) {
      toast({ title: "Validation Error", description: "End time must be after start time.", variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`/api/timeslots/${editingSlot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: editingSlot.days,
          start: editingSlot.start,
          end: editingSlot.end,
          slotType: editingSlot.slotType,
          isSummer: editingSlot.isSummer,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to update time slot. Please try again.",
          variant: "destructive",
        })
        return
      }

      setAllTimeSlots(
        allTimeSlots.map((s) =>
          s.id === editingSlot.id
            ? ({ ...data, isSummer: Boolean((data as { isSummer?: boolean }).isSummer) } as TimeSlot)
            : s,
        ),
      )
      setEditingSlot(null)
      toast({
        title: "Success",
        description: "Time slot updated successfully.",
      })
    } catch (error) {
      console.error('Error updating timeslot:', error)
      toast({
        title: "Error",
        description: "Failed to update time slot. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const tableSlots = useMemo(
    () => filterSlotsBySemester(allTimeSlots, listFilter),
    [allTimeSlots, listFilter],
  )

  const overviewSlots = useMemo(
    () => filterSlotsBySemester(allTimeSlots, weeklyOverviewFilter),
    [allTimeSlots, weeklyOverviewFilter],
  )

  const handleDeleteSlot = async (slot: TimeSlot) => {
    try {
      const response = await fetch(`/api/timeslots/${slot.id}`, {
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
          description: errorMessage || "Failed to archive time slot. Please try again.",
          variant: "destructive",
        })
        return
      }

      setAllTimeSlots(allTimeSlots.filter((s) => s.id !== slot.id))
      await fetchArchivedTimeSlots()
      toast({
        title: "Success",
        description: `${slot.days.join(", ")} ${slot.start}-${slot.end} archived — it won't be used in future scheduling`,
      })
    } catch (error) {
      console.error('Error deleting timeslot:', error)
      toast({
        title: "Error",
        description: "Failed to archive time slot. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRestoreArchivedSlot = async (slot: TimeSlot) => {
    try {
      const response = await fetch(`/api/timeslots/${slot.id}/restore`, { method: "PATCH" })
      const data = await response.json()
      const errorMessage =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) ? data.message.join(", ") : undefined) ||
        data?.error

      if (!response.ok) {
        toast({
          title: "Error",
          description: errorMessage || "Failed to restore time slot. Please try again.",
          variant: "destructive",
        })
        return
      }

      setArchivedTimeSlots((prev) => prev.filter((s) => s.id !== slot.id))
      await fetchTimeSlots()
      toast({ title: "Success", description: "Time slot restored successfully." })
    } catch (error) {
      console.error("Error restoring timeslot:", error)
      toast({
        title: "Error",
        description: "Failed to restore time slot. Please try again.",
        variant: "destructive",
      })
    }
  }

  const openPermanentDeleteSlotModal = async (slot: TimeSlot) => {
    try {
      setLoadingDeletionImpact(true)
      const response = await fetch(`/api/timeslots/${slot.id}/deletion-impact`, { cache: "no-store" })
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

      setArchivedSlotToPermanentlyDelete(slot)
      setArchivedSlotDeletionImpact({
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
      console.error("Error checking timeslot deletion impact:", error)
      toast({
        title: "Error",
        description: "Failed to check deletion impact. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingDeletionImpact(false)
    }
  }

  const confirmPermanentDeleteArchivedSlot = async () => {
    if (!archivedSlotToPermanentlyDelete) return
    try {
      setPermanentlyDeleting(true)
      const response = await fetch(`/api/timeslots/${archivedSlotToPermanentlyDelete.id}/permanent`, {
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
          description: errorMessage || "Failed to permanently delete time slot. Please try again.",
          variant: "destructive",
        })
        return
      }

      setArchivedTimeSlots((prev) => prev.filter((s) => s.id !== archivedSlotToPermanentlyDelete.id))
      setArchivedSlotToPermanentlyDelete(null)
      setArchivedSlotDeletionImpact(null)
      toast({ title: "Success", description: "Time slot permanently deleted successfully." })
    } catch (error) {
      console.error("Error permanently deleting timeslot:", error)
      toast({
        title: "Error",
        description: "Failed to permanently delete time slot. Please try again.",
        variant: "destructive",
      })
    } finally {
      setPermanentlyDeleting(false)
    }
  }

  const confirmDeleteSlot = async () => {
    if (!slotToDelete) return
    await handleDeleteSlot(slotToDelete)
    setSlotToDelete(null)
  }

  const toggleDay = (day: string, slot: TimeSlot, setSlot: (s: TimeSlot) => void) => {
    const newDays = slot.days.includes(day) ? slot.days.filter((d) => d !== day) : [...slot.days, day]
    setSlot({ ...slot, days: newDays })
  }

  const getDayColor = (day: string) => {
    const colors: Record<string, string> = {
      Sunday: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      Monday: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      Tuesday: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      Wednesday: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      Thursday: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    }
    return colors[day] || "bg-gray-100 text-gray-800"
  }

  const getSlotTypeColor = (type: SlotType) => {
    const normalizedType = type.toLowerCase().replace(/[_-]/g, " ").trim()
    const slotTypeColors: Record<string, string> = {
      lecture: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      "traditional lecture": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      lab: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      "blended lecture": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
      tutorial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      seminar: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
      workshop: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
      online: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    }
    return slotTypeColors[normalizedType] || "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
  }

  // Calculate duration in hours and minutes
  const calculateDuration = (start: string, end: string) => {
    const [startH, startM] = start.split(":").map(Number)
    const [endH, endM] = end.split(":").map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    const diff = endMinutes - startMinutes
    const hours = Math.floor(diff / 60)
    const minutes = diff % 60
    if (hours === 0) return `${minutes} min`
    if (minutes === 0) return `${hours} hr${hours !== 1 ? "s" : ""}`
    return `${hours} hr${hours !== 1 ? "s" : ""} ${minutes} min`
  }

  const getDurationMinutes = (start: string, end: string) => {
    const [startH, startM] = start.split(":").map(Number)
    const [endH, endM] = end.split(":").map(Number)
    return endH * 60 + endM - (startH * 60 + startM)
  }

  const getDaySortValue = (days: string[]) => {
    const dayIndexes = days.map((d) => allDays.indexOf(d)).filter((i) => i >= 0)
    const firstIndex = dayIndexes.length > 0 ? Math.min(...dayIndexes) : Number.MAX_SAFE_INTEGER
    return { firstIndex, count: days.length, label: sortDaysByWeekOrder(days).join(",") }
  }

  const handleSort = (field: SortField) => {
    setCurrentPage(1)
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortField(field)
    setSortDirection("asc")
  }

  const toggleOuterGroup = (groupId: string) => {
    setCollapsedOuterGroups((prev) => ({
      ...prev,
      [groupId]: !(prev[groupId] ?? true),
    }))
  }

  const sortedTimeSlots = useMemo(() => {
    if (!sortField) return tableSlots

    return [...tableSlots].sort((a, b) => {
      let comparison = 0

      if (sortField === "duration") {
        comparison = getDurationMinutes(a.start, a.end) - getDurationMinutes(b.start, b.end)
        if (comparison === 0) {
          const aDays = getDaySortValue(a.days)
          const bDays = getDaySortValue(b.days)
          comparison = aDays.firstIndex - bDays.firstIndex
          if (comparison === 0) comparison = aDays.count - bDays.count
          if (comparison === 0) comparison = aDays.label.localeCompare(bDays.label)
        }
        if (comparison === 0) comparison = a.start.localeCompare(b.start)
        if (comparison === 0) comparison = a.id - b.id
      } else {
        const aDays = getDaySortValue(a.days)
        const bDays = getDaySortValue(b.days)
        comparison = aDays.firstIndex - bDays.firstIndex
        if (comparison === 0) comparison = aDays.count - bDays.count
        if (comparison === 0) comparison = aDays.label.localeCompare(bDays.label)
        if (comparison === 0)
          comparison = getDurationMinutes(a.start, a.end) - getDurationMinutes(b.start, b.end)
        if (comparison === 0) comparison = a.start.localeCompare(b.start)
        if (comparison === 0) comparison = a.id - b.id
      }

      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [tableSlots, sortField, sortDirection])

  const weeklyOverviewGroups = useMemo(() => {
    const sortedByStart = (slots: TimeSlot[]) =>
      [...slots].sort((a, b) => {
        const startCompare = a.start.localeCompare(b.start)
        if (startCompare !== 0) return startCompare
        const endCompare = a.end.localeCompare(b.end)
        if (endCompare !== 0) return endCompare
        return a.id - b.id
      })

    const outerGroups = overviewSlots.reduce(
      (acc, slot) => {
        const key = weeklyOverviewGroupBy === "days" ? sortDaysByWeekOrder(slot.days).join("-") : getCanonicalSlotType(slot.slotType)
        if (!acc[key]) acc[key] = []
        acc[key].push(slot)
        return acc
      },
      {} as Record<string, TimeSlot[]>
    )

    return Object.entries(outerGroups)
      .sort(([a], [b]) => {
        if (weeklyOverviewGroupBy === "days") {
          const firstDayA = a.split("-")[0] ?? ""
          const firstDayB = b.split("-")[0] ?? ""
          const dayCompare = getDayIndex(firstDayA) - getDayIndex(firstDayB)
          if (dayCompare !== 0) return dayCompare
          return a.localeCompare(b)
        }

        const slotTypeAIndex = slotTypes.findIndex((slotType) => slotType === a)
        const slotTypeBIndex = slotTypes.findIndex((slotType) => slotType === b)
        if (slotTypeAIndex !== -1 || slotTypeBIndex !== -1) {
          if (slotTypeAIndex === -1) return 1
          if (slotTypeBIndex === -1) return -1
          if (slotTypeAIndex !== slotTypeBIndex) return slotTypeAIndex - slotTypeBIndex
        }
        return a.localeCompare(b)
      })
      .map(([groupKey, slots]) => {
        if (weeklyOverviewGroupBy === "days") {
          const innerGroups = slotTypes.map((slotType) => ({
            key: slotType,
            slots: sortedByStart(slots.filter((slot) => getCanonicalSlotType(slot.slotType) === slotType)),
          }))
          return { groupKey, slots: sortedByStart(slots), innerGroups }
        }

        const groupedByDayPattern = slots.reduce(
          (acc, slot) => {
            const dayPattern = sortDaysByWeekOrder(slot.days).join("-")
            if (!acc[dayPattern]) acc[dayPattern] = []
            acc[dayPattern].push(slot)
            return acc
          },
          {} as Record<string, TimeSlot[]>
        )

        const innerGroups = Object.entries(groupedByDayPattern)
          .sort(([a], [b]) => {
            const patternADays = a.split("-")
            const patternBDays = b.split("-")
            const firstDayCompare = getDayIndex(patternADays[0] ?? "") - getDayIndex(patternBDays[0] ?? "")
            if (firstDayCompare !== 0) return firstDayCompare
            if (patternADays.length !== patternBDays.length) return patternADays.length - patternBDays.length
            return a.localeCompare(b)
          })
          .map(([dayPattern, groupedSlots]) => ({
            key: dayPattern,
            slots: sortedByStart(groupedSlots),
          }))
        return { groupKey, slots: sortedByStart(slots), innerGroups }
      })
  }, [overviewSlots, weeklyOverviewGroupBy])

  const totalPages = Math.ceil(sortedTimeSlots.length / pageSize)
  const maxPage = totalPages || 1
  const paginatedTimeSlots = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedTimeSlots.slice(start, start + pageSize)
  }, [sortedTimeSlots, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, maxPage))
  }, [maxPage])

  if (loading) {
    return (
      <EntityLayout
      title="Time Slot Management"
      description="Add, edit, and manage Time slots."
    >
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
        title="Time Slot Management"
        description="Add, edit, and manage Time slots."
        headerActions={
          <TabsList>
            <TabsTrigger value="active">Time Slots</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="active">
          <div className="flex flex-col gap-6">
            <Card className="gap-2 py-4">
          <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
            <CardTitle>
              Time Slots ({tableSlots.length}
              {listFilter !== "all" ? (
                <span className="text-sm font-normal text-muted-foreground"> of {allTimeSlots.length}</span>
              ) : null}
              )
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">List filter</span>
                <Select
                  value={listFilter}
                  onValueChange={(v) => setListFilter(v as TimeslotListFilter)}
                >
                  <SelectTrigger className="h-9 w-[200px]" aria-label="Timeslot list semester filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="normal">Normal (1st / 2nd semester)</SelectItem>
                    <SelectItem value="summer">Summer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setIsImportDialogOpen(true)}>
                <ImportIcon className="mr-2 h-4 w-4" />
                Import
              </Button>
              <ExportDropdownWithDialog
                allData={sortedTimeSlots.map((s) => ({
                  ...s,
                  days: s.days.join(", "),
                  isSummer: s.isSummer ? "Summer" : "1st/2nd",
                }))}
                filteredData={paginatedTimeSlots.map((s) => ({
                  ...s,
                  days: s.days.join(", "),
                  isSummer: s.isSummer ? "Summer" : "1st/2nd",
                }))}
                columns={[
                  { key: "days" as const, label: "Days" },
                  { key: "start" as const, label: "Start" },
                  { key: "end" as const, label: "End" },
                  { key: "slotType" as const, label: "Type" },
                  { key: "isSummer" as const, label: "Semester" },
                ]}
                filenamePrefix="timeslots"
                pdfTitle="Time Slots"
                totalLabel={`${allTimeSlots.length}`}
                filteredLabel={`${paginatedTimeSlots.length}`}
                isFiltered={sortField != null || listFilter !== "all"}
                filterDescription={
                  [
                    listFilter !== "all" ? `list: ${listFilter}` : null,
                    sortField ? `sort: ${sortField} ${sortDirection}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
              />
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Time Slot
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Time Slot</DialogTitle>
                    <DialogDescription>
                      Choose whether this pattern applies to the summer semester or to first/second semester
                      (normal) scheduling.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Days</Label>
                      <div className="flex flex-wrap gap-3">
                        {allDays.map((day) => (
                          <div key={day} className="flex items-center space-x-2">
                            <Checkbox
                              id={`new-day-${day}`}
                              checked={newSlot.days.includes(day)}
                              onCheckedChange={() => toggleDay(day, newSlot, setNewSlot)}
                            />
                            <label htmlFor={`new-day-${day}`} className="text-sm">
                              {day.slice(0, 3)}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="slot-start">Start Time</Label>
                        <Input
                          id="slot-start"
                          type="time"
                          value={newSlot.start}
                          onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slot-end">End Time</Label>
                        <Input
                          id="slot-end"
                          type="time"
                          value={newSlot.end}
                          onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })}
                          className={
                            newSlot.start && newSlot.end &&
                            (() => { const [sh, sm] = newSlot.start.split(":").map(Number); const [eh, em] = newSlot.end.split(":").map(Number); return eh * 60 + em <= sh * 60 + sm })()
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }
                        />
                        {newSlot.start && newSlot.end && (() => {
                          const [sh, sm] = newSlot.start.split(":").map(Number)
                          const [eh, em] = newSlot.end.split(":").map(Number)
                          return eh * 60 + em <= sh * 60 + sm
                        })() && (
                          <p className="text-xs text-destructive">End time must be after start time</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slot-type">Slot Type</Label>
                      <Select
                        value={newSlot.slotType}
                        onValueChange={(v) => setNewSlot({ ...newSlot, slotType: v as SlotType })}
                      >
                        <SelectTrigger id="slot-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {slotTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Semester</Label>
                      <RadioGroup
                        value={newSlot.isSummer ? "summer" : "normal"}
                        onValueChange={(v) =>
                          setNewSlot({ ...newSlot, isSummer: v === "summer" })
                        }
                        className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="normal" id="new-slot-sem-normal" />
                          <Label htmlFor="new-slot-sem-normal" className="cursor-pointer text-sm font-normal">
                            First or second semester
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="summer" id="new-slot-sem-summer" />
                          <Label htmlFor="new-slot-sem-summer" className="cursor-pointer text-sm font-normal">
                            Summer semester
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddSlot} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Time Slot
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 font-medium hover:text-foreground",
                          sortField === "days" ? "text-foreground" : "text-muted-foreground",
                        )}
                        onClick={() => handleSort("days")}
                      >
                        Days
                        {sortField === "days" ? (
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
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 font-medium hover:text-foreground",
                          sortField === "duration" ? "text-foreground" : "text-muted-foreground",
                        )}
                        onClick={() => handleSort("duration")}
                      >
                        Duration
                        {sortField === "duration" ? (
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
                    <TableHead>Type</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTimeSlots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No time slots found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTimeSlots.map((slot) => (
                      <TableRow key={slot.id}>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {slot.days.map((day) => (
                              <Badge key={day} className={getDayColor(day)}>
                                {day.slice(0, 3)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{slot.start}</TableCell>
                        <TableCell>{slot.end}</TableCell>
                        <TableCell>{calculateDuration(slot.start, slot.end)}</TableCell>
                        <TableCell>
                          <Badge className={getSlotTypeColor(slot.slotType)}>{slot.slotType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              slot.isSummer
                                ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"
                                : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                            }
                          >
                            {slot.isSummer ? "Summer" : "1st/2nd"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingSlot({ ...slot })}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive hover:text-destructive focus:text-destructive data-[highlighted]:text-destructive"
                                onClick={() => setSlotToDelete(slot)}
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
                  <SelectTrigger className="h-8 w-[80px]">
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

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="space-y-1">
                <CardTitle>
                  Weekly Overview ({overviewSlots.length}
                  {weeklyOverviewFilter !== "all" ? (
                    <span className="text-sm font-normal text-muted-foreground"> of {allTimeSlots.length}</span>
                  ) : null}
                  )
                </CardTitle>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="weekly-overview-sem-filter" className="text-sm text-muted-foreground whitespace-nowrap">
                    Show
                  </Label>
                  <Select
                    value={weeklyOverviewFilter}
                    onValueChange={(v) => setWeeklyOverviewFilter(v as TimeslotListFilter)}
                  >
                    <SelectTrigger id="weekly-overview-sem-filter" className="h-8 w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="normal">Normal (1st / 2nd semester)</SelectItem>
                      <SelectItem value="summer">Summer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="weekly-overview-group-by" className="text-sm text-muted-foreground whitespace-nowrap">
                    Group by
                  </Label>
                  <Select
                    value={weeklyOverviewGroupBy}
                    onValueChange={(value) => setWeeklyOverviewGroupBy(value as WeeklyOverviewGroupBy)}
                  >
                    <SelectTrigger id="weekly-overview-group-by" className="h-8 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="type">Type</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weeklyOverviewGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {allTimeSlots.length === 0
                    ? "No time slots configured yet."
                    : "No slots match this weekly overview filter — try “All” or another semester."}
                </p>
              ) : (
                weeklyOverviewGroups.map(({ groupKey, slots, innerGroups }) => (
                  <div key={groupKey} className="space-y-2">
                    {(() => {
                      const groupId = `${weeklyOverviewGroupBy}:${groupKey}`
                      const isCollapsed = collapsedOuterGroups[groupId] ?? true
                      return (
                        <>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded-md p-1 text-left hover:bg-muted/40"
                            onClick={() => toggleOuterGroup(groupId)}
                            aria-expanded={!isCollapsed}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              {weeklyOverviewGroupBy === "days" ? (
                                groupKey.split("-").map((day) => (
                                  <Badge key={day} className={cn(getDayColor(day), "text-xs font-medium")}>
                                    {day.slice(0, 3)}
                                  </Badge>
                                ))
                              ) : (
                                <Badge className={cn(getSlotTypeColor(groupKey as SlotType), "text-xs font-medium")}>{groupKey}</Badge>
                              )}
                              <span className="text-sm text-muted-foreground">{slots.length} slots</span>
                            </div>
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDownIcon
                                size={16}
                                className="h-4 w-4 text-muted-foreground"
                              />
                            )}
                          </button>
                          {!isCollapsed && (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                              {innerGroups.map(({ key, slots: innerSlots }) => (
                                <div
                                  key={`${groupKey}-${key}`}
                                  className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3 ml-6"
                                >
                                  <div className="flex items-center gap-2">
                                    {weeklyOverviewGroupBy === "days" ? (
                                      <Badge className={getSlotTypeColor(key as SlotType)}>{key}</Badge>
                                    ) : (
                                      <div className="flex flex-wrap gap-1">
                                        {key.split("-").map((day) => (
                                          <Badge key={`${groupKey}-${key}-${day}`} className={getDayColor(day)}>
                                            {day.slice(0, 3)}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                    <span className="text-xs text-muted-foreground">{innerSlots.length} slots</span>
                                  </div>
                                  {innerSlots.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No slots</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {innerSlots.map((slot) => (
                                        <div
                                          key={slot.id}
                                          className="rounded-md border bg-muted/50 px-3 py-1 text-sm flex items-center gap-2"
                                        >
                                          <span>
                                            {slot.start} - {slot.end}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <CardTitle>Archived Time Slots ({archivedTimeSlots.length})</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">List filter</span>
                  <Select
                    value={listFilter}
                    onValueChange={(v) => setListFilter(v as TimeslotListFilter)}
                  >
                    <SelectTrigger className="h-9 w-[200px]" aria-label="Archived timeslot list semester filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="normal">Normal (1st / 2nd semester)</SelectItem>
                      <SelectItem value="summer">Summer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {loadingArchived ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>
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
                        <TableHead>Days</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Semester</TableHead>
                        <TableHead className="w-[70px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedTimeSlots.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No archived time slots
                          </TableCell>
                        </TableRow>
                      ) : (
                        archivedTimeSlots.map((slot) => (
                          <TableRow key={slot.id}>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {slot.days.map((day) => (
                                  <Badge key={day} className={getDayColor(day)}>
                                    {day.slice(0, 3)}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>{slot.start}</TableCell>
                            <TableCell>{slot.end}</TableCell>
                            <TableCell>
                              <Badge className={getSlotTypeColor(slot.slotType)}>{slot.slotType}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  slot.isSummer
                                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"
                                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                                }
                              >
                                {slot.isSummer ? "Summer" : "1st/2nd"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleRestoreArchivedSlot(slot)}>
                                    Restore
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openPermanentDeleteSlotModal(slot)}
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
      <Dialog open={!!editingSlot} onOpenChange={(open) => !open && setEditingSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Slot</DialogTitle>
            <DialogDescription>Update the time slot information.</DialogDescription>
          </DialogHeader>
          {editingSlot && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Days</Label>
                <div className="flex flex-wrap gap-3">
                  {allDays.map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-day-${day}`}
                        checked={editingSlot.days.includes(day)}
                        onCheckedChange={() => toggleDay(day, editingSlot, setEditingSlot)}
                      />
                      <label htmlFor={`edit-day-${day}`} className="text-sm">
                        {day.slice(0, 3)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={editingSlot.start}
                    onChange={(e) => setEditingSlot({ ...editingSlot, start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={editingSlot.end}
                    onChange={(e) => setEditingSlot({ ...editingSlot, end: e.target.value })}
                    className={
                      editingSlot.start && editingSlot.end &&
                      (() => { const [sh, sm] = editingSlot.start.split(":").map(Number); const [eh, em] = editingSlot.end.split(":").map(Number); return eh * 60 + em <= sh * 60 + sm })()
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }
                  />
                  {editingSlot.start && editingSlot.end && (() => {
                    const [sh, sm] = editingSlot.start.split(":").map(Number)
                    const [eh, em] = editingSlot.end.split(":").map(Number)
                    return eh * 60 + em <= sh * 60 + sm
                  })() && (
                    <p className="text-xs text-destructive">End time must be after start time</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Slot Type</Label>
                <Select
                  value={editingSlot.slotType}
                  onValueChange={(v) => setEditingSlot({ ...editingSlot, slotType: v as SlotType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {slotTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Semester</Label>
                <RadioGroup
                  value={editingSlot.isSummer ? "summer" : "normal"}
                  onValueChange={(v) =>
                    setEditingSlot({ ...editingSlot, isSummer: v === "summer" })
                  }
                  className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="normal" id="edit-slot-sem-normal" />
                    <Label htmlFor="edit-slot-sem-normal" className="cursor-pointer text-sm font-normal">
                      First or second semester
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="summer" id="edit-slot-sem-summer" />
                    <Label htmlFor="edit-slot-sem-summer" className="cursor-pointer text-sm font-normal">
                      Summer semester
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSlot(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSlot} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Import Time Slots"
        description="Upload a CSV, Excel, or JSON file with time slot data."
        exampleHeaders={["days", "start", "end", "slotType", "isSummer"]}
        columns={[
          { key: "id", label: "ID" },
          { key: "days", label: "Days" },
          { key: "start", label: "Start" },
          { key: "end", label: "End" },
          { key: "slotType", label: "Type" },
          { key: "isSummer", label: "Semester" },
        ]}
        getRowKey={(row) => {
          const days = [...row.days].sort().join(",")
          return `${days}|${row.start}|${row.end}`.toLowerCase()
        }}
        mapRow={(row: ParsedRow, index: number) => {
          const daysStr = findColumn(row, "days", "day", "day_of_week", "dayofweek")
          const start = findColumn(row, "start", "start_time", "starttime", "from")
          const end = findColumn(row, "end", "end_time", "endtime", "to")
          if (!daysStr || !start || !end) return null
          const days = daysStr.split(",").map((d) => d.trim()).filter((d) => allDays.includes(d))
          if (days.length === 0) return null
          const slotType = (findColumn(row, "slotType", "slot_type", "slottype", "type") ?? "Traditional Lecture") as SlotType
          const summerRaw = findColumn(row, "isSummer", "is_summer", "summer", "semester_type")
          const isSummer =
            summerRaw?.toLowerCase() === "true" ||
            summerRaw === "1" ||
            summerRaw?.toLowerCase() === "summer" ||
            summerRaw?.toLowerCase() === "yes"
          return {
            id: allTimeSlots.length + index + 1,
            days,
            start,
            end,
            slotType: slotTypes.includes(slotType) ? slotType : "Traditional Lecture",
            isSummer,
          }
        }}
        onImport={async (data) => {
          let added = 0
          let duplicates = 0
          let errors = 0
          for (const slot of data) {
            try {
              const response = await fetch('/api/timeslots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slot),
              })
              if (response.ok) {
                const created = await response.json()
                setAllTimeSlots((prev) => [...prev, created])
                added++
              } else if (response.status === 409) {
                duplicates++
              } else {
                errors++
              }
            } catch (error) {
              console.error('Error importing timeslot:', error)
              errors++
            }
          }
          return { added, duplicates, errors }
        }}
      />

      <AlertDialog open={slotToDelete !== null} onOpenChange={(open) => !open && setSlotToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive time slot?</AlertDialogTitle>
            <AlertDialogDescription>
              {slotToDelete
                ? `"${slotToDelete.days.join(", ")} ${slotToDelete.start}-${slotToDelete.end}" will be archived. Archived time slots are excluded from future scheduling.`
                : "Archived time slots are excluded from future scheduling."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteSlot}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={archivedSlotToPermanentlyDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchivedSlotToPermanentlyDelete(null)
            setArchivedSlotDeletionImpact(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete time slot?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will permanently remove this timeslot and delete{" "}
                  <span className="font-semibold text-foreground">{archivedSlotDeletionImpact?.entryCount ?? 0}</span>{" "}
                  schedule entries.
                </p>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Affected Timetables
                  </p>
                  {(archivedSlotDeletionImpact?.timetables?.length ?? 0) === 0 ? (
                    <p>No timetables</p>
                  ) : (
                    <ul className="max-h-36 list-disc space-y-1 overflow-y-auto pl-5">
                      {(archivedSlotDeletionImpact?.timetables ?? []).map((t) => (
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
              onClick={confirmPermanentDeleteArchivedSlot}
              disabled={permanentlyDeleting || archivedSlotDeletionImpact == null}
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
