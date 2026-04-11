import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
      orderBy: [{ version_number: "desc" }, { generated_at: "desc" }],
      include: { timetable_metrics: true },
    })

    const selectedTimetable =
      timetables.find((t) => t.status.toLowerCase() === "active") ?? timetables[0] ?? null

    const [allRooms, catalogCourses] = await Promise.all([
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
        lecturerRows: [],
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
      })
    }

    const entries = await prisma.sectionScheduleEntry.findMany({
      where: { timetable_id: selectedTimetable.timetable_id },
      include: {
        timeslot: true,
        course: { include: { department: true } },
        lecturer: { include: { user: true, department: true } },
        room: true,
      },
    })

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

    const lecturerRows = [...byLecturer.entries()]
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
    })
  } catch (error) {
    console.error("[GET /api/reports/aggregates]", error)
    return NextResponse.json(
      { error: "Failed to build report aggregates from the database." },
      { status: 500 },
    )
  }
}
