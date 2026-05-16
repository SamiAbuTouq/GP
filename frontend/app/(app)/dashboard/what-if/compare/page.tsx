"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { ApiClient, ApiError } from "@/lib/api-client";
import {
  fetchTimetableConflictSummary,
  resolveHardConflictCount,
  type HardConflictByTimetableId,
} from "@/lib/timetable-conflicts";
import {
  getTimetables,
  getRuns,
  getScenarios,
  normalizeMetricSnapshot,
  storeScenarioRun,
  type MetricSnapshot,
  type Scenario,
  type TimetableOption,
  type WhatIfRun,
} from "@/lib/what-if";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { useDateTimeFormat } from "@/components/datetime-preferences-context";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CompareModeApi = "before_after" | "cross_timetable" | "cross_scenario";

type UiMode = "before-after" | "cross-timetable" | "cross-scenario";

type ConflictBreakdown = {
  roomConflicts: number;
  lecturerConflicts: number;
  timeslotClashes: number;
};

type SectionChangePerCourse = {
  courseId: number;
  courseCode: string;
  sectionsAffected: number;
  sectionsWithRoomChange: number;
  sectionsWithLecturerChange: number;
  sectionsWithSlotChange: number;
};

type SectionChangeDetail = {
  courseId: number;
  courseCode: string;
  courseName: string;
  sectionNumber: string;
  changeType: "added" | "removed" | "reassigned";
  roomChanged?: boolean;
  lecturerChanged?: boolean;
  timeslotChanged?: boolean;
};

type CourseSectionChangeRow = {
  key: string;
  courseId: number;
  courseName: string;
  courseCode: string;
  deltaLabel: string;
  kind: "added" | "removed";
};

function courseSectionChangeRows(changedSections: SectionChangeDetail[]): CourseSectionChangeRow[] {
  const byCourse = new Map<
    number,
    { courseName: string; courseCode: string; added: number; removed: number }
  >();
  for (const s of changedSections) {
    if (s.changeType !== "added" && s.changeType !== "removed") continue;
    const agg = byCourse.get(s.courseId) ?? {
      courseName: s.courseName,
      courseCode: s.courseCode,
      added: 0,
      removed: 0,
    };
    if (s.changeType === "added") agg.added += 1;
    else agg.removed += 1;
    byCourse.set(s.courseId, agg);
  }
  const rows: CourseSectionChangeRow[] = [];
  for (const [courseId, agg] of byCourse) {
    const net = agg.added - agg.removed;
    if (net === 0) continue;
    const base = { courseId, courseName: agg.courseName, courseCode: agg.courseCode };
    if (net > 0) {
      rows.push({ ...base, key: String(courseId), deltaLabel: `+${net}`, kind: "added" });
    } else {
      rows.push({ ...base, key: String(courseId), deltaLabel: `−${Math.abs(net)}`, kind: "removed" });
    }
  }
  return rows.sort((a, b) =>
    a.courseName.localeCompare(b.courseName, undefined, { sensitivity: "base" }),
  );
}

type ComparisonRow = {
  runId: number;
  scenarioId: number;
  scenarioName: string;
  conditionCount: number;
  baseTimetableId: number;
  resultTimetableId: number | null;
  baseline: MetricSnapshot | null;
  result: MetricSnapshot | null;
  deltas: {
    conflicts: number;
    roomUtilizationRate: number;
    softConstraintsScore: number;
    fitnessScore: number;
    lecturerBalanceScore: number | null;
  } | null;
  recommendation: string;
  baselineConflictBreakdown: ConflictBreakdown | null;
  resultConflictBreakdown: ConflictBreakdown | null;
  conflictBreakdownDelta: ConflictBreakdown | null;
  gwoIterationsRun: number | null;
  generationSeconds: number | null;
  disruptionLevel: "Low" | "Moderate" | "High";
  sectionChanges: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
    baselineCount: number;
    resultCount: number;
    percentSectionsAffected: number;
    perCourse: SectionChangePerCourse[];
    changedSections: SectionChangeDetail[];
  } | null;
};

type SelectableRun = {
  id: number;
  scenarioId: number;
  scenarioName: string;
  baseTimetableId: number;
  baseTimetableName: string;
  status: WhatIfRun["status"];
  startedAt: string;
};

function parseRunIds(searchParams: URLSearchParams): number[] {
  const raw = searchParams.get("runIds") ?? searchParams.get("runId");
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function uiModeToApi(m: UiMode): CompareModeApi {
  if (m === "before-after") return "before_after";
  if (m === "cross-timetable") return "cross_timetable";
  return "cross_scenario";
}

function normalizeConflictBreakdown(raw: unknown): ConflictBreakdown | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
    if (typeof v === "string") {
      const x = Number(v);
      return Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0;
    }
    return 0;
  };
  return {
    roomConflicts: num(o.roomConflicts ?? o.room_conflicts),
    lecturerConflicts: num(o.lecturerConflicts ?? o.lecturer_conflicts),
    timeslotClashes: num(o.timeslotClashes ?? o.timeslot_clashes),
  };
}

function disruptionFromPercent(pct: number): "Low" | "Moderate" | "High" {
  if (pct <= 12) return "Low";
  if (pct <= 28) return "Moderate";
  return "High";
}

function normalizeComparisonApiRow(raw: Record<string, unknown>): ComparisonRow {
  const d = raw.deltas as Record<string, unknown> | null | undefined;
  const num = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const x = Number(v);
      return Number.isFinite(x) ? x : 0;
    }
    return 0;
  };
  const nullableNum = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const x = Number(v);
      return Number.isFinite(x) ? x : null;
    }
    return null;
  };
  const nullableInt = (v: unknown): number | null => {
    if (v == null) return null;
    const n = num(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const sectionRaw =
    raw.sectionChanges && typeof raw.sectionChanges === "object"
      ? (raw.sectionChanges as Record<string, unknown>)
      : null;
  const pctRaw = sectionRaw ? sectionRaw.percentSectionsAffected ?? sectionRaw.percent_sections_affected : undefined;
  let pct =
    typeof pctRaw === "number" && Number.isFinite(pctRaw)
      ? pctRaw
      : typeof pctRaw === "string" && pctRaw.trim() !== ""
        ? Number(pctRaw)
        : NaN;
  const perCourseRaw = sectionRaw?.perCourse ?? sectionRaw?.per_course;
  const perCourse: SectionChangePerCourse[] = Array.isArray(perCourseRaw)
    ? perCourseRaw.map((row: Record<string, unknown>) => ({
        courseId: Number(row.courseId ?? row.course_id ?? 0),
        courseCode: String(row.courseCode ?? row.course_code ?? ""),
        sectionsAffected: num(row.sectionsAffected ?? row.sections_affected),
        sectionsWithRoomChange: num(row.sectionsWithRoomChange ?? row.sections_with_room_change),
        sectionsWithLecturerChange: num(row.sectionsWithLecturerChange ?? row.sections_with_lecturer_change),
        sectionsWithSlotChange: num(row.sectionsWithSlotChange ?? row.sections_with_slot_change),
      }))
    : [];
  const changedSectionsRaw = sectionRaw?.changedSections ?? sectionRaw?.changed_sections;
  const changedSections: SectionChangeDetail[] = Array.isArray(changedSectionsRaw)
    ? changedSectionsRaw.map((row: Record<string, unknown>) => {
        const changeTypeRaw = String(row.changeType ?? row.change_type ?? "reassigned");
        const changeType: SectionChangeDetail["changeType"] =
          changeTypeRaw === "added" || changeTypeRaw === "removed" || changeTypeRaw === "reassigned"
            ? changeTypeRaw
            : "reassigned";
        const courseCode = String(row.courseCode ?? row.course_code ?? "");
        return {
          courseId: Number(row.courseId ?? row.course_id ?? 0),
          courseCode,
          courseName: String(row.courseName ?? row.course_name ?? "").trim() || courseCode,
          sectionNumber: String(row.sectionNumber ?? row.section_number ?? ""),
          changeType,
          roomChanged: Boolean(row.roomChanged ?? row.room_changed),
          lecturerChanged: Boolean(row.lecturerChanged ?? row.lecturer_changed),
          timeslotChanged: Boolean(row.timeslotChanged ?? row.timeslot_changed),
        };
      })
    : [];

  if (!Number.isFinite(pct) && sectionRaw) {
    const changed = num(sectionRaw.changed);
    const added = num(sectionRaw.added);
    const removed = num(sectionRaw.removed);
    const bc = Math.max(num(sectionRaw.baselineCount ?? sectionRaw.baseline_count), 1);
    pct = Math.min(100, Math.round(((changed + added + removed) / bc) * 1000) / 10);
  }
  if (!Number.isFinite(pct)) pct = 0;

  const disruptionRaw = raw.disruptionLevel ?? raw.disruption_level;
  const disruptionParsed: "Low" | "Moderate" | "High" =
    disruptionRaw === "Low" || disruptionRaw === "Moderate" || disruptionRaw === "High"
      ? disruptionRaw
      : (() => {
          const s = String(disruptionRaw ?? "").toLowerCase();
          if (s === "low") return "Low";
          if (s === "moderate") return "Moderate";
          if (s === "high") return "High";
          return disruptionFromPercent(pct);
        })();

  return {
    runId: Number(raw.runId ?? raw.run_id ?? 0),
    scenarioId: Number(raw.scenarioId ?? raw.scenario_id ?? 0),
    scenarioName: String(raw.scenarioName ?? raw.scenario_name ?? ""),
    conditionCount: Math.round(num(raw.conditionCount ?? raw.condition_count)),
    baseTimetableId: Number(raw.baseTimetableId ?? raw.base_timetable_id ?? 0),
    resultTimetableId:
      raw.resultTimetableId != null
        ? Number(raw.resultTimetableId)
        : raw.result_timetable_id != null
          ? Number(raw.result_timetable_id)
          : null,
    baseline: normalizeMetricSnapshot(raw.baseline),
    result: normalizeMetricSnapshot(raw.result),
    deltas:
      d && typeof d === "object"
        ? {
            conflicts: num(d.conflicts),
            roomUtilizationRate: num(d.roomUtilizationRate ?? d.room_utilization_rate),
            softConstraintsScore: num(d.softConstraintsScore ?? d.soft_constraints_score),
            fitnessScore: num(d.fitnessScore ?? d.fitness_score),
            lecturerBalanceScore: nullableNum(
              d.lecturerBalanceScore ?? d.lecturer_balance_score,
            ),
          }
        : null,
    recommendation: String(raw.recommendation ?? ""),
    baselineConflictBreakdown: normalizeConflictBreakdown(
      raw.baselineConflictBreakdown ?? raw.baseline_conflict_breakdown,
    ),
    resultConflictBreakdown: normalizeConflictBreakdown(
      raw.resultConflictBreakdown ?? raw.result_conflict_breakdown,
    ),
    conflictBreakdownDelta: normalizeConflictBreakdown(
      raw.conflictBreakdownDelta ?? raw.conflict_breakdown_delta,
    ),
    gwoIterationsRun: nullableInt(raw.gwoIterationsRun ?? raw.gwo_iterations_run),
    generationSeconds: nullableNum(raw.generationSeconds ?? raw.generation_seconds),
    disruptionLevel: disruptionParsed,
    sectionChanges: sectionRaw
      ? {
          added: num(sectionRaw.added),
          removed: num(sectionRaw.removed),
          changed: num(sectionRaw.changed),
          unchanged: num(sectionRaw.unchanged),
          baselineCount: num(sectionRaw.baselineCount ?? sectionRaw.baseline_count),
          resultCount: num(sectionRaw.resultCount ?? sectionRaw.result_count),
          percentSectionsAffected: pct,
          perCourse,
          changedSections,
        }
      : null,
  };
}

type MetricRowKind =
  | "conflicts"
  | "roomUtilizationRate"
  | "softConstraintsScore"
  | "fitnessScore"
  | "lecturerBalanceScore";

function verdictForMetric(
  kind: MetricRowKind,
  delta: number | null | undefined,
): "Better" | "Worse" | "No Change" {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return "No Change";
  const lowerBetter = kind === "conflicts";
  const improved = lowerBetter ? delta < 0 : delta > 0;
  return improved ? "Better" : "Worse";
}

function DeltaVerdictBadge({ verdict }: { verdict: "Better" | "Worse" | "No Change" }) {
  if (verdict === "No Change") {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        No change
      </Badge>
    );
  }
  if (verdict === "Better") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/50 bg-emerald-500/10 font-normal text-emerald-800 dark:text-emerald-300"
      >
        Better
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-rose-500/50 bg-rose-500/10 font-normal text-rose-800 dark:text-rose-300">
      Worse
    </Badge>
  );
}

function formatDelta(delta: number | null): string {
  if (delta == null || !Number.isFinite(delta)) return "—";
  const absSmall = Math.abs(delta) < 10;
  const s = absSmall ? delta.toFixed(2).replace(/\.?0+$/, "") : String(delta);
  return `${delta > 0 ? "+" : ""}${s}`;
}

function metricTable(
  baseline: MetricSnapshot | null,
  result: MetricSnapshot | null,
  deltas: ComparisonRow["deltas"],
  opts?: {
    showVerdicts?: boolean;
    baselineTimetableId?: number | null;
    resultTimetableId?: number | null;
    hardConflictByTimetableId?: HardConflictByTimetableId;
  },
) {
  const showVerdicts = opts?.showVerdicts ?? false;
  const hardMap = opts?.hardConflictByTimetableId ?? {};
  const bHard = resolveHardConflictCount(
    opts?.baselineTimetableId ?? null,
    baseline?.conflicts ?? null,
    hardMap,
  );
  const rHard = resolveHardConflictCount(opts?.resultTimetableId ?? null, result?.conflicts ?? null, hardMap);
  const conflictsDelta =
    bHard != null && rHard != null ? rHard - bHard : (deltas?.conflicts ?? null);
  const rows = [
    ["Hard conflicts", "conflicts", bHard, rHard, conflictsDelta, true],
    ["Room utilization", "roomUtilizationRate", baseline?.roomUtilizationRate, result?.roomUtilizationRate, deltas?.roomUtilizationRate, false],
    ["Soft constraints", "softConstraintsScore", baseline?.softConstraintsScore, result?.softConstraintsScore, deltas?.softConstraintsScore, false],
    ["Fitness", "fitnessScore", baseline?.fitnessScore, result?.fitnessScore, deltas?.fitnessScore, false],
    ["Lecturer balance", "lecturerBalanceScore", baseline?.lecturerBalanceScore, result?.lecturerBalanceScore, deltas?.lecturerBalanceScore, false],
  ] as const;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="p-2 text-left font-medium">Metric</th>
            <th className="p-2 text-center font-medium">Baseline</th>
            <th className="p-2 text-center font-medium">Result</th>
            <th className="p-2 text-center font-medium">Delta</th>
            {showVerdicts ? (
              <th className="p-2 text-center font-medium">Verdict</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, kind, b, r, d, lowerIsBetter]) => {
            const delta =
              typeof d === "number" && Number.isFinite(d)
                ? d
                : r != null && b != null && typeof r === "number" && typeof b === "number"
                  ? r - b
                  : null;
            const good =
              delta != null &&
              delta !== 0 &&
              (lowerIsBetter ? delta < 0 : Boolean(delta > 0));
            const verdict = showVerdicts ? verdictForMetric(kind as MetricRowKind, delta) : null;
            return (
              <tr key={label} className="border-b last:border-0">
                <td className="p-2">{label}</td>
                <td className="p-2 text-center tabular-nums">{b ?? "—"}</td>
                <td className="p-2 text-center tabular-nums">{r ?? "—"}</td>
                <td
                  className={`p-2 text-center tabular-nums ${
                    delta == null || delta === 0 ? "text-muted-foreground" : good ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatDelta(delta)}
                </td>
                {showVerdicts && verdict ? (
                  <td className="p-2 text-center">
                    <DeltaVerdictBadge verdict={verdict} />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function conflictBreakdownPanel(
  title: string,
  base: ConflictBreakdown | null,
  res: ConflictBreakdown | null,
  delta: ConflictBreakdown | null,
) {
  const row = (label: string, b: number, r: number, d: number | null) => (
    <tr className="border-b last:border-0">
      <td className="p-2">{label}</td>
      <td className="p-2 text-center tabular-nums">{b}</td>
      <td className="p-2 text-center tabular-nums">{r}</td>
      <td className="p-2 text-center tabular-nums text-muted-foreground">
        {d == null ? "—" : `${d > 0 ? "+" : ""}${d}`}
      </td>
    </tr>
  );
  const zb = base ?? { roomConflicts: 0, lecturerConflicts: 0, timeslotClashes: 0 };
  const zr = res ?? { roomConflicts: 0, lecturerConflicts: 0, timeslotClashes: 0 };
  const zd = delta;
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="overflow-x-auto p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/25">
              <th className="p-2 text-left font-medium">Type</th>
              <th className="p-2 text-center font-medium">Baseline</th>
              <th className="p-2 text-center font-medium">Result</th>
              <th className="p-2 text-center font-medium">Δ pairs</th>
            </tr>
          </thead>
          <tbody>
            {row("Room conflicts", zb.roomConflicts, zr.roomConflicts, zd ? zd.roomConflicts : null)}
            {row("Lecturer conflicts", zb.lecturerConflicts, zr.lecturerConflicts, zd ? zd.lecturerConflicts : null)}
            {row("Timeslot / cohort clashes", zb.timeslotClashes, zr.timeslotClashes, zd ? zd.timeslotClashes : null)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function metricSnapshotMiniTable(
  title: string,
  snapshot: MetricSnapshot | null,
  footnote?: string,
  opts?: {
    timetableId?: number | null;
    hardConflictByTimetableId?: HardConflictByTimetableId;
  },
) {
  const hardMap = opts?.hardConflictByTimetableId ?? {};
  const hardConflicts =
    snapshot != null
      ? resolveHardConflictCount(opts?.timetableId ?? null, snapshot.conflicts, hardMap)
      : null;
  const metricsConflictSnap = snapshot?.conflicts ?? null;
  const conflictDebug =
    hardConflicts != null &&
    metricsConflictSnap != null &&
    Math.round(hardConflicts) !== Math.round(metricsConflictSnap);

  const rows: Array<[string, number | null, ReactNode]> = snapshot
    ? [
        ["Hard conflicts", hardConflicts, conflictDebug ? (
          <span className="block text-[11px] font-normal text-muted-foreground">
            Run metrics snapshot: {metricsConflictSnap}
          </span>
        ) : null],
        ["Room utilization %", snapshot.roomUtilizationRate, null],
        ["Soft constraints", snapshot.softConstraintsScore, null],
        ["Fitness", snapshot.fitnessScore, null],
        ["Lecturer balance", snapshot.lecturerBalanceScore, null],
      ]
    : [];
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        {footnote ? <p className="mt-1 text-xs text-muted-foreground">{footnote}</p> : null}
      </div>
      <div className="p-3">
        {!snapshot ? (
          <p className="text-sm text-muted-foreground">No metrics recorded.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {rows.map(([label, val, extra]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-border/40 py-2 last:border-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right tabular-nums font-medium">
                  <span className="block">{val == null ? "—" : val}</span>
                  {extra}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function competitionRanks(
  raw: (number | null | undefined)[],
  lowerBetter: boolean,
): (number | null)[] {
  const out: (number | null)[] = raw.map(() => null);
  const idx = raw
    .map((v, i) => ({
      v: typeof v === "number" && Number.isFinite(v) ? v : null,
      i,
    }))
    .filter((x): x is { v: number; i: number } => x.v != null);
  idx.sort((a, b) => (lowerBetter ? a.v - b.v : b.v - a.v));
  let lastRank = 1;
  for (let k = 0; k < idx.length; k++) {
    const rank = k === 0 || idx[k]!.v !== idx[k - 1]!.v ? k + 1 : lastRank;
    lastRank = rank;
    out[idx[k]!.i] = rank;
  }
  return out;
}

function ordinalRankLabel(rank: number | null): string {
  if (rank == null) return "—";
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

function jDominatesI(j: MetricSnapshot, i: MetricSnapshot): boolean {
  const lecGe =
    j.lecturerBalanceScore == null || i.lecturerBalanceScore == null
      ? true
      : j.lecturerBalanceScore >= i.lecturerBalanceScore;
  const ge =
    j.conflicts <= i.conflicts &&
    j.roomUtilizationRate >= i.roomUtilizationRate &&
    j.softConstraintsScore >= i.softConstraintsScore &&
    j.fitnessScore >= i.fitnessScore &&
    lecGe;
  const strict =
    j.conflicts < i.conflicts ||
    j.roomUtilizationRate > i.roomUtilizationRate ||
    j.softConstraintsScore > i.softConstraintsScore ||
    j.fitnessScore > i.fitnessScore ||
    (j.lecturerBalanceScore != null &&
      i.lecturerBalanceScore != null &&
      j.lecturerBalanceScore > i.lecturerBalanceScore);
  return ge && strict;
}

function paretoOptimalFlags(
  rows: ComparisonRow[],
  hardConflictByTimetableId: HardConflictByTimetableId = {},
): boolean[] {
  const resultWithResolved = (c: ComparisonRow): MetricSnapshot | null => {
    if (!c.result) return null;
    const co = resolveHardConflictCount(
      c.resultTimetableId,
      c.result.conflicts ?? null,
      hardConflictByTimetableId,
    );
    if (co == null) return c.result;
    return { ...c.result, conflicts: co };
  };
  return rows.map((_, idx) => {
    const ri = resultWithResolved(rows[idx]!);
    if (!ri) return false;
    for (let j = 0; j < rows.length; j++) {
      if (j === idx) continue;
      const rj = resultWithResolved(rows[j]!);
      if (rj && jDominatesI(rj, ri)) return false;
    }
    return true;
  });
}

function CrossTimetableComparisonBlock({
  comparisons,
  hardConflictByTimetableId,
  onStore,
  storingRunId,
}: {
  comparisons: ComparisonRow[];
  hardConflictByTimetableId: HardConflictByTimetableId;
  onStore?: (runId: number) => void;
  storingRunId?: number | null;
}) {
  const bestOverallIdx = useMemo(() => {
    if (!comparisons.length) return -1;
    let best = 0;
    for (let i = 1; i < comparisons.length; i++) {
      const a = comparisons[best]!;
      const b = comparisons[i]!;
      const ca =
        resolveHardConflictCount(a.resultTimetableId, a.result?.conflicts ?? null, hardConflictByTimetableId) ??
        Number.POSITIVE_INFINITY;
      const cb =
        resolveHardConflictCount(b.resultTimetableId, b.result?.conflicts ?? null, hardConflictByTimetableId) ??
        Number.POSITIVE_INFINITY;
      const fa = a.result?.fitnessScore ?? Number.NEGATIVE_INFINITY;
      const fb = b.result?.fitnessScore ?? Number.NEGATIVE_INFINITY;
      if (cb < ca || (cb === ca && fb > fa)) best = i;
    }
    return best;
  }, [comparisons, hardConflictByTimetableId]);

  const improvedHowMany = useMemo(() => {
    return comparisons.filter((c) => {
      const d = c.deltas;
      const bH = resolveHardConflictCount(c.baseTimetableId, c.baseline?.conflicts ?? null, hardConflictByTimetableId);
      const rH = resolveHardConflictCount(c.resultTimetableId, c.result?.conflicts ?? null, hardConflictByTimetableId);
      const conflictDelta = bH != null && rH != null ? rH - bH : d?.conflicts;
      const fitnessOk = d != null && d.fitnessScore > 0.0001;
      if (conflictDelta != null && conflictDelta < 0) return true;
      return fitnessOk;
    }).length;
  }, [comparisons, hardConflictByTimetableId]);

  const conflictRanks = useMemo(
    () =>
      competitionRanks(
        comparisons.map((c) =>
          resolveHardConflictCount(c.resultTimetableId, c.result?.conflicts ?? null, hardConflictByTimetableId),
        ),
        true,
      ),
    [comparisons, hardConflictByTimetableId],
  );
  const fitnessRanks = useMemo(
    () => competitionRanks(
      comparisons.map((c) => c.result?.fitnessScore ?? null),
      false,
    ),
    [comparisons],
  );
  const roomRanks = useMemo(
    () => competitionRanks(
      comparisons.map((c) => c.result?.roomUtilizationRate ?? null),
      false,
    ),
    [comparisons],
  );
  const softRanks = useMemo(
    () => competitionRanks(
      comparisons.map((c) => c.result?.softConstraintsScore ?? null),
      false,
    ),
    [comparisons],
  );

  const bestRun = bestOverallIdx >= 0 ? comparisons[bestOverallIdx] : null;

  const [expandedRunIds, setExpandedRunIds] = useState<Set<number>>(() => new Set());

  const toggleDetails = (runId: number) => {
    setExpandedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const winnerCellClass = "bg-emerald-500/15";

  const renderMetricCell = (
    b: number | null | undefined,
    r: number | null | undefined,
    d: number | null | undefined,
    lowerBetter: boolean,
    isWinner: boolean,
  ) => {
    const delta =
      typeof d === "number" && Number.isFinite(d)
        ? d
        : b != null && r != null && typeof b === "number" && typeof r === "number"
          ? r - b
          : null;
    const good =
      delta != null && delta !== 0 && (lowerBetter ? delta < 0 : Boolean(delta > 0));
    return (
      <TableCell className={`align-top text-center ${isWinner ? winnerCellClass : ""}`}>
        <div className="tabular-nums text-sm">
          {b ?? "—"} → {r ?? "—"}
        </div>
        <div
          className={`mt-0.5 text-xs tabular-nums ${
            delta == null || delta === 0
              ? "text-muted-foreground"
              : good
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {formatDelta(delta)}
        </div>
      </TableCell>
    );
  };

  const disruptionBadgeClass = (level: ComparisonRow["disruptionLevel"]) => {
    if (level === "Low") {
      return "border-emerald-500/50 bg-emerald-500/10 font-normal text-emerald-800 dark:text-emerald-300";
    }
    if (level === "Moderate") {
      return "border-amber-500/50 bg-amber-500/10 font-normal text-amber-800 dark:text-amber-300";
    }
    return "border-rose-500/50 bg-rose-500/10 font-normal text-rose-800 dark:text-rose-300";
  };

  const sectionDetailLabel = (row: SectionChangeDetail): string => {
    if (row.changeType === "added") return "Added";
    if (row.changeType === "removed") return "Removed";
    const parts: string[] = [];
    if (row.roomChanged) parts.push("room");
    if (row.lecturerChanged) parts.push("lecturer");
    if (row.timeslotChanged) parts.push("timeslot");
    return parts.length > 0 ? `Reassigned (${parts.join(", ")})` : "Reassigned";
  };

  const columnCount = 8;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-foreground/90">
        <span>
          Timetables compared: <strong className="text-foreground">{comparisons.length}</strong>
        </span>
        {improvedHowMany > 0 ? (
          <span>
            Improved:{" "}
            <strong className="text-foreground">
              {improvedHowMany} of {comparisons.length}
            </strong>
          </span>
        ) : null}
        {bestRun ? (
          <span>
            Best result:{" "}
            <strong className="text-foreground">
              Run #{bestRun.runId} on Timetable #{bestRun.baseTimetableId}
            </strong>
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="min-w-[140px]">Timetable</TableHead>
              <TableHead className="text-center">Hard Conflicts</TableHead>
              <TableHead className="text-center">Room Util. %</TableHead>
              <TableHead className="text-center">Soft Score</TableHead>
              <TableHead className="text-center">Fitness</TableHead>
              <TableHead className="text-center">Disruption</TableHead>
              <TableHead className="text-center">Sections affected</TableHead>
              <TableHead className="min-w-[160px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisons.map((c, idx) => {
              const bH = resolveHardConflictCount(
                c.baseTimetableId,
                c.baseline?.conflicts ?? null,
                hardConflictByTimetableId,
              );
              const rH = resolveHardConflictCount(
                c.resultTimetableId,
                c.result?.conflicts ?? null,
                hardConflictByTimetableId,
              );
              const dH = bH != null && rH != null ? rH - bH : c.deltas?.conflicts;
              const isExpanded = expandedRunIds.has(c.runId);
              const isBest = idx === bestOverallIdx;

              return (
                <Fragment key={c.runId}>
                  <TableRow className={isBest ? "bg-primary/[0.04]" : undefined}>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap items-start gap-2">
                        <div>
                          <p className="font-medium">Timetable #{c.baseTimetableId}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            Run #{c.runId}
                          </p>
                        </div>
                        {isBest ? (
                          <Badge className="shrink-0 bg-primary font-normal text-primary-foreground hover:bg-primary">
                            Best overall
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    {renderMetricCell(bH ?? undefined, rH ?? undefined, dH, true, conflictRanks[idx] === 1)}
                    {renderMetricCell(
                      c.baseline?.roomUtilizationRate,
                      c.result?.roomUtilizationRate,
                      c.deltas?.roomUtilizationRate,
                      false,
                      roomRanks[idx] === 1,
                    )}
                    {renderMetricCell(
                      c.baseline?.softConstraintsScore,
                      c.result?.softConstraintsScore,
                      c.deltas?.softConstraintsScore,
                      false,
                      softRanks[idx] === 1,
                    )}
                    {renderMetricCell(
                      c.baseline?.fitnessScore,
                      c.result?.fitnessScore,
                      c.deltas?.fitnessScore,
                      false,
                      fitnessRanks[idx] === 1,
                    )}
                    <TableCell className="align-top text-center">
                      <Badge variant="outline" className={disruptionBadgeClass(c.disruptionLevel)}>
                        {c.disruptionLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top text-center tabular-nums text-sm">
                      {c.sectionChanges
                        ? `${c.sectionChanges.percentSectionsAffected.toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        {c.resultTimetableId != null ? (
                          <Button size="sm" variant="outline" className="h-8" asChild>
                            <Link
                              href={`/schedule?simulation=1&timetableId=${c.resultTimetableId}&runId=${c.runId}`}
                            >
                              View in Schedule Viewer
                            </Link>
                          </Button>
                        ) : onStore ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={storingRunId === c.runId}
                            onClick={() => onStore(c.runId)}
                          >
                            {storingRunId === c.runId ? "Storing…" : "Store"}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => toggleDetails(c.runId)}
                        >
                          {isExpanded ? "Hide details" : "Details"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={columnCount} className="py-4">
                        <div className="space-y-3">
                          <p className="text-sm leading-relaxed text-foreground/90">{c.recommendation}</p>
                          {c.sectionChanges ? (
                            <p className="text-sm text-muted-foreground">
                              {c.sectionChanges.changed} reassigned · +{c.sectionChanges.added} added · −
                              {c.sectionChanges.removed} removed
                            </p>
                          ) : null}
                          {c.sectionChanges && c.sectionChanges.changedSections.length > 0 ? (
                            <div className="overflow-x-auto rounded-lg border border-border/70">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead>Course</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead>Change</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {c.sectionChanges.changedSections.map((row) => (
                                    <TableRow
                                      key={`${row.courseId}-${row.sectionNumber}-${row.changeType}`}
                                    >
                                      <TableCell>
                                        <p className="font-medium text-foreground">{row.courseName}</p>
                                        <p className="font-mono text-[11px] text-muted-foreground">
                                          {row.courseCode}
                                        </p>
                                      </TableCell>
                                      <TableCell className="tabular-nums text-muted-foreground">
                                        {row.sectionNumber}
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {sectionDetailLabel(row)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

type ScenarioSortCol =
  | "name"
  | "conditions"
  | "disruption"
  | "conflicts"
  | "room"
  | "soft"
  | "fitness"
  | "lecturer";

function CrossScenarioComparisonBlock({
  comparisons,
  hardConflictByTimetableId,
  onStore,
  storingRunId,
}: {
  comparisons: ComparisonRow[];
  hardConflictByTimetableId: HardConflictByTimetableId;
  onStore?: (runId: number) => void;
  storingRunId?: number | null;
}) {
  const [sortCol, setSortCol] = useState<ScenarioSortCol>("fitness");
  const [sortAsc, setSortAsc] = useState(false);

  const pareto = useMemo(
    () => paretoOptimalFlags(comparisons, hardConflictByTimetableId),
    [comparisons, hardConflictByTimetableId],
  );

  const winners = useMemo(() => {
    const bestIdx = (
      pick: (c: ComparisonRow) => number | null,
      lowerBetter: boolean,
    ): number[] => {
      const vals = comparisons.map((c, i) => ({ v: pick(c), i }));
      const finite = vals.filter((x) => x.v != null && Number.isFinite(x.v!));
      if (!finite.length) return [];
      const best = lowerBetter
        ? Math.min(...finite.map((x) => x.v!))
        : Math.max(...finite.map((x) => x.v!));
      return finite.filter((x) => x.v === best).map((x) => x.i);
    };
    return {
      conflicts: bestIdx(
        (c) => resolveHardConflictCount(c.resultTimetableId, c.result?.conflicts ?? null, hardConflictByTimetableId),
        true,
      ),
      room: bestIdx((c) => c.result?.roomUtilizationRate ?? null, false),
      soft: bestIdx((c) => c.result?.softConstraintsScore ?? null, false),
      fitness: bestIdx((c) => c.result?.fitnessScore ?? null, false),
      lecturer: bestIdx((c) => c.result?.lecturerBalanceScore ?? null, false),
      disruptionLow: bestIdx((c) => c.sectionChanges?.percentSectionsAffected ?? null, true),
    };
  }, [comparisons, hardConflictByTimetableId]);

  const decisionBanner = useMemo(() => {
    const parts: string[] = [];
    const nameAt = (i: number) => comparisons[i]?.scenarioName ?? `Scenario ${i}`;
    if (winners.conflicts.length === 1)
      parts.push(`${nameAt(winners.conflicts[0]!)} posts the lowest conflict count`);
    else if (winners.conflicts.length > 1) parts.push("Several scenarios tie on conflicts");

    if (winners.fitness.length === 1 && winners.fitness[0] !== winners.conflicts[0])
      parts.push(`${nameAt(winners.fitness[0]!)} leads fitness`);
    else if (winners.fitness.length === 1 && winners.conflicts.length === 1 && winners.fitness[0] === winners.conflicts[0])
      parts.push(`the same scenario (${nameAt(winners.fitness[0]!)}) also leads fitness`);

    if (winners.room.length === 1 && !winners.conflicts.includes(winners.room[0]!))
      parts.push(`${nameAt(winners.room[0]!)} leads room utilization`);

    const domCount = pareto.filter(Boolean).length;
    if (domCount === 0)
      parts.push("no scenario is undominated — every option loses on at least one metric compared to some alternative");
    else if (domCount === 1) {
      const i = pareto.findIndex(Boolean);
      parts.push(`${nameAt(i)} is Pareto-optimal (nothing strictly dominates it)`);
    } else parts.push(`${domCount} scenarios sit on the Pareto frontier`);

    if (!parts.length) return "Compare scenarios using the table — hover metrics to see baseline versus sandbox deltas.";
    let tail = "";
    if (winners.conflicts.length > 1 && winners.fitness.length > 1) tail = " — no single scenario dominates every metric.";
    return `${parts.join("; ")}.${tail}`;
  }, [comparisons, pareto, winners]);

  const sorted = useMemo(() => {
    const copy = [...comparisons];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "name":
          cmp = a.scenarioName.localeCompare(b.scenarioName);
          break;
        case "conditions":
          cmp = a.conditionCount - b.conditionCount;
          break;
        case "disruption":
          cmp =
            (a.sectionChanges?.percentSectionsAffected ?? 0) -
            (b.sectionChanges?.percentSectionsAffected ?? 0);
          break;
        case "conflicts":
          cmp =
            (resolveHardConflictCount(a.resultTimetableId, a.result?.conflicts ?? null, hardConflictByTimetableId) ??
              1e9) -
            (resolveHardConflictCount(b.resultTimetableId, b.result?.conflicts ?? null, hardConflictByTimetableId) ??
              1e9);
          break;
        case "room":
          cmp = (a.result?.roomUtilizationRate ?? -1e9) - (b.result?.roomUtilizationRate ?? -1e9);
          break;
        case "soft":
          cmp = (a.result?.softConstraintsScore ?? -1e9) - (b.result?.softConstraintsScore ?? -1e9);
          break;
        case "fitness":
          cmp = (a.result?.fitnessScore ?? -1e9) - (b.result?.fitnessScore ?? -1e9);
          break;
        case "lecturer":
          cmp =
            (a.result?.lecturerBalanceScore ?? -1e9) - (b.result?.lecturerBalanceScore ?? -1e9);
          break;
        default:
          cmp = 0;
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [comparisons, hardConflictByTimetableId, sortAsc, sortCol]);

  const toggleSort = (col: ScenarioSortCol) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortAsc((a) => !a);
        return prev;
      }
      setSortAsc(col === "name");
      return col;
    });
  };

  const isWinnerCell = (metric: keyof typeof winners, rowIdxInComparisons: number) =>
    winners[metric].includes(rowIdxInComparisons);

  return (
    <div className="space-y-4">
      <Alert className="border-border/80 bg-muted/30">
        <AlertTitle className="text-base">Summary</AlertTitle>
        <AlertDescription className="text-foreground/90">{decisionBanner}</AlertDescription>
      </Alert>

      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="cursor-pointer font-semibold" onClick={() => toggleSort("name")}>
                Scenario
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => toggleSort("conditions")}>
                Conditions
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => toggleSort("disruption")}>
                % sections disrupted
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => toggleSort("conflicts")}>
                Hard conflicts (base → result)
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => toggleSort("room")}>
                Room util. (base → result)
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => toggleSort("soft")}>
                Soft score (base → result)
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => toggleSort("fitness")}>
                Fitness (base → result)
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => toggleSort("lecturer")}>
                Lecturer balance (base → result)
              </TableHead>
              <TableHead className="text-center">Pareto</TableHead>
              <TableHead className="min-w-[220px]">Why</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c) => {
              const origIdx = comparisons.findIndex((x) => x.runId === c.runId);
              const wConf = origIdx >= 0 && isWinnerCell("conflicts", origIdx);
              const wRoom = origIdx >= 0 && isWinnerCell("room", origIdx);
              const wSoft = origIdx >= 0 && isWinnerCell("soft", origIdx);
              const wFit = origIdx >= 0 && isWinnerCell("fitness", origIdx);
              const wLec = origIdx >= 0 && isWinnerCell("lecturer", origIdx);
              const wDisrupt = origIdx >= 0 && isWinnerCell("disruptionLow", origIdx);
              const par = origIdx >= 0 ? pareto[origIdx] : false;
              const cellClass = (win: boolean) =>
                win ? "bg-emerald-500/15 ring-1 ring-emerald-500/25 font-medium" : "";

              const pair = (b: number | null | undefined, r: number | null | undefined, d: number | null | undefined) => (
                <span className="tabular-nums">
                  {b ?? "—"} → {r ?? "—"}
                  <span className="ml-1 text-muted-foreground">({formatDelta(d ?? null)})</span>
                </span>
              );

              return (
                <TableRow key={c.runId}>
                  <TableCell className="font-medium">
                    <div>{c.scenarioName}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">Run #{c.runId}</div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{c.conditionCount}</TableCell>
                  <TableCell className={`text-center tabular-nums ${cellClass(wDisrupt)}`}>
                    {c.sectionChanges ? `${c.sectionChanges.percentSectionsAffected.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className={`text-center ${cellClass(wConf)}`}>
                    {(() => {
                      const bH = resolveHardConflictCount(
                        c.baseTimetableId,
                        c.baseline?.conflicts ?? null,
                        hardConflictByTimetableId,
                      );
                      const rH = resolveHardConflictCount(
                        c.resultTimetableId,
                        c.result?.conflicts ?? null,
                        hardConflictByTimetableId,
                      );
                      const dH = bH != null && rH != null ? rH - bH : c.deltas?.conflicts;
                      return pair(bH ?? undefined, rH ?? undefined, dH);
                    })()}
                  </TableCell>
                  <TableCell className={`text-center ${cellClass(wRoom)}`}>
                    {pair(
                      c.baseline?.roomUtilizationRate,
                      c.result?.roomUtilizationRate,
                      c.deltas?.roomUtilizationRate,
                    )}
                  </TableCell>
                  <TableCell className={`text-center ${cellClass(wSoft)}`}>
                    {pair(
                      c.baseline?.softConstraintsScore,
                      c.result?.softConstraintsScore,
                      c.deltas?.softConstraintsScore,
                    )}
                  </TableCell>
                  <TableCell className={`text-center ${cellClass(wFit)}`}>
                    {pair(c.baseline?.fitnessScore, c.result?.fitnessScore, c.deltas?.fitnessScore)}
                  </TableCell>
                  <TableCell className={`text-center ${cellClass(wLec)}`}>
                    {pair(
                      c.baseline?.lecturerBalanceScore,
                      c.result?.lecturerBalanceScore,
                      c.deltas?.lecturerBalanceScore,
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {par ? (
                      <Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 font-normal">
                        Pareto
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-xs leading-snug text-muted-foreground">
                    {c.recommendation.slice(0, 280)}
                    {c.recommendation.length > 280 ? "…" : ""}
                  </TableCell>
                  <TableCell className="space-y-1 text-right align-top">
                    {c.resultTimetableId != null ? (
                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <Link
                          href={`/schedule?simulation=1&timetableId=${c.resultTimetableId}&runId=${c.runId}`}
                        >
                          View in Schedule Viewer
                        </Link>
                      </Button>
                    ) : onStore ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={storingRunId === c.runId}
                        onClick={() => onStore(c.runId)}
                      >
                        {storingRunId === c.runId ? "Storing…" : "Store"}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function WhatIfComparePage() {
  const { formatDateTime } = useDateTimeFormat();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const lastAutoCompareKeyRef = useRef<string | null>(null);
  const [mode, setMode] = useState<UiMode | null>(null);
  const [selectedRunIds, setSelectedRunIds] = useState<number[]>([]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [comparisons, setComparisons] = useState<ComparisonRow[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [storingRunId, setStoringRunId] = useState<number | null>(null);
  const [availableRuns, setAvailableRuns] = useState<SelectableRun[]>([]);
  const [timetables, setTimetables] = useState<TimetableOption[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runSearch, setRunSearch] = useState("");
  const [timetableFilter, setTimetableFilter] = useState<number | null>(null);
  const [scenarioFilter, setScenarioFilter] = useState<number | null>(null);
  const [hardConflictByTimetableId, setHardConflictByTimetableId] = useState<HardConflictByTimetableId>({});

  const runIdsFromUrl = useMemo(() => parseRunIds(searchParams), [searchParams.toString()]);

  useEffect(() => {
    if (!comparisons.length) {
      setHardConflictByTimetableId({});
      return;
    }
    let cancelled = false;
    const ids = new Set<number>();
    for (const c of comparisons) {
      if (Number.isFinite(c.baseTimetableId) && c.baseTimetableId > 0) {
        ids.add(Math.trunc(c.baseTimetableId));
      }
      const rt = c.resultTimetableId;
      if (rt != null && Number.isFinite(rt) && rt > 0) {
        ids.add(Math.trunc(rt));
      }
    }
    void (async () => {
      const results = await Promise.all(
        [...ids].map(async (id) => {
          try {
            const s = await fetchTimetableConflictSummary(id);
            return [id, s.hardConflictCount] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      if (cancelled) return;
      const next: HardConflictByTimetableId = {};
      for (const [id, count] of results) {
        if (count != null && typeof count === "number" && Number.isFinite(count)) {
          next[id] = count;
        }
      }
      setHardConflictByTimetableId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [comparisons]);

  useEffect(() => {
    let nextMode: UiMode | null = null;
    const m = searchParams.get("mode");
    const scenarioParam = Number(searchParams.get("scenarioId"));
    const timetableParam = Number(searchParams.get("timetableId"));
    if (m === "cross_scenario") nextMode = "cross-scenario";
    else if (m === "cross_timetable") nextMode = "cross-timetable";
    else if (m === "before_after") nextMode = "before-after";
    const nextTimetable =
      Number.isFinite(timetableParam) && timetableParam > 0 ? timetableParam : null;
    const nextScenario =
      Number.isFinite(scenarioParam) && scenarioParam > 0 ? scenarioParam : null;
    const nextSelectedIds =
      nextMode === "before-after" ? runIdsFromUrl.slice(0, 1) : runIdsFromUrl;

    setMode(nextMode);
    setTimetableFilter(nextTimetable);
    setScenarioFilter(nextScenario);
    setSelectedRunIds(nextSelectedIds);

    const hasMode = Boolean(nextMode);
    const filtersSatisfied =
      nextMode === "cross-scenario"
        ? Boolean(nextTimetable)
        : nextMode === "cross-timetable"
          ? Boolean(nextScenario)
          : nextMode === "before-after"
            ? Boolean(nextScenario && nextTimetable)
            : true;

    if (!hasMode) {
      setStep(1);
      return;
    }
    // Never skip run selection (Step 3): deep links with runIds stay on Step 3 with runs pre-selected,
    // and comparison still runs from the auto-compare effect.
    if (nextMode === "before-after") {
      setStep(filtersSatisfied ? 3 : 2);
      return;
    }
    setStep(filtersSatisfied ? 3 : 2);
  }, [searchParams, runIdsFromUrl]);

  useEffect(() => {
    let cancelled = false;
    const loadRuns = async () => {
      setRunsLoading(true);
      try {
        const [scenarios, timetablesData] = await Promise.all([getScenarios(), getTimetables()]);
        setTimetables(timetablesData);
        const perScenarioRuns = await Promise.all(
          scenarios.map(async (s: Scenario) => {
            const runs = await getRuns(s.id);
            return { scenario: s, runs };
          }),
        );
        if (cancelled) return;
        const rows: SelectableRun[] = [];
        for (const entry of perScenarioRuns) {
          for (const run of entry.runs) {
            if (run.status !== "completed" && run.status !== "applied") continue;
            rows.push({
              id: run.id,
              scenarioId: entry.scenario.id,
              scenarioName: entry.scenario.name,
              baseTimetableId: run.baseTimetableId,
              baseTimetableName: run.baseTimetableName,
              status: run.status,
              startedAt: run.startedAt,
            });
          }
        }
        setAvailableRuns(rows.sort((a, b) => b.id - a.id));
      } catch (error: unknown) {
        if (!cancelled) {
          toast({
            title: "Could not load runs",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setRunsLoading(false);
      }
    };
    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const fetchCompare = useCallback(
    async (ids: number[], m: UiMode) => {
      if (ids.length === 0) {
        setComparisons([]);
        setCompareError(null);
        return;
      }
      if (m === "before-after" && ids.length !== 1) {
        setCompareError("Before vs after needs exactly one completed run ID.");
        setComparisons([]);
        return;
      }
      if (m === "cross-scenario" && ids.length < 2) {
        setCompareError("This comparison mode needs at least two completed run IDs.");
        setComparisons([]);
        return;
      }
      setLoading(true);
      setCompareError(null);
      try {
        const res = await ApiClient.request<{ comparisons?: Record<string, unknown>[]; mode?: string }>("/what-if/compare", {
          method: "POST",
          body: JSON.stringify({ mode: uiModeToApi(m), runIds: ids }),
        });
        const rows = (res.comparisons ?? []).map((r) => normalizeComparisonApiRow(r));
        setComparisons(rows);
      } catch (e: unknown) {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Compare request failed.";
        setCompareError(msg);
        setComparisons([]);
        toast({ title: "Compare failed", description: msg, variant: "destructive" });
      } finally {
        setLoading(false);
        setStep((prev) => (prev >= 3 ? 4 : prev));
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!mode) return;
    const filtersSatisfied =
      mode === "cross-scenario"
        ? Boolean(timetableFilter)
        : mode === "cross-timetable"
          ? Boolean(scenarioFilter)
          : mode === "before-after"
            ? Boolean(scenarioFilter && timetableFilter)
            : true;
    const urlCanCompare =
      mode === "before-after"
        ? selectedRunIds.length === 1 && filtersSatisfied
        : selectedRunIds.length >= 2;
    if (!filtersSatisfied || !urlCanCompare) return;

    const key = `${uiModeToApi(mode)}:${selectedRunIds.join(",")}:${scenarioFilter ?? ""}:${timetableFilter ?? ""}`;
    if (lastAutoCompareKeyRef.current === key) return;
    lastAutoCompareKeyRef.current = key;

    void fetchCompare(selectedRunIds, mode);
  }, [mode, scenarioFilter, timetableFilter, selectedRunIds, fetchCompare]);

  function applyUrl(ids: number[], m: UiMode | null, opts?: { scenarioId?: number | null; timetableId?: number | null }) {
    const params = new URLSearchParams();
    if (ids.length > 0) params.set("runIds", ids.join(","));
    if (m) params.set("mode", uiModeToApi(m));
    if (opts?.scenarioId && opts.scenarioId > 0) params.set("scenarioId", String(opts.scenarioId));
    if (opts?.timetableId && opts.timetableId > 0) params.set("timetableId", String(opts.timetableId));
    const next = params.toString();
    router.replace(next ? `/dashboard/what-if/compare?${next}` : "/dashboard/what-if/compare", {
      scroll: false,
    });
  }

  const handleStoreRun = useCallback(
    async (runId: number) => {
      setStoringRunId(runId);
      try {
        const res = await storeScenarioRun(runId);
        toast({
          title: "Stored",
          description: res.message ?? `Draft timetable #${res.resultTimetableId} saved.`,
        });
        if (mode && selectedRunIds.length > 0) {
          await fetchCompare(selectedRunIds, mode);
        }
      } catch (error: unknown) {
        toast({
          title: "Store failed",
          description:
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setStoringRunId(null);
      }
    },
    [fetchCompare, mode, selectedRunIds, toast],
  );

  const availableTimetables = useMemo(() => {
    const map = new Map<number, string>();
    for (const run of availableRuns) map.set(run.baseTimetableId, run.baseTimetableName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableRuns]);

  const availableScenarios = useMemo(() => {
    const map = new Map<number, string>();
    for (const run of availableRuns) map.set(run.scenarioId, run.scenarioName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableRuns]);

  const selectableRuns = useMemo(() => {
    const q = runSearch.trim().toLowerCase();
    return availableRuns.filter((run) => {
      if (mode === "before-after") {
        if (scenarioFilter && run.scenarioId !== scenarioFilter) return false;
        if (timetableFilter && run.baseTimetableId !== timetableFilter) return false;
      }
      if (mode === "cross-timetable" && scenarioFilter && run.scenarioId !== scenarioFilter) return false;
      if (mode === "cross-scenario" && timetableFilter && run.baseTimetableId !== timetableFilter) return false;
      if (!q) return true;
      return (
        String(run.id).includes(q) ||
        run.scenarioName.toLowerCase().includes(q) ||
        run.baseTimetableName.toLowerCase().includes(q)
      );
    });
  }, [availableRuns, mode, runSearch, timetableFilter, scenarioFilter]);

  const scenariosForCompare = useMemo(() => {
    const map = new Map<number, string>();
    for (const run of availableRuns) map.set(run.scenarioId, run.scenarioName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableRuns]);

  const baseTimetablesForBeforeAfter = useMemo(() => {
    if (!scenarioFilter) return [];
    const map = new Map<number, string>();
    for (const run of availableRuns) {
      if (run.scenarioId !== scenarioFilter) continue;
      map.set(run.baseTimetableId, run.baseTimetableName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableRuns, scenarioFilter]);

  const filterReady =
    mode === "cross-scenario"
      ? Boolean(timetableFilter)
      : mode === "cross-timetable"
        ? Boolean(scenarioFilter)
        : mode === "before-after"
          ? Boolean(scenarioFilter && timetableFilter)
          : true;

  useEffect(() => {
    if (!mode || step !== 2 || !filterReady) return;
    setStep(3);
  }, [mode, step, filterReady]);

  const showCompareResults =
    Boolean(mode && filterReady) &&
    (step >= 4 || loading || compareError !== null || comparisons.length > 0);

  const modeCards: Array<{ key: UiMode; title: string; description: string }> = [
    {
      key: "before-after",
      title: "Before vs After",
      description: "Compare one completed run against the original baseline timetable.",
    },
    {
      key: "cross-timetable",
      title: "Same Scenario, Multiple Timetables",
      description: "Compare one scenario's results across different baseline timetables.",
    },
    {
      key: "cross-scenario",
      title: "Different Scenarios, Same Timetable",
      description: "Compare different scenarios that were run on one base timetable.",
    },
  ];

  const resetResults = () => {
    setComparisons([]);
    setCompareError(null);
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px] space-y-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard/what-if">What-If</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Compare runs</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col gap-3 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Compare scenario runs</h1>
              </div>
              <Badge variant="outline" className="w-fit shrink-0 font-normal">
                Step {step} of 4
              </Badge>
            </div>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-lg">Step 1 — Comparison Mode</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 md:items-stretch">
                {modeCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => {
                      setMode(card.key);
                      setSelectedRunIds([]);
                      resetResults();
                      setStep(2);
                      applyUrl([], card.key, {
                        scenarioId: card.key === "cross-timetable" ? scenarioFilter : null,
                        timetableId: card.key === "cross-scenario" ? timetableFilter : null,
                      });
                    }}
                    className={`flex h-full min-h-0 flex-col rounded-xl border p-4 text-left transition ${
                      mode === card.key
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <p className="text-base font-semibold">{card.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {mode ? (
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-lg">Step 2 — Filter</CardTitle>
                  <CardDescription>
                    {mode === "cross-scenario" && "Select the baseline timetable."}
                    {mode === "cross-timetable" && "Select the scenario."}
                    {mode === "before-after" && "Select the scenario and baseline timetable."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {mode === "before-after" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="compare-scenario-ba">Scenario</Label>
                        <Select
                          value={scenarioFilter != null ? String(scenarioFilter) : undefined}
                          onValueChange={(v) => {
                            const parsed = Number(v);
                            const nextScenario = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
                            setScenarioFilter(nextScenario);
                            setTimetableFilter(null);
                            setSelectedRunIds([]);
                            resetResults();
                            setStep(2);
                            applyUrl([], mode, { scenarioId: nextScenario, timetableId: null });
                          }}
                        >
                          <SelectTrigger id="compare-scenario-ba" className="w-full bg-background shadow-xs">
                            <SelectValue placeholder="Select a scenario" />
                          </SelectTrigger>
                          <SelectContent className="z-[280]">
                            {scenariosForCompare.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compare-timetable-ba">Baseline timetable</Label>
                        <Select
                          disabled={!scenarioFilter}
                          value={timetableFilter != null ? String(timetableFilter) : undefined}
                          onValueChange={(v) => {
                            const parsed = Number(v);
                            const nextTimetable = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
                            setTimetableFilter(nextTimetable);
                            setSelectedRunIds([]);
                            resetResults();
                            setStep(2);
                            applyUrl([], mode, { scenarioId: scenarioFilter, timetableId: nextTimetable });
                          }}
                        >
                          <SelectTrigger
                            id="compare-timetable-ba"
                            className="w-full bg-background shadow-xs disabled:opacity-60"
                          >
                            <SelectValue
                              placeholder={
                                scenarioFilter ? "Select a timetable" : "Choose scenario first"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="z-[280]">
                            {baseTimetablesForBeforeAfter.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}
                  {mode === "cross-timetable" ? (
                    <div className="space-y-2">
                      <Label htmlFor="compare-scenario-ct">Scenario</Label>
                      <Select
                        value={scenarioFilter != null ? String(scenarioFilter) : undefined}
                        onValueChange={(v) => {
                          const parsed = Number(v);
                          const nextScenario = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
                          setScenarioFilter(nextScenario);
                          setSelectedRunIds([]);
                          resetResults();
                          setStep(2);
                          applyUrl([], mode, { scenarioId: nextScenario, timetableId: null });
                        }}
                      >
                        <SelectTrigger id="compare-scenario-ct" className="w-full bg-background shadow-xs">
                          <SelectValue placeholder="Select a scenario" />
                        </SelectTrigger>
                        <SelectContent className="z-[280]">
                          {availableScenarios.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {mode === "cross-scenario" ? (
                    <div className="space-y-2">
                      <Label htmlFor="compare-timetable-cs">Timetable</Label>
                      <Select
                        value={timetableFilter != null ? String(timetableFilter) : undefined}
                        onValueChange={(v) => {
                          const parsed = Number(v);
                          const nextTimetable = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
                          setTimetableFilter(nextTimetable);
                          setSelectedRunIds([]);
                          resetResults();
                          setStep(2);
                          applyUrl([], mode, { scenarioId: null, timetableId: nextTimetable });
                        }}
                      >
                        <SelectTrigger id="compare-timetable-cs" className="w-full bg-background shadow-xs">
                          <SelectValue placeholder="Select a timetable" />
                        </SelectTrigger>
                        <SelectContent className="z-[280]">
                          {availableTimetables.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {mode && filterReady ? (
              <Card className="border-border/80 shadow-sm">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-lg">Step 3 — Select Runs</CardTitle>
                <CardDescription>
                  {mode === "before-after" && "Select one run."}
                  {(mode === "cross-timetable" || mode === "cross-scenario") && "Select two or more runs."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="run-search">Search runs</Label>
                  <Input
                    id="run-search"
                    placeholder="Run ID, scenario, or timetable"
                    value={runSearch}
                    onChange={(e) => setRunSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2">
                  {runsLoading ? <p className="px-2 py-6 text-sm text-muted-foreground">Loading runs…</p> : null}
                  {!runsLoading && selectableRuns.length === 0 ? (
                    <p className="px-2 py-6 text-sm text-muted-foreground">No completed runs match this filter.</p>
                  ) : null}
                  {selectableRuns.map((run) => {
                    const checked = selectedRunIds.includes(run.id);
                    return (
                      <label
                        key={run.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            const on = Boolean(next);
                            const ids = on
                              ? mode === "before-after"
                                ? [run.id]
                                : selectedRunIds.includes(run.id)
                                  ? selectedRunIds
                                  : [...selectedRunIds, run.id]
                              : selectedRunIds.filter((id) => id !== run.id);
                            setSelectedRunIds(ids);
                            lastAutoCompareKeyRef.current = null;
                            if (!mode) return;
                            const selectionValid =
                              mode === "before-after"
                                ? ids.length === 1 && filterReady
                                : ids.length >= 2;
                            applyUrl(ids, mode, {
                              scenarioId:
                                mode === "cross-timetable" || mode === "before-after"
                                  ? scenarioFilter
                                  : null,
                              timetableId:
                                mode === "cross-scenario" || mode === "before-after"
                                  ? timetableFilter
                                  : null,
                            });
                            if (selectionValid) {
                              setStep(4);
                            } else {
                              resetResults();
                              setStep(3);
                            }
                          }}
                        />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="truncate font-medium">
                            Run #{run.id} · {run.scenarioName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {run.baseTimetableName} · {formatDateTime(run.startedAt)}
                          </p>
                        </div>
                        <Badge variant={run.status === "applied" ? "default" : "secondary"} className="shrink-0">
                          {run.status}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            ) : null}

            {showCompareResults ? (
              <div className="border-t border-border/70 pt-6">
                <h2 className="mb-3 text-lg font-semibold">Step 4 — Results</h2>
              </div>
            ) : null}

            {showCompareResults && loading ? (
              <div className="space-y-3">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl lg:hidden" />
              </div>
            ) : null}
            {showCompareResults && compareError ? (
              <Alert variant="destructive">
                <AlertTitle>Comparison could not be loaded</AlertTitle>
                <AlertDescription>{compareError}</AlertDescription>
              </Alert>
            ) : null}

            {showCompareResults && !loading && comparisons.length === 0 && !compareError ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No results yet. Pick valid runs in Step 3.
                </CardContent>
              </Card>
            ) : null}

            {showCompareResults && !loading && comparisons.length > 0 ? (
              mode === "before-after" && comparisons.length === 1 ? (
                (() => {
                  const c = comparisons[0]!;
                  const sectionChangeRows = courseSectionChangeRows(
                    c.sectionChanges?.changedSections ?? [],
                  );
                  return (
                    <div className="space-y-4">
                      <Card className="overflow-hidden border-border/80 shadow-sm">
                        <CardHeader className="border-b bg-muted/30">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-lg leading-snug">{c.scenarioName}</CardTitle>
                              <p className="mt-1 font-mono text-xs text-muted-foreground">
                                Run #{c.runId}: baseline timetable #{c.baseTimetableId} → scenario draft #
                                {c.resultTimetableId ?? "—"}
                              </p>
                            </div>
                            {c.sectionChanges ? (
                              <Badge variant="outline" className="shrink-0 font-normal">
                                {c.disruptionLevel} disruption · {c.sectionChanges.percentSectionsAffected.toFixed(1)}%
                                sections touched
                              </Badge>
                            ) : null}
                          </div>
                        </CardHeader>
                      </Card>

                      {c.gwoIterationsRun != null && c.gwoIterationsRun <= 20 ? (
                        <Alert className="border-amber-500/40 bg-amber-500/10">
                          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                          <AlertTitle>Few optimizer iterations</AlertTitle>
                          <AlertDescription>
                            <span>
                              This run completed after only <strong>{c.gwoIterationsRun}</strong> iterations. Treat the draft as exploratory — quality may improve with more search budget.
                            </span>
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <div className="grid gap-4 lg:grid-cols-2">
                        {metricSnapshotMiniTable(
                          "Original timetable (baseline)",
                          c.baseline,
                          `Baseline timetable #${c.baseTimetableId}`,
                          { timetableId: c.baseTimetableId, hardConflictByTimetableId },
                        )}
                        {metricSnapshotMiniTable(
                          "Scenario result (draft timetable)",
                          c.result,
                          c.resultTimetableId != null
                            ? `Draft timetable #${c.resultTimetableId}`
                            : undefined,
                          { timetableId: c.resultTimetableId, hardConflictByTimetableId },
                        )}
                      </div>

                      {c.baselineConflictBreakdown && c.resultConflictBreakdown ? (
                        conflictBreakdownPanel(
                          "Hard clash breakdown (schedule-derived)",
                          c.baselineConflictBreakdown,
                          c.resultConflictBreakdown,
                          c.conflictBreakdownDelta,
                        )
                      ) : null}

                      <Card className="border-border/80 shadow-sm">
                        <CardHeader className="border-b bg-muted/30">
                          <CardTitle className="text-base">Metrics compared</CardTitle>
                          <CardDescription>
                            Lower conflicts and higher fitness indicate a better result.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          {metricTable(c.baseline, c.result, c.deltas, {
                            showVerdicts: true,
                            baselineTimetableId: c.baseTimetableId,
                            resultTimetableId: c.resultTimetableId,
                            hardConflictByTimetableId,
                          })}
                        </CardContent>
                      </Card>

                      {c.sectionChanges ? (
                        <Card className="border-border/80 shadow-sm">
                          <CardHeader className="border-b bg-muted/30">
                            <CardTitle className="text-base">Section-level changes</CardTitle>
                            {c.resultTimetableId != null ? (
                              <CardDescription>
                                +{c.sectionChanges.added} added · −{c.sectionChanges.removed} removed ·{" "}
                                {c.sectionChanges.percentSectionsAffected.toFixed(1)}% of sections affected
                              </CardDescription>
                            ) : null}
                          </CardHeader>
                          <CardContent className="space-y-4 pt-4">
                            {c.resultTimetableId == null ? (
                              <p className="text-sm text-muted-foreground">
                                The timetable should be stored first.
                              </p>
                            ) : sectionChangeRows.length > 0 ? (
                              <div className="rounded-xl border border-border/70">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                                      <TableHead>Course</TableHead>
                                      <TableHead className="text-right">Sections</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sectionChangeRows.map((row) => (
                                      <TableRow key={row.key}>
                                        <TableCell>
                                          <p className="font-medium text-foreground">
                                            {row.courseName.trim() || row.courseCode}{" "}
                                            <span className="font-mono text-[11px] font-normal text-muted-foreground">
                                              {row.courseCode}
                                            </span>
                                          </p>
                                        </TableCell>
                                        <TableCell
                                          className={`text-right text-sm font-semibold tabular-nums ${
                                            row.kind === "added"
                                              ? "text-emerald-600 dark:text-emerald-400"
                                              : "text-rose-600 dark:text-rose-400"
                                          }`}
                                        >
                                          {row.deltaLabel}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No section-level changes — every course section matched the baseline placement.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ) : null}
                      <div className="flex flex-row flex-wrap items-center gap-2 border-t border-border/40 pt-3">
                        <Button size="sm" variant="outline" className="shrink-0" asChild>
                          <Link href="/dashboard/what-if">Back to scenarios</Link>
                        </Button>
                        {c.resultTimetableId != null ? (
                          <Button size="sm" variant="outline" className="shrink-0" asChild>
                            <Link
                              href={`/schedule?simulation=1&timetableId=${c.resultTimetableId}&runId=${c.runId}`}
                            >
                              View in Schedule Viewer
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            disabled={storingRunId === c.runId}
                            onClick={() => void handleStoreRun(c.runId)}
                          >
                            {storingRunId === c.runId ? "Storing…" : "Store"}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="shrink-0" asChild>
                          <Link href={`/dashboard/what-if/${c.scenarioId}/runs`}>Scenario runs</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })()
              ) : mode === "cross-scenario" ? (
                <CrossScenarioComparisonBlock
                  comparisons={comparisons}
                  hardConflictByTimetableId={hardConflictByTimetableId}
                  onStore={(id) => void handleStoreRun(id)}
                  storingRunId={storingRunId}
                />
              ) : (
                <CrossTimetableComparisonBlock
                  comparisons={comparisons}
                  hardConflictByTimetableId={hardConflictByTimetableId}
                  onStore={(id) => void handleStoreRun(id)}
                  storingRunId={storingRunId}
                />
              )
            ) : null}

            {!(
              showCompareResults &&
              !loading &&
              comparisons.length === 1 &&
              mode === "before-after"
            ) ? (
              <Button variant="outline" asChild>
                <Link href="/dashboard/what-if">Back to scenarios</Link>
              </Button>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
