import { NextRequest, NextResponse } from "next/server"
import { writeFile, readFile, mkdir, stat } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

export const dynamic = "force-dynamic"

const DATA_DIR  = path.join(process.cwd(), "data")
const DATA_FILE = path.join(DATA_DIR, "schedule.json")

const DEFAULT_SOFT_WEIGHTS = {
  preferred_timeslot:     80,
  unpreferred_timeslot:   70,
  minimize_gaps:          60,
  room_utilization:       90,
  balanced_workload:      50,
  distribute_classes:     65,
  student_gaps:           70,      // NEW: idle time between student's consecutive lectures
  single_session_day:     50,      // NEW: single-session-on-a-day penalty (matches Python)
}

const DEFAULT = {
  schedule: [],
  metadata: {
    total_lectures: 0,
    total_rooms: 0,
    total_timeslots: 0,
    total_lecturers: 0,
    conflicts: 0,
    iterations: null,
    wolves: null,
    best_fitness: null,
    generated_at: null,
    soft_preference_warnings: 0,
    gap_warnings: 0,
    overload_violations: 0,
    max_classes_per_lecturer: 5,
    total_slots: 0,
    used_slots: 0,
    utilization_pct: 0,
    timetable_seat_utilization_pct: 0,
    workload_penalty: 0,
    distribution_penalty: 0,
    soft_weights: DEFAULT_SOFT_WEIGHTS,
    // NEW counters
    unit_conflict_count: 0,
    student_gap_count: 0,
    single_session_day_count: 0,
  },
  lecturer_summary: [],
  preference_warnings: [],
  gap_warnings: [],
  utilization_info: [],
  workload_info: [],
  distribution_info: [],
  room_summary: [],
  lecturer_preferences: {},
  soft_weights: DEFAULT_SOFT_WEIGHTS,
  timeslots_catalogue: [],
  wrong_slot_type_violations: [],
  // NEW: study plan / student constraint data
  study_plan_units: {},
  study_plan_summary: [],
  unit_conflict_violations: [],
  student_gap_warnings: [],
  single_session_day_warnings: [],
}

export async function GET() {
  try {
    if (!existsSync(DATA_FILE)) {
      return NextResponse.json(DEFAULT, {
        headers: { "Cache-Control": "no-store, must-revalidate" },
      })
    }
    const raw = await readFile(DATA_FILE, "utf-8")
    const parsed = JSON.parse(raw)

    // BUG FIX 1 & 2: Deep-merge soft_weights at BOTH the top level AND inside
    // metadata so old schedule.json files missing the 2 new keys still work.
    const rawTopSoft = { ...(parsed.soft_weights ?? {}) } as Record<string, number>
    if (rawTopSoft.single_session_day == null && rawTopSoft.early_thursday_penalty != null) {
      rawTopSoft.single_session_day = rawTopSoft.early_thursday_penalty
    }
    const mergedSoftWeights = {
      ...DEFAULT_SOFT_WEIGHTS,
      ...rawTopSoft,
    }
    const rawMetaSoft = { ...(parsed.metadata?.soft_weights ?? {}) } as Record<string, number>
    if (rawMetaSoft.single_session_day == null && rawMetaSoft.early_thursday_penalty != null) {
      rawMetaSoft.single_session_day = rawMetaSoft.early_thursday_penalty
    }
    const mergedMetadataSoftWeights = {
      ...DEFAULT_SOFT_WEIGHTS,
      ...rawMetaSoft,
    }

    const mergedMetaBase = {
      ...DEFAULT.metadata,
      ...(parsed.metadata ?? {}),
      soft_weights: mergedMetadataSoftWeights,
    }
    const genRaw = mergedMetaBase.generated_at
    if (typeof genRaw !== "string" || !genRaw.trim()) {
      try {
        const st = await stat(DATA_FILE)
        mergedMetaBase.generated_at = st.mtime.toISOString()
      } catch {
        mergedMetaBase.generated_at = null
      }
    }

    const metaAny = mergedMetaBase as Record<string, unknown>
    const ssdFromMeta =
      metaAny.single_session_day_count ?? metaAny.early_thursday_count
    const ssdCount =
      typeof ssdFromMeta === "number"
        ? ssdFromMeta
        : (parsed.single_session_day_warnings?.length ??
            parsed.early_thursday_warnings?.length ??
            0)
    mergedMetaBase.single_session_day_count = ssdCount

    const ssdWarnings =
      parsed.single_session_day_warnings ?? parsed.early_thursday_warnings ?? []

    const studyPlanSummaryRaw = parsed.study_plan_summary ?? []
    const studyPlanSummaryNorm = Array.isArray(studyPlanSummaryRaw)
      ? studyPlanSummaryRaw.map((s: Record<string, unknown>) => ({
          ...s,
          single_session_day_count:
            typeof s.single_session_day_count === "number"
              ? s.single_session_day_count
              : typeof s.early_thu_count === "number"
                ? s.early_thu_count
                : 0,
        }))
      : []

    return NextResponse.json(
      {
        ...DEFAULT,
        ...parsed,
        // Override top-level soft_weights with the deep-merged version
        soft_weights: mergedSoftWeights,
        metadata: mergedMetaBase,
        single_session_day_warnings: ssdWarnings,
        study_plan_summary: studyPlanSummaryNorm,
      },
      {
        headers: {
          "Cache-Control": "no-store, must-revalidate",
        },
      },
    )
  } catch {
    return NextResponse.json(DEFAULT, {
      headers: { "Cache-Control": "no-store, must-revalidate" },
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!Array.isArray(body.schedule)) {
      return NextResponse.json(
        { error: "Body must have a `schedule` array." },
        { status: 400 }
      )
    }

    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true })
    }

    const studyPlanSummaryIn = Array.isArray(body.study_plan_summary)
      ? body.study_plan_summary.map((s: Record<string, unknown>) => ({
          ...s,
          single_session_day_count:
            typeof s.single_session_day_count === "number"
              ? s.single_session_day_count
              : typeof s.early_thu_count === "number"
                ? s.early_thu_count
                : 0,
        }))
      : []

    // Deep-merge incoming soft_weights with defaults so all keys are always present
    const rawIncomingSoft = {
      ...(body.soft_weights ?? body.metadata?.soft_weights ?? {}),
    } as Record<string, number>
    if (
      rawIncomingSoft.single_session_day == null &&
      rawIncomingSoft.early_thursday_penalty != null
    ) {
      rawIncomingSoft.single_session_day = rawIncomingSoft.early_thursday_penalty
    }
    const softWeights = {
      ...DEFAULT_SOFT_WEIGHTS,
      ...rawIncomingSoft,
    }

    const payload = {
      schedule: body.schedule,
      metadata: {
        total_lectures:           body.metadata?.total_lectures           ?? body.schedule.length,
        total_rooms:              body.metadata?.total_rooms              ?? 0,
        total_timeslots:          body.metadata?.total_timeslots          ?? 0,
        total_lecturers:          body.metadata?.total_lecturers          ?? 0,
        conflicts:                body.metadata?.conflicts                ?? 0,
        iterations:               body.metadata?.iterations               ?? null,
        wolves:                   body.metadata?.wolves                   ?? null,
        best_fitness:             body.metadata?.best_fitness             ?? null,
        generated_at:             new Date().toISOString(),
        algorithm:                body.metadata?.algorithm                ?? "GWO",
        soft_preference_warnings: body.metadata?.soft_preference_warnings ?? 0,
        gap_warnings:             body.metadata?.gap_warnings             ?? (body.gap_warnings?.length ?? 0),
        overload_violations:      body.metadata?.overload_violations      ?? 0,
        max_classes_per_lecturer: body.metadata?.max_classes_per_lecturer ?? 5,
        total_slots:              body.metadata?.total_slots              ?? 0,
        used_slots:               body.metadata?.used_slots               ?? 0,
        utilization_pct:          body.metadata?.utilization_pct          ?? 0,
        timetable_seat_utilization_pct:
          body.metadata?.timetable_seat_utilization_pct ?? 0,
        workload_penalty:         body.metadata?.workload_penalty         ?? 0,
        distribution_penalty:     body.metadata?.distribution_penalty     ?? 0,
        soft_weights:             softWeights,
        inperson_lectures:        body.metadata?.inperson_lectures        ?? body.session_counts?.inperson_lectures,
        online_lectures:          body.metadata?.online_lectures          ?? body.session_counts?.online_lectures,
        blended_lectures:         body.metadata?.blended_lectures         ?? body.session_counts?.blended_lectures,
        lab_sessions:             body.metadata?.lab_sessions             ?? body.session_counts?.lab_sessions,
        // NEW summary counters
        unit_conflict_count:  body.metadata?.unit_conflict_count  ?? (body.unit_conflict_violations?.length ?? 0),
        student_gap_count:    body.metadata?.student_gap_count    ?? (body.student_gap_warnings?.length     ?? 0),
        single_session_day_count:
          body.metadata?.single_session_day_count ??
          body.metadata?.early_thursday_count ??
          (body.single_session_day_warnings?.length ??
            body.early_thursday_warnings?.length ??
            0),
      },
      lecturer_summary:      body.lecturer_summary      ?? [],
      preference_warnings:   body.preference_warnings   ?? [],
      gap_warnings:          body.gap_warnings          ?? [],
      utilization_info:      body.utilization_info      ?? [],
      workload_info:         body.workload_info         ?? [],
      distribution_info:     body.distribution_info     ?? [],
      room_summary:          body.room_summary          ?? [],
      lecturer_preferences:  body.lecturer_preferences  ?? {},
      soft_weights:          softWeights,
      timeslots_catalogue:   body.timeslots_catalogue   ?? [],
      room_types_map:        body.room_types_map        ?? {},
      session_counts:        body.session_counts        ?? undefined,
      wrong_slot_type_violations: body.wrong_slot_type_violations ?? [],
      // NEW: study plan / student constraint data
      study_plan_units:         body.study_plan_units         ?? {},
      study_plan_summary:       studyPlanSummaryIn.length ? studyPlanSummaryIn : body.study_plan_summary ?? [],
      unit_conflict_violations: body.unit_conflict_violations ?? [],
      student_gap_warnings:     body.student_gap_warnings     ?? [],
      single_session_day_warnings:
        body.single_session_day_warnings ?? body.early_thursday_warnings ?? [],
    }

    await writeFile(DATA_FILE, JSON.stringify(payload, null, 2), "utf-8")
    return NextResponse.json({ ok: true, count: body.schedule.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
