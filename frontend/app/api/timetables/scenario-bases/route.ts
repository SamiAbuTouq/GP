import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRefreshOrBearer } from "@/lib/server-auth";

/**
 * Eligible timetables for what-if scenario baseline selection.
 * Logic mirrors Nest `TimetablesService.list(..., scenarioRunBasesOnly)` as far as this repo’s
 * frontend Prisma schema allows (it has no `ScenarioRun` relation — we rely on `generation_type`
 * for scenario-result rows).
 *
 * Uses this app’s Prisma `DATABASE_URL` — the same DB as `POST /api/timetables/persist` from
 * timetable generation — so optimizer drafts appear even when the Nest API points at another DB.
 */
function decodeSemesterType(type: number): string {
  const map: Record<number, string> = {
    1: "First Semester",
    2: "Second Semester",
    3: "Summer Semester",
  };
  return map[type] ?? `Semester ${type}`;
}

function isOptimizerScenarioRunBaseGenerationType(gen: string | null | undefined): boolean {
  const g = String(gen ?? "").trim().toLowerCase();
  return g === "gwo_ui" || g === "gwo";
}

/** Same intent as Nest `scenarioBaseWhere` minus `scenario_runs_as_result` (not in frontend schema). */
function scenarioBaseWhere() {
  return {
    AND: [
      { generation_type: { notIn: ["what_if", "what_if_applied"] } },
      {
        OR: [
          { semester_id: { not: null } },
          { generation_type: { in: ["gwo_ui", "gwo", "GWO_UI", "GWO", "Gwo_Ui"] } },
        ],
      },
    ],
  };
}

function mapTimetableSummary(t: {
  timetable_id: number;
  semester_id: number | null;
  generated_at: Date;
  status: string;
  generation_type: string;
  version_number: number;
  semester: {
    academic_year: string;
    semester_type: number;
    total_students: number | null;
  } | null;
  timetable_metrics: {
    room_utilization_rate: unknown;
    soft_constraints_score: unknown;
    fitness_score: unknown;
    is_valid: boolean;
  } | null;
}) {
  const isDraft = t.semester_id == null;
  const isScenarioResult = t.generation_type === "what_if";
  const canUseAsScenarioBase =
    !isScenarioResult &&
    (t.semester_id != null || isOptimizerScenarioRunBaseGenerationType(t.generation_type));
  const draftOrigin: "optimizer" | "scenario" | "other" | null = isDraft
    ? isScenarioResult
      ? "scenario"
      : isOptimizerScenarioRunBaseGenerationType(t.generation_type)
        ? "optimizer"
        : "other"
    : null;

  return {
    timetableId: t.timetable_id,
    semesterId: t.semester_id,
    academicYear: t.semester?.academic_year ?? "Unassigned",
    semesterType: t.semester?.semester_type ?? 0,
    semester: t.semester ? decodeSemesterType(t.semester.semester_type) : "Unassigned draft",
    totalStudents: t.semester?.total_students ?? null,
    generatedAt: t.generated_at,
    status: t.status,
    generationType: t.generation_type,
    versionNumber: t.version_number,
    isDraft,
    isPublished: !isDraft,
    isScenarioResult,
    draftOrigin,
    canUseAsScenarioBase,
    timetableKind: isDraft ? "draft" : "published",
    metrics: t.timetable_metrics
      ? {
          roomUtilizationRate: t.timetable_metrics.room_utilization_rate,
          softConstraintsScore: t.timetable_metrics.soft_constraints_score,
          fitnessScore: t.timetable_metrics.fitness_score,
          isValid: t.timetable_metrics.is_valid,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthFromRefreshOrBearer(request);
  if (!auth.ok) return auth.response;
  if (auth.role !== "ADMIN" && auth.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const timetables = await prisma.timetable.findMany({
      where: scenarioBaseWhere(),
      include: {
        semester: true,
        timetable_metrics: true,
      },
      orderBy: [{ generated_at: "desc" }, { timetable_id: "desc" }],
    });
    return NextResponse.json(timetables.map(mapTimetableSummary));
  } catch (err) {
    console.error("[GET /api/timetables/scenario-bases]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
