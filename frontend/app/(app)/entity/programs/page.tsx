"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import useSWR from "swr"
import { EntityLayout } from "@/components/entity-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, Trash2, Loader2, MoreHorizontal, GraduationCap, ArrowRightLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type CourseBasic = {
  id: number
  code: string
  name: string
  department: string
  creditHours?: number
}

function normalizeCourseCodeKey(value: string | number): string {
  return String(value).trim()
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : word))
    .join(" ")
}

type ProgramStructure = {
  [programName: string]: {
    [year: string]: {
      [semester: string]: number[]
    }
  }
}

const COURSE_PLACEHOLDERS: Record<number, { name: string; creditHours: number }> = {
  0: { name: "Elective University Requirements", creditHours: 3 },
  1: { name: "Elective Program Requirements", creditHours: 3 },
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function ProgramsPage() {
  const { data: programsData, error: programsError, mutate: mutatePrograms } = useSWR<ProgramStructure>("/api/programs", fetcher)
  const { data: coursesCatalog, error: coursesError } = useSWR("/api/courses/catalog", fetcher)
  
  const [localPrograms, setLocalPrograms] = useState<ProgramStructure | null>(null)
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [openCoursePicker, setOpenCoursePicker] = useState(false)
  const [moveDialog, setMoveDialog] = useState<{ courseRef: number } | null>(null)
  const [moveToYear, setMoveToYear] = useState<string>("")
  const [moveToSemester, setMoveToSemester] = useState<string>("")
  const { toast } = useToast()

  const persistPrograms = async (next: ProgramStructure, previous: ProgramStructure) => {
    setSaving(true)
    try {
      const response = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
      if (!response.ok) throw new Error("Failed to save programs")
      await mutatePrograms(next, { revalidate: false })
    } catch (error) {
      console.error("Error saving programs:", error)
      setLocalPrograms(previous)
      toast({
        title: "Could not save",
        description: "Your change was reverted. Please try again.",
        variant: "destructive",
      })
      throw error
    } finally {
      setSaving(false)
    }
  }

  // Initialize local programs state when data arrives
  useEffect(() => {
    if (programsData && !localPrograms) {
      setLocalPrograms(programsData)
      const firstProgram = Object.keys(programsData)[0]
      if (firstProgram) {
        setSelectedProgram(firstProgram)
        const years = Object.keys(programsData[firstProgram]).sort()
        const firstYear = years[0]
        if (firstYear) {
          setSelectedYear(firstYear)
          const semesters = Object.keys(programsData[firstProgram][firstYear]).sort()
          const firstSemester = semesters[0]
          if (firstSemester) {
            setSelectedSemester(firstSemester)
          }
        }
      }
    }
  }, [programsData, localPrograms])

  const courses = useMemo(() => {
    if (!coursesCatalog || !coursesCatalog.courses) return []
    return coursesCatalog.courses as CourseBasic[]
  }, [coursesCatalog])

  /** Programs JSON may list either DB `course_id` or numeric `course_code`; resolve against the catalog. */
  const resolveCatalogCourse = useMemo(() => {
    const byId = new Map<number, CourseBasic>()
    const byCode = new Map<string, CourseBasic>()
    for (const c of courses) {
      byId.set(c.id, c)
      const k = normalizeCourseCodeKey(c.code)
      if (!byCode.has(k)) byCode.set(k, c)
    }
    return (ref: number): CourseBasic | null => {
      const direct = byId.get(ref)
      if (direct) return direct
      return byCode.get(normalizeCourseCodeKey(ref)) ?? null
    }
  }, [courses])

  const catalogRefMatchesCourse = useCallback(
    (ref: number, c: CourseBasic): boolean => {
      if (c.id === ref) return true
      if (normalizeCourseCodeKey(c.code) === normalizeCourseCodeKey(ref)) return true
      const resolved = resolveCatalogCourse(ref)
      return resolved?.id === c.id
    },
    [resolveCatalogCourse],
  )

  /** Whether two stored refs refer to the same catalog course (id vs numeric code). */
  const sameCatalogEntry = useCallback(
    (refA: number, refB: number): boolean => {
      if (refA === refB) return true
      const a = resolveCatalogCourse(refA)
      const b = resolveCatalogCourse(refB)
      if (a && b) return a.id === b.id
      if (a && !b) return normalizeCourseCodeKey(refB) === normalizeCourseCodeKey(a.code)
      if (!a && b) return normalizeCourseCodeKey(refA) === normalizeCourseCodeKey(b.code)
      return normalizeCourseCodeKey(refA) === normalizeCourseCodeKey(refB)
    },
    [resolveCatalogCourse],
  )

  const resolveSemesterCourseDisplay = useCallback(
    (ref: number) => {
      const placeholder = COURSE_PLACEHOLDERS[ref]
      if (placeholder) {
        return {
          code: "",
          name: placeholder.name,
          creditHours: placeholder.creditHours,
        }
      }

      const course = resolveCatalogCourse(ref)
      if (course) {
        return {
          code: course.code,
          name: toTitleCase(course.name),
          creditHours: typeof course.creditHours === "number" ? course.creditHours : null,
        }
      }

      return {
        code: "",
        name: "Unknown course",
        creditHours: null,
      }
    },
    [resolveCatalogCourse],
  )

  const filteredPrograms = useMemo(() => {
    if (!localPrograms) return []
    return Object.keys(localPrograms).filter(p => 
      p.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort()
  }, [localPrograms, searchQuery])

  const handleAddCourse = async (courseId: number) => {
    if (!localPrograms || !selectedProgram || !selectedYear || !selectedSemester) return

    const currentCourses = localPrograms[selectedProgram][selectedYear][selectedSemester] || []
    if (currentCourses.some((ref) => sameCatalogEntry(ref, courseId))) {
      toast({
        title: "Course already added",
        description: "This course is already in this semester.",
        variant: "destructive",
      })
      return
    }

    const previous = localPrograms
    const updatedPrograms = { ...localPrograms }
    updatedPrograms[selectedProgram] = { ...updatedPrograms[selectedProgram] }
    updatedPrograms[selectedProgram][selectedYear] = { ...updatedPrograms[selectedProgram][selectedYear] }
    updatedPrograms[selectedProgram][selectedYear][selectedSemester] = [...currentCourses, courseId]

    setLocalPrograms(updatedPrograms)
    setOpenCoursePicker(false)
    try {
      await persistPrograms(updatedPrograms, previous)
      toast({
        title: "Course added",
        description: `Saved to ${selectedProgram} · ${selectedYear} · ${selectedSemester}.`,
      })
    } catch {
      /* persistPrograms already surfaced toast + reverted */
    }
  }

  const handleRemoveCourse = async (courseId: number) => {
    if (!localPrograms || !selectedProgram || !selectedYear || !selectedSemester) return

    const previous = localPrograms
    const updatedPrograms = { ...localPrograms }
    updatedPrograms[selectedProgram] = { ...updatedPrograms[selectedProgram] }
    updatedPrograms[selectedProgram][selectedYear] = { ...updatedPrograms[selectedProgram][selectedYear] }
    updatedPrograms[selectedProgram][selectedYear][selectedSemester] =
      updatedPrograms[selectedProgram][selectedYear][selectedSemester].filter((id) => id !== courseId)

    setLocalPrograms(updatedPrograms)
    try {
      await persistPrograms(updatedPrograms, previous)
    } catch {
      /* persistPrograms already surfaced toast + reverted */
    }
  }

  const currentSemesterCourses = useMemo(() => {
    if (!localPrograms || !selectedProgram || !selectedYear || !selectedSemester) return []
    return localPrograms[selectedProgram][selectedYear][selectedSemester] || []
  }, [localPrograms, selectedProgram, selectedYear, selectedSemester])

  const currentSemesterCreditHours = useMemo(
    () =>
      currentSemesterCourses.reduce((total, ref) => {
        const display = resolveSemesterCourseDisplay(ref)
        return total + (display.creditHours ?? 0)
      }, 0),
    [currentSemesterCourses, resolveSemesterCourseDisplay],
  )

  const coursesAvailableToAdd = useMemo(
    () => courses.filter((c) => !currentSemesterCourses.some((ref) => catalogRefMatchesCourse(ref, c))),
    [courses, currentSemesterCourses, catalogRefMatchesCourse],
  )

  const openMoveDialog = (courseRef: number) => {
    if (!localPrograms || !selectedProgram || !selectedYear || !selectedSemester) return
    const programYears = Object.keys(localPrograms[selectedProgram]).sort()
    const semestersHere = Object.keys(localPrograms[selectedProgram][selectedYear]).sort()
    let targetYear = selectedYear
    let targetSem =
      semestersHere.find((s) => s !== selectedSemester) ??
      semestersHere[0] ??
      ""
    if (!targetSem || targetSem === selectedSemester) {
      const otherYear = programYears.find((y) => y !== selectedYear) ?? programYears[0] ?? selectedYear
      targetYear = otherYear
      targetSem = Object.keys(localPrograms[selectedProgram][otherYear] ?? {}).sort()[0] ?? ""
    }
    setMoveToYear(targetYear)
    setMoveToSemester(targetSem)
    setMoveDialog({ courseRef })
  }

  const handleMoveCourse = async () => {
    if (!localPrograms || !selectedProgram || !selectedYear || !selectedSemester || !moveDialog) return
    const { courseRef } = moveDialog
    const toYear = moveToYear
    const toSemester = moveToSemester
    if (!toYear || !toSemester) {
      toast({ title: "Choose destination", description: "Select a year and semester.", variant: "destructive" })
      return
    }
    if (toYear === selectedYear && toSemester === selectedSemester) {
      toast({
        title: "Same semester",
        description: "Pick a different year or semester to move this course.",
        variant: "destructive",
      })
      return
    }

    const moving = resolveCatalogCourse(courseRef)
    const destRaw = localPrograms[selectedProgram][toYear]?.[toSemester] ?? []
    if (destRaw.some((existing) => sameCatalogEntry(existing, courseRef))) {
      toast({
        title: "Already in destination",
        description: "That semester already lists this course.",
        variant: "destructive",
      })
      return
    }

    const valueToStore = moving ? moving.id : courseRef

    const previous = localPrograms
    const updatedPrograms: ProgramStructure = { ...localPrograms }
    updatedPrograms[selectedProgram] = { ...updatedPrograms[selectedProgram] }
    updatedPrograms[selectedProgram][selectedYear] = { ...updatedPrograms[selectedProgram][selectedYear] }
    updatedPrograms[selectedProgram][selectedYear][selectedSemester] = currentSemesterCourses.filter((x) => x !== courseRef)

    updatedPrograms[selectedProgram][toYear] = { ...updatedPrograms[selectedProgram][toYear] }
    updatedPrograms[selectedProgram][toYear][toSemester] = [...destRaw, valueToStore]

    setLocalPrograms(updatedPrograms)
    setMoveDialog(null)
    try {
      await persistPrograms(updatedPrograms, previous)
      toast({
        title: "Course moved",
        description: `Placed in ${toYear} · ${toSemester}.`,
      })
    } catch {
      /* persistPrograms already surfaced toast + reverted */
    }
  }

  const programCount = localPrograms ? Object.keys(localPrograms).length : 0

  const selectedProgramMeta = useMemo(() => {
    if (!localPrograms || !selectedProgram) return null
    const years = Object.keys(localPrograms[selectedProgram]).sort()
    let semesterSlots = 0
    for (const y of years) {
      semesterSlots += Object.keys(localPrograms[selectedProgram][y] ?? {}).length
    }
    return { years: years.length, semesterSlots }
  }, [localPrograms, selectedProgram])

  if (programsError || coursesError) {
    return (
      <EntityLayout title="Program Management" description="View and edit academic program structures by year and semester.">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-8">
            <p className="text-sm text-destructive">Failed to load programs or course data. Please refresh the page.</p>
          </CardContent>
        </Card>
      </EntityLayout>
    )
  }

  if (!localPrograms || !coursesCatalog) {
    return (
      <EntityLayout title="Program Management" description="View and edit academic program structures by year and semester.">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </EntityLayout>
    )
  }

  return (
    <EntityLayout title="Program Management" description="View and edit academic program structures by year and semester.">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle>Programs ({filteredPrograms.length === programCount ? programCount : `${filteredPrograms.length} of ${programCount}`})</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Pick a program, then a year and semester. Changes save to the server when you add or remove a course.
            </p>
          </div>
          {saving ? (
            <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search programs…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 max-w-full"
                />
              </div>
              <div className="rounded-md border">
                <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span className="min-w-0">Program</span>
                  <span className="text-right tabular-nums">Years</span>
                </div>
                <ScrollArea className="h-[min(520px,55vh)]">
                  <div className="p-2">
                    {filteredPrograms.length === 0 ? (
                      <p className="px-2 py-8 text-center text-sm text-muted-foreground">No programs match your search.</p>
                    ) : (
                      filteredPrograms.map((program) => (
                        <Tooltip key={program}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProgram(program)
                                const years = Object.keys(localPrograms[program]).sort()
                                const nextYear =
                                  selectedYear && years.includes(selectedYear) ? selectedYear : (years[0] ?? null)
                                setSelectedYear(nextYear)
                                if (nextYear) {
                                  const semesters = Object.keys(localPrograms[program][nextYear]).sort()
                                  const nextSemester =
                                    selectedSemester && semesters.includes(selectedSemester)
                                      ? selectedSemester
                                      : (semesters[0] ?? null)
                                  setSelectedSemester(nextSemester)
                                } else {
                                  setSelectedSemester(null)
                                }
                              }}
                              className={cn(
                                "grid w-full grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2 rounded-sm px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted",
                                selectedProgram === program && "bg-muted font-medium text-foreground",
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="min-w-0 truncate">{program}</span>
                              </div>
                              <span className="text-right tabular-nums text-xs text-muted-foreground">
                                {Object.keys(localPrograms[program]).length}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" align="start">
                            {`${Object.keys(localPrograms[program]).length} academic years in this plan`}
                          </TooltipContent>
                        </Tooltip>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-8">
              {selectedProgram ? (
                <>
                  <div className="rounded-md border p-4 sm:p-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold leading-tight">{selectedProgram}</h2>
                        {selectedProgramMeta ? (
                          <p className="text-sm text-muted-foreground">
                            {selectedProgramMeta.years} academic {selectedProgramMeta.years === 1 ? "year" : "years"} ·{" "}
                            {selectedProgramMeta.semesterSlots} semester
                            {selectedProgramMeta.semesterSlots === 1 ? "" : "s"} in the plan
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Academic year</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(localPrograms[selectedProgram])
                          .sort()
                          .map((year) => (
                            <Button
                              key={year}
                              type="button"
                              variant={selectedYear === year ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setSelectedYear(year)
                                const semesters = Object.keys(localPrograms[selectedProgram][year]).sort()
                                if (!semesters.includes(selectedSemester || "")) {
                                  setSelectedSemester(semesters[0] ?? null)
                                }
                              }}
                            >
                              {year}
                            </Button>
                          ))}
                      </div>
                    </div>

                    {selectedYear ? (
                      <>
                        <Separator className="my-4" />
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Semester</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.keys(localPrograms[selectedProgram][selectedYear])
                              .sort()
                              .map((semester) => (
                                <Button
                                  key={semester}
                                  type="button"
                                  variant={selectedSemester === semester ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setSelectedSemester(semester)}
                                >
                                  {semester}
                                </Button>
                              ))}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>

                  {selectedYear && selectedSemester ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-semibold">Courses in this semester</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedYear} · {selectedSemester} · {currentSemesterCourses.length} course
                            {currentSemesterCourses.length === 1 ? "" : "s"}
                            {" · "}
                            {currentSemesterCreditHours} credit hour
                            {currentSemesterCreditHours === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Popover open={openCoursePicker} onOpenChange={setOpenCoursePicker}>
                          <PopoverTrigger asChild>
                            <Button size="sm" className="w-full shrink-0 sm:w-auto">
                              <Plus className="mr-2 h-4 w-4" />
                              Add course
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0 sm:w-[450px]" align="end">
                            <Command>
                              <CommandInput placeholder="Search by code or name…" className="h-10" />
                              <CommandList>
                                <CommandEmpty>
                                  {courses.length > 0 && coursesAvailableToAdd.length === 0
                                    ? "All catalog courses are already in this semester."
                                    : "No courses match your search."}
                                </CommandEmpty>
                                <CommandGroup className="max-h-[320px] overflow-auto">
                                  {coursesAvailableToAdd.map((course) => (
                                    <CommandItem
                                      key={course.id}
                                      value={`${course.code} ${course.name}`}
                                      onSelect={() => handleAddCourse(course.id)}
                                      className="flex cursor-pointer flex-col items-start gap-1 py-3 aria-selected:bg-accent"
                                    >
                                      <div className="flex w-full items-center justify-between gap-2">
                                        <span className="font-mono text-xs font-medium">{course.code}</span>
                                        <Badge variant="outline" className="max-w-[10rem] shrink-0 truncate text-xs font-normal">
                                          {course.department}
                                        </Badge>
                                      </div>
                                      <span className="text-sm">{toTitleCase(course.name)}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="rounded-md border">
                        <Table className="table-fixed">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead className="w-[8rem]">Code</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="w-[5rem] text-right tabular-nums">Credits</TableHead>
                              <TableHead className="w-[70px] text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentSemesterCourses.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                  <p className="text-sm">No courses in this semester yet.</p>
                                  <Button variant="link" className="mt-1 h-auto p-0 text-sm" onClick={() => setOpenCoursePicker(true)}>
                                    Add a course from the catalog
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ) : (
                              currentSemesterCourses.map((id, index) => {
                                const display = resolveSemesterCourseDisplay(id)
                                return (
                                  <TableRow key={`${selectedProgram}-${selectedYear}-${selectedSemester}-${id}`}>
                                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                    <TableCell className="w-[8rem] overflow-hidden text-ellipsis font-mono text-sm font-medium">
                                      {display.code || <span className="inline-block w-[5ch] text-center text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="overflow-hidden text-ellipsis">
                                      {display.name}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                      {display.creditHours ?? <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open row menu">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => openMoveDialog(id)}>
                                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                                            Move to another term…
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => handleRemoveCourse(id)}
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove from semester
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                  <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-medium">Select a program</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Choose a program on the left to view years, semesters, and the course list for each term.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={moveDialog != null} onOpenChange={(open) => !open && setMoveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move course</DialogTitle>
            <DialogDescription>
              {selectedProgram
                ? `Choose a year and semester within ${selectedProgram}. The course is removed from the current term and added to the destination.`
                : "Choose where to place this course."}
            </DialogDescription>
          </DialogHeader>
          {localPrograms && selectedProgram ? (
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="move-year">Academic year</Label>
                <Select
                  value={moveToYear}
                  onValueChange={(v) => {
                    setMoveToYear(v)
                    const sems = Object.keys(localPrograms[selectedProgram][v] ?? {}).sort()
                    setMoveToSemester(sems[0] ?? "")
                  }}
                >
                  <SelectTrigger id="move-year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(localPrograms[selectedProgram])
                      .sort()
                      .map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="move-semester">Semester</Label>
                <Select value={moveToSemester} onValueChange={setMoveToSemester}>
                  <SelectTrigger id="move-semester">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {(moveToYear ? Object.keys(localPrograms[selectedProgram][moveToYear] ?? {}).sort() : []).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setMoveDialog(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleMoveCourse()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Move course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityLayout>
  )
}
