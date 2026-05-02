"use client";

import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TimetableGridSectionDialog } from "@/components/timetable-grid-section-dialog";
import { TimetableGridAddSectionDialog } from "@/components/timetable-grid-add-section-dialog";
import {
  collectScheduleHardViolations,
  hardViolationsIntroducedOrWorsened,
  validateScheduleHardConstraints,
} from "@/lib/schedule-hard-constraints";
import { mergeEntryWithPlacement } from "@/lib/schedule-edit-rules";
import { getScenarios } from "@/lib/what-if";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Clock,
  GripVertical,
  Layers2,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import type {
  SchedulePayload,
  ScheduleEntry,
  ScheduleMeta,
  LecturerSummary,
  RoomSummary,
  ScheduleConfig,
  GapWarning,
  UtilizationInfo,
  WorkloadInfo,
  DistributionInfo,
  SoftWeights,
  TimeslotConfigEntry,
  RoomConfigValue,
  UnitConflictViolation,
  StudentGapWarning,
  SingleSessionDayWarning,
  StudyPlanUnitSummary,
} from "@/lib/schedule-data";
import { getLecturerColor } from "@/lib/schedule-data";
import { useGwoRun } from "@/components/gwo-run-context";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { segmentedNavTabItemRadiusClass } from "@/lib/segmented-nav-tabs";
import { buildUiConflicts } from "@/lib/schedule-ui";
import {
  catalogueById,
  mergeCatalogueWithConfigTimeslots,
  compareTimeslotGridOrder,
  normalizeTimeslotCatalogueEntry,
  timeslotCompactLabel,
  timeslotLongLabel,
  timeslotScheduleLabel,
  uiSlotKindFromEngineSlotType,
  formatDeliveryMode,
  injectTimeslotIdsWithLabels,
  type TimeslotCatalogueEntry,
} from "@/lib/timetable-model";
async function jsonFetcher(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

const ENGINE_SLOT_TYPES = [
  "lecture_mw",
  "lecture_stt",
  "blended_mon",
  "blended_wed",
  "blended_st",
  "lab",
] as const;

const ROOM_TYPE_OPTIONS = ["lecture_hall", "lab_room", "any"] as const;

function normalizeTimeslotsInput(
  raw: ScheduleConfig["timeslots"],
): TimeslotConfigEntry[] {
  if (!raw || raw.length === 0) return [];
  if (typeof raw[0] === "string") {
    return (raw as string[]).map((id, i) => ({
      id,
      days: ["Monday", "Wednesday"],
      start_hour: 8 + i * 1.5,
      duration: 1.5,
      slot_type: "lecture_mw",
    }));
  }
  return raw as TimeslotConfigEntry[];
}

function roomCap(v: RoomConfigValue): number {
  return typeof v === "number" ? v : (v.capacity ?? 0);
}

function roomTp(v: RoomConfigValue): string {
  return typeof v === "number" ? "any" : (v.room_type ?? "any");
}

function timeslotHeaderLabel(
  tsId: string,
  catalogue: TimeslotCatalogueEntry[],
  entries: ScheduleEntry[],
  mode: "compact" | "long" = "long",
): string {
  const row = catalogue.find((t) => t.id === tsId);
  if (row) {
    return mode === "compact" ? timeslotCompactLabel(row) : timeslotLongLabel(row);
  }
  const hit = entries.find((e) => e.timeslot === tsId);
  return hit?.timeslot_label ?? tsId;
}

function entryRequiresRoom(e: ScheduleEntry): boolean {
  if (e.room_required != null) return e.room_required;
  if (e.requires_room != null) return e.requires_room;
  return (
    (e.delivery_mode || "inperson").toLowerCase().replace(/_/g, "") !==
    "online"
  );
}

function deliveryTag(dm?: string): string | null {
  const v = (dm || "inperson").toLowerCase().replace(/_/g, "");
  if (v === "online") return "Online";
  if (v === "blended") return "Blended";
  return null;
}

function formatRoomCell(entry: ScheduleEntry): string {
  if (!entryRequiresRoom(entry)) return "—";
  if (entry.room == null || entry.room === "" || entry.room === "ONLINE") {
    return "—";
  }
  return entry.room;
}

// ─── Shared hooks ─────────────────────────────────────────────────────────────

function useSchedule() {
  const searchParams = useSearchParams();
  const simulationTimetableId = searchParams.get("simulationTimetableId");
  const parsedSimulationTimetableId =
    simulationTimetableId != null && simulationTimetableId.trim() !== ""
      ? Number(simulationTimetableId)
      : NaN;
  const isSimulationView =
    Number.isFinite(parsedSimulationTimetableId) && parsedSimulationTimetableId > 0;
  const swrKey = isSimulationView
    ? `/timetables/${parsedSimulationTimetableId}/schedule-payload`
    : "/api/schedule";

  const { data, error, isLoading, mutate } = useSWR<SchedulePayload>(
    swrKey,
    (key: string) =>
      isSimulationView ? ApiClient.request<SchedulePayload>(key) : jsonFetcher(key),
    { refreshInterval: 3000, dedupingInterval: 0 },
  );
  return { data, error, isLoading, refresh: mutate };
}

function useConfig() {
  const searchParams = useSearchParams();
  const semesterMode = searchParams.get("mode") === "summer" ? "summer" : "normal";
  const swrKey = `/api/config?mode=${semesterMode}`;
  const { data, error, isLoading, mutate } = useSWR<ScheduleConfig>(
    swrKey,
    jsonFetcher,
    { dedupingInterval: 0 },
  );
  return { config: data, error, isLoading, refresh: mutate };
}

export function RefreshButton({
  semesterMode = "normal",
  className,
  onRunError,
}: {
  semesterMode?: "normal" | "summer";
  className?: string;
  /** When set, errors are reported here instead of rendering under the button (avoids layout shift). */
  onRunError?: (message: string | null) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const simulationTimetableId = searchParams.get("simulationTimetableId");
  const isSimulationView = simulationTimetableId != null && simulationTimetableId.trim() !== "";
  const { isRunning, runOptimizer } = useGwoRun();
  const [error, setError] = useState<string | null>(null);
  const [openingWhatIf, setOpeningWhatIf] = useState(false);
  const { data: runServerStatus } = useSWR<{
    running: boolean;
    globalLockOwner?: "timetable" | "whatif" | null;
  }>("/api/run", jsonFetcher, { refreshInterval: 1500, dedupingInterval: 0 });
  const blockedByWhatIf = runServerStatus?.globalLockOwner === "whatif";
  const runDisabled = isRunning || blockedByWhatIf;

  const handleRunAlgorithm = async () => {
    setError(null);
    onRunError?.(null);
    console.log("[v0] Calling /api/run endpoint (SSE)");
    const errMsg = await runOptimizer({ semesterMode });
    if (errMsg) {
      if (onRunError) onRunError(errMsg);
      else setError(errMsg);
    }
  };

  const handleOpenRunningScenario = async () => {
    setOpeningWhatIf(true);
    try {
      const scenarios = await getScenarios();
      const running = scenarios.find(
        (s) => s.isRunning || s.latestRun?.status === "running" || s.latestRun?.status === "pending",
      );
      if (running) router.push(`/dashboard/what-if/${running.id}`);
      else router.push("/dashboard/what-if");
    } catch {
      router.push("/dashboard/what-if");
    } finally {
      setOpeningWhatIf(false);
    }
  };

  return (
    <div className={cn("flex w-full flex-col gap-2 sm:w-auto sm:items-end", className)}>
      {blockedByWhatIf ? (
        <div className="relative flex h-10 w-full items-center rounded-lg bg-green-600 pl-4 pr-36 text-sm font-medium text-white sm:w-[22rem]">
          <span className="pointer-events-none">Scenario running...</span>
          <button
            type="button"
            className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-md border border-green-300 bg-card px-2.5 text-[11px] font-semibold text-green-800 shadow-sm transition-colors hover:bg-green-50 disabled:opacity-60"
            onClick={() => void handleOpenRunningScenario()}
            disabled={openingWhatIf}
          >
            {openingWhatIf ? "Opening…" : "Open Running Scenario"}
          </button>
        </div>
      ) : isSimulationView ? null : (
        <button
          type="button"
          onClick={handleRunAlgorithm}
          disabled={runDisabled}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {isRunning ? "Optimizer running…" : "Run Algorithm"}
        </button>
      )}
      {!onRunError && error ? (
        <div className="w-full max-w-[22rem] rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700/60 dark:bg-red-950/30 dark:text-red-200 sm:w-[22rem]">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function scheduleDeliveryBreakdown(
  meta: ScheduleMeta | undefined,
  entries: ScheduleEntry[],
): { ip: number; on: number; bl: number; lab: number } {
  if (meta?.inperson_lectures != null && meta?.online_lectures != null) {
    return {
      ip: meta.inperson_lectures,
      on: meta.online_lectures,
      bl: meta.blended_lectures ?? 0,
      lab: meta.lab_sessions ?? 0,
    };
  }
  let ip = 0;
  let on = 0;
  let bl = 0;
  let lab = 0;
  for (const e of entries) {
    const dm = (e.delivery_mode || "inperson").toLowerCase().replace(/_/g, "");
    const st = (e.session_type || "lecture").toLowerCase();
    if (st === "lab") lab++;
    else if (dm === "online") on++;
    else if (dm === "blended") bl++;
    else ip++;
  }
  return { ip, on, bl, lab };
}

/** Counts from the active merged config (`/api/config`): what the scheduler considers. */
function getSchedulingInputCounts(config: ScheduleConfig): {
  distinctCourses: number;
  sectionSlots: number;
  rooms: number;
  timeslots: number;
  lecturers: number;
} {
  const lectures = config.lectures ?? [];
  const distinctCourses = new Set(
    lectures.map((l) => String(l.course).trim()).filter(Boolean),
  ).size;
  return {
    distinctCourses,
    sectionSlots: lectures.length,
    rooms: Object.keys(config.rooms ?? {}).length,
    timeslots: Array.isArray(config.timeslots) ? config.timeslots.length : 0,
    lecturers: config.lecturers?.length ?? 0,
  };
}

// ─── ConflictAlert ────────────────────────────────────────────────────────────

type HardViolationCategory =
  | "all"
  | "teaching_load"
  | "wrong_slot"
  | "unit"
  | "room"
  | "lecturer";

function textMatchesQuery(query: string, parts: Array<string | number | undefined | null>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((p) => String(p ?? "").toLowerCase().includes(q));
}

export function ConflictAlert({ asSection = false }: { asSection?: boolean } = {}) {
  const { data, isLoading } = useSchedule();
  const { config, isLoading: configLoading } = useConfig();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<HardViolationCategory>("all");
  const [query, setQuery] = useState("");
  const entries = data?.schedule ?? [];
  const rawCatalogue = data?.timeslots_catalogue ?? [];
  const configSlotRows = useMemo(
    () => normalizeTimeslotsInput(config?.timeslots ?? []) as TimeslotCatalogueEntry[],
    [config?.timeslots],
  );
  const catalogue = useMemo(
    () => mergeCatalogueWithConfigTimeslots(rawCatalogue, configSlotRows),
    [rawCatalogue, configSlotRows],
  );
  const wrongSlots = data?.wrong_slot_type_violations ?? [];
  const unitConflicts: UnitConflictViolation[] = data?.unit_conflict_violations ?? [];
  const { conflicts, conflictIds } = buildUiConflicts(entries, catalogue);
  const lecturerSummary = data?.lecturer_summary ?? [];
  const overloads = lecturerSummary
    .map((l) => ({
      name: l.name,
      assigned: Number(l.teaching_load) || 0,
      max: Number(l.max_load) || 0,
    }))
    .filter((l) => (l.max || 0) > 0 && (l.assigned || 0) > (l.max || 0))
    .sort((a, b) => {
      if (b.assigned !== a.assigned) return b.assigned - a.assigned;
      return String(a.name).localeCompare(String(b.name));
    });

  const hasIssues =
    !isLoading &&
    !configLoading &&
    (wrongSlots.length > 0 || conflicts.length > 0 || unitConflicts.length > 0 || overloads.length > 0);
  const hasGeneratedSchedule = Boolean(data && entries.length > 0);

  const roomConflicts = conflicts.filter((c) => c.type === "room");
  const lecturerConflicts = conflicts.filter((c) => c.type === "lecturer");
  const totalCount = wrongSlots.length + conflicts.length + unitConflicts.length + overloads.length;

  const q = query.trim().toLowerCase();
  const filteredOverloads = useMemo(
    () =>
      overloads.filter((o) =>
        textMatchesQuery(query, [
          o.name,
          o.assigned,
          o.max,
          `${o.assigned}h`,
          `${o.max}h`,
          "teaching load",
          "workload",
          "max workload",
        ]),
      ),
    [overloads, query],
  );
  const filteredWrongSlots = useMemo(
    () =>
      wrongSlots.filter((w) =>
        textMatchesQuery(query, [
          w.lecture,
          w.assigned_type,
          w.delivery_mode,
          w.session_type,
          formatDeliveryMode(w.delivery_mode),
          (w.session_type || "lecture").toLowerCase() === "lab" ? "lab" : "lecture",
          "wrong timeslot",
          "wrong slot",
          "timeslot type",
          "session",
          "delivery",
        ]),
      ),
    [wrongSlots, query],
  );
  const filteredUnitConflicts = useMemo(
    () =>
      unitConflicts.filter((uc) =>
        textMatchesQuery(query, [
          uc.unit,
          uc.course_a,
          uc.course_b,
          uc.timeslot_a,
          uc.timeslot_b,
          "unit conflicts",
          "unit conflict",
          "students cannot attend both sessions",
          "overlap",
        ]),
      ),
    [unitConflicts, query],
  );
  const filteredRoomConflicts = useMemo(
    () =>
      roomConflicts.filter((c) =>
        textMatchesQuery(query, [
          c.detail,
          `Room ${c.detail}`,
          `room ${c.detail}`,
          c.timeslot_label,
          ...c.entries.map((e) => e.course_code),
          ...c.entries.map((e) => e.lecturer ?? ""),
          "Room overlap",
          "room overlap",
          "room",
        ]),
      ),
    [roomConflicts, query],
  );
  const filteredLecturerConflicts = useMemo(
    () =>
      lecturerConflicts.filter((c) =>
        textMatchesQuery(query, [
          c.detail,
          c.timeslot_label,
          ...c.entries.map((e) => e.course_code),
          ...c.entries.map((e) => e.lecturer ?? ""),
          "Lecturer overlap",
          "lecturer overlap",
          "lecturer",
        ]),
      ),
    [lecturerConflicts, query],
  );

  const filteredTotal =
    filteredOverloads.length +
    filteredWrongSlots.length +
    filteredUnitConflicts.length +
    filteredRoomConflicts.length +
    filteredLecturerConflicts.length;

  const activeFilteredCount = useMemo(() => {
    switch (category) {
      case "all":
        return filteredTotal;
      case "teaching_load":
        return filteredOverloads.length;
      case "wrong_slot":
        return filteredWrongSlots.length;
      case "unit":
        return filteredUnitConflicts.length;
      case "room":
        return filteredRoomConflicts.length;
      case "lecturer":
        return filteredLecturerConflicts.length;
      default:
        return filteredTotal;
    }
  }, [
    category,
    filteredTotal,
    filteredOverloads.length,
    filteredWrongSlots.length,
    filteredUnitConflicts.length,
    filteredRoomConflicts.length,
    filteredLecturerConflicts.length,
  ]);

  const categoryChips: { id: HardViolationCategory; label: string; filtered: number; base: number }[] = [
    { id: "all", label: "All types", filtered: filteredTotal, base: totalCount },
    { id: "teaching_load", label: "Teaching load", filtered: filteredOverloads.length, base: overloads.length },
    { id: "wrong_slot", label: "Wrong slot type", filtered: filteredWrongSlots.length, base: wrongSlots.length },
    { id: "unit", label: "Unit conflicts", filtered: filteredUnitConflicts.length, base: unitConflicts.length },
    { id: "room", label: "Room overlap", filtered: filteredRoomConflicts.length, base: roomConflicts.length },
    {
      id: "lecturer",
      label: "Lecturer overlap",
      filtered: filteredLecturerConflicts.length,
      base: lecturerConflicts.length,
    },
  ];

  const showSection = (id: HardViolationCategory) => category === "all" || category === id;

  const resetFiltersOnClose = useCallback(() => {
    setQuery("");
    setCategory("all");
  }, []);

  return (
    <div className={asSection ? "space-y-3" : ""}>
      {asSection && (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Section 3 — Violated Hard Constraints
        </p>
      )}
      {!hasIssues && hasGeneratedSchedule && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-700/60 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-100">
            No hard constraint violations detected
          </p>
        </div>
      )}
      {hasIssues && (
      <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 shadow-sm dark:border-red-700/60 dark:bg-red-950/25">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => {
              const next = !o;
              if (!next) resetFiltersOnClose();
              return next;
            });
          }}
          className="flex w-full items-center justify-between border-b border-red-200 bg-red-50 px-4 py-3 text-left transition-colors hover:bg-red-100 dark:border-red-700/60 dark:bg-red-950/25 dark:hover:bg-red-950/40"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-red-900 dark:text-red-100">Hard constraint violations</span>
            <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-bold text-red-800 dark:bg-red-900/55 dark:text-red-100">
              {totalCount} issue{totalCount > 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-sm tabular-nums text-red-800 dark:text-red-200" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </button>
        {open && (
          <div>
            <div className="space-y-2 border-b border-red-200/60 bg-red-50/80 px-4 py-2.5 dark:border-red-700/45 dark:bg-red-950/20">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by course code, room id, lecturer, unit, slot, or type (e.g. room, unit)…"
                className="w-full rounded-md border border-red-200 bg-card px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-red-700/70 focus:border-red-400 focus:ring-1 focus:ring-red-300 dark:border-red-700/55 dark:placeholder:text-red-300/60 dark:focus:border-red-500 dark:focus:ring-red-500/45"
                aria-label="Filter hard constraint violations"
              />
              <div
                className="flex flex-wrap gap-1.5"
                role="tablist"
                aria-label="Violation categories"
              >
                {categoryChips.map((chip) => {
                  if (chip.id !== "all" && chip.base === 0) return null;
                  if (chip.id !== "all" && q && chip.filtered === 0) return null;
                  const selected = category === chip.id;
                  const badge =
                    q && chip.id !== "all" && chip.filtered !== chip.base
                      ? `${chip.filtered}/${chip.base}`
                      : chip.id === "all"
                        ? String(totalCount)
                        : String(chip.base);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setCategory(chip.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-red-400 bg-red-200 text-red-950 shadow-sm dark:border-red-500 dark:bg-red-900/55 dark:text-red-100"
                          : "border-red-200/80 bg-card/90 text-red-900 hover:bg-red-100/80 dark:border-red-700/50 dark:text-red-200 dark:hover:bg-red-900/35",
                      )}
                    >
                      <span>{chip.label}</span>
                      <span
                        className={cn(
                          "tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          selected
                            ? "bg-red-300/80 text-red-950 dark:bg-red-800/70 dark:text-red-100"
                            : "bg-red-100 text-red-800 dark:bg-red-900/55 dark:text-red-200",
                        )}
                      >
                        {chip.id === "all" && q ? `${filteredTotal}/${totalCount}` : badge}
                      </span>
                    </button>
                  );
                })}
              </div>
              {q && (
                <p className="text-[11px] text-red-800/80 dark:text-red-200/85">
                  Showing <span className="font-semibold tabular-nums">{filteredTotal}</span> of{" "}
                  <span className="tabular-nums">{totalCount}</span> after filter
                  {category !== "all" && (
                    <>
                      {" "}
                      · category:{" "}
                      <span className="font-medium">
                        {categoryChips.find((c) => c.id === category)?.label}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="max-h-[min(32rem,70vh)] overflow-y-auto px-4 py-4 text-sm">
              {activeFilteredCount === 0 ? (
                <p className="py-6 text-center text-red-800/80 dark:text-red-200/85">
                  No violations match this filter. Try another keyword or choose &quot;All types&quot;.
                </p>
              ) : (
                <div className="space-y-5">
                  {showSection("teaching_load") && filteredOverloads.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-medium text-red-900 dark:text-red-100">
                        Teaching load exceeds max workload
                        <span className="ml-2 tabular-nums text-xs font-normal text-red-700 dark:text-red-300/90">
                          ({filteredOverloads.length}
                          {q && overloads.length !== filteredOverloads.length
                            ? ` / ${overloads.length}`
                            : ""}
                          )
                        </span>
                      </h4>
                      <ul className="space-y-1.5 text-red-800 dark:text-red-200">
                        {filteredOverloads.map((o) => (
                          <li key={o.name} className="rounded border border-red-200 bg-card/80 px-3 py-2 dark:border-red-700/50">
                            <span className="font-semibold text-foreground">{o.name}</span>
                            {" — "}
                            <span className="tabular-nums font-semibold">{o.assigned}h</span>
                            <span className="text-muted-foreground"> / </span>
                            <span className="tabular-nums text-foreground/80">{o.max}h</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {showSection("wrong_slot") && filteredWrongSlots.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-medium text-red-900 dark:text-red-100">
                        Wrong timeslot type (session / delivery rules)
                        <span className="ml-2 tabular-nums text-xs font-normal text-red-700 dark:text-red-300/90">
                          ({filteredWrongSlots.length}
                          {q && wrongSlots.length !== filteredWrongSlots.length
                            ? ` / ${wrongSlots.length}`
                            : ""}
                          )
                        </span>
                      </h4>
                      <ul className="space-y-1.5 text-red-800 dark:text-red-200">
                        {filteredWrongSlots.map((w, idx) => (
                          <li key={idx} className="rounded border border-red-200 bg-card/80 px-3 py-2 dark:border-red-700/50">
                            <span className="font-mono font-semibold">{w.lecture}</span>
                            {" — "}
                            assigned slot pattern{" "}
                            <span className="font-mono">{w.assigned_type}</span>
                            {" "}not allowed for{" "}
                            <span className="font-medium">
                              {formatDeliveryMode(w.delivery_mode)}
                            </span>
                            {" / "}
                            <span className="font-medium">
                              {(w.session_type || "lecture").toLowerCase() === "lab"
                                ? "Lab"
                                : "Lecture"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {showSection("unit") && filteredUnitConflicts.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-medium text-red-900 dark:text-red-100">
                        Unit conflicts — students cannot attend both sessions
                        <span className="ml-2 tabular-nums text-xs font-normal text-red-700 dark:text-red-300/90">
                          ({filteredUnitConflicts.length}
                          {q && unitConflicts.length !== filteredUnitConflicts.length
                            ? ` / ${unitConflicts.length}`
                            : ""}
                          )
                        </span>
                      </h4>
                      <ul className="space-y-1.5 text-red-800 dark:text-red-200">
                        {filteredUnitConflicts.map((uc, idx) => (
                          <li key={idx} className="rounded border border-red-200 bg-card/80 px-3 py-2 dark:border-red-700/50">
                            <span className="mr-2 rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/55 dark:text-red-200">
                              {uc.unit}
                            </span>
                            <span className="font-mono font-semibold">{uc.course_a}</span>
                            {" & "}
                            <span className="font-mono font-semibold">{uc.course_b}</span>
                            {" overlap — "}
                            <span className="text-xs text-muted-foreground">
                              {uc.timeslot_a} / {uc.timeslot_b}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {showSection("room") && filteredRoomConflicts.length > 0 && (
                    <div>
                      <h4 className="mb-1 font-medium text-red-800 dark:text-red-200">
                        Room overlap
                        <span className="ml-2 tabular-nums text-xs font-normal text-red-700 dark:text-red-300/90">
                          ({filteredRoomConflicts.length}
                          {q && roomConflicts.length !== filteredRoomConflicts.length
                            ? ` / ${roomConflicts.length}`
                            : ""}
                          )
                        </span>
                      </h4>
                      <ul className="space-y-1 text-red-700 dark:text-red-200">
                        {filteredRoomConflicts.map((c, idx) => (
                          <li key={idx} className="rounded border border-red-200 bg-card/80 px-3 py-2 dark:border-red-700/50">
                            <strong>Room {c.detail}</strong> — {c.timeslot_label}:{" "}
                            {c.entries.map((e) => e.course_code).join(", ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {showSection("lecturer") && filteredLecturerConflicts.length > 0 && (
                    <div>
                      <h4 className="mb-1 font-medium text-red-800 dark:text-red-200">
                        Lecturer overlap
                        <span className="ml-2 tabular-nums text-xs font-normal text-red-700 dark:text-red-300/90">
                          ({filteredLecturerConflicts.length}
                          {q && lecturerConflicts.length !== filteredLecturerConflicts.length
                            ? ` / ${lecturerConflicts.length}`
                            : ""}
                          )
                        </span>
                      </h4>
                      <ul className="space-y-1 text-red-700 dark:text-red-200">
                        {filteredLecturerConflicts.map((c, idx) => (
                          <li key={idx} className="rounded border border-red-200 bg-card/80 px-3 py-2 dark:border-red-700/50">
                            <strong>{c.detail}</strong> — {c.timeslot_label}:{" "}
                            {c.entries.map((e) => e.course_code).join(", ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ─── SoftConstraintPanel ──────────────────────────────────────────────────────

export function SoftConstraintPanel() {
  return <SoftConstraintWarningsPanel />;
}

export function SoftConstraintWarningsPanel({ asSection = false }: { asSection?: boolean } = {}) {
  const { data, isLoading } = useSchedule();
  const [query, setQuery] = useState("");
  const preferenceWarnings = data?.preference_warnings ?? [];
  const catalogue = data?.timeslots_catalogue ?? [];
  const [open, setOpen] = useState(false);

  if (isLoading) return null;

  const totalWarnings = preferenceWarnings.length;
  if (totalWarnings === 0) return null;

  const slotLabel = (id: string) => timeslotHeaderLabel(id, catalogue, []);

  const q = query.trim().toLowerCase();
  const filteredPreferenceWarnings = preferenceWarnings
    .filter((w) => !q || w.lecturer.toLowerCase().includes(q) || w.course.toLowerCase().includes(q))
    .sort((a, b) => b.lecturer.localeCompare(a.lecturer));
  const hasFilteredResults = filteredPreferenceWarnings.length > 0;

  return (
    <div className={asSection ? "space-y-3" : ""}>
      <div className="overflow-hidden rounded-lg border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 shadow-sm">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between border-b border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-left transition-colors hover:bg-amber-100 dark:bg-amber-900/40"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-900 dark:text-amber-100">Soft constraint violations</span>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
              {totalWarnings} issue{totalWarnings > 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-sm tabular-nums text-amber-800" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </button>
        {open && (
          <div>
            <div className="border-b border-amber-200 dark:border-amber-700/60/50 dark:border-amber-700/50 px-4 py-2.5">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by lecturer or course…"
                className="w-full rounded-md border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-sm outline-none placeholder:text-amber-700 focus:border-amber-400 focus:bg-card"
              />
            </div>
            <div className="px-4 py-4">
              <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
                {filteredPreferenceWarnings.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
                      Lecturer preference violations ({filteredPreferenceWarnings.length})
                    </p>
                    <div className="space-y-1.5">
                      {filteredPreferenceWarnings.map((w, idx) => {
                        const color = getLecturerColor(w.lecturer);
                        return (
                          <div key={idx} className="rounded-md border border-amber-200 dark:border-amber-700/60 bg-card px-3 py-2 text-sm">
                            <span className={`font-semibold ${color.text}`}>{w.lecturer}</span> ·{" "}
                            <span className="font-mono text-foreground/90">{w.course}</span> ·{" "}
                            <span className="text-foreground/90">{slotLabel(w.timeslot)}</span>
                            <div className="mt-0.5 text-xs text-muted-foreground">{w.reason}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!hasFilteredResults && (
                  <p className="py-4 text-center text-sm text-amber-600/70">No violations match this filter.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SoftConstraintMetricsPanel ───────────────────────────────────────────────

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

export function SoftConstraintMetricsPanel({
  embedded = false,
}: {
  /** When true, section is always expanded with a simpler heading (e.g. inside Constraints tab). */
  embedded?: boolean;
} = {}) {
  const { data, isLoading } = useSchedule();
  const [open, setOpen] = useState(embedded);
  if (isLoading || !data) return null;

  const meta = data.metadata;
  const softWeights = data.soft_weights ?? meta.soft_weights;
  const gapWarnings = data.gap_warnings ?? [];
  const utilizationInfo = data.utilization_info ?? [];
  const workloadInfo = data.workload_info ?? [];
  const distributionInfo = data.distribution_info ?? [];
  const scheduleEntries = data.schedule ?? [];

  if (!softWeights) return null;

  // Calculate total wasted seat capacity across ALL room-timeslot combinations
  // (occupied slots: capacity - class_size; empty slots: full capacity)
  const totalWastedSeats = utilizationInfo.reduce(
    (sum, u) => sum + (u.wasted_seats ?? (u.capacity - u.class_size)),
    0,
  );
  const totalSeatSlots = utilizationInfo.reduce((sum, u) => sum + u.capacity, 0);
  const avgWaste =
    totalSeatSlots > 0 ? (totalWastedSeats / totalSeatSlots) * 100 : 0;
  /** Share of all room×timeslot seat capacity that is actually filled (higher is better). */
  const timetableSeatUtilizationPct =
    totalSeatSlots > 0 ? 100 - avgWaste : 0;

  // Calculate workload std dev
  const workloads = workloadInfo.map((w) => w.classes);
  const avgWorkload =
    workloads.length > 0
      ? workloads.reduce((a, b) => a + b, 0) / workloads.length
      : 0;
  const workloadStdDev =
    workloads.length > 0
      ? Math.sqrt(
          workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) /
            workloads.length,
        )
      : 0;

  // Calculate distribution std dev
  const distributions = distributionInfo.map((d) => d.classes);
  const avgDist =
    distributions.length > 0
      ? distributions.reduce((a, b) => a + b, 0) / distributions.length
      : 0;
  const distStdDev =
    distributions.length > 0
      ? Math.sqrt(
          distributions.reduce((sum, d) => sum + Math.pow(d - avgDist, 2), 0) /
            distributions.length,
        )
      : 0;

  const studentGapWarnings: StudentGapWarning[] = data.student_gap_warnings ?? [];
  const prefWarnings = data.preference_warnings ?? [];
  const unprefCount = prefWarnings.filter((w) => w.severity === "unpreferred").length;
  const notPrefCount = prefWarnings.filter((w) => w.severity === "not_preferred").length;

  const earlyDayWarnings: SingleSessionDayWarning[] =
    data.single_session_day_warnings ?? [];

  const totalAssignments = scheduleEntries.length;
  const scoreFromRatio = (badCount: number, total: number): number => {
    if (total <= 0) return 100;
    return clamp(100 - (badCount / total) * 100);
  };

  const preferencePreferredScore = scoreFromRatio(notPrefCount, totalAssignments);
  const preferenceUnpreferredScore = scoreFromRatio(unprefCount, totalAssignments);

  const totalUnits =
    (data.study_plan_summary?.length ?? 0) ||
    (data.study_plan_units ? Object.keys(data.study_plan_units).length : 0) ||
    0;
  const affectedStudentGapUnits = new Set(studentGapWarnings.map((w) => w.unit)).size;
  const affectedSingleSessionUnits = new Set(earlyDayWarnings.map((w) => w.unit)).size;
  const studentGapsScore = scoreFromRatio(affectedStudentGapUnits, totalUnits);
  const singleSessionScore = scoreFromRatio(affectedSingleSessionUnits, totalUnits);

  const roomUtilScore = clamp(timetableSeatUtilizationPct);
  const roomUtilShell: "green" | "amber" | "red" =
    roomUtilScore >= 80 ? "green" : roomUtilScore >= 60 ? "amber" : "red";

  const workloadBalanceScore = clamp(100 - workloadStdDev * 50);
  const distributeClassesScore = clamp(100 - distStdDev * 50);

  // Minimize gaps: score based on total gap-hours relative to total scheduled hours.
  const totalGapHours = gapWarnings.reduce((sum, w) => sum + Number(w.gap_hours ?? w.gap ?? 0), 0);
  const totalScheduledHours = scheduleEntries.reduce((sum, e) => sum + Number(e.duration ?? 0), 0);
  const gapDenom = totalScheduledHours + totalGapHours;
  const gapRatioScore =
    gapDenom > 0 ? clamp(100 - (totalGapHours / gapDenom) * 100) : 100;

  const statusFromScore = (score: number): "good" | "warn" | "bad" =>
    score >= 80 ? "good" : score >= 60 ? "warn" : "bad";

  const metrics: {
    key: string;
    label: string;
    /** Pastel shell + border hue (single border, no contrasting accent stripe) */
    shell: "green" | "amber" | "red";
    weight: number;
    value: string;
    score: number;
  }[] = [
    {
      key: "preferred_timeslot",
      label: "Preferred timeslot",
      shell: "green",
      weight: softWeights.preferred_timeslot,
      value: `${notPrefCount} not-in-preferred`,
      score: preferencePreferredScore,
    },
    {
      key: "unpreferred_timeslot",
      label: "Unpreferred timeslot",
      shell: "green",
      weight: softWeights.unpreferred_timeslot,
      value: `${unprefCount} in avoided slot`,
      score: preferenceUnpreferredScore,
    },
    {
      key: "minimize_gaps",
      label: "Minimize gaps",
      shell: "amber",
      weight: softWeights.minimize_gaps,
      value: `${gapWarnings.length} gaps`,
      score: gapRatioScore,
    },
    {
      key: "room_utilization",
      label: "Room seat fill",
      shell: roomUtilShell,
      weight: softWeights.room_utilization,
      value: `${timetableSeatUtilizationPct.toFixed(1)}% of catalog seat capacity used`,
      score: roomUtilScore,
    },
    {
      key: "balanced_workload",
      label: "Balanced workload",
      shell: "red",
      weight: softWeights.balanced_workload,
      value: `σ = ${workloadStdDev.toFixed(2)}`,
      score: workloadBalanceScore,
    },
    {
      key: "distribute_classes",
      label: "Distribute classes",
      shell: "amber",
      weight: softWeights.distribute_classes,
      value: `σ = ${distStdDev.toFixed(2)}`,
      score: distributeClassesScore,
    },
    {
      key: "student_gaps",
      label: "Student gaps",
      shell: "green",
      weight: softWeights.student_gaps ?? 70,
      value: `${studentGapWarnings.length} gap(s)`,
      score: studentGapsScore,
    },
    {
      key: "single_session_day",
      label: "Single-session day",
      shell: "green",
      weight: softWeights.single_session_day ?? 50,
      value: `${earlyDayWarnings.length} issue(s)`,
      score: singleSessionScore,
    },
  ];

  const metricsInner = (
        <div className="p-4 pt-0 sm:pt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map(({ key, label, shell, weight, value, score }) => {
              const status = statusFromScore(score);
              const shellStyles = {
                green:
                  "border-emerald-200/80 dark:border-emerald-700/60 bg-gradient-to-br from-emerald-50/90 to-card dark:from-emerald-950/35",
                amber:
                  "border-amber-200/80 dark:border-amber-700/60 bg-gradient-to-br from-amber-50/90 to-card dark:from-amber-950/35",
                red:
                  "border-rose-200/80 dark:border-rose-700/60 bg-gradient-to-br from-rose-50/90 to-card dark:from-rose-950/35",
              };
              const statusTextColors = {
                good: "text-emerald-800 dark:text-emerald-200",
                warn: "text-amber-800 dark:text-amber-200",
                bad: "text-rose-800 dark:text-rose-200",
              };
              const barGradient = {
                good: "from-emerald-500 via-teal-500 to-emerald-600",
                warn: "from-amber-400 via-orange-400 to-amber-600",
                bad: "from-rose-500 via-red-500 to-rose-700",
              };
              const statusLabel =
                status === "good" ? "On target" : status === "warn" ? "Watch" : "Attention";
              const fillPct = clamp(score);
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-4 shadow-sm ${shellStyles[shell]}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug text-foreground">
                      {label}
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTextColors[status]} bg-card/70 ring-1 ring-border/60`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div
                    className={`text-sm font-medium leading-snug ${statusTextColors[status]}`}
                  >
                    {value}
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      <span>Performance</span>
                      <span className="tabular-nums text-muted-foreground">{fillPct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted/90 ring-1 ring-inset ring-border/40">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barGradient[status]} shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-[width] duration-500 ease-out`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
  );

  if (embedded) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/90 bg-card shadow-sm">
        <div className="border-b border-border/60 bg-gradient-to-r from-muted/60 to-card px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Soft constraint metrics
          </h3>
          <p className="text-xs text-muted-foreground">
            Performance overview for soft constraints in the latest generated timetable.
          </p>
        </div>
        {metricsInner}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-border bg-muted/40 px-4 py-3 transition-colors hover:bg-muted"
      >
        <span className="font-semibold text-foreground">Soft constraint metrics</span>
        <span className="text-sm tabular-nums text-muted-foreground" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? metricsInner : null}
    </div>
  );
}

// ─── TeachingLoadPanel ────────────────────────────────────────────────────────

export function TeachingLoadPanel() {
  const { data, isLoading } = useSchedule();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const lecturerSummary = data?.lecturer_summary ?? [];
  const workloadInfo = data?.workload_info ?? [];
  if (isLoading || (lecturerSummary.length === 0 && workloadInfo.length === 0)) return null;
  const merged = lecturerSummary.map((l) => {
    const w = workloadInfo.find((x) => x.lecturer === l.name);
    // Prefer DB-backed lecturer_summary values; only fall back when missing.
    const assigned =
      Number(l.teaching_load ?? w?.credit_hour_load ?? w?.classes ?? 0) || 0;
    const maxLoad = Number(l.max_load ?? w?.max_workload ?? 0) || 0;
    return { ...l, assigned, maxLoad, overloaded: assigned > maxLoad };
  });
  const q = query.trim().toLowerCase();
  const rows = merged
    .filter((l) => !q || l.name.toLowerCase().includes(q) || l.courses.some((c) => c.toLowerCase().includes(q)))
    .sort((a, b) => {
      if (b.assigned !== a.assigned) return b.assigned - a.assigned;
      return String(a.name).localeCompare(String(b.name));
    });
  const overloadedCount = merged.filter((l) => l.overloaded).length;
  return (
    <div className="space-y-3">
      {/* Teaching load table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between border-b border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground">Teaching load</span>
            <div className="flex items-center gap-2">
              {overloadedCount > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{overloadedCount} overloaded</span>
              )}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground/80">{merged.length} lecturers</span>
            </div>
          </div>
          <span className="text-sm text-muted-foreground" aria-hidden>{open ? "▾" : "▸"}</span>
        </button>
        {open && (
          <div>
        <div className="border-b border-border/60 px-4 py-2.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by lecturer or course…"
            className="w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground/80 focus:border-ring focus:bg-card"
          />
        </div>
        {/* Sticky header + scrollable body */}
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 shadow-[0_1px_0_0_#e2e8f0]">
              <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Lecturer</th>
                <th className="px-4 py-2.5 text-left">Workload</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Courses</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const pct = Math.min(100, ((l.assigned || 0) / Math.max(l.maxLoad || 1, 1)) * 100);
                const utilColor = l.overloaded
                  ? "bg-rose-500"
                  : pct >= 85
                    ? "bg-amber-400"
                    : pct >= 35
                      ? "bg-emerald-500"
                      : "bg-muted/80";
                return (
                  <tr key={l.name} className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/70">
                    <td className="px-4 py-2.5 font-medium text-foreground/90">{l.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 ${utilColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          <span className="font-semibold text-foreground/90">{l.assigned}h</span>
                          <span className="text-muted-foreground/80"> / </span>
                          <span className="text-muted-foreground">{l.maxLoad}h</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${l.overloaded ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {l.overloaded ? "Overloaded" : "On track"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {l.courses.length > 0
                          ? l.courses.map((c, idx) => (
                              <span key={`${l.name}-${c}-${idx}`} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{c}</span>
                            ))
                          : <span className="text-xs text-muted-foreground/80">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground/80">No lecturers match this filter.</p>
          )}
        </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RoomUtilizationPanel ─────────────────────────────────────────────────────

export function RoomUtilizationPanel() {
  const { data, isLoading } = useSchedule();
  const { config, isLoading: configLoading } = useConfig();
  const [query, setQuery] = useState("");
  const [openUtil, setOpenUtil] = useState(false);
  const [distQuery, setDistQuery] = useState("");
  const [openDist, setOpenDist] = useState(false);
  const roomSummary = data?.room_summary ?? [];
  const entries = data?.schedule ?? [];
  const distributionInfo = data?.distribution_info ?? [];
  const catalogue = data?.timeslots_catalogue ?? [];
  if (isLoading || roomSummary.length === 0) return null;

  const normalizeRoomType = (raw?: string): "any" | "regular" | "blended" | "lab" => {
    const v = String(raw ?? "any")
      .trim()
      .toLowerCase()
      .replace(/[\s_]/g, "");
    if (!v || v === "any") return "any";
    if (v.includes("lab")) return "lab";
    if (v.includes("blend")) return "blended";
    return "regular";
  };

  const roomTypeByName = useMemo(() => {
    const out = new Map<string, "any" | "regular" | "blended" | "lab">();
    const rooms = config?.rooms ?? {};
    for (const [name, val] of Object.entries(rooms)) {
      const v = typeof val === "number" ? undefined : (val as any)?.room_type;
      out.set(String(name).trim(), normalizeRoomType(typeof v === "string" ? v : undefined));
    }
    return out;
  }, [config?.rooms]);

  const compatibleFamiliesForRoomType = (
    rt: "any" | "regular" | "blended" | "lab",
  ): Set<SlotFamily> => {
    if (rt === "lab") return new Set<SlotFamily>(["lab"]);
    // Regular rooms: accept regular + blended patterns (user requirement).
    if (rt === "regular") return new Set<SlotFamily>(["regular", "blended"]);
    // Blended-capable rooms: accept blended + regular patterns.
    if (rt === "blended") return new Set<SlotFamily>(["blended", "regular"]);
    return new Set<SlotFamily>(["regular", "blended", "lab"]);
  };

  const familiesByTimeslotId = useMemo(() => {
    const m = new Map<string, SlotFamily>();
    for (const t of catalogue ?? []) {
      m.set(String(t.id), uiSlotKindFromEngineSlotType(t.slot_type));
    }
    return m;
  }, [catalogue]);

  const compatibleTimeslotCount = useCallback(
    (roomType: "any" | "regular" | "blended" | "lab"): number => {
      const allowed = compatibleFamiliesForRoomType(roomType);
      let count = 0;
      for (const fam of familiesByTimeslotId.values()) {
        if (allowed.has(fam)) count++;
      }
      return count;
    },
    [familiesByTimeslotId],
  );

  const { usedSlotsByRoom } = useMemo(() => {
    const used = new Map<string, Set<string>>();
    for (const e of entries) {
      if (!entryRequiresRoom(e)) continue;
      const room = e.room?.trim();
      if (!room || room === "ONLINE") continue;
      const roomType = roomTypeByName.get(room) ?? "any";
      const allowed = compatibleFamiliesForRoomType(roomType);
      const ts = String(e.timeslot ?? "");
      const fam = familiesByTimeslotId.get(ts) ?? "regular";
      if (!allowed.has(fam)) continue;
      used.set(room, (used.get(room) ?? new Set<string>()).add(ts));
    }
    return { usedSlotsByRoom: used };
  }, [entries, familiesByTimeslotId, roomTypeByName]);

  const q = query.trim().toLowerCase();
  const rows = roomSummary
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .map((r) => {
      const roomType = roomTypeByName.get(r.name) ?? "any";
      const totalSlots = configLoading ? r.total_slots : compatibleTimeslotCount(roomType);
      const usedSlots = configLoading ? r.used_slots : (usedSlotsByRoom.get(r.name)?.size ?? 0);
      const slotUtilPct = totalSlots > 0 ? (usedSlots / totalSlots) * 100 : 0;
      return {
        ...r,
        total_slots: totalSlots,
        used_slots: usedSlots,
        slotUtilPct,
      };
    })
    .sort((a, b) => b.slotUtilPct - a.slotUtilPct);
  
  const distQ = distQuery.trim().toLowerCase();
  const distRows = distributionInfo
    .filter((d) => !distQ || timeslotHeaderLabel(d.timeslot, catalogue, []).toLowerCase().includes(distQ))
    .sort((a, b) => b.classes - a.classes);

  const maxClasses = Math.max(...distributionInfo.map((d) => d.classes), 0);
  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-2">
      {/* Room utilization table */}
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm",
          openUtil ? "h-full" : "self-start",
        )}
      >
        <button type="button" onClick={() => setOpenUtil((o) => !o)} className="flex w-full items-center justify-between border-b border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground">Room utilization</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground/80">{roomSummary.length} rooms</span>
          </div>
          <span className="text-sm text-muted-foreground" aria-hidden>{openUtil ? "▾" : "▸"}</span>
        </button>
        {openUtil && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border/60 px-4 py-2.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by room name…"
            className="w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground/80 focus:border-ring focus:bg-card"
          />
        </div>
        <div className="max-h-[32rem] flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/40 shadow-[0_1px_0_0_#e2e8f0]">
              <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Room</th>
                <th className="px-4 py-2.5 text-right">Cap.</th>
                <th className="px-4 py-2.5 text-right">Slots</th>
                <th className="px-4 py-2.5 text-right">Slot Utilization %</th>
              </tr>
            </thead>
            <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/70">
                    <td className="px-4 py-2.5 font-mono font-medium text-foreground/90">{r.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.capacity}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.used_slots}/{r.total_slots}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground/80">{r.slotUtilPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground/80">No rooms match this filter.</p>
            )}
          </div>
          </div>
        )}
      </div>

      {/* Class distribution bar chart */}
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm",
          openDist ? "h-full" : "self-start",
        )}
      >
        <button type="button" onClick={() => setOpenDist((o) => !o)} className="flex w-full items-center justify-between border-b border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted">
          <span className="font-semibold text-foreground">Class distribution across timeslots</span>
          <span className="text-sm text-muted-foreground" aria-hidden>{openDist ? "▾" : "▸"}</span>
        </button>
        {openDist && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border/60 px-4 py-2.5">
              <input
                type="search"
                value={distQuery}
                onChange={(e) => setDistQuery(e.target.value)}
                placeholder="Filter by timeslot…"
                className="w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground/80 focus:border-ring focus:bg-card"
              />
            </div>
            <div className="max-h-[32rem] flex-1 overflow-auto px-4 py-4">
              <div className="space-y-2 text-sm">
                {distRows.map((d) => {
                const pct = maxClasses > 0 ? (d.classes / maxClasses) * 100 : 0;
                return (
                  <div key={d.timeslot} className="grid grid-cols-[1fr_2.75rem_8rem] items-center gap-3">
                    <span className="truncate text-muted-foreground">{timeslotHeaderLabel(d.timeslot, catalogue, [])}</span>
                    <span className="text-right tabular-nums font-semibold text-foreground/80">{d.classes}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-indigo-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
                {distRows.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground/80">No timeslots match this filter.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function QualityAnalyticsTabPanel() {
  const { data, isLoading } = useSchedule();
  if (isLoading) return null;
  if (!data || (data.schedule?.length ?? 0) === 0) {
    return <div className="rounded-lg border border-border bg-card px-6 py-12 text-center shadow-sm"><div className="mx-auto mb-4 h-16 w-16 rounded-full border border-border bg-muted/40" /><h3 className="text-base font-semibold text-foreground">Run the optimizer to see analytics</h3><p className="mt-1 text-sm text-muted-foreground">Generate a timetable first to populate quality and resource metrics.</p></div>;
  }
  const meta = data.metadata;
  const totalWarnings = (data.preference_warnings?.length ?? 0) + (data.student_gap_warnings?.length ?? 0) + (data.single_session_day_warnings?.length ?? 0);
  const overloadedLecturers = (data.lecturer_summary ?? []).filter((l) => l.teaching_load > l.max_load).length;
  const util = data.utilization_info ?? [];
  const totalSeats = util.reduce((s, u) => s + (u.capacity ?? 0), 0);
  const wastedSeats = util.reduce((s, u) => s + (u.wasted_seats ?? (u.capacity ?? 0) - (u.class_size ?? 0)), 0);
  const seatFillPct = totalSeats > 0 ? Math.max(0, 100 - (wastedSeats / totalSeats) * 100) : 0;
  const softWeights = data.soft_weights ?? meta?.soft_weights;
  const prefWarnings = data.preference_warnings ?? [];
  const notPrefCount = prefWarnings.filter((w) => w.severity === "not_preferred").length;
  const unprefCount = prefWarnings.filter((w) => w.severity === "unpreferred").length;
  const gapWarnings = data.gap_warnings ?? [];
  const workloads = (data.workload_info ?? []).map((w) => w.classes);
  const avgWorkload = workloads.length > 0 ? workloads.reduce((a, b) => a + b, 0) / workloads.length : 0;
  const workloadStd = workloads.length > 0 ? Math.sqrt(workloads.reduce((sum, v) => sum + Math.pow(v - avgWorkload, 2), 0) / workloads.length) : 0;
  const dists = (data.distribution_info ?? []).map((d) => d.classes);
  const avgDist = dists.length > 0 ? dists.reduce((a, b) => a + b, 0) / dists.length : 0;
  const distStd = dists.length > 0 ? Math.sqrt(dists.reduce((sum, v) => sum + Math.pow(v - avgDist, 2), 0) / dists.length) : 0;
  const studentGapCount = data.student_gap_warnings?.length ?? 0;
  const singleSessionCount = data.single_session_day_warnings?.length ?? 0;
  const metricScores = [
    { weight: softWeights?.preferred_timeslot ?? 0, score: notPrefCount === 0 ? 1 : 0.5 },
    { weight: softWeights?.unpreferred_timeslot ?? 0, score: unprefCount === 0 ? 1 : 0.5 },
    { weight: softWeights?.minimize_gaps ?? 0, score: gapWarnings.length === 0 ? 1 : 0.5 },
    { weight: softWeights?.room_utilization ?? 0, score: seatFillPct >= 80 ? 1 : seatFillPct >= 60 ? 0.5 : 0 },
    { weight: softWeights?.balanced_workload ?? 0, score: workloadStd < 0.5 ? 1 : workloadStd < 1 ? 0.5 : 0 },
    { weight: softWeights?.distribute_classes ?? 0, score: distStd < 0.5 ? 1 : distStd < 1 ? 0.5 : 0 },
    { weight: softWeights?.student_gaps ?? 70, score: studentGapCount === 0 ? 1 : 0.5 },
    { weight: softWeights?.single_session_day ?? 50, score: singleSessionCount === 0 ? 1 : 0.5 },
  ];
  const qualityWeightTotal = metricScores.reduce((sum, m) => sum + m.weight, 0);
  const qualityScore = qualityWeightTotal > 0 ? (metricScores.reduce((sum, m) => sum + m.weight * m.score, 0) / qualityWeightTotal) * 100 : 0;

  // KPI status helpers
  const warnStatus = totalWarnings === 0 ? "green" : totalWarnings <= 5 ? "amber" : "red";
  const overloadStatus = overloadedLecturers === 0 ? "green" : "red";
  const fillStatus = seatFillPct >= 80 ? "green" : seatFillPct >= 60 ? "amber" : "red";
  const qualityStatus = qualityScore >= 80 ? "green" : qualityScore >= 60 ? "amber" : "red";

  const kpiValueColor = {
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-rose-700",
  } as const;
  const kpiBadgeStyle = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 dark:bg-amber-900/40 text-amber-700",
    red: "bg-rose-100 text-rose-700",
  } as const;
  const kpiBorderStyle = {
    green: "border-emerald-200/70",
    amber: "border-amber-200 dark:border-amber-700/60/70 dark:border-amber-700/60",
    red: "border-rose-200/70",
  } as const;

  return (
    <div className="space-y-6">
      {/* ── Section 1: Soft Constraint Scorecard ────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Soft Constraint Scorecard
        </p>
        <SoftConstraintMetricsPanel embedded />
      </div>

      {/* Section divider */}
      <div className="border-t border-border" />

      {/* ── Section 2: Resource Analytics ───────────────────────────── */}
      <div className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Resource Analytics
        </p>
        <TeachingLoadPanel />
        <RoomUtilizationPanel />
      </div>

      {/* Section divider */}
      <div className="border-t border-border" />

      {/* ── Section 3 & 4: Detailed Feedback ────────────────────────── */}
      <ConflictAlert asSection />
      <SoftConstraintWarningsPanel asSection />
    </div>
  );
}

// ─── Study plan (cohort curriculum from schedule payload) ─────────────────────

function buildStudyPlanMajorTree(units: Record<string, string[]>) {
  const grouped = new Map<string, Map<string, Map<string, string>>>();
  for (const unitId of Object.keys(units)) {
    const parts = unitId.split("|").map((p) => p.trim());
    const major = parts[0] || "Unknown major";
    const year = parts[1] || "Unknown year";
    const semester = parts[2] || "Unknown semester";
    if (!grouped.has(major)) grouped.set(major, new Map());
    const years = grouped.get(major)!;
    if (!years.has(year)) years.set(year, new Map());
    years.get(year)!.set(semester, unitId);
  }
  const majors = [...grouped.keys()].sort();
  return { grouped, majors };
}

function parseStudyPlanUnitId(unitId: string): { major: string; year: string; semester: string } {
  const parts = String(unitId || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    major: parts[0] ?? "Unknown major",
    year: parts[1] ?? "Unknown year",
    semester: parts[2] ?? "Unknown semester",
  };
}

function studyPlanPseudoCourseLabel(code: string): string | null {
  const normalized = String(code ?? "").trim();
  if (normalized === "0") return "Elective University Requirements";
  if (normalized === "1") return "Elective Program Requirements";
  return null;
}

/** Full-width cohort health view for Timetable Generation (majors, years, semester cards, badges). */
export function StudyPlanTabPanel() {
  const { data, isLoading } = useSchedule();
  const [selectedMajor, setSelectedMajor] = useState<string | null>(null);
  const [majorPickerOpen, setMajorPickerOpen] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [detailDialog, setDetailDialog] = useState<{
    kind: "conflicts" | "gaps" | "singleDays";
    unitId: string;
    title: string;
  } | null>(null);

  const units: Record<string, string[]> = data?.study_plan_units ?? {};
  const summary: StudyPlanUnitSummary[] = data?.study_plan_summary ?? [];
  const entries = data?.schedule ?? [];
  const catalogue = data?.timeslots_catalogue ?? [];
  const unitConflicts: UnitConflictViolation[] = data?.unit_conflict_violations ?? [];
  const studentGapWarnings: StudentGapWarning[] = data?.student_gap_warnings ?? [];
  const singleSessionWarnings: SingleSessionDayWarning[] = data?.single_session_day_warnings ?? [];

  const summaryById = useMemo(
    () => new Map(summary.map((s) => [s.unit_id, s])),
    [summary],
  );
  const entryNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of entries) {
      if (!map.has(row.course_code)) map.set(row.course_code, row.course_name);
    }
    return map;
  }, [entries]);

  const { grouped, majors } = useMemo(
    () => buildStudyPlanMajorTree(units),
    [units],
  );

  const unitConflictsByUnit = useMemo(() => {
    const map = new Map<string, UnitConflictViolation[]>();
    for (const v of unitConflicts) {
      const key = String(v.unit ?? "").trim();
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(v);
      else map.set(key, [v]);
    }
    return map;
  }, [unitConflicts]);

  const slotLabel = useCallback(
    (id: string) => timeslotHeaderLabel(id, catalogue, entries, "compact"),
    [catalogue, entries],
  );

  const activeMajor = useMemo(() => {
    if (selectedMajor && majors.includes(selectedMajor)) return selectedMajor;
    return majors[0] ?? null;
  }, [selectedMajor, majors]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-[200px] items-center justify-center py-12 text-sm text-muted-foreground">
          Loading schedule and study-plan data…
        </CardContent>
      </Card>
    );
  }

  if (majors.length === 0 || Object.keys(units).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No study plan data yet</CardTitle>
          <CardDescription>
            Run the optimizer with <code className="rounded bg-muted px-1 py-0.5 text-xs">programs.json</code> present
            so cohorts (program · year · semester) are included in the saved timetable. Then open this tab again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const years = [...(grouped.get(activeMajor!)?.keys() ?? [])].sort();
  const activeMajorUnitIds = activeMajor
    ? [...(grouped.get(activeMajor)?.values() ?? [])].flatMap((semesterMap) => [...semesterMap.values()])
    : [];
  const activeMajorStats = activeMajorUnitIds.reduce(
    (acc, unitId) => {
      const item = summaryById.get(unitId);
      if (!item) return acc;
      acc.conflicts += item.conflict_count ?? 0;
      acc.gaps += item.gap_count ?? 0;
      acc.singleDays += item.single_session_day_count ?? 0;
      return acc;
    },
    { conflicts: 0, gaps: 0, singleDays: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border/60 bg-muted/50">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Student cohort health</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review pathway health by year and semester to spot overlaps, idle gaps, and single-class days.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch">
          <div className="p-5 lg:w-[550px] shrink-0 border-b lg:border-b-0 lg:border-r border-border/60 flex items-center">
            <Popover open={majorPickerOpen} onOpenChange={setMajorPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={majorPickerOpen}
                  className="h-10 w-full justify-between bg-card font-medium shadow-sm"
                >
                  <span className="truncate">{activeMajor ?? "Select major"}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search major..." />
                  <CommandList>
                    <CommandEmpty>No major found.</CommandEmpty>
                    {majors.map((major) => (
                      <CommandItem
                        key={major}
                        value={major}
                        onSelect={() => {
                          setSelectedMajor(major);
                          setMajorPickerOpen(false);
                        }}
                      >
                        <Check className={cn("h-4 w-4", activeMajor === major ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{major}</span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {activeMajor && (
            <div className="flex-1 p-5 flex items-center overflow-x-auto bg-muted/40/10">
              <div className="flex items-center gap-10 sm:gap-14">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Conflicts</span>
                  <span className={`text-2xl font-bold ${activeMajorStats.conflicts > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {activeMajorStats.conflicts}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Long Gaps</span>
                  <span className={`text-2xl font-bold ${activeMajorStats.gaps > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {activeMajorStats.gaps}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Single Days</span>
                  <span className={`text-2xl font-bold ${activeMajorStats.singleDays > 0 ? "text-sky-600" : "text-emerald-600"}`}>
                    {activeMajorStats.singleDays}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeMajor && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {years.map((year) => {
            const semesters = [...(grouped.get(activeMajor)?.get(year)?.keys() ?? [])].sort();
            return (
              <section key={`${activeMajor}-${year}`} className="space-y-4">
                <div className="flex items-center gap-3 border-b border-border pb-2">
                  <h3 className="text-lg font-bold tracking-tight text-foreground">{year}</h3>
                  <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted font-medium border-transparent">
                    {semesters.length} Semester{semesters.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="flex flex-col gap-4">
                  {semesters.map((semester) => {
                    const unitId = grouped.get(activeMajor)?.get(year)?.get(semester) ?? "";
                    const unitCourses = unitId ? (units[unitId] ?? []) : [];
                    const unitSummary = unitId ? summaryById.get(unitId) : undefined;
                    const conflicts = unitSummary?.conflict_count ?? 0;
                    const gaps = unitSummary?.gap_count ?? 0;
                    const singleDay = unitSummary?.single_session_day_count ?? 0;
                    const allClear = conflicts === 0 && gaps === 0 && singleDay === 0;
                    const unitConflictDetails = unitId ? (unitConflictsByUnit.get(unitId) ?? []) : [];
                    const unitGapDetails = unitId
                      ? studentGapWarnings.filter((g) => g.unit === unitId)
                      : [];
                    const unitSingleDayDetails = unitId
                      ? singleSessionWarnings.filter((w) => w.unit === unitId)
                      : [];
                    const cohort = unitId ? parseStudyPlanUnitId(unitId) : null;
                    const isExpanded = expandedUnits[unitId] || false;
                    const toggleExpanded = () => setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));

                    return (
                      <Card
                        key={unitId || `${year}-${semester}`}
                        className="flex flex-col overflow-hidden border-border/70 shadow-sm transition-all hover:shadow-md bg-card"
                      >
                        <div 
                          className="flex flex-col gap-3 bg-muted/50 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={toggleExpanded}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm tabular-nums text-muted-foreground/80" aria-hidden>
                                {isExpanded ? "▾" : "▸"}
                              </span>
                              <h4 className="font-semibold text-foreground">{semester}</h4>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {unitCourses.length} course{unitCourses.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 ml-5">
                            {conflicts > 0 && (
                              <Badge asChild className="border-0 bg-red-100 text-red-800 hover:bg-red-200 cursor-pointer transition-colors shadow-none">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailDialog({
                                      kind: "conflicts",
                                      unitId,
                                      title: `${year} · ${semester}`,
                                    });
                                  }}
                                >
                                  {conflicts} conflict{conflicts === 1 ? "" : "s"}
                                </button>
                              </Badge>
                            )}
                            {gaps > 0 && (
                              <Badge asChild className="border-0 bg-amber-100 dark:bg-amber-900/40 text-amber-800 hover:bg-amber-200 cursor-pointer transition-colors shadow-none">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailDialog({
                                      kind: "gaps",
                                      unitId,
                                      title: `${year} · ${semester}`,
                                    });
                                  }}
                                >
                                  {gaps} gap{gaps === 1 ? "" : "s"}
                                </button>
                              </Badge>
                            )}
                            {singleDay > 0 && (
                              <Badge asChild className="border-0 bg-sky-100 text-sky-800 hover:bg-sky-200 cursor-pointer transition-colors shadow-none">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailDialog({
                                      kind: "singleDays",
                                      unitId,
                                      title: `${year} · ${semester}`,
                                    });
                                  }}
                                >
                                  {singleDay} single day{singleDay === 1 ? "" : "s"}
                                </button>
                              </Badge>
                            )}
                            {allClear && (
                              <Badge className="border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 shadow-none">
                                All clear
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="flex-1 p-4 bg-card border-t border-border/60">
                            {unitCourses.length === 0 ? (
                              <div className="flex h-full min-h-[100px] items-center justify-center rounded-md border border-dashed border-border bg-muted/40 py-6 text-xs text-muted-foreground/80">
                                No courses listed
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {unitCourses.map((code, idx) => {
                                  const name = entryNameByCode.get(code);
                                  const pseudoLabel = studyPlanPseudoCourseLabel(code);
                                  return (
                                    <div
                                      key={`${unitId || `${year}-${semester}`}-${code}-${idx}`}
                                      className="group flex flex-col justify-center rounded-lg border border-border/60 bg-muted/50 p-2.5 transition-colors hover:border-border hover:bg-card"
                                    >
                                      {pseudoLabel ? (
                                        <p className="text-[13px] font-medium text-foreground/80">{pseudoLabel}</p>
                                      ) : (
                                        <>
                                          <p className="font-mono text-[11px] font-bold text-muted-foreground">{code}</p>
                                          <p className="mt-0.5 text-xs font-medium text-foreground/90 leading-snug line-clamp-2">
                                            {name ?? "Course name unavailable"}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        <Dialog
                          open={
                            !!detailDialog &&
                            detailDialog.unitId === unitId
                          }
                          onOpenChange={(open) => {
                            if (!open) setDetailDialog(null);
                          }}
                        >
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>
                                {detailDialog?.kind === "conflicts" && "Unit conflicts"}
                                {detailDialog?.kind === "gaps" && "Student gaps"}
                                {detailDialog?.kind === "singleDays" && "Single-class days"}
                              </DialogTitle>
                              <DialogDescription className="truncate whitespace-nowrap">
                                {cohort ? `${cohort.major} · ${cohort.year} · ${cohort.semester}` : detailDialog?.title}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="max-h-[55vh] space-y-2 overflow-auto pr-1">
                              {detailDialog?.kind === "conflicts" &&
                                unitConflictDetails.map((uc, idx) => (
                                  <div
                                    key={`${unitId}-dialog-uc-${idx}-${uc.course_a}-${uc.course_b}`}
                                    className="rounded border border-red-200 bg-red-50/60 px-3 py-3 text-sm dark:border-red-700/60 dark:bg-red-950/35"
                                  >
                                    <div className="flex items-start gap-5">
                                      <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="font-mono text-xs font-semibold text-red-900 dark:text-red-100">{uc.course_a}</div>
                                        <div className="text-sm font-medium text-foreground/90">
                                          {entryNameByCode.get(uc.course_a) ?? "Course name unavailable"}
                                        </div>
                                        <div className="text-xs font-medium text-muted-foreground">{slotLabel(uc.timeslot_a)}</div>
                                      </div>
                                      <div className="w-40 shrink-0 self-center text-center text-[11px] font-semibold uppercase tracking-wider text-red-700">
                                        conflicts with
                                      </div>
                                      <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="font-mono text-xs font-semibold text-red-900 dark:text-red-100">{uc.course_b}</div>
                                        <div className="text-sm font-medium text-foreground/90">
                                          {entryNameByCode.get(uc.course_b) ?? "Course name unavailable"}
                                        </div>
                                        <div className="text-xs font-medium text-muted-foreground">{slotLabel(uc.timeslot_b)}</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              {detailDialog?.kind === "gaps" &&
                                unitGapDetails.map((g, idx) => (
                                  <div
                                    key={`${unitId}-dialog-gap-${idx}-${g.day}-${g.gap_hours}`}
                                    className="rounded border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm"
                                  >
                                    <span className="font-medium text-foreground">{g.day}</span>
                                    <span className="ml-2 text-foreground/80">
                                      Idle gap: <span className="font-semibold">{g.gap_hours}h</span>
                                    </span>
                                  </div>
                                ))}
                              {detailDialog?.kind === "singleDays" &&
                                unitSingleDayDetails.map((w, idx) => (
                                  <div
                                    key={`${unitId}-dialog-sd-${idx}-${w.course}-${w.day ?? "na"}`}
                                    className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-700/60 dark:bg-sky-950/35"
                                  >
                                    <div className="font-mono font-semibold text-foreground">{w.course}</div>
                                    <div className="mt-0.5 text-xs text-foreground/80">
                                      {entryNameByCode.get(w.course) ?? "Course name unavailable"}
                                    </div>
                                    <div className="mt-1 text-xs text-foreground/80">
                                      Day: {w.day ?? "N/A"}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── LecturerLegend ───────────────────────────────────────────────────────────


export function LecturerLegend() {
  const { data } = useSchedule();
  const entries = data?.schedule ?? [];
  if (entries.length === 0) return null;
  const lecturers = [...new Set(entries.map((e) => e.lecturer))].sort();

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        {lecturers.map((lecturer) => {
          const color = getLecturerColor(lecturer);
          return (
            <div key={lecturer} className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${color.dot}`} />
              <span className="text-sm text-foreground/80">{lecturer}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Maps column codes T1, T2, … (timetable left-to-right) to calendar times and engine ids. */
export function TimeslotCodeLegend() {
  const { data } = useSchedule();
  const { config, isLoading } = useConfig();
  const [open, setOpen] = useState(false);

  const entries = data?.schedule ?? [];
  const rawCatalogue = data?.timeslots_catalogue ?? [];
  const configSlotRows = useMemo(
    () => normalizeTimeslotsInput(config?.timeslots ?? []) as TimeslotCatalogueEntry[],
    [config?.timeslots],
  );
  const catalogue = useMemo(
    () => mergeCatalogueWithConfigTimeslots(rawCatalogue, configSlotRows),
    [rawCatalogue, configSlotRows],
  );
  const catMap = useMemo(() => catalogueById(catalogue), [catalogue]);

  const timeslotIds = useMemo(() => {
    if (entries.length > 0) {
      const ids = [...new Set(entries.map((e) => e.timeslot))];
      return ids.sort((a, b) => compareTimeslotGridOrder(a, b, catMap));
    }
    const rows = configSlotRows.map((t) => normalizeTimeslotCatalogueEntry(t));
    return [...rows]
      .sort((a, b) => {
        if (a.start_hour !== b.start_hour) return a.start_hour - b.start_hour;
        return a.id.localeCompare(b.id);
      })
      .map((t) => t.id);
  }, [entries, catMap, configSlotRows]);

  if (isLoading || !config) return null;
  if (timeslotIds.length === 0) return null;

  const rowForId = (id: string): TimeslotCatalogueEntry => {
    const fromCat = catMap.get(id);
    if (fromCat) return normalizeTimeslotCatalogueEntry(fromCat);
    const fromCfg = configSlotRows.find((r) => r.id === id);
    if (fromCfg) return normalizeTimeslotCatalogueEntry(fromCfg);
    return normalizeTimeslotCatalogueEntry({
      id,
      days: ["Monday"],
      start_hour: 0,
      duration: 1.5,
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        id="timeslot-code-key-toggle"
        aria-expanded={open}
        aria-controls="timeslot-code-key-panel"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left transition-colors hover:bg-muted/70"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Timeslot code key
        </span>
        <span className="text-sm tabular-nums text-muted-foreground" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div
          id="timeslot-code-key-panel"
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Timeslot codes
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Headers use <span className="font-mono">T1</span>, <span className="font-mono">T2</span>, … in
            column order{entries.length === 0 ? " (preview from config)" : ""}. The second line in each
            header is the engine id (e.g. <span className="font-mono">MON_LAB_0800</span>).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2">Engine ID</th>
                </tr>
              </thead>
              <tbody>
                {timeslotIds.map((tsId, idx) => {
                  const ts = rowForId(tsId);
                  const fam = uiSlotKindFromEngineSlotType(ts.slot_type);
                  const rowBg = fam === "lab" ? "bg-amber-50/80 dark:bg-amber-950/35" : "";
                  return (
                    <tr key={tsId} className={`border-b border-border/60 last:border-0 ${rowBg}`}>
                      <td className="py-2 pr-3 font-bold text-foreground tabular-nums">
                        T{idx + 1}
                      </td>
                      <td className="py-2 pr-3 text-foreground/90">{timeslotScheduleLabel(ts)}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{tsId}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Publish generated timetable to DB (Viewer Schedule) ─────────────────────

/**
 * Saves the current optimizer/UI schedule to Prisma as a new timetable version.
 * Renders nothing until `/api/schedule` has rows and config is loaded.
 *
 * @param scheduleOverride When editing the grid, pass the draft so "Store" matches unsaved edits.
 * @param onPersistError Show validation/API errors in the parent grid using the same full-width Alert as edit errors.
 * @param clearPersistError Clear that banner (call on success, dismiss, and before a new attempt).
 */
export function TimetableDatabasePersistBar({
  className,
  scheduleOverride,
  onPersistError,
  clearPersistError,
}: {
  className?: string;
  scheduleOverride?: ScheduleEntry[] | null;
  onPersistError: (payload: { title: string; lines: string[] }) => void;
  clearPersistError: () => void;
}) {
  const { data } = useSchedule();
  const { config } = useConfig();
  const { toast } = useToast();
  const { optimizerScheduleEpoch } = useGwoRun();
  /** Last timetable row stored in this browser session; cleared when a new GWO run finishes so the next store is v1. */
  const continueFromTimetableIdRef = useRef<number | null>(null);
  const prevOptimizerEpochRef = useRef(optimizerScheduleEpoch);
  const [savingDb, setSavingDb] = useState(false);
  /** After a successful DB store, until the schedule rows change (new edit / new run). */
  const [persistSuccess, setPersistSuccess] = useState<{
    scheduleSnapshot: string;
    timetableId: number;
    versionNumber: number;
    timetableName: string;
  } | null>(null);

  const entries = scheduleOverride ?? data?.schedule ?? [];
  const scheduleSnapshot = useMemo(() => JSON.stringify(entries), [entries]);
  const rawCatalogue = data?.timeslots_catalogue ?? [];
  const configSlotRows = useMemo(
    () => normalizeTimeslotsInput(config?.timeslots ?? []) as TimeslotCatalogueEntry[],
    [config?.timeslots],
  );
  const catalogue = useMemo(
    () => mergeCatalogueWithConfigTimeslots(rawCatalogue, configSlotRows),
    [rawCatalogue, configSlotRows],
  );

  useEffect(() => {
    if (!persistSuccess) return;
    if (persistSuccess.scheduleSnapshot !== scheduleSnapshot) {
      setPersistSuccess(null);
    }
  }, [persistSuccess, scheduleSnapshot]);

  useEffect(() => {
    if (optimizerScheduleEpoch !== prevOptimizerEpochRef.current) {
      prevOptimizerEpochRef.current = optimizerScheduleEpoch;
      continueFromTimetableIdRef.current = null;
    }
  }, [optimizerScheduleEpoch]);

  const persistTimetableToDatabase = async () => {
    if (!config) return;
    clearPersistError();
    if (entries.length === 0) {
      const line = "No schedule rows to store. Run the optimizer or load a schedule first.";
      onPersistError({ title: "Nothing to store", lines: [line] });
      toast({ title: "Nothing to store", description: line, variant: "destructive" });
      return;
    }
    const v = validateScheduleHardConstraints(entries, config, catalogue);
    if (!v.ok) {
      onPersistError({
        title: "Fix issues before storing in the database",
        lines: v.errors.slice(0, 14),
      });
      toast({
        title: "Not stored",
        description:
          v.errors.length === 1
            ? v.errors[0]!
            : `${v.errors[0]!} (+${v.errors.length - 1} more — see message above the grid).`,
        variant: "destructive",
      });
      return;
    }
    setSavingDb(true);
    try {
      const r = await fetch("/api/timetables/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          semesterId: null,
          ...(continueFromTimetableIdRef.current != null
            ? { continueFromTimetableId: continueFromTimetableIdRef.current }
            : {}),
          schedule: entries,
          timeslots_catalogue: data?.timeslots_catalogue ?? [],
          validationResult: {
            lecturer_conflicts: (data as any)?.lecturer_conflicts ?? [],
            room_conflicts: (data as any)?.room_conflicts ?? [],
            capacity_violations: (data as any)?.capacity_violations ?? [],
            overload_violations: (data as any)?.overload_violations ?? [],
            invalid_timeslot_types: (data as any)?.invalid_timeslot_types ?? [],
            invalid_room_types: (data as any)?.invalid_room_types ?? [],
            unit_conflict_violations: data?.unit_conflict_violations ?? [],
            preference_warnings: data?.preference_warnings ?? [],
          },
        }),
      });
      const body = (await r.json().catch(() => ({}))) as {
        error?: string;
        timetableId?: number;
        versionNumber?: number;
        timetableName?: string;
      };
      if (!r.ok) {
        throw new Error(body.error || r.statusText);
      }
      const tid = body.timetableId ?? 0;
      const ver = body.versionNumber ?? 0;
      const tname =
        typeof body.timetableName === "string" && body.timetableName.trim()
          ? body.timetableName.trim()
          : `Timetable #${tid}`;
      continueFromTimetableIdRef.current = tid;
      setPersistSuccess({
        scheduleSnapshot,
        timetableId: tid,
        versionNumber: ver,
        timetableName: tname,
      });
      clearPersistError();
      toast({
        title: "Stored in database",
        description: `${tname} · v${ver} (id ${tid}).`,
      });
    } catch (e) {
      const msg = String(e);
      onPersistError({ title: "Database save failed", lines: [msg] });
      toast({
        title: "Database save failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSavingDb(false);
    }
  };

  if (!config || entries.length === 0) return null;

  const isSavedForCurrentSchedule =
    persistSuccess != null && persistSuccess.scheduleSnapshot === scheduleSnapshot;

  return (
    <div className={cn("flex flex-col items-stretch gap-1.5 sm:items-end", className)}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant={isSavedForCurrentSchedule ? "secondary" : "default"}
          size="sm"
          className="font-semibold"
          onClick={() => void persistTimetableToDatabase()}
          disabled={savingDb || isSavedForCurrentSchedule}
        >
          {savingDb ? "Storing…" : isSavedForCurrentSchedule ? "Saved" : "Store in database"}
        </Button>
        {isSavedForCurrentSchedule && persistSuccess ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="max-w-[min(100%,20rem)] cursor-default truncate text-xs text-muted-foreground sm:max-w-xs">
                <span className="font-medium text-foreground/90">{persistSuccess.timetableName}</span>
                <span className="text-muted-foreground"> · v{persistSuccess.versionNumber}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              Timetable id {persistSuccess.timetableId}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

// ─── TimetableGrid ────────────────────────────────────────────────────────────

function roomCapFromConfig(config: ScheduleConfig | undefined, roomName: string): number {
  if (!config?.rooms) return 0;
  const rv = config.rooms[roomName];
  if (rv == null) return 0;
  return typeof rv === "number" ? rv : (rv.capacity ?? 0);
}

export function TimetableGrid() {
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const dragScrollRafRef = useRef<number | null>(null);
  const searchParams = useSearchParams();
  const { data, isLoading, refresh } = useSchedule();
  const { config } = useConfig();
  const { toast } = useToast();
  const simulationTimetableIdParam = searchParams.get("simulationTimetableId");
  const parsedSimulationTimetableId =
    simulationTimetableIdParam != null && simulationTimetableIdParam.trim() !== ""
      ? Number(simulationTimetableIdParam)
      : NaN;
  const isSimulationView =
    Number.isFinite(parsedSimulationTimetableId) && parsedSimulationTimetableId > 0;
  const [editMode, setEditMode] = useState(false);
  /** Add-section dialog may exceed configured section count; cleared when leaving edit mode. */
  const [extraSectionsOverride, setExtraSectionsOverride] = useState(false);
  const [draft, setDraft] = useState<ScheduleEntry[] | null>(null);
  const [pickedEntry, setPickedEntry] = useState<ScheduleEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReadOnly, setDialogReadOnly] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addTargetCell, setAddTargetCell] = useState<{ rowKey: string; timeslotId: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const [resetDraftConfirmOpen, setResetDraftConfirmOpen] = useState(false);
  /** Shown in the same full-width destructive Alert row as grid edit errors (e.g. Store validation). */
  const [persistError, setPersistError] = useState<{ title: string; lines: string[] } | null>(null);
  type GridFeedback = { kind: "idle" } | { kind: "error"; title: string; lines: string[] };
  const [feedback, setFeedback] = useState<GridFeedback>({ kind: "idle" });

  const entries = data?.schedule ?? [];
  const rawCatalogue = data?.timeslots_catalogue ?? [];
  const configSlotRows = useMemo(
    () => normalizeTimeslotsInput(config?.timeslots ?? []) as TimeslotCatalogueEntry[],
    [config?.timeslots],
  );
  const catalogue = useMemo(
    () => mergeCatalogueWithConfigTimeslots(rawCatalogue, configSlotRows),
    [rawCatalogue, configSlotRows],
  );
  const displayEntries = draft ?? entries;
  const draftDiffersFromWorkspaceFile = useMemo(() => {
    if (draft == null) return false;
    return JSON.stringify(draft) !== JSON.stringify(entries);
  }, [draft, entries]);
  const { conflictIds } = buildUiConflicts(displayEntries, catalogue);
  const catMap = useMemo(() => catalogueById(catalogue), [catalogue]);

  /** Full list of hard-rule breaches for the current draft — shown persistently while editing. */
  const editDraftHardViolations = useMemo(() => {
    if (!editMode || draft == null || !config) return [];
    return collectScheduleHardViolations(draft, config, catalogue);
  }, [editMode, draft, config, catalogue]);

  const timeslotIds = useMemo(() => {
    const ids = [...new Set(displayEntries.map((e) => e.timeslot))];
    return ids.sort((a, b) => compareTimeslotGridOrder(a, b, catMap));
  }, [displayEntries, catMap]);

  const physicalRooms = useMemo(() => {
    const fromSummary = data?.room_summary?.map((r) => r.name) ?? [];
    const fromEntries = displayEntries
      .filter((e) => entryRequiresRoom(e))
      .map((e) => e.room)
      .filter((r): r is string => !!r && r !== "ONLINE");
    const set = new Set([...fromSummary, ...fromEntries]);
    return [...set].sort();
  }, [displayEntries, data?.room_summary]);

  const hasOnline = useMemo(
    () => displayEntries.some((e) => !entryRequiresRoom(e)),
    [displayEntries],
  );

  const rows = useMemo(() => {
    const r = physicalRooms.map((name) => ({ key: name, label: name }));
    if (hasOnline) {
      r.push({ key: "__online__", label: "Online" });
    }
    return r;
  }, [physicalRooms, hasOnline]);

  const handleGridDragOver = useCallback(
    (ev: DragEvent<HTMLDivElement>) => {
      if (!editMode) return;
      const container = gridScrollRef.current;
      if (!container) return;
      if (dragScrollRafRef.current != null) return;
      const EDGE_PX = 64;
      const SCROLL_STEP_PX = 28;
      dragScrollRafRef.current = requestAnimationFrame(() => {
        dragScrollRafRef.current = null;
        const rect = container.getBoundingClientRect();
        let dx = 0;
        let dy = 0;
        if (ev.clientX < rect.left + EDGE_PX) dx = -SCROLL_STEP_PX;
        else if (ev.clientX > rect.right - EDGE_PX) dx = SCROLL_STEP_PX;
        if (ev.clientY < rect.top + EDGE_PX) dy = -SCROLL_STEP_PX;
        else if (ev.clientY > rect.bottom - EDGE_PX) dy = SCROLL_STEP_PX;
        if (dx !== 0 || dy !== 0) {
          container.scrollBy({ left: dx, top: dy, behavior: "auto" });
        }
      });
    },
    [editMode],
  );

  useEffect(() => {
    return () => {
      if (dragScrollRafRef.current != null) {
        cancelAnimationFrame(dragScrollRafRef.current);
        dragScrollRafRef.current = null;
      }
    };
  }, []);

  const commitDraftIfValid = (nextDraft: ScheduleEntry[]) => {
    if (!config) {
      const line = "Wait for configuration to finish loading, then try again.";
      setFeedback({ kind: "error", title: "Configuration not ready", lines: [line] });
      toast({
        title: "Configuration not ready",
        description: line,
        variant: "destructive",
      });
      return false;
    }
    if (!draft) {
      const line = "Turn on edit mode before changing the timetable.";
      setFeedback({ kind: "error", title: "No draft", lines: [line] });
      toast({ title: "Change not applied", description: line, variant: "destructive" });
      return false;
    }
    const beforeV = collectScheduleHardViolations(draft, config, catalogue);
    const afterV = collectScheduleHardViolations(nextDraft, config, catalogue);
    const worsened = hardViolationsIntroducedOrWorsened(beforeV, afterV);
    if (worsened.length > 0) {
      setFeedback({
        kind: "error",
        title: "That change is not allowed",
        lines: worsened.map((w) => w.message).slice(0, 14),
      });
      toast({
        title: "Change not applied",
        description:
          worsened.length === 1
            ? worsened[0]!.message
            : `This edit would introduce ${worsened.length} new or worsened problem(s). See details below.`,
        variant: "destructive",
      });
      return false;
    }
    setDraft(nextDraft);
    setFeedback({ kind: "idle" });
    return true;
  };

  function cellEntriesFor(rowKey: string, tsId: string): ScheduleEntry[] {
    return displayEntries.filter((e) => {
      if (e.timeslot !== tsId) return false;
      if (!entryRequiresRoom(e)) return rowKey === "__online__";
      const r = e.room;
      if (r == null || r === "" || r === "ONLINE") return rowKey === "__online__";
      return r === rowKey;
    });
  }

  const toggleEditMode = () => {
    if (editMode) {
      setExtraSectionsOverride(false);
      setDraft(null);
      setEditMode(false);
      setAddDialogOpen(false);
      setAddTargetCell(null);
      setFeedback({ kind: "idle" });
    } else {
      setDraft(entries.map((e) => ({ ...e })));
      setEditMode(true);
      setFeedback({ kind: "idle" });
    }
  };

  const saveScheduleToWorkspace = async () => {
    if (!draft || !data || !config) return;
    const v = validateScheduleHardConstraints(draft, config, catalogue);
    if (!v.ok) {
      toast({
        title: "Saving draft with hard constraint issues",
        description:
          v.errors.length === 1
            ? `${v.errors[0]!} — still saving so you can keep repairing.`
            : `${v.errors.length} issues remain — saving anyway so you can keep repairing.`,
      });
    }
    setSavingFile(true);
    try {
      if (isSimulationView && Number.isFinite(parsedSimulationTimetableId) && parsedSimulationTimetableId > 0) {
        await ApiClient.request(`/timetables/${parsedSimulationTimetableId}/schedule-payload`, {
          method: "PUT",
          body: JSON.stringify({ schedule: draft }),
        });
      } else {
        const payload = { ...data, schedule: draft };
        const r = await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || r.statusText);
        }
      }
      await refresh();
      setDraft(null);
      setEditMode(false);
      setFeedback({ kind: "idle" });
      toast({
        title: "Saved",
        description: isSimulationView
          ? "Simulation timetable updated. Apply this run when you're satisfied."
          : "The server schedule file was updated. You can turn Edit back on to keep adjusting.",
      });
    } catch (e) {
      const msg = String(e);
      setFeedback({
        kind: "error",
        title: "Save failed",
        lines: [msg],
      });
      toast({
        title: "Save failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSavingFile(false);
    }
  };

  const onDropEntry = (lectureId: string | number, rowKey: string, tsId: string) => {
    if (!editMode || !draft || !config) return;
    const idx = draft.findIndex((e) => String(e.lecture_id) === String(lectureId));
    if (idx === -1) return;
    const entry = draft[idx]!;
    const onlineRow = rowKey === "__online__";
    if (entryRequiresRoom(entry) && onlineRow) {
      const line = "This section needs a physical room — drop it on a room row, not Online.";
      setFeedback({ kind: "error", title: "Invalid drop target", lines: [line] });
      toast({ title: "Invalid drop", description: line, variant: "destructive" });
      return;
    }
    if (!entryRequiresRoom(entry) && !onlineRow) {
      const line = "Online sections must stay on the Online row.";
      setFeedback({ kind: "error", title: "Invalid drop target", lines: [line] });
      toast({ title: "Invalid drop", description: line, variant: "destructive" });
      return;
    }
    const roomName = onlineRow ? null : rowKey;
    const cap = roomName ? roomCapFromConfig(config, roomName) : 0;
    const next = mergeEntryWithPlacement(entry, catalogue, roomName, tsId, cap);
    const nextDraft = draft.map((e, i) => (i === idx ? next : e));
    if (commitDraftIfValid(nextDraft)) {
      const where = onlineRow ? "Online row" : `Room ${rowKey}`;
      toast({
        title: "Section moved",
        description: `${entry.course_code} → ${where}`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-muted/40">
        <div className="text-sm text-muted-foreground">Loading schedule…</div>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-muted/40">
        <div className="text-sm text-muted-foreground">
          No schedule data. Run the optimizer and push to the UI.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rooms &amp; Timeslots Grid
          </p>
          {isSimulationView ? (
            <p className="max-w-xl text-right text-xs leading-relaxed text-muted-foreground">
              Simulation draft. You can manually edit this grid and save changes before applying to production.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
              {editMode ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!draftDiffersFromWorkspaceFile}
                        className={cn(
                          "gap-1.5 font-semibold transition-colors",
                          draftDiffersFromWorkspaceFile
                            ? "border-amber-600/80 text-amber-950 dark:text-amber-100 shadow-sm hover:bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/70 dark:text-amber-50 dark:hover:bg-amber-950/35"
                            : "border-dashed border-muted-foreground/30 text-muted-foreground shadow-none hover:bg-transparent",
                        )}
                        onClick={() => {
                          if (draftDiffersFromWorkspaceFile) setResetDraftConfirmOpen(true);
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                        Reset draft
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    className="max-w-[min(22rem,calc(100vw-2rem))] px-3.5 py-2.5 text-left text-xs leading-relaxed shadow-lg"
                  >
                    {draftDiffersFromWorkspaceFile
                      ? "Discard unsaved grid changes and reload from the workspace schedule file on the server"
                      : "Grid already matches the saved workspace schedule — nothing to reset"}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {editMode ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={extraSectionsOverride}
                      className={cn(
                        "gap-1.5 font-semibold transition-all",
                        extraSectionsOverride &&
                          "border-primary/45 bg-primary/10 text-foreground shadow-sm ring-2 ring-primary/25 ring-offset-2 ring-offset-background hover:bg-primary/15 dark:border-primary/50 dark:bg-primary/15 dark:hover:bg-primary/20",
                      )}
                      onClick={() => setExtraSectionsOverride((v) => !v)}
                    >
                      <Layers2 className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden />
                      Extra sections
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" sideOffset={8}>
                    {extraSectionsOverride
                      ? "Override is on: you can add more section rows than the planning configuration defines. Each extra gets a new id; rules follow the template section you pick."
                      : "Turn on to add sections beyond the number defined in the planning configuration (same course can appear more often than configured)."}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <Button
                type="button"
                variant={editMode ? "default" : "outline"}
                size="sm"
                aria-pressed={editMode}
                className={cn(
                  "gap-2 font-semibold transition-all",
                  editMode && "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
                )}
                onClick={toggleEditMode}
                disabled={!entries.length || !config}
              >
                <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                {editMode ? "Editing…" : "Edit timetable"}
              </Button>
              {editMode ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveScheduleToWorkspace()}
                        disabled={savingFile}
                      >
                        {savingFile ? "Saving…" : isSimulationView ? "Save simulation draft" : "Save to workspace file"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="end"
                    sideOffset={8}
                    className="max-w-[min(22rem,calc(100vw-2rem))] px-3.5 py-2.5 text-left text-xs leading-relaxed shadow-lg"
                  >
                    {isSimulationView
                      ? "Writes your edited grid back to this simulation timetable in the database. Then you can apply it to production from the simulation banner."
                      : "Writes your edited timetable to the workspace schedule on the server (POST /api/schedule). That file is what this page loads and what the optimizer uses as the starting timetable for the next run."}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <TimetableDatabasePersistBar
                scheduleOverride={editMode && draft ? draft : undefined}
                onPersistError={setPersistError}
                clearPersistError={() => setPersistError(null)}
              />
          </div>
        </div>
        {editMode ? (
          <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            <p className="whitespace-nowrap px-1 text-xs leading-relaxed text-muted-foreground">
              Drag the ⋮⋮ handle to move a section. Click a course block to edit/remove it. To add, click an empty grid
              cell and enter section details for that room/timeslot.
            </p>
          </div>
        ) : null}
      </div>

      {editMode && draft && config ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm shadow-sm",
            editDraftHardViolations.length > 0
              ? "border-amber-600/45 bg-amber-50/90 dark:border-amber-500/40 dark:bg-amber-950/30"
              : "border-emerald-600/30 bg-emerald-50/70 dark:border-emerald-500/35 dark:bg-emerald-950/25",
          )}
          role="region"
          aria-label="Hard constraint issues in the current draft"
        >
          <p className="font-semibold text-foreground">
            {editDraftHardViolations.length > 0
              ? `Hard constraint issues (${editDraftHardViolations.length})`
              : "Hard constraints — no issues in current draft"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            This list updates as you edit. If an edit is blocked, the red alert below describes only what that edit
            would add or worsen — not everything listed here.
          </p>
          {editDraftHardViolations.length > 0 ? (
            <ul className="mt-3 max-h-52 list-inside list-disc space-y-1 overflow-y-auto text-foreground [scrollbar-width:thin]">
              {editDraftHardViolations.map((violation, i) => (
                <li key={`${violation.key}-${i}`}>{violation.message}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              All checked hard rules pass for this draft. Turn off Edit or continue adjusting.
            </p>
          )}
        </div>
      ) : null}

      {persistError ? (
        <Alert variant="destructive" className="border shadow-sm">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle className="flex items-center justify-between gap-2">
            <span>{persistError.title}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Dismiss message"
              onClick={() => setPersistError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {persistError.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {feedback.kind === "error" && (
        <Alert variant="destructive" className="border shadow-sm">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle className="flex items-center justify-between gap-2">
            <span>{feedback.title}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Dismiss message"
              onClick={() => setFeedback({ kind: "idle" })}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {feedback.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <TimetableGridSectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={pickedEntry}
        readOnly={dialogReadOnly}
        config={config ?? ({} as ScheduleConfig)}
        catalogue={catalogue}
        onApply={(next) => {
          if (!draft) return;
          const nextDraft = draft.map((e) =>
            String(e.lecture_id) === String(next.lecture_id) ? next : e,
          );
          if (commitDraftIfValid(nextDraft)) {
            toast({
              title: "Section updated",
              description: `${next.course_code} — ${next.lecturer}`,
            });
          }
        }}
        onDelete={
          editMode && pickedEntry
            ? () => {
                if (!draft || !pickedEntry) return;
                const nextDraft = draft.filter((e) => String(e.lecture_id) !== String(pickedEntry.lecture_id));
                if (commitDraftIfValid(nextDraft)) {
                  toast({
                    title: "Section removed",
                    description: `${pickedEntry.course_code} was removed from the draft.`,
                  });
                }
              }
            : undefined
        }
      />

      <TimetableGridAddSectionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        targetCell={addTargetCell}
        config={config ?? ({} as ScheduleConfig)}
        catalogue={catalogue}
        scheduleEntries={displayEntries}
        extraSectionsOverride={extraSectionsOverride}
        onAdd={(next) => {
          if (!draft) return;
          const nextDraft = [...draft, next];
          if (commitDraftIfValid(nextDraft)) {
            toast({
              title: "Section added",
              description: `${next.course_code} — ${next.lecturer}`,
            });
          }
        }}
      />

      <AlertDialog open={resetDraftConfirmOpen} onOpenChange={setResetDraftConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset draft timetable?</AlertDialogTitle>
            <AlertDialogDescription>
              Unsaved grid changes will be discarded and the table will match the last saved workspace schedule from the
              server. This does not run the optimizer again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDraft(entries.map((e) => ({ ...e })));
                setFeedback({ kind: "idle" });
                toast({ title: "Draft reset", description: "Grid matches the saved workspace schedule." });
                setResetDraftConfirmOpen(false);
              }}
            >
              Reset draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        ref={gridScrollRef}
        className="relative max-h-[min(calc(100dvh-10rem),80rem)] min-h-0 overflow-auto rounded-lg border border-border bg-card shadow-sm [scrollbar-width:thin]"
        onDragOver={editMode ? handleGridDragOver : undefined}
      >
        <table className="w-full border-separate border-spacing-0 text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 w-36 border-b border-r border-border bg-muted px-3 py-2.5 text-left font-semibold text-foreground/80 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.12)]"
              >
                Room
              </th>
              {timeslotIds.map((ts, colIdx) => {
                const slotRow = catMap.get(ts);
                const family = uiSlotKindFromEngineSlotType(slotRow?.slot_type);
                const famClass =
                  family === "lab"
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-700/60"
                    : family === "blended"
                      ? "bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100 border-violet-200 dark:border-violet-700/60"
                      : "bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700/60";
                const slotHdrTip = timeslotHeaderLabel(ts, catalogue, displayEntries, "long");
                return (
                  <th
                    key={ts}
                    scope="col"
                    className={`sticky top-0 z-20 border-b border-l px-2 py-2.5 text-center text-xs font-semibold shadow-[0_4px_6px_-4px_rgba(15,23,42,0.12)] ${famClass}`}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block cursor-default">
                          <div className="mx-auto leading-snug tabular-nums">T{colIdx + 1}</div>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{slotHdrTip}</TooltipContent>
                    </Tooltip>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const roomData =
                row.key !== "__online__"
                  ? data?.room_summary?.find((r) => r.name === row.key)
                  : undefined;
              return (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-t border-border/60 border-r border-border bg-muted px-3 py-2 text-left align-top font-normal shadow-[4px_0_6px_-4px_rgba(15,23,42,0.12)]"
                  >
                    <div className="font-semibold text-foreground/90">{row.label}</div>
                    {roomData && (
                      <div className="text-xs font-normal text-muted-foreground">
                        Capacity {roomData.capacity}
                      </div>
                    )}
                    {row.key === "__online__" && (
                      <div className="text-xs text-muted-foreground">
                        no room
                      </div>
                    )}
                  </th>
                  {timeslotIds.map((ts) => {
                    const cellEntries = cellEntriesFor(row.key, ts);
                    const isConflict = cellEntries.some((e) =>
                      conflictIds.has(String(e.lecture_id)),
                    );
                    return (
                      <td
                        key={`${row.key}-${ts}`}
                        className={`border-t border-border/60 border-l border-border p-1 align-top ${
                          isConflict ? "bg-red-50 dark:bg-red-950/35" : ""
                        } ${editMode ? "ring-1 ring-transparent hover:ring-border" : ""} ${
                          editMode && cellEntries.length === 0 ? "cursor-pointer hover:bg-muted/70" : ""
                        }`}
                        onDragOver={
                          editMode
                            ? (ev) => {
                                ev.preventDefault();
                              }
                            : undefined
                        }
                        onDrop={
                          editMode
                            ? (ev) => {
                                ev.preventDefault();
                                const raw = ev.dataTransfer.getData("application/json");
                                if (!raw) return;
                                try {
                                  const { lecture_id } = JSON.parse(raw) as { lecture_id?: string | number };
                                  if (lecture_id == null) return;
                                  onDropEntry(lecture_id, row.key, ts);
                                } catch {
                                  /* ignore */
                                }
                              }
                            : undefined
                        }
                        onClick={
                          editMode
                            ? () => {
                                if (cellEntries.length !== 0) return;
                                setAddTargetCell({ rowKey: row.key, timeslotId: ts });
                                setAddDialogOpen(true);
                              }
                            : undefined
                        }
                      >
                        <div className="flex flex-col gap-1">
                          {cellEntries.map((entry) => {
                            const color = getLecturerColor(entry.lecturer);
                            const tag = deliveryTag(entry.delivery_mode);
                            return (
                              <div
                                key={entry.lecture_id}
                                className={cn(
                                  "flex min-w-0 items-stretch gap-0.5 rounded-md text-left text-xs leading-tight",
                                  color.bg,
                                  color.text,
                                  editMode && "ring-1 ring-border/60",
                                )}
                              >
                                {editMode && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        draggable
                                        onDragStart={(ev) => {
                                          ev.dataTransfer.setData(
                                            "application/json",
                                            JSON.stringify({ lecture_id: entry.lecture_id }),
                                          );
                                          ev.dataTransfer.effectAllowed = "move";
                                        }}
                                        className="flex shrink-0 cursor-grab touch-none select-none items-center border-r border-black/10 px-0.5 active:cursor-grabbing"
                                        aria-hidden
                                      >
                                        <GripVertical className="h-3.5 w-3.5 opacity-70" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Drag to another room / timeslot</TooltipContent>
                                  </Tooltip>
                                )}
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 rounded-r-md px-1.5 py-1 text-left outline-none hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
                                  onClick={() => {
                                    setPickedEntry(entry);
                                    setDialogReadOnly(!editMode);
                                    setDialogOpen(true);
                                  }}
                                >
                                  {(() => {
                                    const code = String(entry.course_code ?? "").trim();
                                    const name = (entry.course_name ?? "").trim();
                                    const primary = name || code;
                                    const showCodeSub = Boolean(name && code);
                                    const courseTitleTip = showCodeSub ? `${code} — ${name}` : primary;
                                    return (
                                      <>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="line-clamp-2 cursor-default font-semibold leading-snug">
                                              {primary}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">{courseTitleTip}</TooltipContent>
                                        </Tooltip>
                                        {showCodeSub ? (
                                          <div className="font-mono text-[10px] font-medium opacity-75">{code}</div>
                                        ) : null}
                                        <div className="font-normal opacity-80">{entry.lecturer}</div>
                                      </>
                                    );
                                  })()}
                                  {tag && (
                                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                                      <span className="rounded bg-card/60 px-1 text-[10px] font-medium text-foreground/80">
                                        {tag}
                                      </span>
                                    </div>
                                  )}
                                  {conflictIds.has(String(entry.lecture_id)) && (
                                    <div className="mt-0.5 text-[10px] font-semibold text-red-600">Overlap</div>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 px-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Session type:</span>
          <span className="rounded border border-blue-200 bg-blue-100 px-2 py-0.5 font-medium text-blue-900">
            Traditional Lecture
          </span>
          <span className="rounded border border-violet-200 bg-violet-100 px-2 py-0.5 font-medium text-violet-900">
            Blended Lecture
          </span>
          <span className="rounded border border-amber-200 dark:border-amber-700/60 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 font-medium text-amber-900 dark:text-amber-100">
            Lab
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── CourseList ───────────────────────────────────────────────────────────────

export function CourseList() {
  const { data, isLoading } = useSchedule();
  const [open, setOpen] = useState(false);
  const entries = data?.schedule ?? [];
  const catalogue = data?.timeslots_catalogue ?? [];
  const catMap = useMemo(() => catalogueById(catalogue), [catalogue]);
  const { conflictIds } = buildUiConflicts(entries, catalogue);

  if (isLoading || entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) =>
    compareTimeslotGridOrder(a.timeslot, b.timeslot, catMap),
  );

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted transition-colors border-b border-border"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">All courses</span>
          <span className="text-xs text-muted-foreground">({sorted.length})</span>
        </div>
        <span className="text-muted-foreground text-sm tabular-nums" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {sorted.map((entry) => {
            const color = getLecturerColor(entry.lecturer);
            const isConflict = conflictIds.has(String(entry.lecture_id));
            const slotLabel = timeslotHeaderLabel(
              entry.timeslot,
              catalogue,
              entries,
            );
            const family = uiSlotKindFromEngineSlotType(entry.slot_type);
            const isLabRow =
              (entry.session_type || "").toLowerCase() === "lab" ||
              family === "lab";
            const accentBar = isLabRow
              ? "bg-amber-50 dark:bg-amber-950/300"
              : family === "blended"
                ? "bg-violet-500"
                : "bg-muted-foreground/70";

            return (
              <div
                key={entry.lecture_id}
                className={`flex flex-wrap items-start gap-3 px-4 py-3 ${isConflict ? "bg-red-50 dark:bg-red-950/35" : ""}`}
              >
                <div className={`h-4 w-1 rounded shrink-0 mt-1 ${accentBar}`} />

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground leading-snug">
                    {(entry.course_name || "").trim() || entry.course_code}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{entry.course_code}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {formatDeliveryMode(entry.delivery_mode)}
                    </span>
                    {!isLabRow && family === "blended" ? (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                        Blended slot pattern
                      </span>
                    ) : !isLabRow ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Regular slot pattern
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="text-right text-sm shrink-0 min-w-[8rem]">
                  <div className={`font-medium ${color.text}`}>{entry.lecturer}</div>
                  <div className="text-xs text-foreground/80 mt-0.5 leading-snug">
                    {slotLabel}
                  </div>
                </div>

                <div className="text-right shrink-0 min-w-[6rem]">
                  <div className="rounded bg-muted px-2 py-1 text-xs font-medium text-foreground/80">
                    {formatRoomCell(entry)}
                  </div>
                  {isConflict && (
                    <div className="mt-0.5 text-xs font-medium text-red-600">
                      Overlap
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── OptimizationInfo ─────────────────────────────────────────────────────────

export function OptimizationInfo() {
  const { data, isLoading: scheduleLoading } = useSchedule();
  const { config, isLoading: configLoading } = useConfig();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openSoftMetricsTab = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "soft-metrics");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
  const meta = data?.metadata;
  const entries = data?.schedule ?? [];
  const roomSummary = data?.room_summary ?? [];

  if (configLoading || !config) return null;
  if (scheduleLoading && !data) return null;

  const inputCounts = getSchedulingInputCounts(config);
  const breakdown = scheduleDeliveryBreakdown(meta, entries);

  const generatedAt = meta?.generated_at
    ? new Date(meta.generated_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  // Catalog slot occupancy: assigned classes vs every compatible room×timeslot
  // unit in the catalogue (denominator is large, so this stays low unless the
  // grid is nearly full — it is not the same as seat efficiency on used slots).
  const totalSlots = roomSummary.reduce((sum, r) => sum + r.total_slots, 0);
  const usedSlots = roomSummary.reduce((sum, r) => sum + r.used_slots, 0);
  const slotUtilizationPct =
    totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

  const utilizationInfo = data?.utilization_info ?? [];

  const totalCatalogSeatCapacity = utilizationInfo.reduce(
    (sum, u) => sum + (u.capacity ?? 0),
    0,
  );
  const totalCatalogSeatsWasted = utilizationInfo.reduce(
    (sum, u) =>
      sum +
      (u.wasted_seats ?? (u.capacity ?? 0) - (u.class_size ?? 0)),
    0,
  );
  const timetableSeatsPctComputed =
    totalCatalogSeatCapacity > 0
      ? Math.round(
          (100 * (1 - totalCatalogSeatsWasted / totalCatalogSeatCapacity)) * 10,
        ) / 10
      : 0;
  const metaSeatPct = meta?.timetable_seat_utilization_pct;
  const timetableSeatsPctDisplay =
    typeof metaSeatPct === "number" && Number.isFinite(metaSeatPct)
      ? metaSeatPct
      : timetableSeatsPctComputed;

  // Use config values for iterations/wolves if available, fall back to schedule metadata
  const iterations =
    config.gwo_params?.num_iterations ?? meta?.iterations ?? "—";
  const wolves = config.gwo_params?.num_wolves ?? meta?.wolves ?? "—";

  const fitnessRaw = meta?.best_fitness;
  const fitnessNum =
    typeof fitnessRaw === "number" && Number.isFinite(fitnessRaw)
      ? fitnessRaw
      : null;
  const fitnessPerfect =
    fitnessNum !== null && fitnessNum < 0.000001;
  const fitnessDisplay =
    fitnessNum === null
      ? "—"
      : fitnessPerfect
        ? "Perfect"
        : fitnessNum.toFixed(2);
  const fitnessTitle =
    fitnessNum !== null && !fitnessPerfect
      ? String(fitnessRaw)
      : undefined;

  type DetailCell = {
    label: string;
    value: string;
    highlight?: string;
    title?: string;
    mono?: boolean;
    labelTitle?: string;
    /** Shown in the browser tooltip on hover (e.g. room metric cards). */
    description?: string;
  };

  const mergeDetailStatTooltip = (row: DetailCell): string | undefined => {
    if (row.description) {
      const s = [row.labelTitle, row.description].filter(Boolean).join(" — ");
      return s.trim() || undefined;
    }
    const parts = [row.labelTitle, row.title].filter(Boolean) as string[];
    if (parts.length === 0) return undefined;
    return parts.join(" — ");
  };

  const unitConflictCount =
    meta?.unit_conflict_count ?? (data?.unit_conflict_violations?.length ?? 0);
  const roomLecturerConflictCount = meta?.conflicts ?? 0;

  const detailRows: DetailCell[][] = [
    [
      { label: "Iterations", value: String(iterations), mono: true },
      { label: "Wolves", value: String(wolves), mono: true },
      {
        label: "Optimizer Score",
        value: fitnessDisplay,
        highlight: fitnessPerfect
          ? "text-green-600"
          : fitnessNum !== null && (meta?.conflicts ?? 0) > 0
            ? "text-red-600"
            : fitnessNum !== null
              ? "text-amber-600"
              : undefined,
        title: fitnessTitle,
        mono: fitnessNum !== null && !fitnessPerfect,
        description:
          "The GWO optimizer's raw objective value. Lower is better. 'Perfect' means all hard constraints were satisfied with no penalty.",
      },
    ],
    [
      {
        label: "Room/Lecturer conflicts",
        value: String(roomLecturerConflictCount),
        highlight: roomLecturerConflictCount > 0 ? "text-red-600" : "text-green-600",
        mono: true,
        description:
          "Number of hard clashes where a room or lecturer is double-booked in the same timeslot. Any value above zero means the timetable violates hard constraints.",
      },
      {
        label: "Unit conflicts",
        value: String(unitConflictCount),
        highlight: unitConflictCount > 0 ? "text-red-600" : "text-green-600",
        mono: true,
        description:
          "Two courses from the same student cohort are scheduled at the same time, making it impossible for students to attend both.",
      },
      {
        label: "Slot occupancy",
        value: `${slotUtilizationPct}%`,
        mono: true,
        description:
          "Percentage of all room×timeslot pairs that have at least one assigned class. A low value means most rooms sit empty most of the time.",
      },
      { label: "Generated", value: generatedAt },
    ],
  ];

  const scheduleOverviewInputRows: DetailCell[] = [
    {
      label: "Courses",
      value: String(inputCounts.distinctCourses),
      mono: true,
    },
    {
      label: "Sections",
      value: String(inputCounts.sectionSlots),
      mono: true,
      description:
        "Total section slots to schedule (one timetable placement per entry in the lectures list).",
    },
    {
      label: "Rooms",
      value: String(inputCounts.rooms),
      mono: true,
    },
    {
      label: "Timeslots",
      value: String(inputCounts.timeslots),
      mono: true,
      description:
        "Timeslot patterns from configuration (slot catalogue used by the optimizer).",
    },
    {
      label: "Lecturers",
      value: String(inputCounts.lecturers),
      mono: true,
    },
  ];

  const scheduleOverviewSessionMix: DetailCell[] = [
    {
      label: "In-person",
      value: String(breakdown.ip),
      highlight: "text-foreground/90",
      mono: true,
    },
    {
      label: "Online",
      value: String(breakdown.on),
      highlight: "text-sky-700",
      mono: true,
    },
    {
      label: "Blended",
      value: String(breakdown.bl),
      highlight: "text-violet-700",
      mono: true,
    },
    {
      label: "Labs",
      value: String(breakdown.lab),
      highlight: "text-amber-800",
      mono: true,
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border/90 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-gradient-to-r from-muted/60 to-card px-4 py-2.5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Schedule &amp; optimization
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Inputs used for scheduling, last timetable mix, and optimizer run metrics
        </p>
      </div>
      <div className="space-y-2 p-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Schedule overview
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {scheduleOverviewInputRows.map((row) => {
              const { label, value, highlight, mono } = row;
              const tip = mergeDetailStatTooltip(row);
              const tile = (
                <div
                  className={`min-w-0 rounded-lg border border-border/60 bg-muted/40/60 px-3 py-2 ${tip ? "cursor-help" : ""}`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">{label}</div>
                  <div
                    className={`mt-0.5 break-words text-sm font-semibold ${mono ? "tabular-nums" : ""} ${highlight ?? "text-foreground"}`}
                  >
                    {value}
                  </div>
                </div>
              );
              return (
                <Fragment key={`input-${label}`}>
                  {tip ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{tile}</TooltipTrigger>
                      <TooltipContent side="top">{tip}</TooltipContent>
                    </Tooltip>
                  ) : (
                    tile
                  )}
                </Fragment>
              );
            })}
          </div>
          <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Session types (last generated timetable)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {scheduleOverviewSessionMix.map((row) => {
              const { label, value, highlight, mono } = row;
              const tip = mergeDetailStatTooltip(row);
              const tile = (
                <div className="min-w-0 rounded-lg border border-border/60 bg-muted/40/60 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">{label}</div>
                  <div
                    className={`mt-0.5 break-words text-sm font-semibold ${mono ? "tabular-nums" : ""} ${highlight ?? "text-foreground/90"}`}
                  >
                    {value}
                  </div>
                </div>
              );
              return (
                <Fragment key={`mix-${label}`}>
                  {tip ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{tile}</TooltipTrigger>
                      <TooltipContent side="top">{tip}</TooltipContent>
                    </Tooltip>
                  ) : (
                    tile
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

        <div className="pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Optimization run
          </p>
          {!meta && (
            <p className="mb-2 text-xs text-muted-foreground/80">
              Run the optimizer to populate these metrics.
            </p>
          )}
          <div className="grid grid-flow-col auto-cols-fr gap-2 overflow-x-auto pb-1">
            {detailRows.flat().map((row) => {
              const { label, value, highlight, mono } = row;
              const tip = mergeDetailStatTooltip(row);
              const tile = (
                <div
                  className={`min-w-0 rounded-lg border border-border/60 bg-muted/40/60 px-3 py-2 ${tip ? "cursor-help" : ""}`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">{label}</div>
                  <div
                    className={`mt-0.5 break-words text-sm font-semibold ${mono ? "tabular-nums" : ""} ${highlight ?? "text-foreground/90"}`}
                  >
                    {value}
                  </div>
                </div>
              );
              return (
                <Fragment key={label}>
                  {tip ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{tile}</TooltipTrigger>
                      <TooltipContent side="top">{tip}</TooltipContent>
                    </Tooltip>
                  ) : (
                    tile
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Range thumb is 1rem; fill and ticks align to thumb-center travel. */
const SOFT_WEIGHT_THUMB_HALF = "0.5rem";

function softWeightFillWidthToThumbCenter(value: number): string {
  if (value <= 0) return "0";
  return `calc(${SOFT_WEIGHT_THUMB_HALF} + (100% - 1rem) * ${value / 100})`;
}

function softWeightTickLeft(pct: number): string {
  if (pct <= 0) return SOFT_WEIGHT_THUMB_HALF;
  if (pct >= 100) return "calc(100% - 0.5rem)";
  return `calc(${SOFT_WEIGHT_THUMB_HALF} + (100% - 1rem) * ${pct / 100})`;
}

const SOFT_CONSTRAINT_DEFINITIONS: Array<{
  key: keyof SoftWeights;
  label: string;
  description: string;
}> = [
  {
    key: "preferred_timeslot",
    label: "Preferred timeslot",
    description: "Reward assigning lecturers to preferred slots",
  },
  {
    key: "unpreferred_timeslot",
    label: "Unpreferred timeslot",
    description: "Penalize scheduling in avoided slots",
  },
  {
    key: "minimize_gaps",
    label: "Minimize gaps",
    description: "Penalize idle time between lecturer classes",
  },
  {
    key: "room_utilization",
    label: "Room utilization",
    description: "Penalize oversized room assignments",
  },
  {
    key: "balanced_workload",
    label: "Balanced workload",
    description: "Penalize uneven lecturer loads",
  },
  {
    key: "distribute_classes",
    label: "Distribute classes",
    description: "Spread lectures across timeslots",
  },
  {
    key: "student_gaps",
    label: "Student gaps",
    description: "Penalize gaps in student daily schedules",
  },
  {
    key: "single_session_day",
    label: "Single-session day",
    description: "Penalize a day with only one class in a unit",
  },
];

const PRIMARY_SAVE_BUTTON_CLASS = `${segmentedNavTabItemRadiusClass} h-9 px-4 text-sm font-semibold shadow-sm`;

function parseLastAllowedHourHM(s: string | null | undefined): { hour: number; minute: number } {
  if (!s || typeof s !== "string") return { hour: 16, minute: 0 };
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return { hour: 16, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { hour, minute };
}

function formatLastAllowedHourHM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const LAST_HOUR_PICKER_SCROLL_CLASS =
  "max-h-[216px] overflow-y-auto overscroll-contain py-1.5 px-1 scroll-py-9 scroll-smooth " +
  "[scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent]";

function LastAllowedHourTimePicker({
  disabled,
  hour,
  minute,
  onChange,
}: {
  disabled: boolean;
  hour: number;
  minute: number;
  onChange: (nextHour: number, nextMinute: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      hourListRef.current
        ?.querySelector(`button[data-tp-hour="${hour}"]`)
        ?.scrollIntoView({ block: "center" });
      minuteListRef.current
        ?.querySelector(`button[data-tp-minute="${minute}"]`)
        ?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [open, hour, minute]);

  const hourCells = useMemo(() => Array.from({ length: 24 }, (_, h) => h), []);
  const minuteCells = useMemo(() => Array.from({ length: 60 }, (_, m) => m), []);

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(next) => {
        if (!disabled) setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 min-w-[8.25rem] justify-between gap-2 rounded-md border-border bg-card px-3 font-mono text-sm tabular-nums shadow-sm hover:bg-muted/40",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Cutoff time, 24-hour format"
        >
          <span className="flex items-baseline gap-0.5 tracking-wide">
            <span>{String(hour).padStart(2, "0")}</span>
            <span className="text-muted-foreground/80">:</span>
            <span>{String(minute).padStart(2, "0")}</span>
          </span>
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className="w-auto overflow-hidden rounded-xl border border-border/90 bg-card p-0 shadow-lg"
      >
        <div className="flex">
          <div className="flex w-[4.75rem] flex-col border-r border-border">
            <div className="border-b border-border/60 bg-gradient-to-r from-muted/60 to-card px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hour
            </div>
            <div ref={hourListRef} className={LAST_HOUR_PICKER_SCROLL_CLASS}>
              <div className="flex flex-col gap-0.5">
                {hourCells.map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-tp-hour={h}
                    className={cn(
                      "flex h-9 w-full shrink-0 items-center justify-center rounded-lg text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                      h === hour
                        ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                        : "text-foreground/80 hover:bg-muted active:bg-muted/80",
                    )}
                    onClick={() => {
                      onChange(h, minute);
                    }}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex w-[4.75rem] flex-col">
            <div className="border-b border-border/60 bg-gradient-to-r from-muted/60 to-card px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Min
            </div>
            <div ref={minuteListRef} className={LAST_HOUR_PICKER_SCROLL_CLASS}>
              <div className="flex flex-col gap-0.5">
                {minuteCells.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-tp-minute={m}
                    className={cn(
                      "flex h-9 w-full shrink-0 items-center justify-center rounded-lg text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                      m === minute
                        ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                        : "text-foreground/80 hover:bg-muted active:bg-muted/80",
                    )}
                    onClick={() => {
                      onChange(hour, m);
                    }}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Latest clock time for scheduling physical / blended sections (`last_allowed_hour` in config). */
export function LastAllowedHourPhysicalLecturesPanel() {
  const { config, isLoading, refresh } = useConfig();
  const [localConfig, setLocalConfig] = useState<ScheduleConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const displayConfig = localConfig ?? config;

  if (isLoading || !config || !displayConfig) return null;

  const enabled = displayConfig.last_allowed_hour != null;
  const { hour, minute } = parseLastAllowedHourHM(displayConfig.last_allowed_hour ?? "16:00");

  const handleSave = async () => {
    if (!localConfig) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localConfig),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(body.error ?? `Save failed (HTTP ${res.status})`);
        return;
      }
      await refresh();
      setLocalConfig(null);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/90 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-gradient-to-r from-muted/60 to-card px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Last allowed hour for physical lectures
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Sections for in-person and blended courses will not be scheduled after this time. Online courses are not affected.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!localConfig || saving}
            className={PRIMARY_SAVE_BUTTON_CLASS}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="last-allowed-hour-enabled"
                checked={enabled}
                onCheckedChange={(on) => {
                  setLocalConfig({
                    ...displayConfig,
                    last_allowed_hour: on ? displayConfig.last_allowed_hour ?? "16:00" : null,
                  });
                }}
              />
              <Label htmlFor="last-allowed-hour-enabled" className="cursor-pointer text-xs font-semibold text-foreground/80">
                Apply cutoff for physical & blended sections
              </Label>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <span className="text-xs font-semibold text-muted-foreground">Cutoff time (24h)</span>
              <LastAllowedHourTimePicker
                disabled={!enabled}
                hour={hour}
                minute={minute}
                onChange={(nextHour, nextMinute) => {
                  setLocalConfig({
                    ...displayConfig,
                    last_allowed_hour: formatLastAllowedHourHM(nextHour, nextMinute),
                  });
                }}
              />
            </div>
          </div>
        </div>
        {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}
      </div>
    </div>
  );
}

/** Hard rules the GWO search enforces for every feasible timetable (read-only). */
export function HardConstraintsReadOnlyPanel() {
  const hardRules: { title: string; detail: string }[] = [
    {
      title: "Valid lecturer assignment",
      detail: "Each section is taught by a lecturer from the configured pool.",
    },
    {
      title: "Lecturer timeslot availability",
      detail: "Assignments respect lecturer–slot availability.",
    },
    {
      title: "Valid timeslot type",
      detail: "Session type matches the pattern of the chosen slot (e.g. MW vs ST).",
    },
    {
      title: "Valid room type",
      detail: "Room kind matches the session (lecture hall vs lab).",
    },
    {
      title: "No lecturer overlap",
      detail: "A lecturer is not double-booked in the same timeslot.",
    },
    {
      title: "No room overlap",
      detail: "A room is not double-booked in the same timeslot.",
    },
    {
      title: "Room capacity",
      detail: "Class size does not exceed room capacity for in-person placements.",
    },
    {
      title: "Cohort consistency",
      detail: "No hard conflicts for major / year / semester cohorts.",
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border/90 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-gradient-to-r from-muted/60 to-card px-4 py-2.5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Hard constraints
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Feasible timetables from GWO must satisfy all of these rules. This list is read-only (view only).
        </p>
      </div>
      <div className="p-3">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {hardRules.map((rule) => (
            <li
              key={rule.title}
              className="flex gap-3 py-1.5 sm:gap-4"
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/90 text-muted-foreground"
                aria-hidden
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{rule.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{rule.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SoftConstraintWeightsPanel() {
  const { config, isLoading, refresh } = useConfig();
  const [localConfig, setLocalConfig] = useState<ScheduleConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const displayConfig = localConfig ?? config;

  if (isLoading || !config || !displayConfig) return null;

  const updateSoftWeight = (key: keyof SoftWeights, value: number) => {
    setLocalConfig({
      ...displayConfig,
      soft_weights: {
        ...displayConfig.soft_weights,
        [key]: Math.max(0, Math.min(100, value)),
      },
    });
  };

  const handleSave = async () => {
    if (!localConfig) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localConfig),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(body.error ?? `Save failed (HTTP ${res.status})`);
        return;
      }
      await refresh();
      setLocalConfig(null);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/90 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-gradient-to-r from-muted/60 to-card px-4 py-2.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Soft constraint weights
            </h3>
            <p className="text-[11px] text-muted-foreground">
              0 = disabled, 100 = strongest influence on the objective function
            </p>
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!localConfig || saving}
            className={`shrink-0 ${PRIMARY_SAVE_BUTTON_CLASS}`}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SOFT_CONSTRAINT_DEFINITIONS.map((item) => {
            const value = Math.max(
              0,
              Math.min(100, (displayConfig.soft_weights[item.key] ?? 0) as number),
            );
            return (
              <div
                key={String(item.key)}
                className="rounded-xl border border-border/80 bg-muted/50 p-3 sm:p-3.5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-foreground/90">{item.label}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) =>
                      updateSoftWeight(item.key, parseInt(e.target.value, 10) || 0)
                    }
                    className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-center text-sm tabular-nums shadow-sm"
                  />
                </div>
                <div
                  className="relative mt-0.5 w-full"
                  style={{ "--soft-weight-thumb": "#00a5f4" } as CSSProperties}
                >
                  <div className="relative flex h-5 w-full items-center">
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[1] h-1.5 -translate-y-1/2 rounded-full bg-muted/90" />
                    {Array.from({ length: 11 }, (_, i) => i * 10).map((pct) => (
                      <div
                        key={pct}
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 z-[2] h-1.5 w-px -translate-x-1/2 -translate-y-1/2 bg-muted-foreground/55"
                        style={{ left: softWeightTickLeft(pct) }}
                      />
                    ))}
                    <div
                      className={`pointer-events-none absolute left-0 top-1/2 z-[3] h-1.5 max-w-full -translate-y-1/2 bg-gradient-to-r from-[#00a5f4] via-blue-500 to-blue-800 ${
                        value >= 100 ? "rounded-full" : "rounded-l-full"
                      }`}
                      style={{ width: softWeightFillWidthToThumbCenter(value) }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={value}
                      onChange={(e) =>
                        updateSoftWeight(item.key, parseInt(e.target.value, 10))
                      }
                      className="soft-weight-range relative z-10 w-full cursor-pointer"
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
        {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}
      </div>
    </div>
  );
}

export function GwoParametersPanel() {
  const { config, isLoading, refresh } = useConfig();
  const [localConfig, setLocalConfig] = useState<ScheduleConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const displayConfig = localConfig ?? config;

  if (isLoading || !config || !displayConfig) return null;

  const params = [
    { key: "num_wolves", label: "Wolves", desc: "Population size", step: 1 },
    { key: "num_iterations", label: "Iterations", desc: "Max generations", step: 1 },
    { key: "num_runs", label: "Runs", desc: "Independent runs", step: 1 },
    { key: "mutation_rate", label: "Mutation rate", desc: "0.0-1.0", step: 0.1 },
    { key: "stagnation_limit", label: "Stagnation limit", desc: "Iterations before restart", step: 1 },
    { key: "perfect_threshold", label: "Perfect threshold", desc: "Near-zero target", step: 0.000001 },
  ] as const;

  const updateParam = (key: string, value: number) => {
    setLocalConfig({
      ...displayConfig,
      gwo_params: { ...displayConfig.gwo_params, [key]: value },
    });
  };

  const handleSave = async () => {
    if (!localConfig) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localConfig),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(body.error ?? `Save failed (HTTP ${res.status})`);
        return;
      }
      await refresh();
      setLocalConfig(null);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/90 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-gradient-to-r from-muted/60 to-card px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              GWO algorithm parameters
            </h3>
            <p className="text-[11px] text-muted-foreground">Adjust optimizer behavior and run limits</p>
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!localConfig || saving}
            className={PRIMARY_SAVE_BUTTON_CLASS}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {params.map(({ key, label, desc, step }) => (
            <div key={key} className="rounded-md border border-border bg-muted/40 p-3">
              <label className="text-xs font-semibold text-foreground/80">{label}</label>
              <input
                type="number"
                step={step}
                value={(displayConfig.gwo_params as Record<string, number>)[key]}
                onChange={(e) => updateParam(key, parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded border border-border bg-card px-2 py-1 text-sm"
              />
              <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
      </div>
    </div>
  );
}

// ─── ConfigurationPanel (Single Source of Truth) ─────────────────────────────

function RoomConfigEditorRow({
  roomKey,
  rv,
  renameRoom,
  updateRoomCapacity,
  updateRoomType,
  removeRoom,
}: {
  roomKey: string;
  rv: RoomConfigValue;
  renameRoom: (from: string, to: string) => void;
  updateRoomCapacity: (name: string, capacity: number) => void;
  updateRoomType: (name: string, room_type: string) => void;
  removeRoom: (name: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState(roomKey);
  useEffect(() => {
    setNameDraft(roomKey);
  }, [roomKey]);

  const commitName = () => {
    const next = nameDraft.trim();
    if (next === "" || next === roomKey) {
      setNameDraft(roomKey);
      return;
    }
    renameRoom(roomKey, next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <input
        type="text"
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Room name"
        className="min-w-[4.5rem] w-24 max-w-[min(100%,12rem)] rounded border border-border bg-card px-2 py-1 text-sm font-mono font-bold text-foreground/80"
      />
      <input
        type="number"
        value={roomCap(rv)}
        onChange={(e) =>
          updateRoomCapacity(roomKey, parseInt(e.target.value, 10) || 0)
        }
        className="w-16 rounded border border-border px-2 py-1 text-sm text-center"
      />
      <span className="text-xs text-muted-foreground/80">seats</span>
      <select
        value={roomTp(rv)}
        onChange={(e) => updateRoomType(roomKey, e.target.value)}
        className="text-xs rounded border border-border px-1 py-1 bg-card"
      >
        {ROOM_TYPE_OPTIONS.map((rt) => (
          <option key={rt} value={rt}>
            {rt.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => removeRoom(roomKey)}
            className="ml-auto text-xs text-red-500 hover:text-red-700"
            type="button"
          >
            Remove
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Remove room</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ConfigurationPanel() {
  const { config, isLoading, refresh } = useConfig();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localConfig, setLocalConfig] = useState<ScheduleConfig | null>(null);
  const [prefAddSelect, setPrefAddSelect] = useState<Record<string, string>>(
    {},
  );
  const [unprefAddSelect, setUnprefAddSelect] = useState<Record<string, string>>(
    {},
  );
  const [timeslotsOpen, setTimeslotsOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [lecturerPrefsOpen, setLecturerPrefsOpen] = useState(false);
  const [prefsLecturer, setPrefsLecturer] = useState("");

  // Initialize local config when data loads
  const displayConfig = localConfig ?? config;

  useEffect(() => {
    if (
      prefsLecturer &&
      displayConfig &&
      !displayConfig.lecturers.includes(prefsLecturer)
    ) {
      setPrefsLecturer("");
    }
  }, [displayConfig, prefsLecturer]);

  if (isLoading || !config) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-4 py-3">
          <h3 className="font-semibold text-foreground">Configuration</h3>
        </div>
        <div className="p-4 text-sm text-muted-foreground">
          Loading configuration...
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!localConfig) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localConfig),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(body.error ?? `Save failed (HTTP ${res.status})`);
        return;
      }
      await refresh();
      setLocalConfig(null);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSaveError(null);
    setLocalConfig(null);
  };

  const updateRoomCapacity = (name: string, capacity: number) => {
    const cfg = localConfig ?? config;
    const prev = cfg.rooms[name];
    const next =
      typeof prev === "number"
        ? { capacity, room_type: "any" as string }
        : {
            capacity,
            room_type:
              typeof prev === "object" && prev?.room_type
                ? prev.room_type
                : "any",
          };
    setLocalConfig({
      ...cfg,
      rooms: { ...cfg.rooms, [name]: next },
    });
  };

  const updateRoomType = (name: string, room_type: string) => {
    const cfg = localConfig ?? config;
    const prev = cfg.rooms[name];
    const cap = roomCap(prev);
    setLocalConfig({
      ...cfg,
      rooms: { ...cfg.rooms, [name]: { capacity: cap, room_type } },
    });
  };

  const renameRoom = (from: string, to: string) => {
    const cfg = localConfig ?? config;
    const trimmed = to.trim();
    if (!trimmed || trimmed === from) return;
    const roomVal = cfg.rooms[from];
    if (roomVal == null) return;

    const keys = Object.keys(cfg.rooms);
    let newKey = trimmed;
    let n = 2;
    while (keys.includes(newKey) && newKey !== from) {
      newKey = `${trimmed}_${n}`;
      n++;
    }
    if (newKey === from) return;

    const newRooms = Object.fromEntries(
      Object.entries(cfg.rooms).map(([k, v]) => [k === from ? newKey : k, v]),
    );
    setLocalConfig({ ...cfg, rooms: newRooms });
  };

  const updateLecturerPref = (
    name: string,
    field: "preferred" | "unpreferred",
    value: string[],
  ) => {
    const cfg = localConfig ?? config;
    setLocalConfig({
      ...cfg,
      lecturer_preferences: {
        ...cfg.lecturer_preferences,
        [name]: {
          ...cfg.lecturer_preferences[name],
          [field]: value,
        },
      },
    });
  };

  const patchLecturerPrefs = (
    name: string,
    patch: Partial<{ preferred: string[]; unpreferred: string[] }>,
  ) => {
    const cfg = localConfig ?? config;
    const cur = cfg.lecturer_preferences[name] ?? {
      preferred: [],
      unpreferred: [],
    };
    setLocalConfig({
      ...cfg,
      lecturer_preferences: {
        ...cfg.lecturer_preferences,
        [name]: { ...cur, ...patch },
      },
    });
  };

  const updateGWOParam = (key: string, value: number) => {
    const cfg = localConfig ?? config;
    setLocalConfig({
      ...cfg,
      gwo_params: { ...cfg.gwo_params, [key]: value },
    });
  };

  const updateSoftWeight = (key: string, value: number) => {
    const cfg = localConfig ?? config;
    setLocalConfig({
      ...cfg,
      soft_weights: { ...cfg.soft_weights, [key]: value },
    });
  };

  const updateLectureField = (
    id: number,
    field: string,
    value: string | number | number[],
  ) => {
    const cfg = localConfig ?? config;
    setLocalConfig({
      ...cfg,
      lectures: cfg.lectures.map((lec) =>
        lec.id === id ? { ...lec, [field]: value } : lec,
      ),
    });
  };

  const addRoom = () => {
    const cfg = localConfig ?? config;
    const existingNames = Object.keys(cfg.rooms);
    let newName = "R" + (existingNames.length + 1);
    let counter = existingNames.length + 1;
    while (existingNames.includes(newName)) {
      counter++;
      newName = "R" + counter;
    }
    setLocalConfig({
      ...cfg,
      rooms: {
        ...cfg.rooms,
        [newName]: { capacity: 30, room_type: "lecture_hall" },
      },
    });
  };

  const removeRoom = (name: string) => {
    const cfg = localConfig ?? config;
    const newRooms = Object.fromEntries(
      Object.entries(cfg.rooms).filter(([k]) => k !== name),
    );
    setLocalConfig({ ...cfg, rooms: newRooms });
  };

  const addTimeslot = () => {
    const cfg = localConfig ?? config;
    const list = normalizeTimeslotsInput(cfg.timeslots);
    let newId = `SLOT_${list.length + 1}`;
    while (list.some((t) => t.id === newId)) {
      newId = `${newId}_x`;
    }
    setLocalConfig({
      ...cfg,
      timeslots: [
        ...list,
        {
          id: newId,
          days: ["Monday"],
          start_hour: 8,
          duration: 1.5,
          slot_type: "lecture_mw",
        },
      ],
    });
  };

  const removeTimeslot = (tsId: string) => {
    const cfg = localConfig ?? config;
    const list = normalizeTimeslotsInput(cfg.timeslots).filter(
      (t) => t.id !== tsId,
    );
    setLocalConfig({
      ...cfg,
      timeslots: list,
      lecturer_preferences: Object.fromEntries(
        Object.entries(cfg.lecturer_preferences).map(([name, prefs]) => [
          name,
          {
            preferred: prefs.preferred.filter((t) => t !== tsId),
            unpreferred: prefs.unpreferred.filter((t) => t !== tsId),
          },
        ]),
      ),
    });
  };

  const updateTimeslotRow = (
    tsId: string,
    patch: Partial<TimeslotConfigEntry>,
  ) => {
    const cfg = localConfig ?? config;
    const list = normalizeTimeslotsInput(cfg.timeslots).map((t) =>
      t.id === tsId ? { ...t, ...patch } : t,
    );
    setLocalConfig({ ...cfg, timeslots: list });
  };

  const addCourse = () => {
    const cfg = localConfig ?? config;
    const maxId = cfg.lectures.reduce((max, l) => Math.max(max, l.id), 0);
    const newId = maxId + 1;
    setLocalConfig({
      ...cfg,
      lectures: [
        ...cfg.lectures,
        {
          id: newId,
          course: `Course_${newId}`,
          allowed_lecturers: [0],
          size: 30,
          delivery_mode: "inperson",
          session_type: "lecture",
        },
      ],
    });
  };

  const removeCourse = (id: number) => {
    const cfg = localConfig ?? config;
    setLocalConfig({
      ...cfg,
      lectures: cfg.lectures.filter((l) => l.id !== id),
    });
  };

  const hasChanges = localConfig !== null;
  const cfgForSlots = (localConfig ?? config) as ScheduleConfig;
  const timeslotsList = normalizeTimeslotsInput(cfgForSlots.timeslots);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-gradient-to-b from-muted/60 to-muted/90 hover:from-muted/90 hover:to-muted/90 transition-colors border-b border-border text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">Configuration</span>
            {hasChanges && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                Unsaved changes
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Rooms, timeslots, lecturer preferences, courses, and optimizer weights
          </p>
        </div>
        <span className="shrink-0 text-muted-foreground text-sm tabular-nums" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && displayConfig && (
        <div className="p-4 space-y-6">
          {hasChanges && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className={PRIMARY_SAVE_BUTTON_CLASS}
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                <button
                  onClick={handleReset}
                  className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/80 transition-colors"
                >
                  Reset
                </button>
              </div>
              {saveError && (
                <p className="text-sm text-red-600" role="alert">
                  {saveError}
                </p>
              )}
            </div>
          )}

          {/* Rooms */}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-2">
              <button
                type="button"
                id="config-rooms-toggle"
                aria-expanded={roomsOpen}
                aria-controls="config-rooms-body"
                onClick={() => setRoomsOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/80"
              >
                <span
                  className="shrink-0 text-sm tabular-nums text-muted-foreground"
                  aria-hidden
                >
                  {roomsOpen ? "▾" : "▸"}
                </span>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rooms &amp; Capacities ({Object.keys(displayConfig.rooms).length})
                </h4>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoomsOpen(true);
                  addRoom();
                }}
                className="flex shrink-0 items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                + Add Room
              </button>
            </div>
            {roomsOpen && (
              <div id="config-rooms-body" className="p-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(displayConfig.rooms).map(([name, rv]) => (
                    <RoomConfigEditorRow
                      key={name}
                      roomKey={name}
                      rv={rv}
                      renameRoom={renameRoom}
                      updateRoomCapacity={updateRoomCapacity}
                      updateRoomType={updateRoomType}
                      removeRoom={removeRoom}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timeslots */}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-2">
              <button
                type="button"
                id="config-timeslots-toggle"
                aria-expanded={timeslotsOpen}
                aria-controls="config-timeslots-body"
                onClick={() => setTimeslotsOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/80"
              >
                <span
                  className="shrink-0 text-sm tabular-nums text-muted-foreground"
                  aria-hidden
                >
                  {timeslotsOpen ? "▾" : "▸"}
                </span>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Timeslots ({timeslotsList.length})
                </h4>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeslotsOpen(true);
                  addTimeslot();
                }}
                className="flex shrink-0 items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                + Add Timeslot
              </button>
            </div>
            {timeslotsOpen && (
              <div id="config-timeslots-body">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted border-b border-border text-left">
                        <th className="px-2 py-2 font-semibold text-muted-foreground">ID</th>
                        <th className="px-2 py-2 font-semibold text-muted-foreground">Code</th>
                        <th className="px-2 py-2 font-semibold text-muted-foreground">Label</th>
                        <th className="px-2 py-2 font-semibold text-muted-foreground">Days</th>
                        <th className="px-2 py-2 font-semibold text-muted-foreground">Start (h)</th>
                        <th className="px-2 py-2 font-semibold text-muted-foreground">Duration (h)</th>
                        <th className="px-2 py-2 font-semibold text-muted-foreground">Engine slot_type</th>
                        <th className="px-2 py-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeslotsList.map((ts) => (
                        <tr key={ts.id} className="border-b border-border/60">
                          <td className="px-2 py-1.5 font-mono text-foreground/90">{ts.id}</td>
                          <td className="px-2 py-1.5">
                            <input
                              value={ts.short_code ?? ""}
                              placeholder="T1"
                              onChange={(e) =>
                                updateTimeslotRow(ts.id, {
                                  short_code:
                                    e.target.value.trim() === ""
                                      ? undefined
                                      : e.target.value.trim(),
                                })
                              }
                              className="w-14 rounded border border-border px-1 py-0.5 font-mono text-center"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={ts.label ?? ""}
                              placeholder={timeslotScheduleLabel(ts)}
                              onChange={(e) =>
                                updateTimeslotRow(ts.id, {
                                  label:
                                    e.target.value.trim() === ""
                                      ? undefined
                                      : e.target.value,
                                })
                              }
                              className="w-full min-w-[8rem] rounded border border-border px-1 py-0.5"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={(ts.days || []).join(", ")}
                              onChange={(e) =>
                                updateTimeslotRow(ts.id, {
                                  days: e.target.value
                                    .split(",")
                                    .map((d) => d.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full min-w-[10rem] rounded border border-border px-1 py-0.5"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step={0.5}
                              value={ts.start_hour ?? 8}
                              onChange={(e) =>
                                updateTimeslotRow(ts.id, {
                                  start_hour: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-16 rounded border border-border px-1 py-0.5"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step={0.5}
                              value={ts.duration ?? 1.5}
                              onChange={(e) =>
                                updateTimeslotRow(ts.id, {
                                  duration: parseFloat(e.target.value) || 1,
                                })
                              }
                              className="w-16 rounded border border-border px-1 py-0.5"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={ts.slot_type ?? "lecture_mw"}
                              onChange={(e) =>
                                updateTimeslotRow(ts.id, { slot_type: e.target.value })
                              }
                              className="max-w-[9rem] rounded border border-border px-1 py-0.5 bg-card"
                            >
                              {ENGINE_SLOT_TYPES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              onClick={() => removeTimeslot(ts.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 px-2 pb-2 text-xs text-muted-foreground">
                  Lab rows should use <span className="font-mono">slot_type = lab</span> and{" "}
                  <span className="font-mono">duration = 3</span> for a three-hour block. The optimiser
                  matches these to course <span className="font-mono">session_type</span>.
                </p>
              </div>
            )}
          </div>

          {/* Lecturers & Preferences */}
          <div className="rounded-md border border-border overflow-hidden">
            <button
              type="button"
              id="config-lecturer-prefs-toggle"
              aria-expanded={lecturerPrefsOpen}
              aria-controls="config-lecturer-prefs-body"
              onClick={() => setLecturerPrefsOpen((o) => !o)}
              className="flex w-full items-center gap-2 border-b border-border bg-muted/40 px-2 py-2 text-left transition-colors hover:bg-muted/80"
            >
              <span
                className="shrink-0 text-sm tabular-nums text-muted-foreground"
                aria-hidden
              >
                {lecturerPrefsOpen ? "▾" : "▸"}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Lecturer Preferences
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose a lecturer, then add preferred or unpreferred timeslots.
                </p>
              </div>
            </button>
            {lecturerPrefsOpen && (
              <div id="config-lecturer-prefs-body" className="space-y-3 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="config-prefs-lecturer-select"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Lecturer
                    </label>
                    <select
                      id="config-prefs-lecturer-select"
                      className="mt-1 w-full max-w-md rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm"
                      value={prefsLecturer}
                      onChange={(e) => setPrefsLecturer(e.target.value)}
                    >
                      <option value="">Select a lecturer…</option>
                      {displayConfig.lecturers.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {prefsLecturer ? (
                  (() => {
                    const name = prefsLecturer;
                    const color = getLecturerColor(name);
                    const prefs = displayConfig.lecturer_preferences[name] ?? {
                      preferred: [],
                      unpreferred: [],
                    };
                    const prefId = "lecturer-pref-add-active";
                    const unprefId = "lecturer-unpref-add-active";
                    const prefLabel = (id: string) => {
                      const ts = timeslotsList.find((t) => t.id === id);
                      return ts ? timeslotScheduleLabel(ts) : id;
                    };
                    return (
                      <div
                        className={`rounded-lg border p-4 ${color.bg} ${color.border}`}
                      >
                        <div className={`mb-3 text-sm font-semibold ${color.text}`}>
                          {name}
                        </div>
                        <p className="mb-3 text-xs text-muted-foreground">
                          Add slots from each dropdown; chips show current choices — click ×
                          to remove.
                        </p>
                        <div className="space-y-4">
                          <div>
                            <label
                              htmlFor={prefId}
                              className="text-xs font-medium text-green-700"
                            >
                              Preferred{" "}
                              <span className="font-normal text-muted-foreground">
                                ({prefs.preferred.length})
                              </span>
                            </label>
                            <select
                              id={prefId}
                              className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground shadow-sm"
                              value={prefAddSelect[name] ?? ""}
                              onChange={(e) => {
                                const tsId = e.target.value;
                                if (!tsId) return;
                                const blockedByUnpref =
                                  prefs.unpreferred.includes(tsId) &&
                                  !prefs.preferred.includes(tsId);
                                if (blockedByUnpref) {
                                  setPrefAddSelect((s) => ({ ...s, [name]: "" }));
                                  return;
                                }
                                if (prefs.preferred.includes(tsId)) {
                                  setPrefAddSelect((s) => ({ ...s, [name]: "" }));
                                  return;
                                }
                                patchLecturerPrefs(name, {
                                  preferred: [...prefs.preferred, tsId],
                                  unpreferred: prefs.unpreferred.filter(
                                    (t) => t !== tsId,
                                  ),
                                });
                                setPrefAddSelect((s) => ({ ...s, [name]: "" }));
                              }}
                            >
                              <option value="">Add preferred slot…</option>
                              {timeslotsList.map((ts) => {
                                const isSelected = prefs.preferred.includes(ts.id);
                                const blockedByUnpref =
                                  prefs.unpreferred.includes(ts.id) &&
                                  !isSelected;
                                if (isSelected) return null;
                                const short = timeslotScheduleLabel(ts);
                                const hint = ts.short_code
                                  ? `${ts.short_code} · ${ts.id}`
                                  : ts.id;
                                return (
                                  <option
                                    key={ts.id}
                                    value={ts.id}
                                    disabled={blockedByUnpref}
                                    title={hint}
                                  >
                                    {short}
                                    {blockedByUnpref
                                      ? " (in unpreferred — remove there first)"
                                      : ""}
                                  </option>
                                );
                              })}
                            </select>
                            <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border border-border/80 bg-card/90 p-2">
                              {prefs.preferred.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  No preferred slots
                                </span>
                              ) : (
                                prefs.preferred.map((id) => (
                                  <Tooltip key={id}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateLecturerPref(
                                            name,
                                            "preferred",
                                            prefs.preferred.filter((t) => t !== id),
                                          )
                                        }
                                        className="inline-flex max-w-full items-center gap-1 rounded border border-green-700 bg-green-600 px-2 py-0.5 text-left text-xs font-medium text-white shadow-sm hover:bg-green-700"
                                      >
                                        <span className="min-w-0 truncate">{prefLabel(id)}</span>
                                        <span className="shrink-0 opacity-90" aria-hidden>
                                          ×
                                        </span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Remove from preferred</TooltipContent>
                                  </Tooltip>
                                ))
                              )}
                            </div>
                          </div>
                          <div>
                            <label
                              htmlFor={unprefId}
                              className="text-xs font-medium text-red-600"
                            >
                              Unpreferred{" "}
                              <span className="font-normal text-muted-foreground">
                                ({prefs.unpreferred.length})
                              </span>
                            </label>
                            <select
                              id={unprefId}
                              className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground shadow-sm"
                              value={unprefAddSelect[name] ?? ""}
                              onChange={(e) => {
                                const tsId = e.target.value;
                                if (!tsId) return;
                                if (prefs.unpreferred.includes(tsId)) {
                                  setUnprefAddSelect((s) => ({ ...s, [name]: "" }));
                                  return;
                                }
                                updateLecturerPref(name, "unpreferred", [
                                  ...prefs.unpreferred,
                                  tsId,
                                ]);
                                setUnprefAddSelect((s) => ({ ...s, [name]: "" }));
                              }}
                            >
                              <option value="">Add unpreferred slot…</option>
                              {timeslotsList.map((ts) => {
                                if (prefs.unpreferred.includes(ts.id)) return null;
                                const short = timeslotScheduleLabel(ts);
                                const hint = ts.short_code
                                  ? `${ts.short_code} · ${ts.id}`
                                  : ts.id;
                                return (
                                  <option key={ts.id} value={ts.id} title={hint}>
                                    {short}
                                  </option>
                                );
                              })}
                            </select>
                            <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border border-border/80 bg-card/90 p-2">
                              {prefs.unpreferred.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  No unpreferred slots
                                </span>
                              ) : (
                                prefs.unpreferred.map((id) => (
                                  <Tooltip key={id}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateLecturerPref(
                                            name,
                                            "unpreferred",
                                            prefs.unpreferred.filter((t) => t !== id),
                                          )
                                        }
                                        className="inline-flex max-w-full items-center gap-1 rounded border border-red-700 bg-red-600 px-2 py-0.5 text-left text-xs font-medium text-white shadow-sm hover:bg-red-700"
                                      >
                                        <span className="min-w-0 truncate">{prefLabel(id)}</span>
                                        <span className="shrink-0 opacity-90" aria-hidden>
                                          ×
                                        </span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Remove from unpreferred</TooltipContent>
                                  </Tooltip>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="rounded-md border border-dashed border-border bg-muted/40/80 px-3 py-6 text-center text-sm text-muted-foreground">
                    Select a lecturer above to edit their preferred and unpreferred
                    timeslots.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* GWO Parameters */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              GWO Algorithm Parameters
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { key: "num_wolves", label: "Wolves", desc: "Population size" },
                {
                  key: "num_iterations",
                  label: "Iterations",
                  desc: "Max generations",
                },
                { key: "num_runs", label: "Runs", desc: "Independent runs" },
                {
                  key: "mutation_rate",
                  label: "Mutation Rate",
                  desc: "0.0 - 1.0",
                  step: 0.1,
                },
                {
                  key: "stagnation_limit",
                  label: "Stagnation",
                  desc: "Before restart",
                },
                {
                  key: "perfect_threshold",
                  label: "Perfect Thresh",
                  desc: "Near-zero target",
                  step: 0.000001,
                },
              ].map(({ key, label, desc, step }) => (
                <div
                  key={key}
                  className="rounded-md border border-border bg-muted/40 p-3"
                >
                  <label className="text-xs font-semibold text-foreground/80">
                    {label}
                  </label>
                  <input
                    type="number"
                    step={step ?? 1}
                    value={
                      (displayConfig.gwo_params as Record<string, number>)[key]
                    }
                    onChange={(e) =>
                      updateGWOParam(key, parseFloat(e.target.value) || 0)
                    }
                    className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                  />
                  <div className="text-xs text-muted-foreground/80 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Soft Constraint Weights */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Soft Constraint Weights
                </h4>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  0 = disabled · 100 = maximum influence on optimization
                </p>
              </div>
              <button
                onClick={() => {
                  const cfg = localConfig ?? config;
                  const defaultWeights = {
                    preferred_timeslot: 80,
                    unpreferred_timeslot: 70,
                    minimize_gaps: 60,
                    room_utilization: 90,
                    balanced_workload: 50,
                    distribute_classes: 65,
                    student_gaps: 70,
                    single_session_day: 50,
                  };
                  setLocalConfig({ ...cfg, soft_weights: defaultWeights });
                }}
                className="rounded bg-muted px-2 py-1 text-xs font-medium text-foreground/80 hover:bg-muted/80 transition-colors"
                type="button"
              >
                Reset weights
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  key: "preferred_timeslot",
                  label: "Preferred timeslot",
                  desc: "Reward assigning lecturers to preferred slots",
                  trackTint: "bg-emerald-100/80 dark:bg-emerald-900/35",
                  tickColor: "text-emerald-700",
                  tickMuted: "text-emerald-400/90",
                  labelTint: "text-emerald-950 dark:text-emerald-100",
                  descTint: "text-emerald-950/65 dark:text-emerald-200/80",
                  accentHex: "#059669",
                  frameBorder:
                    "border border-emerald-200 dark:border-emerald-700/60 border-l-4 border-l-emerald-600",
                  inputBorder: "border-emerald-200 dark:border-emerald-700/60",
                  focusRing: "focus:ring-emerald-500/90",
                  cardFocusRing: "focus-within:ring-emerald-300/55",
                  cardWash: "bg-gradient-to-br from-card to-emerald-50/50 dark:to-emerald-950/30",
                },
                {
                  key: "unpreferred_timeslot",
                  label: "Unpreferred timeslot",
                  desc: "Penalize scheduling in avoided slots",
                  trackTint: "bg-rose-100/80 dark:bg-rose-900/35",
                  tickColor: "text-rose-700",
                  tickMuted: "text-rose-400/90",
                  labelTint: "text-rose-950 dark:text-rose-100",
                  descTint: "text-rose-950/65 dark:text-rose-200/80",
                  accentHex: "#e11d48",
                  frameBorder:
                    "border border-rose-200 dark:border-rose-700/60 border-l-4 border-l-rose-600",
                  inputBorder: "border-rose-200 dark:border-rose-700/60",
                  focusRing: "focus:ring-rose-500/90",
                  cardFocusRing: "focus-within:ring-rose-300/55",
                  cardWash: "bg-gradient-to-br from-card to-rose-50/50 dark:to-rose-950/30",
                },
                {
                  key: "minimize_gaps",
                  label: "Minimize gaps",
                  desc: "Penalize idle time between a lecturer's classes",
                  trackTint: "bg-amber-100/80 dark:bg-amber-900/40",
                  tickColor: "text-amber-800",
                  tickMuted: "text-amber-500/85",
                  labelTint: "text-amber-950 dark:text-amber-100",
                  descTint: "text-amber-950/65 dark:text-amber-200/80",
                  accentHex: "#d97706",
                  frameBorder:
                    "border border-amber-200 dark:border-amber-700/60 border-l-4 border-l-amber-600",
                  inputBorder: "border-amber-200 dark:border-amber-700/60",
                  focusRing: "focus:ring-amber-500/90",
                  cardFocusRing: "focus-within:ring-amber-300/55",
                  cardWash: "bg-gradient-to-br from-card to-amber-50/50 dark:to-amber-950/30",
                },
                {
                  key: "room_utilization",
                  label: "Room utilization",
                  desc: "Penalize oversized room assignments",
                  trackTint: "bg-blue-100/80 dark:bg-blue-900/35",
                  tickColor: "text-blue-700",
                  tickMuted: "text-blue-400/90",
                  labelTint: "text-blue-950 dark:text-blue-100",
                  descTint: "text-blue-950/65 dark:text-blue-200/80",
                  accentHex: "#2563eb",
                  frameBorder:
                    "border border-blue-200 dark:border-blue-700/60 border-l-4 border-l-blue-600",
                  inputBorder: "border-blue-200 dark:border-blue-700/60",
                  focusRing: "focus:ring-blue-500/90",
                  cardFocusRing: "focus-within:ring-blue-300/55",
                  cardWash: "bg-gradient-to-br from-card to-blue-50/50 dark:to-blue-950/30",
                },
                {
                  key: "balanced_workload",
                  label: "Balanced workload",
                  desc: "Penalize uneven class loads across lecturers",
                  trackTint: "bg-violet-100/80 dark:bg-violet-900/35",
                  tickColor: "text-violet-700",
                  tickMuted: "text-violet-400/90",
                  labelTint: "text-violet-950 dark:text-violet-100",
                  descTint: "text-violet-950/65 dark:text-violet-200/80",
                  accentHex: "#7c3aed",
                  frameBorder:
                    "border border-violet-200 dark:border-violet-700/60 border-l-4 border-l-violet-600",
                  inputBorder: "border-violet-200 dark:border-violet-700/60",
                  focusRing: "focus:ring-violet-500/90",
                  cardFocusRing: "focus-within:ring-violet-300/55",
                  cardWash: "bg-gradient-to-br from-card to-violet-50/50 dark:to-violet-950/30",
                },
                {
                  key: "distribute_classes",
                  label: "Distribute classes",
                  desc: "Spread lectures evenly across timeslots",
                  trackTint: "bg-cyan-100/80 dark:bg-cyan-900/35",
                  tickColor: "text-cyan-800",
                  tickMuted: "text-cyan-500/85",
                  labelTint: "text-cyan-950 dark:text-cyan-100",
                  descTint: "text-cyan-950/65 dark:text-cyan-200/80",
                  accentHex: "#0891b2",
                  frameBorder:
                    "border border-cyan-200 dark:border-cyan-700/60 border-l-4 border-l-cyan-600",
                  inputBorder: "border-cyan-200 dark:border-cyan-700/60",
                  focusRing: "focus:ring-cyan-500/90",
                  cardFocusRing: "focus-within:ring-cyan-300/55",
                  cardWash: "bg-gradient-to-br from-card to-cyan-50/50 dark:to-cyan-950/30",
                },
                {
                  key: "student_gaps",
                  label: "Student gaps",
                  desc: "Penalize idle gaps between a student's lectures in a day",
                  trackTint: "bg-orange-100/80 dark:bg-orange-900/35",
                  tickColor: "text-orange-800",
                  tickMuted: "text-orange-500/85",
                  labelTint: "text-orange-950 dark:text-orange-100",
                  descTint: "text-orange-950/65 dark:text-orange-200/80",
                  accentHex: "#ea580c",
                  frameBorder:
                    "border border-orange-200 dark:border-orange-700/60 border-l-4 border-l-orange-600",
                  inputBorder: "border-orange-200 dark:border-orange-700/60",
                  focusRing: "focus:ring-orange-500/90",
                  cardFocusRing: "focus-within:ring-orange-300/55",
                  cardWash: "bg-gradient-to-br from-card to-orange-50/50 dark:to-orange-950/30",
                },
                {
                  key: "single_session_day",
                  label: "Single-session day",
                  desc: "Penalize units with only one session on a day — poor commute vs. class time",
                  trackTint: "bg-pink-100/80 dark:bg-pink-900/35",
                  tickColor: "text-pink-700",
                  tickMuted: "text-pink-400/90",
                  labelTint: "text-pink-950 dark:text-pink-100",
                  descTint: "text-pink-950/65 dark:text-pink-200/80",
                  accentHex: "#db2777",
                  frameBorder:
                    "border border-pink-200 dark:border-pink-700/60 border-l-4 border-l-pink-600",
                  inputBorder: "border-pink-200 dark:border-pink-700/60",
                  focusRing: "focus:ring-pink-500/90",
                  cardFocusRing: "focus-within:ring-pink-300/55",
                  cardWash: "bg-gradient-to-br from-card to-pink-50/50 dark:to-pink-950/30",
                },
              ].map(
                ({
                  key,
                  label,
                  desc,
                  trackTint,
                  tickColor,
                  tickMuted,
                  labelTint,
                  descTint,
                  accentHex,
                  frameBorder,
                  inputBorder,
                  focusRing,
                  cardFocusRing,
                  cardWash,
                }) => {
                const weights = displayConfig.soft_weights ?? {
                  preferred_timeslot: 80,
                  unpreferred_timeslot: 70,
                  minimize_gaps: 60,
                  room_utilization: 90,
                  balanced_workload: 50,
                  distribute_classes: 65,
                  student_gaps: 70,
                  single_session_day: 50,
                };
                const rawVal = (weights as Record<string, number>)[key] ?? 0;
                const val = Math.min(100, Math.max(0, rawVal));
                return (
                  <div
                    key={key}
                    className={`rounded-lg p-4 pl-3 shadow-sm ring-2 ring-transparent transition-shadow focus-within:shadow-md ${frameBorder} ${cardWash} ${cardFocusRing}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`text-xs font-semibold ${labelTint}`}
                      >
                        {label}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={val}
                        onChange={(e) => {
                          const n = Math.min(
                            100,
                            Math.max(0, parseInt(e.target.value) || 0),
                          );
                          updateSoftWeight(key, n);
                        }}
                        className={`w-14 shrink-0 rounded-md border bg-card/95 px-2 py-0.5 text-sm text-center font-mono font-bold text-foreground/90 tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${inputBorder} ${focusRing}`}
                      />
                    </div>
                    {/* Slider: fill ends at thumb center (1rem thumb in globals.css) */}
                    <div
                      className="relative mt-1 flex h-5 w-full items-center"
                      style={
                        { "--soft-weight-thumb": accentHex } as CSSProperties
                      }
                    >
                      <div
                        className={`pointer-events-none absolute inset-x-0 top-1/2 z-[1] h-1.5 -translate-y-1/2 rounded-full ${trackTint}`}
                      />
                      {Array.from({ length: 11 }, (_, i) => i * 10).map((pct) => (
                        <div
                          key={pct}
                          aria-hidden
                          className="pointer-events-none absolute top-1/2 z-[2] h-1.5 w-px -translate-x-1/2 -translate-y-1/2 bg-muted-foreground/55"
                          style={{ left: softWeightTickLeft(pct) }}
                        />
                      ))}
                      <div
                        className={`pointer-events-none absolute left-0 top-1/2 z-[3] h-1.5 max-w-full -translate-y-1/2 bg-gradient-to-r from-[#00a5f4] via-blue-500 to-blue-800 ${
                          val >= 100 ? "rounded-full" : "rounded-l-full"
                        }`}
                        style={{ width: softWeightFillWidthToThumbCenter(val) }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={val}
                        onChange={(e) =>
                          updateSoftWeight(key, parseInt(e.target.value))
                        }
                        className="soft-weight-range relative z-10 w-full"
                      />
                    </div>
                    {/* Scale labels aligned to thumb travel (inset by half thumb width) */}
                    <div className="relative mt-2 h-4 w-full">
                      {[0, 25, 50, 75, 100].map((tick) => {
                        const pos = softWeightTickLeft(tick);
                        const tf = "translateX(-50%)";
                        return (
                          <span
                            key={tick}
                            className={`absolute top-0 text-[11px] font-mono tabular-nums leading-none ${
                              val >= tick ? tickColor : tickMuted
                            }`}
                            style={{ left: pos, transform: tf }}
                          >
                            {tick}
                          </span>
                        );
                      })}
                    </div>
                    <p
                      className={`text-xs mt-3 leading-relaxed ${descTint}`}
                    >
                      {desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lectures / Courses */}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-2">
              <button
                type="button"
                id="config-courses-toggle"
                aria-expanded={coursesOpen}
                aria-controls="config-courses-body"
                onClick={() => setCoursesOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/80"
              >
                <span
                  className="shrink-0 text-sm tabular-nums text-muted-foreground"
                  aria-hidden
                >
                  {coursesOpen ? "▾" : "▸"}
                </span>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Courses ({displayConfig.lectures.length})
                </h4>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCoursesOpen(true);
                  addCourse();
                }}
                className="flex shrink-0 items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                + Add Course
              </button>
            </div>
            {coursesOpen && (
              <div id="config-courses-body" className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="px-3 py-2 text-left font-semibold text-foreground/80">
                        Course code
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-foreground/80">
                        Delivery
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-foreground/80">
                        Session
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-foreground/80">
                        Size
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-foreground/80">
                        Allowed lecturers
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-foreground/80 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayConfig.lectures.map((lec) => (
                      <tr key={lec.id} className="border-b border-border/60">
                        <td className="px-3 py-2">
                          <input
                            value={lec.course}
                            onChange={(e) =>
                              updateLectureField(lec.id, "course", e.target.value)
                            }
                            className="w-full min-w-[6rem] font-mono font-medium text-foreground/90 rounded border border-border px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={lec.delivery_mode ?? "inperson"}
                            onChange={(e) =>
                              updateLectureField(
                                lec.id,
                                "delivery_mode",
                                e.target.value,
                              )
                            }
                            className="rounded border border-border px-2 py-1 text-xs bg-card"
                          >
                            <option value="inperson">In-person</option>
                            <option value="online">Online</option>
                            <option value="blended">Blended</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={lec.session_type ?? "lecture"}
                            onChange={(e) =>
                              updateLectureField(
                                lec.id,
                                "session_type",
                                e.target.value,
                              )
                            }
                            className="rounded border border-border px-2 py-1 text-xs bg-card"
                          >
                            <option value="lecture">Lecture</option>
                            <option value="lab">Lab (3 h block)</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            value={lec.size}
                            onChange={(e) =>
                              updateLectureField(
                                lec.id,
                                "size",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-16 rounded border border-border px-2 py-1 text-sm text-center"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {displayConfig.lecturers.map((name, idx) => {
                              const isAllowed =
                                lec.allowed_lecturers.includes(idx);
                              const color = getLecturerColor(name);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    const newAllowed = isAllowed
                                      ? lec.allowed_lecturers.filter(
                                          (i) => i !== idx,
                                        )
                                      : [...lec.allowed_lecturers, idx];
                                    updateLectureField(
                                      lec.id,
                                      "allowed_lecturers",
                                      newAllowed,
                                    );
                                  }}
                                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors border ${
                                    isAllowed
                                      ? `${color.bg} ${color.text} ${color.border}`
                                      : "bg-muted text-muted-foreground/80 border-border"
                                  }`}
                                >
                                  {name}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => removeCourse(lec.id)}
                                className="text-xs font-medium text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Remove course</TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
            <div className="text-sm text-blue-800">
              The Python script reads from{" "}
              <code className="bg-blue-100 px-1 rounded">data/config.json</code>
              .
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
