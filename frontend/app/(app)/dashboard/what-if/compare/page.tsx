"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { HardConflictsAcknowledgmentFields } from "@/components/hard-conflicts-ui";
import { ApiClient, ApiError } from "@/lib/api-client";
import {
  fetchTimetableConflictSummary,
  resolveHardConflictCount,
  type HardConflictByTimetableId,
  type TimetableConflictSummary,
} from "@/lib/timetable-conflicts";
import {
  getTimetables,
  getRuns,
  getScenarios,
  normalizeMetricSnapshot,
  normalizeRun,
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

function isPublishedTimetableStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  return normalized === "published" || normalized === "live" || normalized === "active";
}

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
        <p className="mt-1 text-xs text-muted-foreground">
          Pairwise clashes detected from weekly slot expansions (room double-booking, lecturer overlap, section/cohort
          overlap).
        </p>
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
  openApply,
}: {
  comparisons: ComparisonRow[];
  hardConflictByTimetableId: HardConflictByTimetableId;
  openApply: (runId: number) => void;
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

  const scenarioLabel = comparisons[0]?.scenarioName ?? "Scenario";

  const sensitivity = useMemo(() => {
    const xs = comparisons
      .map((c) => c.result?.fitnessScore)
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (xs.length < 2) return { variance: 0, stdev: 0 };
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
    return { variance, stdev: Math.sqrt(variance) };
  }, [comparisons]);

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

  const consistencyLines = useMemo(() => {
    const lines: string[] = [];
    const summarize = (label: string, vals: (number | undefined)[], lowerBetter: boolean) => {
      const nums = vals.filter((x): x is number => typeof x === "number");
      if (!nums.length) return;
      let up = 0;
      let down = 0;
      let flat = 0;
      for (const x of nums) {
        if (x === 0) flat++;
        else if (lowerBetter ? x < 0 : x > 0) up++;
        else down++;
      }
      const n = nums.length;
      if (up === n) lines.push(`${label}: improved on every timetable.`);
      else if (down === n) lines.push(`${label}: worse on every timetable.`);
      else
        lines.push(
          `${label}: mixed (${up} improved, ${down} worse, ${flat} unchanged).`,
        );
    };
    summarize(
      "Conflict Δ",
      comparisons.map((c) => {
        const bH = resolveHardConflictCount(c.baseTimetableId, c.baseline?.conflicts ?? null, hardConflictByTimetableId);
        const rH = resolveHardConflictCount(c.resultTimetableId, c.result?.conflicts ?? null, hardConflictByTimetableId);
        if (bH != null && rH != null) return rH - bH;
        return c.deltas?.conflicts;
      }),
      true,
    );
    summarize(
      "Fitness Δ",
      comparisons.map((c) => c.deltas?.fitnessScore),
      false,
    );
    summarize(
      "Room utilization Δ",
      comparisons.map((c) => c.deltas?.roomUtilizationRate),
      false,
    );
    return lines;
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

  const metricRows = (
    c: ComparisonRow,
    idx: number,
  ): Array<{ label: string; b: number | null | undefined; r: number | null | undefined; d: number | null | undefined; lower: boolean; rank: number | null }> => {
    const bH = resolveHardConflictCount(c.baseTimetableId, c.baseline?.conflicts ?? null, hardConflictByTimetableId);
    const rH = resolveHardConflictCount(c.resultTimetableId, c.result?.conflicts ?? null, hardConflictByTimetableId);
    const dH = bH != null && rH != null ? rH - bH : c.deltas?.conflicts;
    return [
    {
      label: "Hard conflicts",
      b: bH ?? undefined,
      r: rH ?? undefined,
      d: dH,
      lower: true,
      rank: conflictRanks[idx] ?? null,
    },
    {
      label: "Room util. %",
      b: c.baseline?.roomUtilizationRate,
      r: c.result?.roomUtilizationRate,
      d: c.deltas?.roomUtilizationRate,
      lower: false,
      rank: roomRanks[idx] ?? null,
    },
    {
      label: "Soft constraints",
      b: c.baseline?.softConstraintsScore,
      r: c.result?.softConstraintsScore,
      d: c.deltas?.softConstraintsScore,
      lower: false,
      rank: softRanks[idx] ?? null,
    },
    {
      label: "Fitness",
      b: c.baseline?.fitnessScore,
      r: c.result?.fitnessScore,
      d: c.deltas?.fitnessScore,
      lower: false,
      rank: fitnessRanks[idx] ?? null,
    },
    ];
  };

  return (
    <div className="space-y-4">
      <Alert className="border-border/80 bg-muted/30">
        <AlertTitle className="text-base">Cross-timetable summary</AlertTitle>
        <AlertDescription className="space-y-2 text-foreground/90">
          <p>
            Comparing <strong>{scenarioLabel}</strong> across{" "}
            <strong>{comparisons.length}</strong> baseline drafts.{" "}
            <strong>{improvedHowMany}</strong> run(s) register lower conflicts or higher fitness than their baseline.
          </p>
          {bestRun ? (
            <p>
              Best composite card (tie-break: lowest conflicts, then highest fitness):{" "}
              <strong>
                Run #{bestRun.runId}
              </strong>{" "}
              on base timetable #{bestRun.baseTimetableId}.
            </p>
          ) : null}
          <p>
            Scenario sensitivity — variance of fitness across timetables:{" "}
            <strong>{sensitivity.variance.toFixed(5)}</strong> (σ ≈ {sensitivity.stdev.toFixed(4)}). Larger variance means the
            scenario&apos;s quality swing depends more on the starting timetable.
          </p>
          <div>
            <p className="font-medium text-foreground">Consistency across timetables</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {consistencyLines.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      <div className="flex gap-4 overflow-x-auto pb-2 lg:justify-center">
        {comparisons.map((c, idx) => (
          <Card
            key={c.runId}
            className={`w-[min(100%,380px)] shrink-0 overflow-hidden border-border/80 shadow-sm lg:w-[400px] ${idx === bestOverallIdx ? "ring-2 ring-primary/35" : ""}`}
          >
            <CardHeader className="border-b bg-muted/30">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base leading-snug">
                    Base timetable #{c.baseTimetableId}
                  </CardTitle>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    Run #{c.runId}
                    {c.resultTimetableId != null ? ` · Result #${c.resultTimetableId}` : ""}
                  </p>
                </div>
                {idx === bestOverallIdx ? (
                  <Badge className="shrink-0 bg-primary font-normal text-primary-foreground hover:bg-primary">
                    Best overall
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    Timetable
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="p-2 text-left font-medium">Metric</th>
                      <th className="p-2 text-center font-medium">Baseline</th>
                      <th className="p-2 text-center font-medium">Result</th>
                      <th className="p-2 text-center font-medium">Δ</th>
                      <th className="p-2 text-center font-medium">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricRows(c, idx).map((row) => {
                      const delta =
                        typeof row.d === "number"
                          ? row.d
                          : row.r != null && row.b != null
                            ? row.r - row.b
                            : null;
                      const good =
                        delta != null &&
                        delta !== 0 &&
                        (row.lower ? delta < 0 : delta > 0);
                      return (
                        <tr key={row.label} className="border-b last:border-0">
                          <td className="p-2">{row.label}</td>
                          <td className="p-2 text-center tabular-nums">{row.b ?? "—"}</td>
                          <td className="p-2 text-center tabular-nums">{row.r ?? "—"}</td>
                          <td
                            className={`p-2 text-center tabular-nums ${
                              delta == null || delta === 0
                                ? "text-muted-foreground"
                                : good
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                            }`}
                          >
                            {formatDelta(delta)}
                          </td>
                          <td className="p-2 text-center tabular-nums text-muted-foreground">
                            {ordinalRankLabel(row.rank)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {c.sectionChanges ? (
                <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                  <p className="font-medium">Sections</p>
                  <p className="mt-1 text-muted-foreground">
                    Δ changed {c.sectionChanges.changed}, +{c.sectionChanges.added}, −{c.sectionChanges.removed} ·{" "}
                    {c.sectionChanges.percentSectionsAffected.toFixed(1)}% of union slots touched
                  </p>
                </div>
              ) : null}
              <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[13px] leading-relaxed">
                {c.recommendation}
              </p>
              <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
                {c.resultTimetableId != null ? (
                  <Button size="sm" variant="outline" className="w-full shrink-0" asChild>
                    <Link
                      href={`/schedule?simulation=1&timetableId=${c.resultTimetableId}&runId=${c.runId}`}
                    >
                      Viewer
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => void openApply(c.runId)}
                >
                  Apply
                </Button>
                <Button type="button" size="sm" variant="ghost" className="flex-1" asChild>
                  <Link href={`/dashboard/what-if/${c.scenarioId}/runs`}>Runs</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
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
  openApply,
}: {
  comparisons: ComparisonRow[];
  hardConflictByTimetableId: HardConflictByTimetableId;
  openApply: (runId: number) => void;
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
        <AlertTitle className="text-base">Decision summary</AlertTitle>
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
                          Viewer
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => void openApply(c.runId)}
                    >
                      Apply
                    </Button>
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
  const [applyRun, setApplyRun] = useState<WhatIfRun | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [applyConflictSummary, setApplyConflictSummary] = useState<TimetableConflictSummary | null>(null);
  const [applyConflictLoading, setApplyConflictLoading] = useState(false);
  const [applyConflictAcknowledged, setApplyConflictAcknowledged] = useState(false);
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

  async function openApply(runId: number) {
    try {
      const row = await ApiClient.request<any>(`/what-if/runs/${runId}`);
      setApplyRun(normalizeRun(row));
      setConfirmText("");
      setApplyConflictAcknowledged(false);
    } catch {
      toast({ title: "Could not load run", variant: "destructive" });
    }
  }

  useEffect(() => {
    const ttId = applyRun?.resultTimetableId;
    if (ttId == null || ttId <= 0) {
      setApplyConflictSummary(null);
      setApplyConflictAcknowledged(false);
      setApplyConflictLoading(false);
      return;
    }
    let cancelled = false;
    setApplyConflictAcknowledged(false);
    setApplyConflictLoading(true);
    fetchTimetableConflictSummary(ttId)
      .then((data) => {
        if (!cancelled) setApplyConflictSummary(data);
      })
      .catch(() => {
        if (!cancelled) setApplyConflictSummary(null);
      })
      .finally(() => {
        if (!cancelled) setApplyConflictLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyRun]);

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

  const applyRunBaseTimetableStatus = useMemo(() => {
    if (!applyRun) return null;
    return (
      timetables.find((t) => Number(t.timetableId) === Number(applyRun.baseTimetableId))?.status ?? null
    );
  }, [applyRun, timetables]);
  const applyTargetsPublishedTimetable = isPublishedTimetableStatus(applyRunBaseTimetableStatus);
  const requiresFilterStep =
    mode === "cross-scenario" || mode === "cross-timetable" || mode === "before-after";
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

  const canCompare =
    mode === "before-after"
      ? selectedRunIds.length === 1 && filterReady
      : selectedRunIds.length >= 2;

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
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Follow the steps to pick a mode, filter the available runs, and compare outcomes.
                </p>
              </div>
              <Badge variant="outline" className="w-fit shrink-0 font-normal">
                Step {step} of 4
              </Badge>
            </div>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-lg">Step 1 — Choose a comparison mode</CardTitle>
                <CardDescription>Select one mode to begin.</CardDescription>
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
                  <CardTitle className="text-lg">
                    {requiresFilterStep ? "Step 2 — Apply a filter" : "Step 2 — Filter"}
                  </CardTitle>
                  <CardDescription>
                    {mode === "cross-scenario" &&
                      "Pick one timetable. Step 3 lists completed runs that used that baseline."}
                    {mode === "cross-timetable" &&
                      "Pick one scenario. Step 3 lists completed runs for that scenario."}
                    {mode === "before-after" &&
                      "Pick the scenario and baseline timetable for the run. Step 3 lists only matching completed runs."}
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
                <CardTitle className="text-lg">Step 3 — Pick runs</CardTitle>
                <CardDescription>
                  {mode === "before-after" && "Select exactly one completed run."}
                  {mode === "cross-timetable" && "Select two or more runs for the same scenario."}
                  {mode === "cross-scenario" && "Select two or more runs from the selected timetable."}
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
                            resetResults();
                            if (step !== 3) setStep(3);
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
                <div className="flex justify-end border-t border-border/40 pt-3">
                  <Button
                    type="button"
                    disabled={!canCompare || loading}
                    onClick={() => {
                      if (!mode) return;
                      setStep(4);
                      applyUrl(selectedRunIds, mode, {
                        scenarioId:
                          mode === "cross-timetable" || mode === "before-after" ? scenarioFilter : null,
                        timetableId:
                          mode === "cross-scenario" || mode === "before-after" ? timetableFilter : null,
                      });
                      void fetchCompare(selectedRunIds, mode);
                    }}
                  >
                    Compare
                  </Button>
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
                  No results yet. Pick valid runs in Step 3 and click Compare.
                </CardContent>
              </Card>
            ) : null}

            {showCompareResults && !loading && comparisons.length > 0 ? (
              mode === "before-after" && comparisons.length === 1 ? (
                (() => {
                  const c = comparisons[0]!;
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
                              <p className="mt-2 text-xs text-muted-foreground">
                                Scenario uses{" "}
                                <strong className="text-foreground">{c.conditionCount}</strong> condition
                                {c.conditionCount === 1 ? "" : "s"}.
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
                            This run completed after only{" "}
                            <strong>{c.gwoIterationsRun}</strong> iterations. Treat the draft as exploratory — quality may
                            improve with more search budget.
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

                      <Card className="border-border/80 shadow-sm">
                        <CardHeader className="border-b bg-muted/30">
                          <CardTitle className="text-base">GWO optimizer run</CardTitle>
                          <CardDescription>Persisted on the scenario run record.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 text-sm">
                          <dl className="grid gap-3 sm:grid-cols-2">
                            <div className="flex justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                              <dt className="text-muted-foreground">Iterations executed</dt>
                              <dd className="tabular-nums font-medium">
                                {c.gwoIterationsRun != null ? c.gwoIterationsRun : "—"}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                              <dt className="text-muted-foreground">Generation time</dt>
                              <dd className="tabular-nums font-medium">
                                {c.generationSeconds != null ? `${c.generationSeconds}s` : "—"}
                              </dd>
                            </div>
                          </dl>
                        </CardContent>
                      </Card>

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
                            Baseline vs sandbox — verdict badges encode directionality (lower hard conflicts / higher
                            fitness is better). Hard conflicts use the same persisted summary as the schedule viewer; run
                            metrics may differ when the snapshot row is stale.
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
                            <CardDescription>
                              +{c.sectionChanges.added} / −{c.sectionChanges.removed} sections · {c.sectionChanges.changed}{" "}
                              reassigned · {c.sectionChanges.unchanged} untouched · Union coverage{" "}
                              {c.sectionChanges.percentSectionsAffected.toFixed(1)}%
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4 pt-4">
                            {c.sectionChanges.perCourse.length > 0 ? (
                              <div className="rounded-xl border border-border/70">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                                      <TableHead>Course</TableHead>
                                      <TableHead className="text-center">Sections affected</TableHead>
                                      <TableHead className="text-center">Room moves</TableHead>
                                      <TableHead className="text-center">Lecturer moves</TableHead>
                                      <TableHead className="text-center">Timeslot moves</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {c.sectionChanges.perCourse.map((row) => (
                                      <TableRow key={row.courseId}>
                                        <TableCell className="font-medium">
                                          {row.courseCode}
                                          <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                                            #{row.courseId}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">{row.sectionsAffected}</TableCell>
                                        <TableCell className="text-center tabular-nums">
                                          {row.sectionsWithRoomChange}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">
                                          {row.sectionsWithLecturerChange}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">
                                          {row.sectionsWithSlotChange}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No course-level diffs — roster stayed aligned with baseline composition.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ) : null}
                      <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm leading-relaxed text-foreground/90">
                        {c.recommendation}
                      </p>
                      <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
                        {c.resultTimetableId != null ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              href={`/schedule?simulation=1&timetableId=${c.resultTimetableId}&runId=${c.runId}`}
                            >
                              Open result in schedule viewer
                            </Link>
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="default" onClick={() => void openApply(c.runId)}>
                          Apply this result
                        </Button>
                        <Button type="button" size="sm" variant="ghost" asChild>
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
                  openApply={(id) => void openApply(id)}
                />
              ) : (
                <CrossTimetableComparisonBlock
                  comparisons={comparisons}
                  hardConflictByTimetableId={hardConflictByTimetableId}
                  openApply={(id) => void openApply(id)}
                />
              )
            ) : null}

            <Button variant="outline" asChild>
              <Link href="/dashboard/what-if">Back to scenarios</Link>
            </Button>
          </div>
        </main>
      </div>

      <Dialog
        open={Boolean(applyRun)}
        onOpenChange={(open) => {
          if (!open) setApplyRun(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-6 sm:max-w-lg">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
            <DialogHeader>
              <DialogTitle>Apply run {applyRun?.id}?</DialogTitle>
            </DialogHeader>
            {applyTargetsPublishedTimetable ? (
              <Alert variant="destructive" className="border-2 shadow-sm">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                <AlertTitle>Warning: base timetable is published</AlertTitle>
                <AlertDescription>
                  Confirming this action will overwrite the currently published live schedule for
                  the selected base timetable.
                </AlertDescription>
              </Alert>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Replaces the base timetable’s schedule with this sandbox result. Allowed for draft or published timetables.
            </p>
            <div className="space-y-2">
              <Label>Type scenario name to confirm</Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={applyRun?.scenarioName ?? ""}
                autoComplete="off"
              />
            </div>
            <HardConflictsAcknowledgmentFields
              summary={applyConflictSummary}
              loading={applyConflictLoading}
              acknowledged={applyConflictAcknowledged}
              onAcknowledgedChange={setApplyConflictAcknowledged}
              contextLabel="Applying replaces the base timetable’s schedule with this result."
            />
          </div>
          <DialogFooter className="mt-4 shrink-0 border-t pt-4">
            <Button variant="outline" type="button" onClick={() => setApplyRun(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={
                confirmText !== (applyRun?.scenarioName ?? "") ||
                !applyRun ||
                applyConflictLoading ||
                (applyConflictSummary?.requiresConflictAcknowledgment === true && !applyConflictAcknowledged)
              }
              onClick={async () => {
                if (!applyRun) return;
                try {
                  const needAck = applyConflictSummary?.requiresConflictAcknowledgment === true;
                  await ApiClient.request(`/what-if/runs/${applyRun.id}/apply`, {
                    method: "POST",
                    body: JSON.stringify(needAck ? { acknowledgedHardConflicts: true } : {}),
                  });
                  toast({ title: "Applied", description: "The base timetable now uses this scenario result." });
                  setApplyRun(null);
                  router.push("/timetable-generation");
                } catch (error: unknown) {
                  toast({
                    title: "Apply failed",
                    description:
                      error instanceof ApiError
                        ? error.message
                        : error instanceof Error
                          ? error.message
                          : "Unknown error",
                    variant: "destructive",
                  });
                }
              }}
            >
              Confirm apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
