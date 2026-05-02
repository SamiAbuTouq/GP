"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { HardConflictsAcknowledgmentFields } from "@/components/hard-conflicts-ui";
import { ApiClient } from "@/lib/api-client";
import {
  fetchTimetableConflictSummary,
  type TimetableConflictSummary,
} from "@/lib/timetable-conflicts";
import { getRuns, getScenario, getTimetables, type TimetableOption, type WhatIfRun } from "@/lib/what-if";

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

function formatOptimizerScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function metricsRowsForRun(run: WhatIfRun): MetricsTableRow[] {
  const baseline = run.metricsBaseline;
  const result = run.metricsResult;
  return [
    {
      label: "Conflicts",
      baseline: baseline?.conflicts ?? null,
      result: result?.conflicts ?? null,
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
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const scenarioId = Number(params.id);
  const [scenarioName, setScenarioName] = useState("");
  const [runs, setRuns] = useState<WhatIfRun[]>([]);
  const [timetables, setTimetables] = useState<TimetableOption[]>([]);
  const [selectedRun, setSelectedRun] = useState<WhatIfRun | null>(null);
  const [applyRun, setApplyRun] = useState<WhatIfRun | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [applyConflictSummary, setApplyConflictSummary] = useState<TimetableConflictSummary | null>(null);
  const [applyConflictLoading, setApplyConflictLoading] = useState(false);
  const [applyConflictAcknowledged, setApplyConflictAcknowledged] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "completed" | "failed" | "applied">("all");
  const [comparePick, setComparePick] = useState<number[]>([]);

  async function load() {
    const [scenario, runsData, timetablesData] = await Promise.all([
      getScenario(scenarioId),
      getRuns(scenarioId),
      getTimetables(),
    ]);
    setScenarioName(scenario.name);
    setRuns(runsData);
    setTimetables(timetablesData);
  }

  useEffect(() => {
    void load();
  }, [scenarioId]);

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

  const visibleRuns = runs.filter((r) => statusFilter === "all" || r.status === statusFilter);
  const timetableSemesterById = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of timetables) map.set(Number(t.timetableId), String(t.semester ?? ""));
    return map;
  }, [timetables]);

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
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {(["all", "running", "completed", "failed", "applied"] as const).map((v) => (
                  <Button key={v} size="sm" variant={statusFilter === v ? "default" : "outline"} onClick={() => setStatusFilter(v)}>
                    {v === "all" ? "All" : v}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard/what-if/compare">Comparison hub</Link>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={comparePick.length !== 1}
                onClick={() => {
                  const selectedId = comparePick[0];
                  const selectedRunForCompare = runs.find((r) => r.id === selectedId);
                  const completed =
                    selectedRunForCompare != null &&
                    (selectedRunForCompare.status === "completed" || selectedRunForCompare.status === "applied");
                  if (!completed) {
                    toast({ title: "Select one completed or applied run to compare", variant: "destructive" });
                    return;
                  }
                  router.push(
                    `/dashboard/what-if/compare?runIds=${selectedId}&mode=before_after&scenarioId=${scenarioId}&timetableId=${selectedRunForCompare.baseTimetableId}`,
                  );
                }}
              >
                Compare selected ({comparePick.length})
              </Button>
            </div>
            <Card>
              <CardHeader><CardTitle>{scenarioName} - Run History</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="w-10 p-2 text-left" aria-label="Select for compare" />
                      <th className="p-2 text-left">Run ID</th>
                      <th className="p-2 text-left">Base Timetable</th>
                      <th className="p-2 text-left">Semester</th>
                      <th className="p-2 text-left">Started</th>
                      <th className="p-2 text-left">Duration</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-center">Conflicts</th>
                      <th className="p-2 text-center">Optimizer Score</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRuns.map((run) => (
                      <tr key={run.id} className="border-b last:border-0">
                        <td className="p-2 align-middle">
                          <Checkbox
                            checked={comparePick.includes(run.id)}
                            disabled={run.status !== "completed" && run.status !== "applied"}
                            onCheckedChange={(v) => {
                              setComparePick((prev) => {
                                const on = Boolean(v);
                                if (on) return [run.id];
                                return prev.filter((x) => x !== run.id);
                              });
                            }}
                            aria-label={`Select run ${run.id}`}
                          />
                        </td>
                        <td className="p-2">{run.id}</td>
                        <td className="p-2">{run.baseTimetableName}</td>
                        <td className="p-2">
                          {timetableSemesterById.get(run.baseTimetableId) ?? "—"}
                        </td>
                        <td className="p-2">{new Date(run.startedAt).toLocaleString()}</td>
                        <td className="p-2">{formatDurationSeconds(run.durationSeconds)}</td>
                        <td className="p-2">{run.status}</td>
                        <td className="p-2 text-center">{run.metricsResult?.conflicts ?? "-"}</td>
                        <td className="p-2 text-center">{formatOptimizerScore(run.metricsResult?.fitnessScore)}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" onClick={() => setSelectedRun(run)}>View Results</Button>
                            {(run.status === "completed" || run.status === "applied") && run.resultTimetableId ? (
                              <Button size="sm" variant="secondary" asChild>
                                <Link href={`/schedule?simulation=1&timetableId=${run.resultTimetableId}&runId=${run.id}`}>
                                  View Schedule
                                </Link>
                              </Button>
                            ) : null}
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/dashboard/what-if/compare?runIds=${run.id}&mode=before_after&scenarioId=${scenarioId}&timetableId=${run.baseTimetableId}`}>
                                Compare
                              </Link>
                            </Button>
                            <Button size="sm" onClick={() => { setApplyRun(run); setConfirmText(""); }} disabled={run.status !== "completed"}>Apply</Button>
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
                    {metricsRowsForRun(selectedRun).map((row) => {
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
              <div className="rounded border p-2">
                Recommendation: {selectedRun.recommendation ?? "No recommendation available."}
              </div>
              {(selectedRun.status === "completed" || selectedRun.status === "applied") && selectedRun.resultTimetableId ? (
                <Button asChild className="w-full sm:w-auto">
                  <Link href={`/schedule?simulation=1&timetableId=${selectedRun.resultTimetableId}&runId=${selectedRun.id}`}>
                    View Schedule
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRun(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(applyRun)}
        onOpenChange={(open) => {
          if (!open) setApplyRun(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Apply Scenario Result?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will replace the schedule entries in the selected timetable with the simulation result. This action cannot be undone.</p>
          <Label>Type scenario name to confirm</Label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={scenarioName} />
          <HardConflictsAcknowledgmentFields
            summary={applyConflictSummary}
            loading={applyConflictLoading}
            acknowledged={applyConflictAcknowledged}
            onAcknowledgedChange={setApplyConflictAcknowledged}
            contextLabel="Applying replaces the base timetable’s schedule with this result."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyRun(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={
                confirmText !== scenarioName ||
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
                toast({ title: "Scenario applied" });
                setApplyRun(null);
                router.push("/timetable-generation");
              }}
            >
              Confirm & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
