import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminFromRefreshCookie } from "@/lib/server-auth"

function decodeSemesterType(type: number): string {
  const map: Record<number, string> = {
    1: "First Semester",
    2: "Second Semester",
    3: "Summer Semester",
  }
  return map[type] ?? `Semester ${type}`
}

function formatSemesterLabel(academicYear: string, semesterType: number): string {
  return `${academicYear.replace(/-/g, "–")} ${decodeSemesterType(semesterType)}`
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Sat"] as const

function daysFromMask(mask: number): string[] {
  return DAY_NAMES.filter((_, i) => (mask >> i) & 1)
}

/** Weekly recurrence: number of weekdays this slot meets (at least 1). */
function dayMultiplicity(mask: number): number {
  const n = daysFromMask(mask).length
  return n > 0 ? n : 1
}

function slotDurationHours(start: Date, end: Date): number {
  const sm = start.getUTCHours() * 60 + start.getUTCMinutes()
  const em = end.getUTCHours() * 60 + end.getUTCMinutes()
  let diff = (em - sm) / 60
  if (diff <= 0) diff += 24
  return diff
}

function weeklyHoursForEntry(daysMask: number, start: Date, end: Date): number {
  return slotDurationHours(start, end) * dayMultiplicity(daysMask)
}

function decodeRoomType(code: number): string {
  const map: Record<number, string> = {
    1: "Classroom",
    2: "Lecture hall",
    3: "Laboratory",
    4: "Seminar",
    5: "Computer lab",
    6: "Workshop",
  }
  return map[code] ?? `Type ${code}`
}

function roomTypeIsLab(typeLabel: string): boolean {
  const t = typeLabel.toLowerCase()
  return t.includes("laboratory") || t.includes("computer lab")
}

function deliveryLabel(mode: string): string {
  if (mode === "FACE_TO_FACE") return "Face-to-face"
  if (mode === "ONLINE") return "Online"
  if (mode === "BLENDED") return "Blended"
  return mode
}

function generationTypeLabel(value: string): string {
  if (value === "gwo_ui") return "GWO (UI)"
  if (value === "manual") return "Manual"
  return value
}

function isUndergraduateLevel(level: number): boolean {
  return level < 500
}

function sectionCapacityForEntry(e: {
  course: { delivery_mode: string }
  registered_students: number
  room: { capacity: number }
}): number {
  return e.course.delivery_mode === "ONLINE" ? e.registered_students : e.room.capacity
}

export async function GET(request: Request) {
  const auth = await requireAdminFromRefreshCookie()
  if (!auth.ok) {
    return auth.response
  }

  try {
    const semesterId = Number(new URL(request.url).searchParams.get("semesterId"))
    if (!Number.isFinite(semesterId) || semesterId <= 0) {
      return NextResponse.json({ error: "Valid semesterId is required." }, { status: 400 })
    }

    const semester = await prisma.semester.findUnique({
      where: { semester_id: semesterId },
    })
    if (!semester) {
      return NextResponse.json({ error: "Semester not found." }, { status: 404 })
    }

    const semesterLabel = formatSemesterLabel(
      semester.academic_year,
      semester.semester_type,
    )
    const semesterTypeName = decodeSemesterType(semester.semester_type)

    const timetables = await prisma.timetable.findMany({
      where: { semester_id: semesterId },
      orderBy: [{ generated_at: "asc" }, { timetable_id: "asc" }],
      include: { timetable_metrics: true },
    })

    const selectedTimetable =
      timetables.find((t) => t.status.toLowerCase() === "active") ?? timetables[0] ?? null
    const timetableIds = timetables.map((t) => t.timetable_id)
    const sectionCounts =
      timetableIds.length > 0
        ? await prisma.sectionScheduleEntry.groupBy({
            by: ["timetable_id"],
            where: { timetable_id: { in: timetableIds } },
            _count: { _all: true },
          })
        : []
    const sectionsByTimetableId = new Map<number, number>(
      sectionCounts.map((r) => [r.timetable_id, r._count._all]),
    )

    const [allRooms, catalogCourses, activeLecturers] = await Promise.all([
      prisma.room.findMany({ orderBy: { room_number: "asc" } }),
      prisma.course.findMany({
        select: {
          course_id: true,
          dept_id: true,
          academic_level: true,
          delivery_mode: true,
          department: { select: { dept_name: true } },
        },
      }),
      prisma.lecturer.findMany({
        where: { user: { is_active: true } },
        include: {
          user: { select: { first_name: true, last_name: true } },
          department: { select: { dept_name: true } },
        },
        orderBy: [{ user: { first_name: "asc" } }, { user: { last_name: "asc" } }],
      }),
    ])

    const catalogByDept = new Map<string, { total: number; ug: number; grad: number }>()
    for (const c of catalogCourses) {
      const dept = c.department.dept_name
      if (!catalogByDept.has(dept)) {
        catalogByDept.set(dept, { total: 0, ug: 0, grad: 0 })
      }
      const bucket = catalogByDept.get(dept)!
      bucket.total++
      if (isUndergraduateLevel(c.academic_level)) bucket.ug++
      else bucket.grad++
    }

    if (!selectedTimetable) {
      return NextResponse.json({
        semesterLabel,
        academicYear: semester.academic_year,
        semesterTypeName,
        totalStudents: semester.total_students,
        timetable: null,
        insights: {
          totalScheduleEntries: 0,
          totalRoomsInCatalog: allRooms.length,
          roomsWithSchedule: 0,
          totalWeeklyScheduledHours: 0,
          maxWeeklyHoursAnyRoom: 0,
          avgWeeklyHoursPerUsedRoom: 0,
          totalSeatFillWeightedPct: null,
          lecturerCountScheduled: 0,
          lecturersWithNoAssignments: activeLecturers.length,
          distinctCoursesScheduled: 0,
          departmentsScheduled: 0,
        },
        roomRows: allRooms.map((r) => ({
          roomId: r.room_id,
          roomNumber: r.room_number,
          roomTypeLabel: decodeRoomType(r.room_type),
          capacity: r.capacity,
          isAvailable: r.is_available,
          sessionsCount: 0,
          weeklyInstructionalHours: 0,
          relativeLoadPct: 0,
          avgSeatFillPct: null,
          peakDay: "—",
          onlineOrBlendedSessions: 0,
        })),
        lecturerRows: activeLecturers.map((l) => ({
          userId: l.user_id,
          lecturerName: `${l.user.first_name} ${l.user.last_name}`.trim(),
          department: l.department.dept_name,
          maxWorkloadHours: l.max_workload,
          sectionsScheduled: 0,
          distinctCourses: 0,
          labSections: 0,
          weeklyContactHours: 0,
          loadIndex: 0,
          loadPctOfMax: 0,
        })),
        courseDistributionRows: Array.from(catalogByDept.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([department, counts]) => ({
            department,
            catalogCourseCount: counts.total,
            scheduledDistinctCourses: 0,
            sectionInstances: 0,
            totalEnrollment: 0,
            undergraduateCourseCount: 0,
            graduateCourseCount: 0,
            onlineSections: 0,
            blendedSections: 0,
            faceToFaceSections: 0,
            avgSectionEnrollment: 0,
          })),
        optimizationRuns: [],
        conflicts: [],
        lecturerPreferenceRows: [],
        lecturerPreferenceSummary: {
          scheduledLecturers: 0,
          lecturersWithPreferences: 0,
          lecturersWithoutPreferences: 0,
          totalPreferredHits: 0,
          totalAvoidedViolations: 0,
          lecturersRequiringAttention: 0,
        },
        roomTypeRows: [],
        roomTypeSummary: {
          totalSections: 0,
          okCount: 0,
          hardMismatchCount: 0,
          softMismatchCount: 0,
        },
      })
    }

    const [entries, conflicts] = await Promise.all([
      prisma.sectionScheduleEntry.findMany({
        where: { timetable_id: selectedTimetable.timetable_id },
        include: {
          timeslot: true,
          course: { include: { department: true } },
          lecturer: { include: { user: true, department: true } },
          room: true,
        },
      }),
      prisma.timetableConflict.findMany({
        where: { timetable_id: selectedTimetable.timetable_id },
        orderBy: [{ severity: "asc" }, { conflict_type: "asc" }, { conflict_id: "asc" }],
      }),
    ])

    type RoomAgg = {
      sessions: number
      weeklyHours: number
      dayCounts: Map<string, number>
      seatFillSum: number
      seatFillN: number
      onlineBlend: number
    }

    const byRoom = new Map<number, RoomAgg>()
    const byLecturer = new Map<
      number,
      {
        sections: number
        courses: Set<number>
        weeklyHours: number
        labs: number
        name: string
        department: string
        maxWorkload: number
      }
    >()

    const deptSchedule = new Map<
      string,
      {
        courseIds: Set<number>
        sections: number
        enrollment: number
        ugCourses: Set<number>
        gradCourses: Set<number>
        online: number
        blended: number
        f2f: number
      }
    >()

    let totalWeeklyHoursAllEntries = 0
    let seatFillWeighted = 0
    let seatFillWeight = 0

    for (const e of entries) {
      const wh = weeklyHoursForEntry(
        e.timeslot.days_mask,
        e.timeslot.start_time,
        e.timeslot.end_time,
      )
      totalWeeklyHoursAllEntries += wh

      const roomId = e.room_id
      if (!byRoom.has(roomId)) {
        byRoom.set(roomId, {
          sessions: 0,
          weeklyHours: 0,
          dayCounts: new Map(),
          seatFillSum: 0,
          seatFillN: 0,
          onlineBlend: 0,
        })
      }
      const ra = byRoom.get(roomId)!
      ra.sessions++
      ra.weeklyHours += wh
      for (const d of daysFromMask(e.timeslot.days_mask)) {
        ra.dayCounts.set(d, (ra.dayCounts.get(d) ?? 0) + 1)
      }
      if (e.course.delivery_mode === "ONLINE" || e.course.delivery_mode === "BLENDED") {
        ra.onlineBlend++
      }
      if (e.course.delivery_mode === "FACE_TO_FACE" || e.course.delivery_mode === "BLENDED") {
        const cap = Math.max(1, sectionCapacityForEntry(e))
        const fill = Math.min(100, (e.registered_students / cap) * 100)
        ra.seatFillSum += fill
        ra.seatFillN++
        seatFillWeighted += fill * wh
        seatFillWeight += wh
      }

      const uid = e.user_id
      if (!byLecturer.has(uid)) {
        const u = e.lecturer.user
        byLecturer.set(uid, {
          sections: 0,
          courses: new Set(),
          weeklyHours: 0,
          labs: 0,
          name: `${u.first_name} ${u.last_name}`,
          department: e.lecturer.department.dept_name,
          maxWorkload: e.lecturer.max_workload,
        })
      }
      const la = byLecturer.get(uid)!
      la.sections++
      la.courses.add(e.course_id)
      la.weeklyHours += wh
      if (e.course.is_lab) la.labs++

      const dname = e.course.department.dept_name
      if (!deptSchedule.has(dname)) {
        deptSchedule.set(dname, {
          courseIds: new Set(),
          sections: 0,
          enrollment: 0,
          ugCourses: new Set(),
          gradCourses: new Set(),
          online: 0,
          blended: 0,
          f2f: 0,
        })
      }
      const ds = deptSchedule.get(dname)!
      ds.courseIds.add(e.course_id)
      ds.sections++
      ds.enrollment += e.registered_students
      if (isUndergraduateLevel(e.course.academic_level)) ds.ugCourses.add(e.course_id)
      else ds.gradCourses.add(e.course_id)
      if (e.course.delivery_mode === "ONLINE") ds.online++
      else if (e.course.delivery_mode === "BLENDED") ds.blended++
      else ds.f2f++
    }

    const roomWeeklyList = [...byRoom.values()].map((v) => v.weeklyHours)
    const maxWeeklyHoursAnyRoom = roomWeeklyList.length ? Math.max(...roomWeeklyList) : 0

    const roomRows = allRooms.map((r) => {
      const agg = byRoom.get(r.room_id)
      if (!agg) {
        return {
          roomId: r.room_id,
          roomNumber: r.room_number,
          roomTypeLabel: decodeRoomType(r.room_type),
          capacity: r.capacity,
          isAvailable: r.is_available,
          sessionsCount: 0,
          weeklyInstructionalHours: 0,
          relativeLoadPct: 0,
          avgSeatFillPct: null as number | null,
          peakDay: "—",
          onlineOrBlendedSessions: 0,
        }
      }
      let peakDay = "—"
      let peakC = -1
      for (const [d, c] of agg.dayCounts) {
        if (c > peakC) {
          peakC = c
          peakDay = d
        }
      }
      const rel =
        maxWeeklyHoursAnyRoom > 0
          ? Math.round((agg.weeklyHours / maxWeeklyHoursAnyRoom) * 1000) / 10
          : 0
      const avgSeat =
        agg.seatFillN > 0
          ? Math.round((agg.seatFillSum / agg.seatFillN) * 10) / 10
          : null

      return {
        roomId: r.room_id,
        roomNumber: r.room_number,
        roomTypeLabel: decodeRoomType(r.room_type),
        capacity: r.capacity,
        isAvailable: r.is_available,
        sessionsCount: agg.sessions,
        weeklyInstructionalHours: Math.round(agg.weeklyHours * 100) / 100,
        relativeLoadPct: rel,
        avgSeatFillPct: avgSeat,
        peakDay,
        onlineOrBlendedSessions: agg.onlineBlend,
      }
    })

    const scheduledLecturerRows = [...byLecturer.entries()]
      .map(([userId, v]) => {
        const mw = Math.max(1, v.maxWorkload)
        const loadIndex = Math.round((v.weeklyHours / mw) * 1000) / 1000
        const loadPct = Math.round((v.weeklyHours / mw) * 1000) / 10
        return {
          userId,
          lecturerName: v.name,
          department: v.department,
          maxWorkloadHours: v.maxWorkload,
          sectionsScheduled: v.sections,
          distinctCourses: v.courses.size,
          labSections: v.labs,
          weeklyContactHours: Math.round(v.weeklyHours * 100) / 100,
          loadIndex,
          loadPctOfMax: loadPct,
        }
      })
      .sort((a, b) => b.weeklyContactHours - a.weeklyContactHours)

    const scheduledLecturerIds = new Set(scheduledLecturerRows.map((r) => r.userId))
    const zeroLoadLecturerRows = activeLecturers
      .filter((l) => !scheduledLecturerIds.has(l.user_id))
      .map((l) => ({
        userId: l.user_id,
        lecturerName: `${l.user.first_name} ${l.user.last_name}`.trim(),
        department: l.department.dept_name,
        maxWorkloadHours: l.max_workload,
        sectionsScheduled: 0,
        distinctCourses: 0,
        labSections: 0,
        weeklyContactHours: 0,
        loadIndex: 0,
        loadPctOfMax: 0,
      }))
      .sort((a, b) => a.lecturerName.localeCompare(b.lecturerName))

    const lecturerRows = [...scheduledLecturerRows, ...zeroLoadLecturerRows]

    const allDeptNames = new Set([...catalogByDept.keys(), ...deptSchedule.keys()])
    const courseDistributionRows = [...allDeptNames]
      .sort((a, b) => a.localeCompare(b))
      .map((department) => {
        const sched = deptSchedule.get(department)
        const cat = catalogByDept.get(department) ?? { total: 0, ug: 0, grad: 0 }
        const sectionInstances = sched?.sections ?? 0
        const totalEnrollment = sched?.enrollment ?? 0
        const avg =
          sectionInstances > 0
            ? Math.round((totalEnrollment / sectionInstances) * 100) / 100
            : 0
        return {
          department,
          catalogCourseCount: cat.total,
          scheduledDistinctCourses: sched?.courseIds.size ?? 0,
          sectionInstances,
          totalEnrollment,
          undergraduateCourseCount: sched?.ugCourses.size ?? 0,
          graduateCourseCount: sched?.gradCourses.size ?? 0,
          onlineSections: sched?.online ?? 0,
          blendedSections: sched?.blended ?? 0,
          faceToFaceSections: sched?.f2f ?? 0,
          avgSectionEnrollment: avg,
        }
      })

    const metrics = selectedTimetable.timetable_metrics
    const optimizationRuns = timetables.map((t) => ({
      timetableId: t.timetable_id,
      versionNumber: t.version_number,
      generationType: t.generation_type,
      generationTypeLabel: generationTypeLabel(t.generation_type),
      status: t.status,
      generatedAt: t.generated_at.toISOString(),
      fitnessScore: t.timetable_metrics ? Number(t.timetable_metrics.fitness_score) : null,
      softConstraintsScore: t.timetable_metrics ? Number(t.timetable_metrics.soft_constraints_score) : null,
      roomUtilizationRate: t.timetable_metrics ? Number(t.timetable_metrics.room_utilization_rate) : null,
      isValid: t.timetable_metrics?.is_valid ?? null,
      sectionsCount: sectionsByTimetableId.get(t.timetable_id) ?? 0,
      isActive: t.status.toLowerCase() === "active",
    }))

    const lecturerIds = [...new Set(entries.map((e) => e.user_id).filter((v): v is number => v != null))]
    const prefByLecturer = new Map<number, { preferred: Set<number>; avoided: Set<number> }>()
    if (lecturerIds.length > 0) {
      const preferences = await prisma.lecturerPreference.findMany({
        where: { user_id: { in: lecturerIds } },
      })
      for (const p of preferences) {
        if (!prefByLecturer.has(p.user_id)) {
          prefByLecturer.set(p.user_id, { preferred: new Set(), avoided: new Set() })
        }
        const bucket = prefByLecturer.get(p.user_id)!
        if (p.is_preferred) bucket.preferred.add(p.slot_id)
        else bucket.avoided.add(p.slot_id)
      }
    }

    const lecturerPreferenceRows = [...byLecturer.entries()]
      .map(([userId, v]) => {
        const assigned = entries.filter((e) => e.user_id === userId)
        const pref = prefByLecturer.get(userId)
        let onPreferred = 0
        let onAvoided = 0
        let neutral = 0
        for (const e of assigned) {
          if (!pref || (pref.preferred.size === 0 && pref.avoided.size === 0)) {
            neutral++
            continue
          }
          if (pref.preferred.has(e.slot_id)) onPreferred++
          else if (pref.avoided.has(e.slot_id)) onAvoided++
          else neutral++
        }
        const hasPreferences = !!pref && (pref.preferred.size > 0 || pref.avoided.size > 0)
        const complianceScore =
          hasPreferences && assigned.length > 0
            ? Math.round((((assigned.length - onAvoided) / assigned.length) * 1000)) / 10
            : null
        return {
          userId,
          lecturerName: v.name,
          department: v.department,
          sessionsAssigned: assigned.length,
          onPreferred,
          onAvoided,
          neutral,
          hasPreferences,
          complianceScore,
        }
      })
      .sort((a, b) => {
        if (b.onAvoided !== a.onAvoided) return b.onAvoided - a.onAvoided
        const as = a.complianceScore ?? Number.POSITIVE_INFINITY
        const bs = b.complianceScore ?? Number.POSITIVE_INFINITY
        return as - bs
      })

    const lecturerPreferenceSummary = {
      scheduledLecturers: lecturerPreferenceRows.length,
      lecturersWithPreferences: lecturerPreferenceRows.filter((r) => r.hasPreferences).length,
      lecturersWithoutPreferences: lecturerPreferenceRows.filter((r) => !r.hasPreferences).length,
      totalPreferredHits: lecturerPreferenceRows.reduce((s, r) => s + r.onPreferred, 0),
      totalAvoidedViolations: lecturerPreferenceRows.reduce((s, r) => s + r.onAvoided, 0),
      lecturersRequiringAttention: lecturerPreferenceRows.filter((r) => r.onAvoided > 0).length,
    }

    const roomTypeRows = entries.map((e) => {
      const roomTypeLabel = decodeRoomType(e.room.room_type)
      const roomIsLabType = roomTypeIsLab(roomTypeLabel)
      let matchStatus: "OK" | "Hard mismatch" | "Soft mismatch" = "OK"
      let severity: "hard" | "soft" | null = null
      let issue = ""
      if (e.course.is_lab && !roomIsLabType) {
        matchStatus = "Hard mismatch"
        severity = "hard"
        issue = `Lab course in ${roomTypeLabel}`
      } else if (!e.course.is_lab && roomIsLabType) {
        matchStatus = "Hard mismatch"
        severity = "hard"
        issue = `Non-lab course in ${roomTypeLabel}`
      } else if (e.course.delivery_mode === "ONLINE" && e.room.capacity > 0) {
        matchStatus = "Soft mismatch"
        severity = "soft"
        issue = "Online course assigned physical room"
      } else if (e.course.delivery_mode === "FACE_TO_FACE" && e.registered_students > e.room.capacity * 0.8) {
        matchStatus = "Soft mismatch"
        severity = "soft"
        issue = `Enrollment ${e.registered_students} exceeds 80% of capacity ${e.room.capacity}`
      }
      return {
        courseCode: e.course.course_code,
        sectionNumber: e.section_number,
        delivery: e.course.delivery_mode,
        deliveryLabel: deliveryLabel(e.course.delivery_mode),
        isLab: e.course.is_lab,
        roomNumber: e.room.room_number,
        roomTypeLabel,
        capacity: e.room.capacity,
        enrolled: e.registered_students,
        matchStatus,
        severity,
        issue,
      }
    })

    const roomTypeSummary = {
      totalSections: roomTypeRows.length,
      okCount: roomTypeRows.filter((r) => r.matchStatus === "OK").length,
      hardMismatchCount: roomTypeRows.filter((r) => r.matchStatus === "Hard mismatch").length,
      softMismatchCount: roomTypeRows.filter((r) => r.matchStatus === "Soft mismatch").length,
    }
    const insights = {
      totalScheduleEntries: entries.length,
      totalRoomsInCatalog: allRooms.length,
      roomsWithSchedule: [...byRoom.keys()].length,
      totalWeeklyScheduledHours: Math.round(totalWeeklyHoursAllEntries * 100) / 100,
      maxWeeklyHoursAnyRoom: Math.round(maxWeeklyHoursAnyRoom * 100) / 100,
      avgWeeklyHoursPerUsedRoom:
        byRoom.size > 0
          ? Math.round((totalWeeklyHoursAllEntries / byRoom.size) * 100) / 100
          : 0,
      totalSeatFillWeightedPct:
        seatFillWeight > 0
          ? Math.round((seatFillWeighted / seatFillWeight) * 10) / 10
          : null,
      lecturerCountScheduled: byLecturer.size,
      lecturersWithNoAssignments: zeroLoadLecturerRows.length,
      distinctCoursesScheduled: new Set(entries.map((e) => e.course_id)).size,
      departmentsScheduled: deptSchedule.size,
    }

    return NextResponse.json({
      semesterLabel,
      academicYear: semester.academic_year,
      semesterTypeName,
      totalStudents: semester.total_students,
      timetable: {
        timetableId: selectedTimetable.timetable_id,
        status: selectedTimetable.status,
        versionNumber: selectedTimetable.version_number,
        generatedAt: selectedTimetable.generated_at.toISOString(),
        generationType: selectedTimetable.generation_type,
        roomUtilizationRate: metrics ? Number(metrics.room_utilization_rate) : null,
        fitnessScore: metrics ? Number(metrics.fitness_score) : null,
        softConstraintsScore: metrics ? Number(metrics.soft_constraints_score) : null,
        isValid: metrics?.is_valid ?? null,
      },
      insights,
      roomRows,
      lecturerRows,
      courseDistributionRows,
      optimizationRuns,
      conflicts: conflicts.map((c) => ({
        conflictId: c.conflict_id,
        type: c.conflict_type,
        severity: c.severity,
        courseCode: c.course_code,
        sectionNumber: c.section_number,
        lecturerName: c.lecturer_name,
        roomNumber: c.room_number,
        timeslotLabel: c.timeslot_label,
        detail: c.detail,
      })),
      lecturerPreferenceRows,
      lecturerPreferenceSummary,
      roomTypeRows,
      roomTypeSummary,
    })
  } catch (error) {
    console.error("[GET /api/reports/aggregates]", error)
    return NextResponse.json(
      { error: "Failed to build report aggregates from the database." },
      { status: 500 },
    )
  }
}
