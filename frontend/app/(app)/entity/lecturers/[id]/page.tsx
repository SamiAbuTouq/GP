"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react"
import { EntityLayout } from "@/components/entity-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { departments, type Department } from "@/lib/data"

type Lecturer = {
  id: string
  databaseId?: number
  name: string
  email: string
  department: Department
  load: number
  maxWorkload: number
  courses: string[]
}

type CourseOption = {
  code: string
  name: string
}

type PreferenceState = "PREFERRED" | "NOT_PREFERRED" | "NEUTRAL"

type LecturerPreferenceSlot = {
  slotId: number
  days: string[]
  start: string
  end: string
  slotType: string
  preference: PreferenceState
}

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]

const sortDays = (days: string[]) =>
  [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))

const getLoadRatio = (load: number, maxWorkload: number): number => {
  const safeMax = maxWorkload > 0 ? maxWorkload : 15
  return load / safeMax
}

const getLoadIndicatorStyle = (load: number, maxWorkload: number): React.CSSProperties => {
  const cappedRatio = Math.min(Math.max(getLoadRatio(load, maxWorkload), 0), 1.2)
  const startHue = Math.max(0, 120 - cappedRatio * 120)
  const endHue = Math.max(0, startHue - 16)
  return {
    background: `linear-gradient(90deg, hsl(${startHue} 78% 42%), hsl(${endHue} 88% 52%))`,
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

export default function LecturerDetailsPage() {
  const params = useParams<{ id: string }>()
  const lecturerId = params?.id
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [lecturer, setLecturer] = useState<Lecturer | null>(null)
  const [availableCourses, setAvailableCourses] = useState<CourseOption[]>([])
  const [preferences, setPreferences] = useState<LecturerPreferenceSlot[]>([])
  const [preferencesError, setPreferencesError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDetails = async () => {
      if (!lecturerId) return
      try {
        setLoading(true)
        setPreferencesError(null)

        const [lecturerRes, coursesRes, prefRes] = await Promise.all([
          fetch(`/api/lecturers/${lecturerId}`),
          fetch("/api/courses/catalog"),
          fetch(`/api/timeslots/lecturer/preferences/${lecturerId}`),
        ])

        if (!lecturerRes.ok) throw new Error("Failed to load lecturer details.")
        const lecturerData = await lecturerRes.json()
        setLecturer(lecturerData)

        if (coursesRes.ok) {
          const coursesData = await coursesRes.json()
          const rawCourses = Array.isArray(coursesData)
            ? coursesData
            : Array.isArray((coursesData as { courses?: unknown }).courses)
              ? (coursesData as { courses: unknown[] }).courses
              : []
          const normalizedCourses = rawCourses
            .map((course) => {
              if (!course || typeof course !== "object") return null
              const rawCode = (course as { code?: unknown }).code
              const rawName = (course as { name?: unknown }).name
              const code = typeof rawCode === "string" ? rawCode.trim() : ""
              const name = typeof rawName === "string" ? rawName.trim() : ""
              return code && name ? { code, name } : null
            })
            .filter((course): course is CourseOption => course !== null)
          setAvailableCourses(normalizedCourses)
        }

        if (prefRes.ok) {
          const prefData = await prefRes.json()
          setPreferences(Array.isArray(prefData) ? prefData : [])
        } else {
          const prefErr = await prefRes.json()
          setPreferences([])
          setPreferencesError(prefErr.error || "Failed to load preferences.")
        }
      } catch (error) {
        console.error("Error loading lecturer details:", error)
        toast({
          title: "Error",
          description: "Failed to load lecturer details.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    void fetchDetails()
  }, [lecturerId, toast])

  const preferenceCounts = useMemo(() => {
    return preferences.reduce(
      (acc, slot) => {
        acc[slot.preference] += 1
        return acc
      },
      { PREFERRED: 0, NOT_PREFERRED: 0, NEUTRAL: 0 } as Record<PreferenceState, number>,
    )
  }, [preferences])

  const groupPreferencesByDay = (slots: LecturerPreferenceSlot[]) => {
    const groups = new Map<string, LecturerPreferenceSlot[]>()
    for (const slot of slots) {
      const dayLabel = sortDays(slot.days).join(", ")
      if (!groups.has(dayLabel)) groups.set(dayLabel, [])
      groups.get(dayLabel)?.push(slot)
    }
    for (const value of groups.values()) {
      value.sort((a, b) => `${a.start}-${a.end}`.localeCompare(`${b.start}-${b.end}`))
    }
    return Array.from(groups.entries()).sort(
      (a, b) => DAY_ORDER.indexOf(a[0].split(", ")[0]) - DAY_ORDER.indexOf(b[0].split(", ")[0]),
    )
  }

  const preferredByDay = useMemo(
    () => groupPreferencesByDay(preferences.filter((slot) => slot.preference === "PREFERRED")),
    [preferences],
  )

  const notPreferredByDay = useMemo(
    () => groupPreferencesByDay(preferences.filter((slot) => slot.preference === "NOT_PREFERRED")),
    [preferences],
  )

  return (
    <EntityLayout title="Lecturer Details" description="Detailed lecturer profile and preference visibility for admins.">
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/entity/lecturers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to lecturers
          </Link>
        </Button>
      </div>

      {loading || !lecturer ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading lecturer details...
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">ID</p>
                  <p className="font-medium">{lecturer.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{lecturer.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <Badge className={getDepartmentColor(lecturer.department)}>{lecturer.department}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Workload</p>
                <div className="flex items-center gap-3">
                  <Progress
                    value={Math.min(100, getLoadRatio(lecturer.load, lecturer.maxWorkload) * 100)}
                    className="h-2 flex-1 bg-muted"
                    indicatorStyle={getLoadIndicatorStyle(lecturer.load, lecturer.maxWorkload)}
                  />
                  <span className="text-sm font-medium">
                    {lecturer.load}h / {lecturer.maxWorkload}h
                  </span>
                </div>
              </div>
            </CardContent>
            </Card>

            <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Courses Can Teach</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                <span className="text-sm text-muted-foreground">Assigned courses</span>
                <Badge variant="secondary">{lecturer.courses.length}</Badge>
              </div>
              {lecturer.courses.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No assigned teaching courses.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lecturer.courses.map((courseCode) => {
                    const courseInfo = availableCourses.find((course) => course.code === courseCode)
                    return (
                      <div
                        key={courseCode}
                        className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
                      >
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{courseCode}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {courseInfo?.name ?? "Course name unavailable"}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Time Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {preferencesError ? (
                <p className="text-sm text-destructive">{preferencesError}</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-3">
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
                      Preferred: {preferenceCounts.PREFERRED}
                    </Badge>
                    <Badge variant="destructive">
                      Not Preferred: {preferenceCounts.NOT_PREFERRED}
                    </Badge>
                    <Badge variant="outline">Neutral (hidden): {preferenceCounts.NEUTRAL}</Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Preferred</p>
                      </div>
                      {preferredByDay.length === 0 && (
                        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                          No preferred slots set.
                        </p>
                      )}
                      {preferredByDay.map(([dayLabel, daySlots]) => (
                        <div key={`preferred-${dayLabel}`} className="rounded-md border p-3">
                          <p className="mb-2 text-sm font-semibold">{dayLabel}</p>
                          <div className="grid gap-2">
                            {daySlots.map((slot) => (
                              <div key={slot.slotId} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                                <span>
                                  {slot.start} - {slot.end} ({slot.slotType})
                                </span>
                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
                                  Preferred
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-md border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Not Preferred</p>
                      </div>
                      {notPreferredByDay.length === 0 && (
                        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                          No not-preferred slots set.
                        </p>
                      )}
                      {notPreferredByDay.map(([dayLabel, daySlots]) => (
                        <div key={`not-preferred-${dayLabel}`} className="rounded-md border p-3">
                          <p className="mb-2 text-sm font-semibold">{dayLabel}</p>
                          <div className="grid gap-2">
                            {daySlots.map((slot) => (
                              <div key={slot.slotId} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                                <span>
                                  {slot.start} - {slot.end} ({slot.slotType})
                                </span>
                                <Badge variant="destructive">
                                  Not Preferred
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </EntityLayout>
  )
}
