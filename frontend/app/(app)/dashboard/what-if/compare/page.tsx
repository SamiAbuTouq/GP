"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";

type CompareModeApi = "before_after" | "cross_timetable" | "cross_scenario";

type UiMode = "before-after" | "cross-timetable" | "cross-scenario";

type ComparisonRow = {
  runId: number;
  scenarioId: number;
  scenarioName: string;
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
  sectionChanges: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
    baselineCount: number;
    resultCount: number;
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
  return {
    runId: Number(raw.runId ?? raw.run_id ?? 0),
    scenarioId: Number(raw.scenarioId ?? raw.scenario_id ?? 0),
    scenarioName: String(raw.scenarioName ?? raw.scenario_name ?? ""),
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
    sectionChanges:
      raw.sectionChanges && typeof raw.sectionChanges === "object"
        ? {
            added: num((raw.sectionChanges as Record<string, unknown>).added),
            removed: num((raw.sectionChanges as Record<string, unknown>).removed),
            changed: num((raw.sectionChanges as Record<string, unknown>).changed),
            unchanged: num((raw.sectionChanges as Record<string, unknown>).unchanged),
            baselineCount: num((raw.sectionChanges as Record<string, unknown>).baselineCount),
            resultCount: num((raw.sectionChanges as Record<string, unknown>).resultCount),
          }
        : null,
  };
}

function metricTable(
  baseline: MetricSnapshot | null,
  result: MetricSnapshot | null,
  deltas: ComparisonRow["deltas"],
) {
  const rows = [
    ["Conflicts", baseline?.conflicts, result?.conflicts, deltas?.conflicts, true],
    ["Room utilization", baseline?.roomUtilizationRate, result?.roomUtilizationRate, deltas?.roomUtilizationRate, false],
    ["Soft constraints", baseline?.softConstraintsScore, result?.softConstraintsScore, deltas?.softConstraintsScore, false],
    ["Fitness", baseline?.fitnessScore, result?.fitnessScore, deltas?.fitnessScore, false],
    ["Lecturer balance", baseline?.lecturerBalanceScore, result?.lecturerBalanceScore, deltas?.lecturerBalanceScore, false],
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
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, b, r, d, lowerIsBetter]) => {
            const delta = typeof d === "number" ? d : r != null && b != null ? r - b : null;
            const good =
              delta != null && delta !== 0 && lowerIsBetter ? delta < 0 : Boolean(delta != null && delta > 0);
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
                  {delta == null ? "—" : `${delta > 0 ? "+" : ""}${typeof delta === "number" && Math.abs(delta) < 10 ? delta.toFixed(2).replace(/\.?0+$/, "") : delta}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function metricSnapshotMiniTable(title: string, snapshot: MetricSnapshot | null, footnote?: string) {
  const rows: Array<[string, number | null]> = snapshot
    ? [
        ["Conflicts", snapshot.conflicts],
        ["Room utilization %", snapshot.roomUtilizationRate],
        ["Soft constraints", snapshot.softConstraintsScore],
        ["Fitness", snapshot.fitnessScore],
        ["Lecturer balance", snapshot.lecturerBalanceScore],
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
            {rows.map(([label, val]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-border/40 py-2 last:border-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular-nums font-medium">{val == null ? "—" : val}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

export default function WhatIfComparePage() {
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

  const runIdsFromUrl = useMemo(() => parseRunIds(searchParams), [searchParams.toString()]);

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
    const hasRuns = nextSelectedIds.length > 0;
    const filtersSatisfied =
      nextMode === "cross-scenario"
        ? Boolean(nextTimetable)
        : nextMode === "cross-timetable"
          ? Boolean(nextScenario)
          : nextMode === "before-after"
            ? Boolean(nextScenario && nextTimetable)
            : true;
    const urlCanCompare =
      nextMode === "before-after"
        ? nextSelectedIds.length === 1 && filtersSatisfied
        : nextSelectedIds.length >= 2;

    if (!hasMode) {
      setStep(1);
      return;
    }
    if (urlCanCompare && filtersSatisfied && hasRuns) {
      setStep(4);
      return;
    }
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

  const modeTitle =
    mode === "before-after"
      ? "Before vs after"
      : mode === "cross-timetable"
        ? "Same scenario, multiple timetables"
      : "Multiple scenarios, one timetable";

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
              <CardContent className="grid gap-3 pt-4 lg:grid-cols-2">
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
                    className={`rounded-xl border p-4 text-left transition ${
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
                    {mode === "cross-scenario" && "Pick one timetable before you continue to run selection."}
                    {mode === "cross-timetable" && "Pick one scenario before you continue to run selection."}
                    {mode === "before-after" &&
                      "Pick the scenario and the baseline timetable that run used. Step 3 lists only matching completed runs."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {mode === "before-after" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Scenario</Label>
                        <select
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          value={scenarioFilter ?? ""}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            const nextScenario = Number.isFinite(value) && value > 0 ? value : null;
                            setScenarioFilter(nextScenario);
                            setTimetableFilter(null);
                            setSelectedRunIds([]);
                            resetResults();
                            setStep(2);
                            applyUrl([], mode, { scenarioId: nextScenario, timetableId: null });
                          }}
                        >
                          <option value="">Select a scenario</option>
                          {scenariosForCompare.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Baseline timetable</Label>
                        <select
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
                          disabled={!scenarioFilter}
                          value={timetableFilter ?? ""}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            const nextTimetable = Number.isFinite(value) && value > 0 ? value : null;
                            setTimetableFilter(nextTimetable);
                            setSelectedRunIds([]);
                            resetResults();
                            setStep(2);
                            applyUrl([], mode, { scenarioId: scenarioFilter, timetableId: nextTimetable });
                          }}
                        >
                          <option value="">{scenarioFilter ? "Select a timetable" : "Choose scenario first"}</option>
                          {baseTimetablesForBeforeAfter.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}
                  {mode === "cross-timetable" ? (
                    <div className="space-y-2">
                      <Label>Scenario</Label>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={scenarioFilter ?? ""}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          const nextScenario = Number.isFinite(value) && value > 0 ? value : null;
                          setScenarioFilter(nextScenario);
                          setSelectedRunIds([]);
                          resetResults();
                          setStep(2);
                          applyUrl([], mode, { scenarioId: nextScenario, timetableId: null });
                        }}
                      >
                        <option value="">Select a scenario</option>
                        {availableScenarios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {mode === "cross-scenario" ? (
                    <div className="space-y-2">
                      <Label>Timetable</Label>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={timetableFilter ?? ""}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          const nextTimetable = Number.isFinite(value) && value > 0 ? value : null;
                          setTimetableFilter(nextTimetable);
                          setSelectedRunIds([]);
                          resetResults();
                          setStep(2);
                          applyUrl([], mode, { scenarioId: null, timetableId: nextTimetable });
                        }}
                      >
                        <option value="">Select a timetable</option>
                        {availableTimetables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {requiresFilterStep ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() => setStep(3)}
                        disabled={!filterReady}
                      >
                        Continue
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Continue directly to Step 3.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {mode && step === 3 ? (
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
                            {run.baseTimetableName} · {new Date(run.startedAt).toLocaleString()}
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

            {mode ? (
              <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm">
              <p className="font-medium">{modeTitle}</p>
              <p className="mt-1 text-muted-foreground">
                {mode === "before-after" && "Single run: baseline timetable vs that run’s sandbox result."}
                {mode === "cross-timetable" &&
                  "Single scenario across multiple baseline timetables — compare sensitivity to starting point."}
                {mode === "cross-scenario" &&
                  "Different scenarios on the same base timetable — compare which change set performs best."}
              </p>
              </div>
            ) : null}

            {mode && step >= 4 ? (
              <div className="border-t border-border/70 pt-6">
                <h2 className="mb-3 text-lg font-semibold">Step 4 — Results</h2>
              </div>
            ) : null}

            {mode && step >= 4 && loading ? (
              <div className="space-y-3">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl lg:hidden" />
              </div>
            ) : null}
            {mode && step >= 4 && compareError ? (
              <Alert variant="destructive">
                <AlertTitle>Comparison could not be loaded</AlertTitle>
                <AlertDescription>{compareError}</AlertDescription>
              </Alert>
            ) : null}

            {mode && step >= 4 && !loading && comparisons.length === 0 && !compareError ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No results yet. Pick valid runs in Step 3 and click Compare.
                </CardContent>
              </Card>
            ) : null}

            {mode && step >= 4 && !loading ? (
              comparisons.length === 1 && mode === "before-after" ? (
                (() => {
                  const c = comparisons[0]!;
                  return (
                    <div className="space-y-4">
                      <Card className="overflow-hidden border-border/80 shadow-sm">
                        <CardHeader className="border-b bg-muted/30">
                          <CardTitle className="text-lg leading-snug">{c.scenarioName}</CardTitle>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            Run #{c.runId}: baseline timetable #{c.baseTimetableId} → scenario draft #
                            {c.resultTimetableId ?? "—"}
                          </p>
                        </CardHeader>
                      </Card>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {metricSnapshotMiniTable(
                          "Original timetable (baseline)",
                          c.baseline,
                          `Baseline timetable #${c.baseTimetableId}`,
                        )}
                        {metricSnapshotMiniTable(
                          "Scenario result (draft timetable)",
                          c.result,
                          c.resultTimetableId != null
                            ? `Draft timetable #${c.resultTimetableId}`
                            : undefined,
                        )}
                      </div>
                      <Card className="border-border/80 shadow-sm">
                        <CardHeader className="border-b bg-muted/30">
                          <CardTitle className="text-base">Metrics compared</CardTitle>
                          <CardDescription>Baseline vs sandbox result side by side.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          {metricTable(c.baseline, c.result, c.deltas)}
                        </CardContent>
                      </Card>
                      {c.sectionChanges ? (
                        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm">
                          <p className="font-medium">Section-level summary</p>
                          <p className="mt-1 text-muted-foreground">
                            Changed: {c.sectionChanges.changed} · Added: {c.sectionChanges.added} · Removed:{" "}
                            {c.sectionChanges.removed}
                          </p>
                          <p className="text-muted-foreground">
                            Baseline sections: {c.sectionChanges.baselineCount} · Result sections:{" "}
                            {c.sectionChanges.resultCount}
                          </p>
                        </div>
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
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2 lg:justify-center">
                  {comparisons.map((c) => (
                    <Card
                      key={c.runId}
                      className="w-[min(100%,340px)] shrink-0 overflow-hidden border-border/80 shadow-sm lg:w-[360px]"
                    >
                      <CardHeader className="border-b bg-muted/30">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base leading-snug">{c.scenarioName}</CardTitle>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              Run #{c.runId}
                              <br />
                              Base #{c.baseTimetableId}
                              {c.resultTimetableId != null ? ` · Result #{c.resultTimetableId}` : ""}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 font-normal">
                            Column
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        {metricTable(c.baseline, c.result, c.deltas)}
                        {c.sectionChanges ? (
                          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                            <p className="font-medium">Sections</p>
                            <p className="mt-1 text-muted-foreground">
                              Δ changed {c.sectionChanges.changed}, +{c.sectionChanges.added}, −
                              {c.sectionChanges.removed}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
          <Label>Type scenario name to confirm</Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={applyRun?.scenarioName ?? ""}
            autoComplete="off"
          />
          <HardConflictsAcknowledgmentFields
            summary={applyConflictSummary}
            loading={applyConflictLoading}
            acknowledged={applyConflictAcknowledged}
            onAcknowledgedChange={setApplyConflictAcknowledged}
            contextLabel="Applying replaces the base timetable’s schedule with this result."
          />
          <DialogFooter>
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
                const needAck = applyConflictSummary?.requiresConflictAcknowledgment === true;
                await ApiClient.request(`/what-if/runs/${applyRun.id}/apply`, {
                  method: "POST",
                  body: JSON.stringify(needAck ? { acknowledgedHardConflicts: true } : {}),
                });
                toast({ title: "Applied", description: "The base timetable now uses this scenario result." });
                setApplyRun(null);
                router.push("/timetable-generation");
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
