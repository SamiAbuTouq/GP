"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { GwoTopProgressBar, useGwoRun } from "@/components/gwo-run-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { HardConflictsAcknowledgmentFields } from "@/components/hard-conflicts-ui";
import { ApiClient, ApiError } from "@/lib/api-client";
import { streamScenarioRunSse } from "@/lib/scenario-sse";
import {
  fetchTimetableConflictSummary,
  type TimetableConflictSummary,
} from "@/lib/timetable-conflicts";
import {
  buildWhatIfCompareHref,
  conditionLabel,
  conditionParameterSummary,
  getScenario,
  getScenarios,
  getTimetables,
  type Scenario,
  type TimetableOption,
  type WhatIfLookupOption,
} from "@/lib/what-if";
import { cn } from "@/lib/utils";
import { useDateTimeFormat } from "@/components/datetime-preferences-context";
import { AlertTriangle, Check, Play, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function isPublishedTimetableStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  return normalized === "published" || normalized === "live" || normalized === "active";
}

function numericString(value: unknown): string | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function isUserCancelledRun(errorMessage: string | null | undefined): boolean {
  const normalized = String(errorMessage ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "run cancelled by user." || normalized === "run cancelled by user") return true;
  if (normalized.includes("cancelled by user")) return true;
  return false;
}

function formatRunDurationSeconds(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(Number(sec)) || Number(sec) < 0) return "—";
  const s = Math.round(Number(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function effectiveRunDurationSeconds(run: {
  durationSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
}): number | null {
  if (run.durationSeconds != null && Number.isFinite(Number(run.durationSeconds)) && Number(run.durationSeconds) >= 0) {
    return Number(run.durationSeconds);
  }
  if (!run.completedAt) return null;
  const a = Date.parse(run.startedAt);
  const b = Date.parse(run.completedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 1000);
}

function firstArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate = obj.items ?? obj.data ?? obj.rows ?? obj.results ?? obj.courses ?? obj.lecturers ?? obj.rooms ?? obj.timeslots;
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export default function WhatIfScenarioDetailPage() {
  const { formatDateTime } = useDateTimeFormat();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const id = Number(params.id);
  const idValid = Number.isFinite(id) && id > 0;
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [timetables, setTimetables] = useState<TimetableOption[]>([]);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyText, setApplyText] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyConflictSummary, setApplyConflictSummary] = useState<TimetableConflictSummary | null>(null);
  const [applyConflictLoading, setApplyConflictLoading] = useState(false);
  const [applyConflictAcknowledged, setApplyConflictAcknowledged] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [simStarting, setSimStarting] = useState(false);
  const [timetableSearch, setTimetableSearch] = useState("");
  const [lecturerOptions, setLecturerOptions] = useState<WhatIfLookupOption[]>([]);
  const [roomOptions, setRoomOptions] = useState<WhatIfLookupOption[]>([]);
  const [courseOptions, setCourseOptions] = useState<WhatIfLookupOption[]>([]);
  const [timeslotOptions, setTimeslotOptions] = useState<WhatIfLookupOption[]>([]);
  const {
    beginRun,
    bindRunId,
    updateProgress,
    setPercent,
    setRunPhase,
    endRun,
    setFinalizing,
    isRunning: gwoIsRunning,
    isPaused: gwoIsPaused,
    runSource: gwoRunSource,
  } =
    useGwoRun();
  const recoveringRunIdRef = useRef<number | null>(null);
  const pageMountedRef = useRef(true);
  const streamAbortRef = useRef<AbortController | null>(null);
  const { data: runServerStatus } = useSWR<{ running: boolean; globalLockOwner?: "timetable" | "whatif" | null }>(
    "/api/run",
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
    { refreshInterval: 1500, dedupingInterval: 0 },
  );
  const canStart = selected.length === 1;
  const applyNeedsConflictAck = applyConflictSummary?.requiresConflictAcknowledgment === true;
  const canApply =
    applyText === (scenario?.name ?? "") &&
    (!applyNeedsConflictAck || applyConflictAcknowledged) &&
    !applyConflictLoading;
  const runStatus = scenario?.latestRun?.status;
  const latestRunErrorMessage = scenario?.latestRun?.errorMessage;
  const runWasCancelledByUser = runStatus === "failed" && isUserCancelledRun(latestRunErrorMessage);
  const blockedByTimetable = runServerStatus?.globalLockOwner === "timetable";
  const blockedByWhatIf = runServerStatus?.globalLockOwner === "whatif";
  const localScenarioActive =
    Boolean(scenario?.isRunning) ||
    runStatus === "running" ||
    runStatus === "pending" ||
    (gwoRunSource === "scenario" && gwoIsRunning) ||
    simStarting;
  const scenarioPaused = gwoRunSource === "scenario" && localScenarioActive && gwoIsPaused;
  const blockedByOtherScenarioRun = blockedByWhatIf && !localScenarioActive;
  const scenarioRunBusy = localScenarioActive;
  const shouldShowScenarioProgressBar = localScenarioActive;
  const { data: scenariosSnapshot } = useSWR(
    blockedByOtherScenarioRun ? `whatif-scenarios-active:${id}` : null,
    async () => getScenarios(),
    { refreshInterval: 2500, dedupingInterval: 0 },
  );
  const activeScenarioId = useMemo(() => {
    if (!blockedByOtherScenarioRun || !Array.isArray(scenariosSnapshot)) return null;
    const active = scenariosSnapshot.find((s) => {
      if (!s || Number(s.id) === id) return false;
      const status = s.latestRun?.status;
      return Boolean(s.isRunning) || status === "running" || status === "pending";
    });
    return active?.id ?? null;
  }, [blockedByOtherScenarioRun, scenariosSnapshot, id]);

  const load = useCallback(async () => {
    if (!idValid) {
      setScenarioLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const [scenarioData, timetablesData] = await Promise.all([
        getScenario(id),
        getTimetables({ scenarioRunBasesOnly: true }),
      ]);
      setScenario(scenarioData);
      setTimetables(timetablesData);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Could not load scenario.");
      setScenario(null);
    } finally {
      setScenarioLoading(false);
    }
  }, [id, idValid]);

  useEffect(() => {
    if (idValid) return;
    toast({
      title: "Invalid scenario",
      description: "Check the link or pick a scenario from the list.",
      variant: "destructive",
    });
    router.replace("/dashboard/what-if");
  }, [idValid, router, toast]);

  useEffect(() => {
    pageMountedRef.current = true;
    return () => {
      pageMountedRef.current = false;
      try {
        streamAbortRef.current?.abort();
      } catch {
        /* ignore */
      }
      streamAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    setScenarioLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const loadLookups = async () => {
      const safeReq = async <T,>(path: string, fallback: T): Promise<T> => {
        try {
          return await ApiClient.request<T>(path);
        } catch {
          return fallback;
        }
      };

      const [lecturers, rooms, coursesRes, timeslots] = await Promise.all([
        safeReq("/lecturers", [] as unknown[]),
        safeReq("/rooms", [] as unknown[]),
        safeReq("/courses/catalog", { courses: [] } as unknown),
        safeReq("/timeslots", [] as unknown[]),
      ]);

      const nextLecturers: WhatIfLookupOption[] = firstArray(lecturers)
        .map((l: any) => {
          const value = numericString(
            l.databaseId ??
            l.database_id ??
            l.userId ??
            l.user_id ??
            l.lecturerUserId ??
            l.lecturer_user_id ??
            l.id,
          );
          if (!value) return null;
          return {
            value,
            label: String(l.name ?? l.email ?? l.id ?? "Lecturer"),
          };
        })
        .filter((x): x is WhatIfLookupOption => x !== null);

      const nextRooms: WhatIfLookupOption[] = firstArray(rooms)
        .map((r: any) => {
          const value = numericString(
            r.databaseId ??
            r.database_id ??
            r.roomId ??
            r.room_id ??
            r.id,
          );
          if (!value) return null;
          const roomName = String(r.roomNumber ?? r.room_number ?? r.name ?? r.id ?? "Room");
          const roomType = String(r.type ?? r.roomType ?? r.room_type ?? "Room");
          return {
            value,
            label: `${roomName} (${roomType})`,
          };
        })
        .filter((x): x is WhatIfLookupOption => x !== null);

      const nextCourses: WhatIfLookupOption[] = firstArray(coursesRes)
        .map((c: any) => {
          const value = numericString(c.id ?? c.course_id ?? c.courseId);
          if (!value) return null;
          const code = String(c.code ?? c.course_code ?? c.courseCode ?? "").trim();
          const name = String(c.name ?? c.course_name ?? c.courseName ?? "").trim();
          const label = [code, name].filter(Boolean).join(" - ");
          return {
            value,
            label: label || `Course ${value}`,
          };
        })
        .filter((x): x is WhatIfLookupOption => x !== null);

      const nextSlots: WhatIfLookupOption[] = firstArray(timeslots)
        .map((t: any) => {
          const value = numericString(t.id ?? t.slotId ?? t.slot_id);
          if (!value) return null;
          const start = String(t.start ?? t.startTime ?? t.start_time ?? "");
          const end = String(t.end ?? t.endTime ?? t.end_time ?? "");
          const daysRaw = Array.isArray(t.days)
            ? t.days
            : Array.isArray(t.dayNames)
              ? t.dayNames
              : [];
          const days = daysRaw.map((d: unknown) => String(d)).join(" ");
          const slotType = String(t.slotType ?? t.slot_type ?? t.type ?? "");
          return {
            value,
            label: `${start} - ${end} | ${days} | ${slotType}`,
          };
        })
        .filter((x): x is WhatIfLookupOption => x !== null);

      setLecturerOptions(nextLecturers);
      setRoomOptions(nextRooms);
      setCourseOptions(nextCourses);
      setTimeslotOptions(nextSlots);
    };

    void loadLookups();
  }, []);

  useEffect(() => {
    if (launcherOpen) setTimetableSearch("");
  }, [launcherOpen]);

  useEffect(() => {
    const busy =
      scenario?.isRunning ||
      scenario?.latestRun?.status === "running" ||
      scenario?.latestRun?.status === "pending";
    if (!busy) return;
    const t = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(t);
  }, [scenario?.isRunning, scenario?.latestRun?.status, load]);

  useEffect(() => {
    if (!applyOpen) {
      setApplyConflictSummary(null);
      setApplyConflictAcknowledged(false);
      setApplyConflictLoading(false);
      return;
    }
    const ttId = scenario?.latestRun?.resultTimetableId;
    if (ttId == null || ttId <= 0) {
      setApplyConflictSummary(null);
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
  }, [applyOpen, scenario?.latestRun?.resultTimetableId]);

  useEffect(() => {
    if (!scenario || simStarting) return;
    const latest = scenario.latestRun;
    if (!latest || typeof latest.id !== "number") return;
    const isActive = latest.status === "running" || latest.status === "pending";
    if (!isActive) {
      recoveringRunIdRef.current = null;
      return;
    }
    if (recoveringRunIdRef.current === latest.id) return;
    recoveringRunIdRef.current = latest.id;

    const ac = beginRun("scenario", latest.id);
    streamAbortRef.current = ac;
    setRunPhase(
      "Connected to optimizer",
      "Recovered active run after reload. Waiting for progress updates…",
    );
    void (async () => {
      try {
        const outcome = await streamScenarioRunSse(latest.id, ac.signal, {
          updateProgress,
          setPercent,
          setRunPhase,
        });
        if (outcome.ok) {
          setFinalizing();
          if (pageMountedRef.current) {
            await load();
          }
        } else if (outcome.cancelled) {
          if (pageMountedRef.current) {
            await load();
            toast({
              title: "Simulation cancelled",
              description: "Run cancelled by user.",
            });
          }
        } else if (outcome.streamInterrupted) {
          if (pageMountedRef.current) await load();
        } else if (outcome.errorMessage) {
          toast({
            title: "Run failed",
            description: outcome.errorMessage,
            variant: "destructive",
          });
          if (pageMountedRef.current) await load();
        }
      } catch (error: unknown) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          toast({
            title: "Run stream error",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      } finally {
        if (streamAbortRef.current === ac) {
          streamAbortRef.current = null;
        }
        endRun();
      }
    })();
  }, [
    scenario,
    simStarting,
    beginRun,
    updateProgress,
    setPercent,
    setRunPhase,
    setFinalizing,
    load,
    endRun,
  ]);

  async function startSimulation(runSelection: number[] = selected) {
    const canStartWithSelection = runSelection.length === 1;
    if (blockedByTimetable) {
      toast({
        title: "Timetable generation in progress",
        description: "Wait for timetable generation to finish before running a What-If scenario.",
      });
      return;
    }
    if (!canStartWithSelection || simStarting) return;
    setLauncherOpen(false);
    setSimStarting(true);
    const ac = beginRun("scenario");
    streamAbortRef.current = ac;
    const signal = ac.signal;
    setRunPhase("Starting what-if run", "Posting scenario to the server…");
    try {
      const timetableId = runSelection[0];
      const selectedTimetable = selectableBaseTimetables.find(
        (t) => t.timetableId === timetableId,
      );
      if (!selectedTimetable) {
        throw new Error(
          "Selected timetable is not eligible. Choose a published timetable or one saved from timetable generation (optimizer draft).",
        );
      }
      const started = await ApiClient.request<{ runs: Array<{ runId: number; timetableId: number }> }>(
        `/what-if/scenarios/${id}/run`,
        { method: "POST", body: JSON.stringify({ timetableIds: [timetableId] }) },
      );
      const runs = started.runs ?? [];
      if (runs.length === 0) throw new Error("No runs were started.");
      const firstRunId = Number(runs[0]?.runId);
      if (Number.isFinite(firstRunId) && firstRunId > 0) {
        bindRunId(firstRunId);
      }

      const run = runs[0];
      const outcome = await streamScenarioRunSse(run.runId, signal, {
        updateProgress,
        setPercent,
        setRunPhase,
      });
      if (!outcome.ok) {
        if (outcome.cancelled) {
          toast({
            title: "Simulation cancelled",
            description: "Run cancelled by user.",
          });
          if (pageMountedRef.current) {
            await load();
          }
          return;
        }
        if (outcome.streamInterrupted) {
          if (pageMountedRef.current) {
            await load();
          }
          return;
        }
        toast({
          title: "Run failed",
          description: outcome.errorMessage ?? "Unknown error",
          variant: "destructive",
        });
        return;
      }
      setFinalizing();

      const sseResultTimetableId =
        typeof outcome.resultTimetableId === "number" && outcome.resultTimetableId > 0
          ? outcome.resultTimetableId
          : null;
      if (pageMountedRef.current) {
        await load();
      }
      if (sseResultTimetableId && pageMountedRef.current) {
        toast({
          title: "Scenario result saved",
          description: `Stored as draft timetable #${sseResultTimetableId}. Use View schedule below when you want to inspect it.`,
        });
        return;
      }

      if (pageMountedRef.current) {
        const refreshedScenario = await getScenario(id);
        const latestRun = refreshedScenario.latestRun;
        if (
          latestRun &&
          (latestRun.status === "completed" || latestRun.status === "applied") &&
          latestRun.resultTimetableId
        ) {
          toast({
            title: "Scenario result saved",
            description: `Stored as draft timetable #${latestRun.resultTimetableId}. Use View schedule below when you want to inspect it.`,
          });
          return;
        }
      }
      if (pageMountedRef.current) {
        if (pageMountedRef.current) {
          toast({
            title: "Simulation complete",
          });
        }
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        toast({
          title: "Run failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    } finally {
      if (streamAbortRef.current === ac) {
        streamAbortRef.current = null;
      }
      endRun();
      if (pageMountedRef.current) {
        setSimStarting(false);
      }
    }
  }

  const selectableBaseTimetables = useMemo(() => timetables.filter((t) => Boolean(t.canUseAsScenarioBase)), [timetables]);

  const filteredTimetables = useMemo(() => {
    const q = timetableSearch.trim().toLowerCase();
    if (!q) return selectableBaseTimetables;
    return selectableBaseTimetables.filter((t) => {
      const label = `${t.academicYear} ${t.semester} v${t.versionNumber} ${t.status ?? ""} ${t.timetableKind}`.toLowerCase();
      return label.includes(q);
    });
  }, [selectableBaseTimetables, timetableSearch]);

  const latestRunBaseTimetableStatus = useMemo(() => {
    const baseId = scenario?.latestRun?.baseTimetableId;
    if (!baseId) return null;
    return (
      timetables.find((t) => Number(t.timetableId) === Number(baseId))?.status ?? null
    );
  }, [scenario?.latestRun?.baseTimetableId, timetables]);
  const applyTargetsPublishedTimetable = isPublishedTimetableStatus(latestRunBaseTimetableStatus);

  const latestRunCompleteWithResult = useMemo(() => {
    const lr = scenario?.latestRun;
    if (!lr?.resultTimetableId) return null;
    if (lr.status !== "completed" && lr.status !== "applied") return null;
    return lr;
  }, [scenario?.latestRun]);

  const latestRunBaseLabel = useMemo(() => {
    if (!latestRunCompleteWithResult) return "";
    const fromRun = latestRunCompleteWithResult.baseTimetableName?.trim();
    if (fromRun) return fromRun;
    const t = timetables.find(
      (x) => Number(x.timetableId) === Number(latestRunCompleteWithResult.baseTimetableId),
    );
    if (t) {
      return `${t.academicYear} · ${t.semester} · v${t.versionNumber}`;
    }
    return `Timetable #${latestRunCompleteWithResult.baseTimetableId}`;
  }, [latestRunCompleteWithResult, timetables]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px] space-y-4">
            <div className="mb-6 space-y-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard/what-if">What-If Scenarios</Link></BreadcrumbLink></BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem><BreadcrumbPage>{scenario?.name ?? "Scenario"}</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              {shouldShowScenarioProgressBar ? <GwoTopProgressBar sources={["scenario"]} /> : null}
            </div>
            {!idValid ? (
              <Alert>
                <AlertTitle>Redirecting…</AlertTitle>
                <AlertDescription>Invalid scenario ID.</AlertDescription>
              </Alert>
            ) : null}
            {loadError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load scenario</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  {loadError}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setScenarioLoading(true);
                      void load();
                    }}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="space-y-6 lg:col-span-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {scenarioLoading ? (
                        <Skeleton className="h-9 w-32" />
                      ) : (
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{scenario?.name}</h1>
                      )}
                      {scenarioLoading ? null : scenario?.status ? (
                        <Badge variant="secondary" className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                          {scenario.status}
                        </Badge>
                      ) : null}
                    </div>
                    {!scenarioLoading && scenario?.description ? (
                      <p className="text-sm text-muted-foreground">{scenario.description}</p>
                    ) : null}
                  </div>
                  <Button variant="outline" className="shrink-0 border-border shadow-sm" asChild>
                    <Link href={`/dashboard/what-if?edit=${id}`}>Edit Scenario</Link>
                  </Button>
                </div>
                <div>
                  <h2 className="mb-3 text-base font-semibold text-foreground">Conditions</h2>
                  {scenarioLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-20 w-full rounded-lg" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                  ) : scenario?.conditions?.length ? (
                    <div className="space-y-3">
                      {scenario.conditions.map((c, idx) => (
                        <div
                          key={`${c.type}-${idx}`}
                          className="rounded-lg border border-border/80 bg-card p-4 text-sm shadow-sm"
                        >
                          <div className="font-semibold tracking-tight">{conditionLabel(c.type)}</div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {conditionParameterSummary(c, { lecturerOptions, roomOptions, courseOptions, timeslotOptions })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                      No conditions yet. Use Edit Scenario to add mutations.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-3 lg:col-span-2">
                <Card className="border-border/80 shadow-sm">
                  <CardContent className="space-y-4 p-6 pt-6">
                    <div className="flex flex-col items-center text-center">
                      <div
                        className={cn(
                          "mb-4 flex h-14 w-14 items-center justify-center rounded-full",
                          latestRunCompleteWithResult && !scenarioRunBusy
                            ? "bg-emerald-100 dark:bg-emerald-950/50"
                            : "bg-green-100 dark:bg-green-950/50",
                        )}
                      >
                        {latestRunCompleteWithResult && !scenarioRunBusy ? (
                          <Check
                            className="h-7 w-7 stroke-[2.5] text-emerald-700 dark:text-emerald-300"
                            aria-hidden
                          />
                        ) : (
                          <Play className="h-6 w-6 translate-x-0.5 fill-green-600 text-green-600 dark:fill-green-400 dark:text-green-400" />
                        )}
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        {blockedByOtherScenarioRun
                          ? "Another simulation is running"
                          : scenarioPaused
                            ? "Simulation paused"
                            : scenarioRunBusy
                              ? "Simulation in progress"
                              : runWasCancelledByUser
                                ? "Simulation cancelled"
                                : scenario?.latestRun?.status === "failed"
                                  ? "Simulation failed"
                                  : latestRunCompleteWithResult
                                    ? "Latest run finished"
                                    : "Ready to simulate"}
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        {blockedByOtherScenarioRun
                          ? "Only one What-If simulation can run at a time. Wait for the active run to finish."
                          : scenarioPaused
                            ? "The run is paused. Use Resume in the progress bar above to continue."
                            : scenarioRunBusy
                              ? "Live progress is shown in the bar above."
                              : runWasCancelledByUser
                                ? "This run was cancelled by you. You can start another simulation at any time."
                                : scenario?.latestRun?.status === "failed"
                                  ? "Review the error below, adjust conditions or pick another timetable, then try again."
                                  : latestRunCompleteWithResult
                                    ? `Your most recent completed run used baseline “${latestRunBaseLabel}”. Compare, apply, or open the draft below — you can still run this scenario on other timetables.`
                                    : "Select a timetable to run this scenario against."}
                      </p>
                    </div>
                    {blockedByTimetable ? (
                      <div className="relative flex h-11 w-full items-center rounded-lg bg-green-600 pl-4 pr-28 text-base font-medium text-white">
                        <span className="pointer-events-none">
                          Timetable generation running...
                        </span>
                        <button
                          type="button"
                          className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-md border border-green-300 bg-white px-2.5 text-[11px] font-semibold text-green-800 shadow-sm transition-colors hover:bg-green-50"
                          onClick={() => router.push("/timetable-generation")}
                        >
                          Open Timetable
                        </button>
                      </div>
                    ) : blockedByOtherScenarioRun ? (
                      <div className="relative flex h-11 w-full items-center rounded-lg bg-green-600 pl-4 pr-36 text-base font-medium text-white">
                        <span className="pointer-events-none">
                          Waiting for active simulation...
                        </span>
                        <button
                          type="button"
                          className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-md border border-green-300 bg-white px-2.5 text-[11px] font-semibold text-green-800 shadow-sm transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => {
                            if (!activeScenarioId) return;
                            router.push(`/dashboard/what-if/${activeScenarioId}`);
                          }}
                          disabled={!activeScenarioId}
                        >
                          {activeScenarioId ? "Open active scenario" : "Locating..."}
                        </button>
                      </div>
                    ) : (
                      <Button
                        className="h-11 w-full rounded-lg bg-green-600 text-base font-medium text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
                        type="button"
                        disabled={
                          scenarioLoading ||
                          scenarioRunBusy ||
                          blockedByOtherScenarioRun
                        }
                        onClick={() => setLauncherOpen(true)}
                      >
                        {blockedByOtherScenarioRun ? "Waiting for active simulation…" : scenarioRunBusy ? "Running…" : "Run Simulation"}
                      </Button>
                    )}
                    {runStatus === "failed" && !runWasCancelledByUser ? (
                      <div className="rounded-lg border border-red-200/80 bg-red-50/70 p-4 dark:border-red-900/60 dark:bg-red-950/30">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-100">
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold text-red-800 dark:text-red-100">Simulation failed</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-300 bg-white text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-900/50"
                                onClick={() => setLauncherOpen(true)}
                              >
                                Retry
                              </Button>
                            </div>
                            {latestRunErrorMessage !== "Process exited with code null." ? (
                              <p className="mt-1 text-sm leading-relaxed text-red-700/95 dark:text-red-200/90">
                                {latestRunErrorMessage ??
                                  "The run failed. Try again with another timetable or updated conditions."}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {latestRunCompleteWithResult ? (
                      <>
                        <div className="border-t border-border/80 pt-4" />
                        <div className="rounded-lg border border-border/80 bg-muted/25 px-4 py-3 text-left text-sm shadow-sm">
                          <p className="font-medium text-foreground">Last run</p>
                          <dl className="mt-2 space-y-1.5 text-muted-foreground">
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                              <dt className="shrink-0 text-xs font-medium uppercase tracking-wide">Finished</dt>
                              <dd className="text-foreground sm:text-right">
                                {latestRunCompleteWithResult.completedAt
                                  ? formatDateTime(latestRunCompleteWithResult.completedAt)
                                  : "—"}
                              </dd>
                            </div>
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                              <dt className="shrink-0 text-xs font-medium uppercase tracking-wide">Duration</dt>
                              <dd className="tabular-nums text-foreground sm:text-right">
                                {formatRunDurationSeconds(
                                  effectiveRunDurationSeconds(latestRunCompleteWithResult),
                                )}
                              </dd>
                            </div>
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                              <dt className="shrink-0 text-xs font-medium uppercase tracking-wide">Baseline timetable</dt>
                              <dd className="min-w-0 text-foreground sm:max-w-[65%] sm:text-right">
                                <span className="break-words">{latestRunBaseLabel}</span>
                                <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                                  #{latestRunCompleteWithResult.baseTimetableId}
                                </span>
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <div className="grid w-full gap-2 [grid-template-columns:minmax(0,1fr)_minmax(0,1.55fr)_minmax(0,1fr)]">
                          <Button
                            asChild
                            variant="default"
                            type="button"
                            className="w-full min-w-0 justify-center px-2 text-center text-sm sm:px-3"
                          >
                            <Link
                              href={buildWhatIfCompareHref({
                                mode: "before_after",
                                runIds: [latestRunCompleteWithResult.id],
                                scenarioId: id,
                                timetableId: latestRunCompleteWithResult.baseTimetableId ?? null,
                              })}
                            >
                              Compare results
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            className="w-full min-w-0 justify-center px-2 text-center text-sm sm:px-3"
                            onClick={() => setApplyOpen(true)}
                          >
                            Apply to timetable
                          </Button>
                          <Button
                            asChild
                            variant="default"
                            type="button"
                            className="w-full min-w-0 justify-center px-2 text-center text-sm sm:px-3"
                          >
                            <Link
                              href={`/schedule?simulation=1&timetableId=${latestRunCompleteWithResult.resultTimetableId}&runId=${latestRunCompleteWithResult.id}`}
                            >
                              View schedule
                            </Link>
                          </Button>
                        </div>
                      </>
                    ) : null}
                    {scenarioPaused ? (
                      <p className="text-xs text-muted-foreground">
                        Simulation is paused. Use Resume in the progress bar above.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
                <Button asChild variant="outline" className="w-full"><Link href={`/dashboard/what-if/${id}/runs`}>Run history & apply</Link></Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={launcherOpen} onOpenChange={setLauncherOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="space-y-1 border-b px-6 py-5 pr-12 text-left">
            <DialogTitle className="text-xl font-semibold">Run Simulation</DialogTitle>
            <DialogDescription>
              {`Select the baseline timetable to test '${scenario?.name ?? "this scenario"}' against.`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(min(90vh,720px)-200px)] space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-foreground">Select timetables</p>
                <div className="relative w-full sm:max-w-[220px]">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 rounded-lg border-border pl-9"
                    placeholder="Search…"
                    value={timetableSearch}
                    onChange={(e) => setTimetableSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border/80 bg-muted/10 p-2">
                {selectableBaseTimetables.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                    No eligible base timetables found. Use a published timetable or save a draft from timetable generation first.
                  </p>
                ) : filteredTimetables.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">No timetables match your search.</p>
                ) : null}
                {filteredTimetables.map((t) => {
                  const checked = selected.includes(t.timetableId);
                  return (
                    <button
                      key={t.timetableId}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        checked
                          ? "border-sky-600 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/35"
                          : "border-border bg-background hover:bg-muted/40",
                      )}
                      onClick={() => {
                        setSelected([t.timetableId]);
                      }}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                          checked ? "border-sky-600 bg-sky-600 dark:border-sky-500 dark:bg-sky-500" : "border-muted-foreground/40 bg-background",
                        )}
                      >
                        {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-foreground">
                        {t.academicYear} - {t.semester}
                      </span>
                      <Badge variant="outline" className="shrink-0 font-mono text-xs font-normal">
                        v{t.versionNumber}
                      </Badge>
                      <Badge
                        variant={t.isPublished ? "default" : "secondary"}
                        className="shrink-0 text-xs capitalize"
                      >
                        {t.isPublished
                          ? String(t.generationType ?? "").toLowerCase() === "imported"
                            ? "Published · seeded"
                            : "Published · official"
                          : ["gwo_ui", "gwo"].includes(String(t.generationType ?? "").toLowerCase())
                            ? "Draft · optimizer"
                            : "Draft"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" className="min-w-[100px]" onClick={() => setLauncherOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-w-[160px] bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
              disabled={!canStart || scenarioRunBusy || selectableBaseTimetables.length === 0 || blockedByTimetable}
              onClick={() => void startSimulation()}
            >
              <Play className="mr-2 h-4 w-4 fill-current" />
              {simStarting ? "Starting…" : "Start Simulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={applyOpen}
        onOpenChange={(open) => {
          setApplyOpen(open);
          if (!open) {
            setApplyText("");
            setApplySubmitting(false);
            setApplySuccess(null);
            setApplyConflictAcknowledged(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Apply Scenario Result?</DialogTitle></DialogHeader>
          {applyTargetsPublishedTimetable ? (
            <Alert variant="destructive" className="border-2 shadow-sm">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <AlertTitle>Warning: base timetable is published</AlertTitle>
              <AlertDescription>
                Applying this scenario will overwrite the currently published live schedule.
                This change is immediately visible to everyone using the live timetable.
              </AlertDescription>
            </Alert>
          ) : null}
          <p className="text-sm text-muted-foreground">
            This promotes the sandbox result onto the base timetable: schedule entries and metrics are replaced. Works for draft or published timetables.
            Production was not modified during the simulation; this is the only step that writes live data.
          </p>
          <Label>Type scenario name to confirm</Label>
          <Input value={applyText} onChange={(e) => setApplyText(e.target.value)} placeholder={scenario?.name ?? ""} />
          <HardConflictsAcknowledgmentFields
            summary={applyConflictSummary}
            loading={applyConflictLoading}
            acknowledged={applyConflictAcknowledged}
            onAcknowledgedChange={setApplyConflictAcknowledged}
            contextLabel="Applying replaces the base timetable’s schedule with this result."
          />
          {applySuccess ? <p className="text-sm text-emerald-600">{applySuccess}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)} disabled={applySubmitting}>Cancel</Button>
            <Button variant="destructive" disabled={!canApply || applySubmitting} onClick={async () => {
              if (!scenario?.latestRun) return;
              setApplySubmitting(true);
              setApplySuccess(null);
              try {
                const needAck = applyConflictSummary?.requiresConflictAcknowledgment === true;
                await ApiClient.request(`/what-if/runs/${scenario.latestRun.id}/apply`, {
                  method: "POST",
                  body: JSON.stringify(needAck ? { acknowledgedHardConflicts: true } : {}),
                });
                setApplySuccess("Scenario applied successfully.");
                toast({ title: "Scenario applied" });
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
              } finally {
                setApplySubmitting(false);
              }
            }}>{applySubmitting ? "Applying…" : "Confirm & Apply"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
