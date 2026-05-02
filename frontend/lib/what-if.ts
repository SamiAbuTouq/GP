"use client";

import { ApiClient } from "@/lib/api-client";

export type ScenarioStatus = "draft" | "active" | "applied";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "applied";

export type Condition = {
  type: string;
  parameters: Record<string, unknown>;
};

export type MetricSnapshot = {
  conflicts: number;
  roomUtilizationRate: number;
  softConstraintsScore: number;
  fitnessScore: number;
  lecturerBalanceScore: number | null;
};

/** Coerce API / Prisma JSON metrics (may be strings or partial) into numbers. */
export function normalizeMetricSnapshot(raw: unknown): MetricSnapshot | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown, def = 0): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const x = Number(v);
      if (Number.isFinite(x)) return x;
    }
    return def;
  };
  const nullableNum = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const x = Number(v);
      if (Number.isFinite(x)) return x;
    }
    return null;
  };
  return {
    conflicts: num(o.conflicts),
    roomUtilizationRate: num(o.roomUtilizationRate ?? o.room_utilization_rate),
    softConstraintsScore: num(o.softConstraintsScore ?? o.soft_constraints_score),
    fitnessScore: num(o.fitnessScore ?? o.fitness_score),
    lecturerBalanceScore: nullableNum(o.lecturerBalanceScore ?? o.lecturer_balance_score),
  };
}

export type WhatIfRun = {
  id: number;
  scenarioName?: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  baseTimetableName: string;
  baseTimetableId: number;
  resultTimetableId: number | null;
  metricsBaseline: MetricSnapshot | null;
  metricsResult: MetricSnapshot | null;
  recommendation: string | null;
  errorMessage: string | null;
  resultEntryCount: number | null;
  isApplied: boolean;
};

export type Scenario = {
  id: number;
  name: string;
  description: string;
  status: ScenarioStatus;
  conditions: Condition[];
  conditionCount: number;
  latestRun: WhatIfRun | null;
  hasAppliedRuns: boolean;
  /** True when a child process is still attached (best-effort; refreshes on poll). */
  isRunning?: boolean;
};

export type TimetableOption = {
  timetableId: number;
  semester: string;
  academicYear: string;
  versionNumber: number;
  status?: string;
  generationType?: string;
  isDraft: boolean;
  isPublished: boolean;
  isScenarioResult: boolean;
  timetableKind: "draft" | "published";
  draftOrigin?: "optimizer" | "scenario" | "other" | null;
  /** From API: bases allowed for scenario runs (published schedules + GWO UI drafts only). */
  canUseAsScenarioBase?: boolean;
};

export const CONDITION_LABELS: Record<string, string> = {
  add_lecturer: "Add Lecturer",
  delete_lecturer: "Remove Lecturer",
  amend_lecturer: "Amend Lecturer",
  add_room: "Add Room",
  delete_room: "Remove Room",
  adjust_room_capacity: "Adjust Room Capacity",
  add_course: "Add Course",
  change_section_count: "Change Section Count",
  change_delivery_mode: "Change Delivery Mode",
  add_timeslot: "Add Timeslot",
  delete_timeslot: "Remove Timeslot",
};

export async function getScenarios(): Promise<Scenario[]> {
  const rows = await ApiClient.request<any[]>("/what-if/scenarios");
  return rows.map(normalizeScenario);
}

export async function getScenario(id: number): Promise<Scenario> {
  const row = await ApiClient.request<any>(`/what-if/scenarios/${id}`);
  return normalizeScenario(row);
}

export async function getRuns(scenarioId: number): Promise<WhatIfRun[]> {
  const rows = await ApiClient.request<any[]>(`/what-if/scenarios/${scenarioId}/runs`);
  return rows.map(normalizeRun);
}

export async function getTimetables(opts?: { scenarioRunBasesOnly?: boolean }): Promise<TimetableOption[]> {
  const path = opts?.scenarioRunBasesOnly ? "/timetables?scenarioRunBasesOnly=true" : "/timetables";
  const rows = await ApiClient.request<any[]>(path);
  return rows.map((row) => {
    const gen = String(row.generationType ?? row.generation_type ?? "").toLowerCase();
    const isPublishedApi = Boolean(row.isPublished ?? row.is_published ?? (row.semesterId ?? row.semester_id) != null);
    const isScenarioResult = Boolean(
      row.isScenarioResult ?? row.is_scenario_result ?? gen === "what_if",
    );
    const inferredCanBase = !isScenarioResult && (isPublishedApi || gen === "gwo_ui");
    const apiCanUse = row.canUseAsScenarioBase ?? row.can_use_as_scenario_base;
    const canUse = apiCanUse != null ? Boolean(apiCanUse) : inferredCanBase;

    return {
      timetableId: Number(row.timetableId ?? row.timetable_id),
      semester: String(row.semester ?? row.semesterName ?? "Semester"),
      academicYear: String(row.academicYear ?? row.academic_year ?? "-"),
      versionNumber: Number(row.versionNumber ?? row.version_number ?? 1),
      status: row.status,
      generationType: String(row.generationType ?? row.generation_type ?? ""),
      isDraft: Boolean(row.isDraft ?? row.is_draft ?? (row.semesterId ?? row.semester_id) == null),
      isPublished: isPublishedApi,
      isScenarioResult,
      timetableKind: (isPublishedApi ? "published" : "draft") as "draft" | "published",
      draftOrigin: (row.draftOrigin ?? row.draft_origin ?? null) as TimetableOption["draftOrigin"],
      canUseAsScenarioBase: canUse,
    };
  });
}

export function conditionLabel(type: string): string {
  return CONDITION_LABELS[type] ?? type.replaceAll("_", " ");
}

export type WhatIfLookupOption = { value: string; label: string };

function lookupLabel(options: WhatIfLookupOption[], id: unknown): string | null {
  if (id == null || id === "") return null;
  const s = String(id);
  return options.find((o) => o.value === s)?.label ?? null;
}

/** Human-readable one-line summary for a condition row (templates + saved scenarios). */
export function conditionParameterSummary(
  c: Condition,
  ctx: {
    lecturerOptions: WhatIfLookupOption[];
    roomOptions: WhatIfLookupOption[];
    courseOptions: WhatIfLookupOption[];
    timeslotOptions: WhatIfLookupOption[];
  },
): string {
  const p = c.parameters as Record<string, unknown>;
  const L = (opts: WhatIfLookupOption[], id: unknown) => lookupLabel(opts, id);
  switch (c.type) {
    case "delete_lecturer":
    case "amend_lecturer":
      return L(ctx.lecturerOptions, p.lecturerUserId ?? p.lecturerId) ?? `Lecturer #${p.lecturerUserId ?? p.lecturerId ?? "?"}`;
    case "add_lecturer": {
      const full = [String(p.firstName ?? "").trim(), String(p.lastName ?? "").trim()].filter(Boolean).join(" ");
      const mw = typeof p.maxWorkload === "number" ? p.maxWorkload : "?";
      return full ? `${full} · max workload ${mw}` : `New lecturer · max workload ${mw}`;
    }
    case "delete_room":
    case "adjust_room_capacity": {
      const room = L(ctx.roomOptions, p.roomId) ?? `Room #${p.roomId ?? "?"}`;
      if (c.type === "adjust_room_capacity") return `${room} → capacity ${p.newCapacity ?? "?"}`;
      return room;
    }
    case "add_room":
      return `Room ${p.roomNumber ?? "?"} · capacity ${p.capacity ?? "?"} · type ${p.roomType ?? "?"}`;
    case "add_course":
      return `${p.courseCode ?? "?"} — ${p.courseName ?? "?"}`;
    case "change_section_count": {
      const course = L(ctx.courseOptions, p.courseId) ?? `Course #${p.courseId ?? "?"}`;
      return `${course} · normal ${p.newSectionsNormal ?? 0}, summer ${p.newSectionsSummer ?? 0}`;
    }
    case "change_delivery_mode": {
      const course = L(ctx.courseOptions, p.courseId) ?? `Course #${p.courseId ?? "?"}`;
      return `${course} → ${String(p.newDeliveryMode ?? "")}`;
    }
    case "add_timeslot": {
      const days =
        Array.isArray(p.days) && p.days.length
          ? p.days.join(", ")
          : `days mask ${p.daysMask ?? "?"}`;
      return `${p.startTime ?? "?"}–${p.endTime ?? "?"} · ${days}${p.isSummer ? " · summer" : ""}`;
    }
    case "delete_timeslot":
      return L(ctx.timeslotOptions, p.slotId) ?? `Timeslot #${p.slotId ?? "?"}`;
    default:
      return JSON.stringify(p);
  }
}

/** Client-side apply hint from baseline vs result (aligned with backend compare recommendations). */
export function recommendationFromMetrics(
  baseline: MetricSnapshot | null,
  result: MetricSnapshot | null,
  scenarioName: string,
): string | null {
  if (!baseline || !result) return null;
  const deltas = {
    conflicts: (result.conflicts ?? 0) - (baseline.conflicts ?? 0),
    roomUtilizationRate: (result.roomUtilizationRate ?? 0) - (baseline.roomUtilizationRate ?? 0),
    softConstraintsScore: (result.softConstraintsScore ?? 0) - (baseline.softConstraintsScore ?? 0),
    fitnessScore: (result.fitnessScore ?? 0) - (baseline.fitnessScore ?? 0),
    lecturerBalanceScore:
      baseline.lecturerBalanceScore != null && result.lecturerBalanceScore != null
        ? result.lecturerBalanceScore - baseline.lecturerBalanceScore
        : null,
  };
  let positives = 0;
  let negatives = 0;
  if (deltas.conflicts < 0) positives++;
  else if (deltas.conflicts > 0) negatives++;
  if (deltas.roomUtilizationRate > 0) positives++;
  else if (deltas.roomUtilizationRate < -2) negatives++;
  if (deltas.softConstraintsScore > 0) positives++;
  else if (deltas.softConstraintsScore < -2) negatives++;
  if (deltas.fitnessScore > 0) positives++;
  else if (deltas.fitnessScore < 0) negatives++;
  if (typeof deltas.lecturerBalanceScore === "number") {
    if (deltas.lecturerBalanceScore > 0) positives++;
    else if (deltas.lecturerBalanceScore < -0.1) negatives++;
  }
  const total = positives + negatives;
  if (total === 0) return `"${scenarioName}" produces no measurable change in key metrics.`;
  const ratio = positives / total;
  if (ratio >= 0.8) return `Apply recommended — "${scenarioName}" improves ${positives}/${total} key metrics with no significant downsides.`;
  if (ratio >= 0.6) return `Apply with caution — "${scenarioName}" improves most metrics but has ${negatives} area(s) of concern.`;
  if (negatives > positives) return `Apply not recommended — "${scenarioName}" worsens more metrics than it improves.`;
  return `Mixed results — "${scenarioName}" has equal positive and negative effects.`;
}

export function normalizeRun(row: any): WhatIfRun {
  const baselineRaw = row.metricsBaseline ?? row.baselineMetrics ?? row.baseline_metrics ?? null;
  const resultRaw = row.metricsResult ?? row.resultMetrics ?? row.result_metrics ?? null;
  const baseline = normalizeMetricSnapshot(baselineRaw);
  const result = normalizeMetricSnapshot(resultRaw);
  return {
    id: Number(row.id ?? row.runId ?? row.run_id),
    scenarioName:
      row.scenarioName != null
        ? String(row.scenarioName)
        : row.scenario_name != null
          ? String(row.scenario_name)
          : undefined,
    status: String(row.status ?? "pending") as RunStatus,
    startedAt: String(row.startedAt ?? row.started_at ?? new Date().toISOString()),
    completedAt: row.completedAt ?? row.completed_at ?? null,
    durationSeconds:
      row.durationSeconds ??
      row.generationSeconds ??
      row.generation_seconds ??
      null,
    baseTimetableName:
      row.baseTimetableName ??
      (row.semester
        ? `${row.semester.academicYear ?? row.semester.academic_year ?? ""}`
        : `Timetable ${row.baseTimetableId ?? row.base_timetable_id}`),
    baseTimetableId: Number(row.baseTimetableId ?? row.base_timetable_id ?? 0),
    resultTimetableId:
      row.resultTimetableId != null
        ? Number(row.resultTimetableId)
        : row.result_timetable_id != null
          ? Number(row.result_timetable_id)
          : null,
    metricsBaseline: baseline,
    metricsResult: result,
    recommendation: row.recommendation ?? null,
    errorMessage: row.errorMessage ?? row.error_message ?? null,
    resultEntryCount: row.resultEntryCount ?? null,
    isApplied: String(row.status) === "applied",
  };
}

function normalizeScenario(row: any): Scenario {
  return {
    id: Number(row.id ?? row.scenario_id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    status: String(row.status ?? "draft") as ScenarioStatus,
    conditions: (row.conditions ?? []).map((c: any) => ({
      type: String(c.type ?? c.condition_type),
      parameters: (c.parameters ?? {}) as Record<string, unknown>,
    })),
    conditionCount: Number(row.conditionCount ?? row.condition_count ?? row.conditions?.length ?? 0),
    latestRun: row.latestRun ? normalizeRun(row.latestRun) : null,
    hasAppliedRuns:
      Boolean(row.hasAppliedRuns) ||
      (Array.isArray(row.runs) && row.runs.some((r: any) => r.status === "applied")),
    isRunning: Boolean(row.isRunning),
  };
}
