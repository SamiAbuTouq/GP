"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import {
  fetchTimetableConflictSummary,
  resolveHardConflictCount,
  type HardConflictByTimetableId,
} from "@/lib/timetable-conflicts";
import {
  buildWhatIfCompareHref,
  formatTimetableOptionLabel,
  getRuns,
  getScenario,
  getTimetables,
  storeScenarioRun,
  type TimetableOption,
  type WhatIfRun,
} from "@/lib/what-if";
import { useDateTimeFormat } from "@/components/datetime-preferences-context";

type MetricsTableRow = {
  label: string;
  baseline: number | null;
  result: number | null;
  lowerIsBetter: boolean;
};

function formatMetricValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDeltaValue(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDurationSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} s`;
}

/** "Summer Semester" → "Summer"; "First Semester" → "First" */
function shortSemesterLabel(semester: string): string {
  const s = semester.trim();
  if (!s) return "";
  return s.replace(/\s+semester$/i, "").trim();
}

function metricsRowsForRun(run: WhatIfRun, hardByTimetableId: HardConflictByTimetableId): MetricsTableRow[] {
  const baseline = run.metricsBaseline;
  const result = run.metricsResult;
  return [
    {
      label: "Hard conflicts",
      baseline: resolveHardConflictCount(run.baseTimetableId, baseline?.conflicts ?? null, hardByTimetableId),
      result: resolveHardConflictCount(run.resultTimetableId, result?.conflicts ?? null, hardByTimetableId),
      lowerIsBetter: true,
    },
    {
      label: "Room utilization",
      baseline: baseline?.roomUtilizationRate ?? null,
      result: result?.roomUtilizationRate ?? null,
      lowerIsBetter: false,
    },
    {
      label: "Optimizer Score",
      baseline: baseline?.fitnessScore ?? null,
      result: result?.fitnessScore ?? null,
      lowerIsBetter: false,
    },
    {
      label: "Lecturer workload balance",
      baseline: baseline?.lecturerBalanceScore ?? null,
      result: result?.lecturerBalanceScore ?? null,
      lowerIsBetter: false,
    },
  ];
}

export default function WhatIfRunsPage() {
  const { formatDateTime } = useDateTimeFormat();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const scenarioId = Number(params.id);
  const scenarioIdValid = Number.isFinite(scenarioId) && scenarioId > 0;
  const [scenarioName, setScenarioName] = useState("");
  const [runs, setRuns] = useState<WhatIfRun[]>([]);
  const [timetables, setTimetables] = useState<TimetableOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<WhatIfRun | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "completed" | "failed" | "applied">("all");
  const [hardConflictByTimetableId, setHardConflictByTimetableId] = useState<HardConflictByTimetableId>({});
  const [storingRunId, setStoringRunId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!scenarioIdValid) return;
    setLoadError(null);
    try {
      const [scenario, runsData, timetablesData] = await Promise.all([
        getScenario(scenarioId),
        getRuns(scenarioId),
        getTimetables(),
      ]);
      setScenarioName(scenario.name);
      setRuns(runsData);
      setTimetables(timetablesData);
    } catch (error: unknown) {
      const msg =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not load run history.";
      setLoadError(msg);
      toast({ title: "Could not load run history", description: msg, variant: "destructive" });
    }
  }, [scenarioId, scenarioIdValid, toast]);

  useEffect(() => {
    if (!scenarioIdValid) {
      toast({
        title: "Invalid scenario",
        description: "Check the link or pick a scenario from the list.",
        variant: "destructive",
      });
      router.replace("/dashboard/what-if");
      return;
    }
    void load();
  }, [scenarioIdValid, load, router, toast]);

  const hasActiveRuns = useMemo(
    () => runs.some((r) => r.status === "pending" || r.status === "running"),
    [runs],
  );

  const timetableIdsForConflictFetch = useMemo(() => {
    const ids = new Set<number>();
    for (const r of runs) {
      if (Number.isFinite(r.baseTimetableId) && r.baseTimetableId > 0) {
        ids.add(Math.trunc(r.baseTimetableId));
      }
      const rt = r.resultTimetableId;
      if (rt != null && Number.isFinite(rt) && rt > 0) {
        ids.add(Math.trunc(rt));
      }
    }
    return [...ids].sort((a, b) => a - b).join(",");
  }, [runs]);

  useEffect(() => {
    if (!scenarioIdValid || !hasActiveRuns) return;
    const t = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(t);
  }, [scenarioIdValid, hasActiveRuns, load]);

  useEffect(() => {
    if (!scenarioIdValid || !timetableIdsForConflictFetch) {
      setHardConflictByTimetableId({});
      return;
    }
    let cancelled = false;
    const ids = new Set<number>();
    for (const id of timetableIdsForConflictFetch.split(",")) {
      const n = Number(id);
      if (Number.isFinite(n) && n > 0) ids.add(Math.trunc(n));
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
  }, [scenarioIdValid, timetableIdsForConflictFetch]);

  const visibleRuns = runs.filter((r) => statusFilter === "all" || r.status === statusFilter);

  const timetableLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of timetables) {
      map.set(Number(t.timetableId), formatTimetableOptionLabel(t, { formatDateTime }));
    }
    return map;
  }, [timetables, formatDateTime]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px] space-y-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard/what-if">What-If Scenarios</Link></BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink asChild><Link href={`/dashboard/what-if/${scenarioId}`}>{scenarioName || "Scenario"}</Link></BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>Run History</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button variant="ghost" asChild className="px-0"><Link href={`/dashboard/what-if/${scenarioId}`}>Back to scenario</Link></Button>
            {!scenarioIdValid ? (
              <Alert>
                <AlertTitle>Redirecting…</AlertTitle>
                <AlertDescription>Invalid scenario ID.</AlertDescription>
              </Alert>
            ) : null}
            {loadError && scenarioIdValid ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load data</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  {loadError}
                  <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {(["all", "running", "completed", "failed", "applied"] as const).map((v) => (
                  <Button key={v} size="sm" variant={statusFilter === v ? "default" : "outline"} onClick={() => setStatusFilter(v)}>
                    {v === "all" ? "All" : v}
                  </Button>
                ))}
              </div>
            </div>
            <Card>
              <CardHeader><CardTitle>{scenarioName || "Scenario"} - Run History</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Run ID</th>
                      <th className="p-2 text-left">Base Timetable</th>
                      <th className="p-2 text-left">Semester</th>
                      <th className="p-2 text-left">Started</th>
                      <th className="p-2 text-left">Duration</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRuns.map((run) => (
                      <tr key={run.id} className="border-b last:border-0">
                        <td className="p-2">{run.id}</td>
                        <td className="p-2">
                          {timetableLabelById.get(run.baseTimetableId) ?? run.baseTimetableName}
                        </td>
                        <td className="p-2">
                          {(() => {
                            const t = timetables.find(
                              (x) => Number(x.timetableId) === Number(run.baseTimetableId),
                            );
                            if (!t || !t.isPublished) return "—";
                            return (
                              shortSemesterLabel(String(t.semester ?? "")) ||
                              `${t.academicYear}`.trim() ||
                              "—"
                            );
                          })()}
                        </td>
                        <td className="p-2">{formatDateTime(run.startedAt)}</td>
                        <td className="p-2">{formatDurationSeconds(run.durationSeconds)}</td>
                        <td className="p-2">{run.status}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" onClick={() => setSelectedRun(run)}>View Results</Button>
                            {(run.status === "completed" || run.status === "applied") && !run.resultTimetableId ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={storingRunId === run.id}
                                onClick={() => {
                                  setStoringRunId(run.id);
                                  void storeScenarioRun(run.id)
                                    .then((res) => {
                                      toast({
                                        title: "Stored",
                                        description:
                                          res.message ??
                                          `Draft timetable #${res.resultTimetableId} saved.`,
                                      });
                                      return load();
                                    })
                                    .catch((error: unknown) => {
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
                                    })
                                    .finally(() => setStoringRunId(null));
                                }}
                              >
                                {storingRunId === run.id ? "Storing…" : "Store"}
                              </Button>
                            ) : null}
                            {(run.status === "completed" || run.status === "applied") && run.resultTimetableId ? (
                              <Button size="sm" variant="secondary" asChild>
                                <Link href={`/schedule?simulation=1&timetableId=${run.resultTimetableId}&runId=${run.id}`}>
                                  View in Schedule Viewer
                                </Link>
                              </Button>
                            ) : null}
                            <Button size="sm" variant="outline" asChild>
                              <Link
                                href={buildWhatIfCompareHref({
                                  mode: "before_after",
                                  runIds: [run.id],
                                  scenarioId,
                                  timetableId: run.baseTimetableId,
                                })}
                              >
                                Compare
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={Boolean(selectedRun)} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent
          className="overflow-hidden"
          style={{ width: "min(600px, calc(100vw - 4rem))", maxWidth: "min(600px, calc(100vw - 4rem))" }}
        >
          <DialogHeader><DialogTitle>Run Result {selectedRun?.id}</DialogTitle></DialogHeader>
          {selectedRun ? (
            <div className="min-w-0 space-y-3 text-sm">
              <div className="max-w-full rounded-lg border">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[46%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2.5 text-left font-medium">Metric</th>
                      <th className="px-1.5 py-2.5 text-center font-medium">Baseline</th>
                      <th className="px-1.5 py-2.5 text-center font-medium">Result</th>
                      <th className="px-1.5 py-2.5 text-center font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricsRowsForRun(selectedRun, hardConflictByTimetableId).map((row) => {
                      const delta =
                        row.baseline != null && row.result != null
                          ? row.result - row.baseline
                          : null;
                      const improved =
                        delta != null
                          ? row.lowerIsBetter
                            ? delta < 0
                            : delta > 0
                          : null;
                      const deltaClass =
                        delta == null || delta === 0
                          ? "text-muted-foreground"
                          : improved
                            ? "text-emerald-600"
                            : "text-rose-600";
                      return (
                        <tr key={row.label} className="border-b last:border-0">
                          <td className="px-3 py-2.5">{row.label}</td>
                          <td className="px-1.5 py-2.5 text-center tabular-nums">{formatMetricValue(row.baseline)}</td>
                          <td className="px-1.5 py-2.5 text-center tabular-nums">{formatMetricValue(row.result)}</td>
                          <td className={`px-1.5 py-2.5 text-center tabular-nums ${deltaClass}`}>
                            {formatDeltaValue(delta)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Hard conflicts use the timetable conflict summary (same source as the schedule viewer). Values can differ from
                the run-metrics field when metrics were saved as an aggregate snapshot.
              </p>
              <div className="rounded border p-2">
                Recommendation: {selectedRun.recommendation ?? "No recommendation available."}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRun(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
