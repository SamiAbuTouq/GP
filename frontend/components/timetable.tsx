"use client";

import useSWR from "swr";
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TimetableGridSectionDialog } from "@/components/timetable-grid-section-dialog";
import { TimetableGridAddSectionDialog } from "@/components/timetable-grid-add-section-dialog";
import { validateScheduleHardConstraints } from "@/lib/schedule-hard-constraints";
import { mergeEntryWithPlacement } from "@/lib/schedule-edit-rules";
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
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
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
  const { data, error, isLoading, mutate } = useSWR<SchedulePayload>(
    "/api/schedule",
    jsonFetcher,
    { refreshInterval: 3000, dedupingInterval: 0 },
  );
  return { data, error, isLoading, refresh: mutate };
}

function useConfig() {
  const { data, error, isLoading, mutate } = useSWR<ScheduleConfig>(
    "/api/config",
    jsonFetcher,
    { dedupingInterval: 0 },
  );
  return { config: data, error, isLoading, refresh: mutate };
}

export function RefreshButton() {
  const { isRunning, runOptimizer } = useGwoRun();
  const [error, setError] = useState<string | null>(null);

  const handleRunAlgorithm = async () => {
    setError(null);
    console.log("[v0] Calling /api/run endpoint (SSE)");
    const errMsg = await runOptimizer();
    if (errMsg) setError(errMsg);
  };

  return (
    <div className="flex flex-col items-end gap-2 w-full max-w-md">
      <button
        onClick={handleRunAlgorithm}
        disabled={isRunning}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isRunning ? "Optimizer running…" : "Run Algorithm"}
      </button>
      {error && (
        <div className="text-xs text-red-600 max-w-md text-right whitespace-pre-wrap font-mono bg-red-50 p-2 rounded border border-red-200">
          {error}
        </div>
      )}
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

export function ConflictAlert() {
  const { data, isLoading } = useSchedule();
  const entries = data?.schedule ?? [];
  const catalogue = data?.timeslots_catalogue ?? [];
  const wrongSlots = data?.wrong_slot_type_violations ?? [];
  const unitConflicts: UnitConflictViolation[] = data?.unit_conflict_violations ?? [];
  const { conflicts, conflictIds } = buildUiConflicts(entries, catalogue);

  const hasIssues =
    !isLoading && (wrongSlots.length > 0 || conflicts.length > 0 || unitConflicts.length > 0);
  if (!hasIssues) return null;

  const roomConflicts = conflicts.filter((c) => c.type === "room");
  const lecturerConflicts = conflicts.filter((c) => c.type === "lecturer");
  const totalCount = wrongSlots.length + conflicts.length + unitConflicts.length;

  return (
    <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
      <h3 className="font-semibold text-red-900 mb-3">
        Validation · {totalCount} issue{totalCount > 1 ? "s" : ""}
      </h3>
      <div className="space-y-4 text-sm">
        {wrongSlots.length > 0 && (
          <div>
            <h4 className="mb-2 font-medium text-red-900">
              Wrong timeslot type (session / delivery rules)
            </h4>
            <ul className="space-y-1.5 text-red-800">
              {wrongSlots.map((w, idx) => (
                <li key={idx} className="rounded border border-red-200 bg-white/80 px-3 py-2">
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
        {unitConflicts.length > 0 && (
          <div>
            <h4 className="mb-2 font-medium text-red-900">
              Unit conflicts — students cannot attend both sessions
            </h4>
            <ul className="space-y-1.5 text-red-800">
              {unitConflicts.map((uc, idx) => (
                <li key={idx} className="rounded border border-red-200 bg-white/80 px-3 py-2">
                  <span className="rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700 mr-2">
                    {uc.unit}
                  </span>
                  <span className="font-mono font-semibold">{uc.course_a}</span>
                  {" & "}
                  <span className="font-mono font-semibold">{uc.course_b}</span>
                  {" overlap — "}
                  <span className="text-slate-600 text-xs">{uc.timeslot_a} / {uc.timeslot_b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {roomConflicts.length > 0 && (
          <div>
            <h4 className="mb-1 font-medium text-red-800">Room overlap</h4>
            <ul className="space-y-1 text-red-700">
              {roomConflicts.map((c, idx) => (
                <li key={idx}>
                  <strong>Room {c.detail}</strong> — {c.timeslot_label}:{" "}
                  {c.entries.map((e) => e.course_code).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
        {lecturerConflicts.length > 0 && (
          <div>
            <h4 className="mb-1 font-medium text-orange-900">Lecturer overlap</h4>
            <ul className="space-y-1 text-orange-800">
              {lecturerConflicts.map((c, idx) => (
                <li key={idx}>
                  <strong>{c.detail}</strong> — {c.timeslot_label}:{" "}
                  {c.entries.map((e) => e.course_code).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {conflictIds.size > 0 && (
        <p className="mt-3 text-xs text-red-700">
          Overlapping entries are highlighted in the timetable grid.
        </p>
      )}
    </div>
  );
}

// ─── SoftConstraintPanel ──────────────────────────────────────────────────────

export function SoftConstraintPanel() {
  const { data, isLoading } = useSchedule();
  const warnings = data?.preference_warnings ?? [];
  const catalogue = data?.timeslots_catalogue ?? [];
  const studentGapWarnings: StudentGapWarning[] = data?.student_gap_warnings ?? [];
  const earlyDayWarnings: SingleSessionDayWarning[] =
    data?.single_session_day_warnings ?? [];
  const [open, setOpen] = useState(false);

  if (isLoading) return null;

  const hasWarnings = warnings.length > 0;
  const hasStudentGaps = studentGapWarnings.length > 0;
  const hasEarlyDays = earlyDayWarnings.length > 0;

  if (!hasWarnings && !hasStudentGaps && !hasEarlyDays) return null;

  const totalWarnings = warnings.length + studentGapWarnings.length + earlyDayWarnings.length;

  const slotLabel = (id: string) => timeslotHeaderLabel(id, catalogue, []);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-900">
            Soft constraint warnings
          </span>
          {totalWarnings > 0 && (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
              {totalWarnings} warning{totalWarnings > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-amber-800 text-sm tabular-nums" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {hasWarnings && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">
                Preference notes ({warnings.length})
              </h4>
              <div className="space-y-1.5">
                {warnings.map((w, idx) => {
                  const color = getLecturerColor(w.lecturer);
                  const isUnpref = w.severity === "unpreferred";
                  return (
                    <div
                      key={idx}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        isUnpref
                          ? "border-red-200 bg-white"
                          : "border-amber-200 bg-white"
                      }`}
                    >
                      <span className={`font-semibold ${color.text}`}>
                        {w.lecturer}
                      </span>{" "}
                      ·{" "}
                      <span className="font-mono text-slate-800">{w.course}</span>{" "}
                      ·{" "}
                      <span className="text-slate-800">{slotLabel(w.timeslot)}</span>
                      <div className="text-slate-500 text-xs mt-0.5">{w.reason}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasStudentGaps && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">
                Student gap warnings — idle time between sessions ({studentGapWarnings.length})
              </h4>
              <div className="space-y-1.5">
                {studentGapWarnings.map((g, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800 mr-2">
                      {g.unit}
                    </span>
                    <span className="text-slate-800">{g.day}</span>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {g.gap_hours}h idle time between sessions on this day
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasEarlyDays && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">
                Early day warnings — single session day ({earlyDayWarnings.length})
              </h4>
              <div className="space-y-1.5">
                {earlyDayWarnings.map((e, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800 mr-2">
                      {e.unit}
                    </span>
                    <span className="font-mono text-slate-800">{e.course}</span>
                    <div className="text-slate-500 text-xs mt-0.5">{e.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasWarnings && !hasStudentGaps && !hasEarlyDays && (
            <div className="text-sm text-green-700">
              No soft-constraint warnings for this run.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SoftConstraintMetricsPanel ───────────────────────────────────────────────

function softMetricStatusFillPct(status: "good" | "warn" | "bad"): number {
  switch (status) {
    case "good":
      return 100;
    case "warn":
      return 56;
    case "bad":
      return 30;
    default:
      return 0;
  }
}

export function SoftConstraintMetricsPanel({
  embedded = false,
}: {
  /** When true, section is always expanded with a simpler heading (e.g. inside Constraints tab). */
  embedded?: boolean;
} = {}) {
  const { data, isLoading } = useSchedule();
  const [open, setOpen] = useState(embedded);
  const [openMetricSections, setOpenMetricSections] = useState({
    gaps: false,
    roomUtil: false,
    workload: false,
  });

  if (isLoading || !data) return null;

  const meta = data.metadata;
  const softWeights = data.soft_weights ?? meta.soft_weights;
  const gapWarnings = data.gap_warnings ?? [];
  const utilizationInfo = data.utilization_info ?? [];
  const workloadInfo = data.workload_info ?? [];
  const distributionInfo = data.distribution_info ?? [];
  const catalogue = data.timeslots_catalogue ?? [];

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

  const roomUtilShell: "green" | "amber" | "red" =
    timetableSeatUtilizationPct >= 80
      ? "green"
      : timetableSeatUtilizationPct >= 60
        ? "amber"
        : "red";
  const roomUtilStatus: "good" | "warn" | "bad" =
    timetableSeatUtilizationPct >= 80
      ? "good"
      : timetableSeatUtilizationPct >= 60
        ? "warn"
        : "bad";

  const metrics: {
    key: string;
    label: string;
    /** Pastel shell + border hue (single border, no contrasting accent stripe) */
    shell: "green" | "amber" | "red";
    weight: number;
    value: string;
    status: "good" | "warn" | "bad";
  }[] = [
    {
      key: "preferred_timeslot",
      label: "Preferred timeslot",
      shell: "green",
      weight: softWeights.preferred_timeslot,
      value: `${notPrefCount} not-in-preferred`,
      status: notPrefCount === 0 ? "good" : "warn",
    },
    {
      key: "unpreferred_timeslot",
      label: "Unpreferred timeslot",
      shell: "green",
      weight: softWeights.unpreferred_timeslot,
      value: `${unprefCount} in avoided slot`,
      status: unprefCount === 0 ? "good" : "warn",
    },
    {
      key: "minimize_gaps",
      label: "Minimize gaps",
      shell: "amber",
      weight: softWeights.minimize_gaps,
      value: `${gapWarnings.length} gaps`,
      status: gapWarnings.length === 0 ? "good" : "warn",
    },
    {
      key: "room_utilization",
      label: "Room seat fill",
      shell: roomUtilShell,
      weight: softWeights.room_utilization,
      value: `${timetableSeatUtilizationPct.toFixed(1)}% of catalog seat capacity used`,
      status: roomUtilStatus,
    },
    {
      key: "balanced_workload",
      label: "Balanced workload",
      shell: "red",
      weight: softWeights.balanced_workload,
      value: `σ = ${workloadStdDev.toFixed(2)}`,
      status:
        workloadStdDev < 0.5 ? "good" : workloadStdDev < 1 ? "warn" : "bad",
    },
    {
      key: "distribute_classes",
      label: "Distribute classes",
      shell: "amber",
      weight: softWeights.distribute_classes,
      value: `σ = ${distStdDev.toFixed(2)}`,
      status: distStdDev < 0.5 ? "good" : distStdDev < 1 ? "warn" : "bad",
    },
    {
      key: "student_gaps",
      label: "Student gaps",
      shell: "green",
      weight: softWeights.student_gaps ?? 70,
      value: `${studentGapWarnings.length} gap(s)`,
      status: studentGapWarnings.length === 0 ? "good" : "warn",
    },
    {
      key: "single_session_day",
      label: "Single-session day",
      shell: "green",
      weight: softWeights.single_session_day ?? 50,
      value: `${earlyDayWarnings.length} issue(s)`,
      status: earlyDayWarnings.length === 0 ? "good" : "warn",
    },
  ];

  const inner = (
        <div className="space-y-4 p-4 pt-0 sm:pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ key, label, shell, weight, value, status }) => {
              const shellStyles = {
                green: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white",
                amber: "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white",
                red: "border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white",
              };
              const statusTextColors = {
                good: "text-emerald-800",
                warn: "text-amber-800",
                bad: "text-rose-800",
              };
              const barGradient = {
                good: "from-emerald-500 via-teal-500 to-emerald-600",
                warn: "from-amber-400 via-orange-400 to-amber-600",
                bad: "from-rose-500 via-red-500 to-rose-700",
              };
              const statusLabel =
                status === "good" ? "On target" : status === "warn" ? "Watch" : "Attention";
              const fillPct = softMetricStatusFillPct(status);
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-4 shadow-sm ${shellStyles[shell]}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug text-slate-900">
                      {label}
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTextColors[status]} bg-white/70 ring-1 ring-slate-200/60`}
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
                    <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      <span>Outcome vs target</span>
                      <span className="tabular-nums text-slate-600">{fillPct}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90 ring-1 ring-inset ring-slate-300/40">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barGradient[status]} shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-[width] duration-500 ease-out`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-500">
                      <span>Objective weight</span>
                      <span className="tabular-nums font-semibold text-slate-700">
                        {weight}
                        <span className="font-normal text-slate-400">/100</span>
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-400/70 transition-[width] duration-300"
                        style={{ width: `${weight}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <button
              type="button"
              onClick={() => setOpenMetricSections((s) => ({ ...s, gaps: !s.gaps }))}
              className="mb-2 flex w-full items-center gap-2 text-left"
            >
              <h4 className="flex w-full items-center gap-2 flex-wrap text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Minimize gaps between classes</span>
              <span
                className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  gapWarnings.length === 0
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {gapWarnings.length === 0
                  ? "No gaps"
                  : `${gapWarnings.length} gap(s)`}
              </span>
                <span className="text-sm tabular-nums text-slate-500" aria-hidden>
                  {openMetricSections.gaps ? "▾" : "▸"}
                </span>
              </h4>
            </button>
            {openMetricSections.gaps ? gapWarnings.length > 0 ? (
              <div className="space-y-1.5">
                {gapWarnings.map((g, idx) => {
                  const color = getLecturerColor(g.lecturer);
                  const gh = g.gap_hours ?? g.gap ?? 0;
                  const betweenText = injectTimeslotIdsWithLabels(
                    g.between,
                    catalogue,
                  );
                  return (
                    <div
                      key={idx}
                      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-700"
                    >
                      <span className={`font-semibold ${color.text}`}>
                        {g.lecturer}
                      </span>
                      {" — "}
                      <span className="text-slate-600">
                        {gh}h idle between {betweenText}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-green-600">
                No inter-class gaps flagged for this schedule.
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <button
              type="button"
              onClick={() => setOpenMetricSections((s) => ({ ...s, roomUtil: !s.roomUtil }))}
              className="mb-2 flex w-full items-center gap-2 text-left"
            >
              <h4 className="flex w-full items-center gap-2 flex-wrap text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Room seat utilization (catalog)</span>
              <span
                className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  timetableSeatUtilizationPct >= 80
                    ? "bg-green-100 text-green-700"
                    : timetableSeatUtilizationPct >= 60
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {timetableSeatUtilizationPct.toFixed(1)}% used — higher is better
              </span>
                <span className="text-sm tabular-nums text-slate-500" aria-hidden>
                  {openMetricSections.roomUtil ? "▾" : "▸"}
                </span>
              </h4>
            </button>
            {openMetricSections.roomUtil ? (
              <>
            <p className="text-[11px] text-slate-500 mb-2">
              Across every compatible room×timeslot in the catalog: empty slots and
              oversized rooms count as unused capacity. The optimizer still minimizes a
              waste penalty internally; this percentage is 100% minus that waste share.
            </p>
            {utilizationInfo.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-1.5 px-2 font-semibold text-slate-600">
                        Room
                      </th>
                      <th className="text-left py-1.5 px-2 font-semibold text-slate-600">
                        Course
                      </th>
                      <th className="text-left py-1.5 px-2 font-semibold text-slate-600">
                        Timeslot
                      </th>
                      <th className="text-right py-1.5 px-2 font-semibold text-slate-600">
                        Capacity
                      </th>
                      <th className="text-right py-1.5 px-2 font-semibold text-slate-600">
                        Students
                      </th>
                      <th className="text-right py-1.5 px-2 font-semibold text-slate-600">
                        Seat fill
                      </th>
                      <th className="text-right py-1.5 px-2 font-semibold text-slate-600">
                        Unused seats
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {utilizationInfo
                      .slice()
                      .sort((a, b) =>
                        (b.wasted_seats ?? b.capacity - b.class_size) -
                        (a.wasted_seats ?? a.capacity - a.class_size),
                      )
                      .slice(0, 10)
                      .map((u, idx) => {
                        const wastedSeats =
                          u.wasted_seats ?? u.capacity - u.class_size;
                        const wastePct = u.waste_pct;
                        const seatFillPct = Math.max(0, 100 - wastePct);
                        const fillColor =
                          seatFillPct >= 80
                            ? "text-green-600"
                            : seatFillPct >= 50
                              ? "text-amber-600"
                              : "text-red-600";
                        const wasteColor =
                          wastePct < 20
                            ? "text-green-600"
                            : wastePct < 40
                              ? "text-amber-600"
                              : "text-red-600";
                        return (
                          <tr
                            key={idx}
                            className={`border-b border-slate-100 last:border-0 ${
                              u.is_empty ? "bg-slate-50/70" : ""
                            }`}
                          >
                            <td className="py-1.5 px-2 font-mono text-slate-700">
                              {u.room}
                            </td>
                            <td className="py-1.5 px-2 text-slate-700">
                              {u.is_empty ? (
                                <span className="text-xs rounded px-1.5 py-0.5 bg-slate-200 text-slate-500 font-medium">
                                  Empty slot
                                </span>
                              ) : (
                                u.course
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-slate-700 text-xs leading-snug">
                              <div>{timeslotHeaderLabel(u.timeslot, catalogue, [])}</div>
                              <div className="font-mono text-slate-400">{u.timeslot}</div>
                            </td>
                            <td className="py-1.5 px-2 text-right text-slate-600">
                              {u.capacity}
                            </td>
                            <td className="py-1.5 px-2 text-right text-slate-600">
                              {u.is_empty ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                u.class_size
                              )}
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-semibold tabular-nums ${fillColor}`}
                            >
                              {seatFillPct.toFixed(0)}%
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-semibold ${wasteColor}`}
                            >
                              {wastedSeats}
                              <span className="ml-1 text-xs font-normal opacity-70">
                                ({wastePct.toFixed(0)}% unused)
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {utilizationInfo.length > 10 && (
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Showing top 10 of {utilizationInfo.length} entries (sorted by wasted seats)
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No room utilization data available.
              </p>
            )}
              </>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <button
              type="button"
              onClick={() => setOpenMetricSections((s) => ({ ...s, workload: !s.workload }))}
              className="mb-2 flex w-full items-center gap-2 text-left"
            >
              <h4 className="flex w-full items-center gap-2 flex-wrap text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Lecturer workload distribution</span>
              <span
                className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  workloadStdDev < 0.5
                    ? "bg-green-100 text-green-700"
                    : workloadStdDev < 1
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {workloadStdDev < 0.5
                  ? "Balanced"
                  : workloadStdDev < 1
                    ? "Slightly uneven"
                    : "Unbalanced"}{" "}
                (std: {workloadStdDev.toFixed(2)})
              </span>
                <span className="text-sm tabular-nums text-slate-500" aria-hidden>
                  {openMetricSections.workload ? "▾" : "▸"}
                </span>
              </h4>
            </button>
            {openMetricSections.workload ? (
              <>
            {workloadInfo.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {workloadInfo.map((w) => {
                  const color = getLecturerColor(w.lecturer);
                  const deviation = w.classes - avgWorkload;
                  const deviationColor =
                    Math.abs(deviation) < 0.5
                      ? "text-green-600"
                      : Math.abs(deviation) < 1
                        ? "text-amber-600"
                        : "text-red-600";
                  return (
                    <div
                      key={w.lecturer}
                      className={`rounded-lg border px-3 py-2 ${color.bg} ${color.border}`}
                    >
                      <div className={`font-semibold text-sm ${color.text}`}>
                        {w.lecturer}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-700 text-sm">
                          {w.classes} classes
                        </span>
                        {deviation !== 0 && (
                          <span className={`text-xs ${deviationColor}`}>
                            ({deviation > 0 ? "+" : ""}
                            {deviation.toFixed(1)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No workload data available.
              </p>
            )}
            {workloadInfo.length > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                Average: {avgWorkload.toFixed(1)} classes per lecturer
              </p>
            )}
              </>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Class distribution across timeslots
              </h4>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  distStdDev < 0.5
                    ? "bg-emerald-50 text-emerald-700"
                    : distStdDev < 1
                      ? "bg-amber-100 text-orange-700"
                      : "bg-red-50 text-red-700"
                }`}
              >
                {distStdDev < 0.5
                  ? "Even"
                  : distStdDev < 1
                    ? "Slightly clustered"
                    : "Clustered"}{" "}
                (std: {distStdDev.toFixed(2)})
              </span>
            </div>
            {distributionInfo.length > 0 ? (
              <div className="-mx-1 flex gap-0.5 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
                {distributionInfo.map((d, idx) => {
                  const maxClasses = Math.max(
                    ...distributionInfo.map((x) => x.classes),
                    0,
                  );
                  /** 0 = low, 1 = mid, 2 = high load vs max in this run (matches bar legend). */
                  const loadTier =
                    maxClasses <= 0
                      ? 0
                      : Math.min(
                          2,
                          Math.round((d.classes / maxClasses) * 2),
                        );
                  const deviation = d.classes - avgDist;
                  const fullSlotLabel = timeslotHeaderLabel(
                    d.timeslot,
                    catalogue,
                    [],
                  );
                  return (
                    <div
                      key={d.timeslot}
                      className="flex w-9 shrink-0 flex-col items-center gap-1 sm:w-10"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-default text-center text-[10px] font-medium text-slate-600">
                            T{idx + 1}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {`${fullSlotLabel} (${d.timeslot}) — ${d.classes} class(es)`}
                        </TooltipContent>
                      </Tooltip>
                      <div className="relative isolate mx-auto h-[4.5rem] w-full max-w-[1.375rem] overflow-hidden rounded-[5px] bg-[#F1F4F9]">
                        {loadTier >= 1 && (
                          <div
                            className={`absolute inset-x-0 bottom-0 rounded-[5px] transition-all duration-300 ${
                              loadTier === 2
                                ? "top-0 bg-[#FF6B6B]"
                                : "top-[52%] bg-[#FFB800]"
                            }`}
                            aria-hidden
                          />
                        )}
                        <span className="relative z-10 flex h-full items-center justify-center text-xs font-semibold tabular-nums text-slate-700">
                          {loadTier}
                        </span>
                      </div>
                      <div className="text-center text-[10px] tabular-nums text-slate-400">
                        {deviation > 0 ? "+" : ""}
                        {deviation.toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No distribution data available.
              </p>
            )}
            {distributionInfo.length > 0 && (
              <p className="mt-3 text-xs text-slate-400">
                Average: {avgDist.toFixed(1)} classes per timeslot
              </p>
            )}
          </div>
        </div>
  );

  if (embedded) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            Soft constraint metrics
          </h3>
          <p className="text-xs text-slate-500">
            How the latest timetable scores on each soft goal (weights apply during optimization).
          </p>
        </div>
        {inner}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100"
      >
        <span className="font-semibold text-slate-900">Soft constraint metrics</span>
        <span className="text-sm tabular-nums text-slate-500" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? inner : null}
    </div>
  );
}

// ─── TeachingLoadPanel ────────────────────────────────────────────────────────

export function TeachingLoadPanel() {
  const { data, isLoading } = useSchedule();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const lecturerSummary = data?.lecturer_summary ?? [];
  const workloadInfo = data?.workload_info ?? [];

  if (isLoading || (lecturerSummary.length === 0 && workloadInfo.length === 0)) return null;

  const workloadMap = new Map(
    workloadInfo.map((item) => [item.lecturer, item]),
  );
  const mergedLecturers = lecturerSummary.map((lec) => {
    const workload = workloadMap.get(lec.name);
    const teachingLoad = workload?.credit_hour_load ?? workload?.classes ?? lec.teaching_load;
    const maxLoad = workload?.max_workload ?? lec.max_load;
    const overloaded = workload?.within_limit != null ? !workload.within_limit : teachingLoad > maxLoad;
    return {
      ...lec,
      teaching_load: teachingLoad,
      max_load: maxLoad,
      overloaded,
    };
  });
  for (const workload of workloadInfo) {
    if (mergedLecturers.some((lec) => lec.name === workload.lecturer)) continue;
    const teachingLoad = workload.credit_hour_load ?? workload.classes ?? 0;
    const maxLoad = workload.max_workload ?? 0;
    const overloaded = workload.within_limit != null ? !workload.within_limit : teachingLoad > maxLoad;
    mergedLecturers.push({
      name: workload.lecturer,
      teaching_load: teachingLoad,
      max_load: maxLoad,
      overloaded,
      courses: [],
      preferred_slots: [],
      unpreferred_slots: [],
      warning_count: 0,
      warnings: [],
      gap_count: 0,
    });
  }

  // Sort: overloaded first, then by load desc
  const sorted = [...mergedLecturers].sort((a, b) => {
    if (a.overloaded !== b.overloaded) return a.overloaded ? -1 : 1;
    return b.teaching_load - a.teaching_load;
  });
  const q = query.trim().toLowerCase();
  const filtered = q
    ? sorted.filter(
        (lec) =>
          lec.name.toLowerCase().includes(q) ||
          lec.courses.some((course) => course.toLowerCase().includes(q)),
      )
    : sorted;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">Teaching load</span>
          <span className="text-xs text-slate-500 ml-1">
            — assigned workload vs lecturer max workload
          </span>
        </div>
        <span className="text-slate-500 text-sm tabular-nums" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div>
          <div className="border-b border-slate-100 px-4 py-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by instructor or course"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="divide-y divide-slate-100">
          {filtered.map((lec) => {
            const color = getLecturerColor(lec.name);
            const safeMaxLoad = lec.max_load > 0 ? lec.max_load : 1;
            const pct = Math.min(100, (lec.teaching_load / safeMaxLoad) * 100);
            const barColor = lec.overloaded
              ? "bg-red-500"
              : lec.warning_count > 0
                ? "bg-amber-400"
                : "bg-emerald-400";

            return (
              <div key={lec.name} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${color.dot}`} />
                    <span className="font-semibold text-slate-800">
                      {lec.name}
                    </span>
                    {lec.overloaded && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                        OVERLOADED
                      </span>
                    )}
                    {lec.warning_count > 0 && !lec.overloaded && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {lec.warning_count} pref issue
                        {lec.warning_count > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-bold ${lec.overloaded ? "text-red-600" : "text-slate-700"}`}
                  >
                    {lec.teaching_load} / {lec.max_load}
                  </span>
                </div>

                {/* Load bar */}
                <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-slate-200/90 ring-1 ring-inset ring-slate-300/30">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-white/25 to-transparent transition-all duration-500 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Courses */}
                <div className="flex flex-wrap gap-1.5">
                  {lec.courses.length > 0 ? (
                    lec.courses.map((c, idx) => (
                      <span
                        key={`${c}-${idx}`}
                        className={`rounded px-2 py-0.5 text-xs font-mono font-medium ${color.bg} ${color.text} border ${color.border}`}
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      No courses assigned
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-5 text-sm text-slate-500">
              No instructors match this search.
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RoomUtilizationPanel ─────────────────────────────────────────────────────

export function RoomUtilizationPanel() {
  const { data, isLoading } = useSchedule();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const roomSummary = data?.room_summary ?? [];
  const entries = data?.schedule ?? [];

  const seatedByRoom = useMemo(() => {
    const byRoom = new Map<string, number>();
    for (const entry of entries) {
      if (!entryRequiresRoom(entry)) continue;
      const room = entry.room?.trim();
      if (!room || room === "ONLINE") continue;
      const classSize = Number(entry.class_size ?? 0);
      if (!Number.isFinite(classSize) || classSize <= 0) continue;
      byRoom.set(room, (byRoom.get(room) ?? 0) + classSize);
    }
    return byRoom;
  }, [entries]);

  const grandTotalCapacity = roomSummary.reduce(
    (sum, r) => sum + r.capacity * r.total_slots,
    0,
  );
  const grandTotalSeated = roomSummary.reduce((sum, room) => {
    const roomCapacity = room.capacity * room.total_slots;
    const seatedSeats = Math.max(0, Math.min(roomCapacity, seatedByRoom.get(room.name) ?? 0));
    return sum + seatedSeats;
  }, 0);
  const overallSeatUtilPct =
    grandTotalCapacity > 0
      ? (grandTotalSeated / grandTotalCapacity) * 100
      : 0;
  const q = query.trim().toLowerCase();
  const filteredRooms = q
    ? roomSummary.filter((room) => room.name.toLowerCase().includes(q))
    : roomSummary;

  if (isLoading || roomSummary.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-900">Room utilization</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`cursor-default text-xs px-2 py-0.5 rounded-full font-medium ${
                  overallSeatUtilPct >= 60
                    ? "bg-green-100 text-green-700"
                    : overallSeatUtilPct >= 35
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {overallSeatUtilPct.toFixed(1)}% seats utilized
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Share of all room×timeslot seat capacity that has students seated (empty slots count as 0%). Higher is
              better.
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="text-slate-500 text-sm tabular-nums" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div>
          <div className="border-b border-slate-100 px-4 py-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by room name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="divide-y divide-slate-100">
          {filteredRooms.map((room) => {
            // Slot occupancy (how many timeslots had ANY class)
            const slotPct =
              room.total_slots > 0
                ? Math.round((room.used_slots / room.total_slots) * 100)
                : 0;
            // Seat utilization against full room x slot catalog capacity.
            const totalCapacityForRoom = room.capacity * room.total_slots;
            const seatedSeats = Math.max(
              0,
              Math.min(totalCapacityForRoom, seatedByRoom.get(room.name) ?? 0),
            );
            const seatUtilPct =
              totalCapacityForRoom > 0
                ? Math.round((seatedSeats / totalCapacityForRoom) * 100)
                : 0;
            const wastedSeats = Math.max(0, totalCapacityForRoom - seatedSeats);
            const wastePct =
              totalCapacityForRoom > 0
                ? Math.round((wastedSeats / totalCapacityForRoom) * 100)
                : 0;
            const slotBarColor =
              slotPct >= 80
                ? "bg-blue-500"
                : slotPct >= 40
                  ? "bg-blue-400"
                  : "bg-blue-200";
            const seatUtilBarColor =
              seatUtilPct >= 60
                ? "bg-emerald-500"
                : seatUtilPct >= 35
                  ? "bg-amber-400"
                  : "bg-red-400";
            return (
              <div key={room.name} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">
                      {room.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      cap {room.capacity}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {room.used_slots}/{room.total_slots} slots
                  </span>
                </div>

                {/* Slot occupancy bar */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-slate-400 w-24 shrink-0">Occupied slots</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full transition-all ${slotBarColor}`}
                      style={{ width: `${slotPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums w-10 text-right">
                    {slotPct}%
                  </span>
                </div>

                {/* Seat utilization (of full room×slot catalog capacity) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-24 shrink-0">Seat fill</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full transition-all ${seatUtilBarColor}`}
                      style={{ width: `${seatUtilPct}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs tabular-nums w-14 text-right font-semibold ${
                      seatUtilPct >= 60
                        ? "text-emerald-600"
                        : seatUtilPct >= 35
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {seatUtilPct}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {wastedSeats.toLocaleString()} unused seat places (
                  {wastePct}% of {totalCapacityForRoom.toLocaleString()} catalog seats)
                </p>
              </div>
            );
          })}
          {filteredRooms.length === 0 && (
            <div className="px-4 py-5 text-sm text-slate-500">
              No rooms match this search.
            </div>
          )}
          </div>
        </div>
      )}
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

/** Full-width cohort health view for Timetable Generation (majors, years, semester cards, badges). */
export function StudyPlanTabPanel() {
  const { data, isLoading } = useSchedule();
  const [selectedMajor, setSelectedMajor] = useState<string | null>(null);
  const [majorPickerOpen, setMajorPickerOpen] = useState(false);

  const units: Record<string, string[]> = data?.study_plan_units ?? {};
  const summary: StudyPlanUnitSummary[] = data?.study_plan_summary ?? [];
  const entries = data?.schedule ?? [];

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
    <div className="space-y-5">
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="space-y-4 pb-4">
          <CardTitle className="text-base text-slate-900">Explore by major</CardTitle>
          <div className="max-w-xl">
            <Popover open={majorPickerOpen} onOpenChange={setMajorPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={majorPickerOpen}
                  className="h-9 w-full justify-between bg-white font-normal"
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
        </CardHeader>
      </Card>

      {activeMajor && (
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">{activeMajor}</span>:{" "}
          <span className="font-semibold text-red-700">{activeMajorStats.conflicts}</span> conflict
          {activeMajorStats.conflicts === 1 ? "" : "s"},{" "}
          <span className="font-semibold text-amber-700">{activeMajorStats.gaps}</span> long gap
          {activeMajorStats.gaps === 1 ? "" : "s"}, and{" "}
          <span className="font-semibold text-sky-700">{activeMajorStats.singleDays}</span> single-class day
          {activeMajorStats.singleDays === 1 ? "" : "s"}.
        </p>
      )}

      {activeMajor && (
        <div className="grid gap-4 grid-cols-2">
          {years.map((year) => {
            const semesters = [...(grouped.get(activeMajor)?.get(year)?.keys() ?? [])].sort();
            return (
              <section key={`${activeMajor}-${year}`} className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">{year}</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {semesters.map((semester) => {
                    const unitId = grouped.get(activeMajor)?.get(year)?.get(semester) ?? "";
                    const unitCourses = unitId ? (units[unitId] ?? []) : [];
                    const unitSummary = unitId ? summaryById.get(unitId) : undefined;
                    const conflicts = unitSummary?.conflict_count ?? 0;
                    const gaps = unitSummary?.gap_count ?? 0;
                    const singleDay = unitSummary?.single_session_day_count ?? 0;
                    const allClear = conflicts === 0 && gaps === 0 && singleDay === 0;

                    return (
                      <Card
                        key={unitId || `${year}-${semester}`}
                        className="overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <CardHeader className="space-y-0 border-b border-slate-100 bg-slate-50/80 pb-3 pt-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base font-semibold text-slate-900">{semester}</CardTitle>
                              <CardDescription className="text-xs text-slate-500">
                                {unitCourses.length} required course{unitCourses.length === 1 ? "" : "s"}
                              </CardDescription>
                            </div>
                            <div className="flex max-w-[58%] flex-wrap justify-end gap-1">
                              {conflicts > 0 && (
                                <Badge className="border-0 bg-red-600 text-white hover:bg-red-600">
                                  {conflicts} conflict{conflicts === 1 ? "" : "s"}
                                </Badge>
                              )}
                              {gaps > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100"
                                >
                                  {gaps} gap{gaps === 1 ? "" : "s"}
                                </Badge>
                              )}
                              {singleDay > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100"
                                >
                                  {singleDay} single-class day{singleDay === 1 ? "" : "s"}
                                </Badge>
                              )}
                              {allClear && (
                                <Badge className="border-0 bg-emerald-600 text-white hover:bg-emerald-600">
                                  All clear
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          {unitCourses.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No courses listed for this semester in the study plan.</p>
                          ) : (
                            <div className="space-y-2">
                              {unitCourses.map((code) => {
                                const name = entryNameByCode.get(code);
                                return (
                                  <div
                                    key={code}
                                    className="rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm"
                                  >
                                    <p className="font-mono text-xs font-semibold text-slate-800">{code}</p>
                                    <p className="mt-0.5 text-xs text-slate-600">{name ?? "Course name unavailable"}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        {lecturers.map((lecturer) => {
          const color = getLecturerColor(lecturer);
          return (
            <div key={lecturer} className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${color.dot}`} />
              <span className="text-sm text-slate-700">{lecturer}</span>
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
        className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left transition-colors hover:bg-slate-100/70"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Timeslot code key
        </span>
        <span className="text-sm tabular-nums text-slate-500" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div
          id="timeslot-code-key-panel"
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Timeslot codes
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Headers use <span className="font-mono">T1</span>, <span className="font-mono">T2</span>, … in
            column order{entries.length === 0 ? " (preview from config)" : ""}. The second line in each
            header is the engine id (e.g. <span className="font-mono">MON_LAB_0800</span>).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-600">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2">Engine ID</th>
                </tr>
              </thead>
              <tbody>
                {timeslotIds.map((tsId, idx) => {
                  const ts = rowForId(tsId);
                  const fam = uiSlotKindFromEngineSlotType(ts.slot_type);
                  const rowBg = fam === "lab" ? "bg-amber-50/80" : "";
                  return (
                    <tr key={tsId} className={`border-b border-slate-100 last:border-0 ${rowBg}`}>
                      <td className="py-2 pr-3 font-bold text-slate-900 tabular-nums">
                        T{idx + 1}
                      </td>
                      <td className="py-2 pr-3 text-slate-800">{timeslotScheduleLabel(ts)}</td>
                      <td className="py-2 font-mono text-xs text-slate-600">{tsId}</td>
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
              <span className="max-w-[min(100%,20rem)] cursor-default truncate text-xs text-slate-600 sm:max-w-xs">
                <span className="font-medium text-slate-800">{persistSuccess.timetableName}</span>
                <span className="text-slate-500"> · v{persistSuccess.versionNumber}</span>
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
  const { data, isLoading, refresh } = useSchedule();
  const { config } = useConfig();
  const { toast } = useToast();
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
      r.push({ key: "__online__", label: "Online (no room)" });
    }
    return r;
  }, [physicalRooms, hasOnline]);

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
    const v = validateScheduleHardConstraints(nextDraft, config, catalogue);
    if (!v.ok) {
      setFeedback({
        kind: "error",
        title: "That change is not allowed",
        lines: v.errors.slice(0, 14),
      });
      toast({
        title: "Change not applied",
        description: `The timetable still has to satisfy all hard rules (${v.errors.length} problem${v.errors.length === 1 ? "" : "s"}). Open the details below.`,
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
      setFeedback({
        kind: "error",
        title: "Fix hard constraint issues before saving",
        lines: v.errors.slice(0, 14),
      });
      toast({
        title: "Not saved",
        description: `Resolve ${v.errors.length} issue(s) first — see the panel below.`,
        variant: "destructive",
      });
      return;
    }
    setSavingFile(true);
    try {
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
      await refresh();
      setDraft(null);
      setEditMode(false);
      setFeedback({ kind: "idle" });
      toast({
        title: "Saved",
        description: "The server schedule file was updated. You can turn Edit back on to keep adjusting.",
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
      <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
        <div className="text-sm text-slate-500">Loading schedule…</div>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
        <div className="text-sm text-slate-500">
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
                          ? "border-amber-600/80 text-amber-950 shadow-sm hover:bg-amber-50 dark:border-amber-500/70 dark:text-amber-50 dark:hover:bg-amber-950/35"
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
                      {savingFile ? "Saving…" : "Save to workspace file"}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  className="max-w-[min(22rem,calc(100vw-2rem))] px-3.5 py-2.5 text-left text-xs leading-relaxed shadow-lg"
                >
                  Writes your edited timetable to the workspace schedule on the server (POST /api/schedule). That file is
                  what this page loads and what the optimizer uses as the starting timetable for the next run.
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
            <p className="whitespace-nowrap px-1 text-xs leading-relaxed text-slate-600">
              Drag the ⋮⋮ handle to move a section. Click a course block to edit/remove it. To add, click an empty grid
              cell and enter section details for that room/timeslot.
            </p>
          </div>
        ) : null}
      </div>

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

      <div className="relative max-h-[min(calc(100dvh-10rem),80rem)] min-h-0 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm [scrollbar-width:thin]">
        <table className="w-full border-separate border-spacing-0 text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100">
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 w-36 border-b border-r border-slate-200 bg-slate-100 px-3 py-2.5 text-left font-semibold text-slate-700 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.12)]"
              >
                Room
              </th>
              {timeslotIds.map((ts, colIdx) => {
                const slotRow = catMap.get(ts);
                const family = uiSlotKindFromEngineSlotType(slotRow?.slot_type);
                const famClass =
                  family === "lab"
                    ? "bg-amber-50"
                    : family === "blended"
                      ? "bg-violet-50"
                      : "bg-slate-50";
                const slotHdrTip = `${timeslotHeaderLabel(ts, catalogue, displayEntries, "long")} · ${ts}`;
                return (
                  <th
                    key={ts}
                    scope="col"
                    className={`sticky top-0 z-20 border-b border-l border-slate-200 px-2 py-2.5 text-center text-xs font-semibold text-slate-800 shadow-[0_4px_6px_-4px_rgba(15,23,42,0.12)] ${famClass}`}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block cursor-default">
                          <div className="mx-auto leading-snug tabular-nums">T{colIdx + 1}</div>
                          <div className="mt-0.5 font-mono text-[10px] font-normal text-slate-500">{ts}</div>
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
                    className="sticky left-0 z-10 border-t border-slate-100 border-r border-slate-200 bg-slate-50 px-3 py-2 text-left align-top font-normal shadow-[4px_0_6px_-4px_rgba(15,23,42,0.12)]"
                  >
                    <div className="font-semibold text-slate-800">{row.label}</div>
                    {roomData && (
                      <div className="text-xs font-normal text-slate-500">
                        Capacity {roomData.capacity}
                      </div>
                    )}
                    {row.key === "__online__" && (
                      <div className="text-xs text-slate-500">
                        Synchronous online sections
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
                        className={`border-t border-slate-100 border-l border-slate-200 p-1 align-top ${
                          isConflict ? "bg-red-50" : ""
                        } ${editMode ? "ring-1 ring-transparent hover:ring-slate-200" : ""} ${
                          editMode && cellEntries.length === 0 ? "cursor-pointer hover:bg-slate-50/70" : ""
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
                                  editMode && "ring-1 ring-slate-900/10",
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
                                      <span className="rounded bg-white/60 px-1 text-[10px] font-medium text-slate-700">
                                        {tag}
                                      </span>
                                    </div>
                                  )}
                                  {entryRequiresRoom(entry) &&
                                    entry.class_size != null &&
                                    entry.room_capacity != null &&
                                    entry.room_capacity > 0 && (
                                      <div className="mt-0.5 text-[10px] font-normal opacity-60">
                                        {entry.class_size}/{entry.room_capacity}
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
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">All courses</span>
          <span className="text-xs text-slate-500">({sorted.length})</span>
        </div>
        <span className="text-slate-500 text-sm tabular-nums" aria-hidden>
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
              ? "bg-amber-500"
              : family === "blended"
                ? "bg-violet-500"
                : "bg-slate-400";

            return (
              <div
                key={entry.lecture_id}
                className={`flex flex-wrap items-start gap-3 px-4 py-3 ${isConflict ? "bg-red-50" : ""}`}
              >
                <div className={`h-4 w-1 rounded shrink-0 mt-1 ${accentBar}`} />

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 leading-snug">
                    {(entry.course_name || "").trim() || entry.course_code}
                  </div>
                  <div className="font-mono text-xs text-slate-500">{entry.course_code}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {formatDeliveryMode(entry.delivery_mode)}
                    </span>
                    {!isLabRow && family === "blended" ? (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                        Blended slot pattern
                      </span>
                    ) : !isLabRow ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        Regular slot pattern
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="text-right text-sm shrink-0 min-w-[8rem]">
                  <div className={`font-medium ${color.text}`}>{entry.lecturer}</div>
                  <div className="text-xs text-slate-700 mt-0.5 leading-snug">
                    {slotLabel}
                  </div>
                </div>

                <div className="text-right shrink-0 min-w-[6rem]">
                  <div className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {formatRoomCell(entry)}
                  </div>
                  {entryRequiresRoom(entry) &&
                    entry.class_size != null &&
                    entry.room_capacity != null &&
                    entry.room_capacity > 0 && (
                      <div className="mt-0.5 text-xs text-slate-400">
                        {entry.class_size}/{entry.room_capacity}
                      </div>
                    )}
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
  const occupiedSeatRows = utilizationInfo.filter(
    (u) =>
      u.is_empty !== true &&
      (u.course?.length ?? 0) > 0 &&
      (u.capacity ?? 0) > 0,
  );
  const seatFillAssignedPct =
    occupiedSeatRows.length > 0
      ? Math.round(
          occupiedSeatRows.reduce(
            (sum, u) => sum + (u.class_size / u.capacity) * 100,
            0,
          ) / occupiedSeatRows.length,
        )
      : 0;

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
        : fitnessNum.toFixed(4);
  const fitnessTitle =
    fitnessNum !== null && !fitnessPerfect
      ? String(fitnessRaw)
      : undefined;

  const totalSoftWarnings =
    (meta?.soft_preference_warnings ?? 0) + (meta?.gap_warnings ?? 0);

  const hasHardConflicts = (meta?.conflicts ?? 0) > 0;
  const fitnessPerfectBar =
    fitnessNum !== null && fitnessNum < 0.000001;

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
  const studentGapCount =
    meta?.student_gap_count ?? (data?.student_gap_warnings?.length ?? 0);
  const singleSessionDayCount =
    meta?.single_session_day_count ??
    (data?.single_session_day_warnings?.length ?? 0);
  const totalHardConflicts = (meta?.conflicts ?? 0) + unitConflictCount;

  const detailRows: DetailCell[][] = [
    [
      { label: "Iterations", value: String(iterations), mono: true },
      { label: "Wolves", value: String(wolves), mono: true },
      {
        label: "Fitness",
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
      },
    ],
    [
      {
        label: "Hard conflicts",
        value: String(totalHardConflicts),
        highlight: totalHardConflicts > 0 ? "text-red-600" : "text-green-600",
        mono: true,
      },
      {
        label: "Unit conflicts",
        value: String(unitConflictCount),
        highlight: unitConflictCount > 0 ? "text-red-600" : "text-green-600",
        mono: true,
      },
      {
        label: "Soft warnings",
        value: String(totalSoftWarnings),
        highlight:
          totalSoftWarnings > 0 ? "text-amber-600" : "text-green-600",
        mono: true,
      },
      {
        label: "Student gaps",
        value: String(studentGapCount),
        highlight: studentGapCount > 0 ? "text-amber-600" : "text-green-600",
        mono: true,
      },
      {
        label: "Single-session days",
        value: String(singleSessionDayCount),
        highlight:
          singleSessionDayCount > 0 ? "text-amber-600" : "text-green-600",
        mono: true,
      },
      {
        label: "Catalog slots %",
        value: `${slotUtilizationPct}%`,
        mono: true,
        description: "How much of the slot grid is occupied at all?",
      },
      {
        label: "Timetable seats %",
        value: `${timetableSeatsPctDisplay}%`,
        mono: true,
        highlight:
          timetableSeatsPctDisplay >= 60
            ? "text-emerald-600"
            : timetableSeatsPctDisplay >= 35
              ? "text-amber-600"
              : "text-slate-800",
        description:
          "How much of all catalog seat capacity is filled by students?",
      },
      {
        label: "Avg fill on used slots %",
        value: `${seatFillAssignedPct}%`,
        mono: true,
        description:
          "When a room is used, is it full or mostly empty seats?",
      },
      { label: "Generated", value: generatedAt },
    ],
  ];

  const scheduleOverviewInputRows: DetailCell[] = [
    {
      label: "Courses",
      value: String(inputCounts.distinctCourses),
      mono: true,
      description:
        "Distinct course codes in the active configuration (merged from data/config.json and PostgreSQL when DATABASE_URL is set).",
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
      description: "Assignable rooms in the active configuration.",
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
      description:
        "Faculty pool for the optimizer (from the DB when connected, otherwise the file list).",
    },
  ];

  const scheduleOverviewSessionMix: DetailCell[] = [
    {
      label: "In-person",
      value: String(breakdown.ip),
      highlight: "text-slate-800",
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
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">
          Schedule &amp; optimization
        </h3>
        <p className="text-[11px] text-slate-500">
          Inputs used for scheduling, last timetable mix, and optimizer run metrics
        </p>
      </div>
      <div className="space-y-2 p-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Schedule overview
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {scheduleOverviewInputRows.map((row) => {
              const { label, value, highlight, mono } = row;
              const tip = mergeDetailStatTooltip(row);
              const tile = (
                <div
                  className={`min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 ${tip ? "cursor-help" : ""}`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
                  <div
                    className={`mt-0.5 break-words text-sm font-semibold ${mono ? "tabular-nums" : ""} ${highlight ?? "text-slate-900"}`}
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
          <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Session types (last generated timetable)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {scheduleOverviewSessionMix.map((row) => {
              const { label, value, highlight, mono } = row;
              const tip = mergeDetailStatTooltip(row);
              const tile = (
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
                  <div
                    className={`mt-0.5 break-words text-sm font-semibold ${mono ? "tabular-nums" : ""} ${highlight ?? "text-slate-800"}`}
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

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Optimization run
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {detailRows.flat().map((row) => {
              const { label, value, highlight, mono } = row;
              const tip = mergeDetailStatTooltip(row);
              const tile = (
                <div
                  className={`min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 ${tip ? "cursor-help" : ""}`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
                  <div
                    className={`mt-0.5 break-words text-sm font-semibold ${mono ? "tabular-nums" : ""} ${highlight ?? "text-slate-800"}`}
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
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">
          Hard constraints
        </h3>
        <p className="text-xs text-slate-500">
          Feasible timetables from GWO must satisfy all of these rules. This list is read-only (view only).
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {hardRules.map((rule) => (
          <li
            key={rule.title}
            className="flex gap-3 py-1.5 sm:gap-4"
          >
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200/90 text-slate-600"
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
              <div className="text-sm font-semibold text-slate-900">{rule.title}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{rule.detail}</p>
            </div>
          </li>
        ))}
      </ul>
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
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            Soft constraint weights
          </h3>
          <p className="text-xs text-slate-500">
            0 = disabled, 100 = strongest influence on the objective function
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!localConfig || saving}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SOFT_CONSTRAINT_DEFINITIONS.map((item) => {
          const value = Math.max(
            0,
            Math.min(100, (displayConfig.soft_weights[item.key] ?? 0) as number),
          );
          return (
            <div
              key={String(item.key)}
              className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 sm:p-3.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-800">{item.label}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={value}
                  onChange={(e) =>
                    updateSoftWeight(item.key, parseInt(e.target.value, 10) || 0)
                  }
                  className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-sm tabular-nums shadow-sm"
                />
              </div>
              <div
                className="relative mt-0.5 w-full"
                style={{ "--soft-weight-thumb": "#00a5f4" } as CSSProperties}
              >
                <div className="relative flex h-5 w-full items-center">
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[1] h-1.5 -translate-y-1/2 rounded-full bg-slate-200/90" />
                  {Array.from({ length: 11 }, (_, i) => i * 10).map((pct) => (
                    <div
                      key={pct}
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 z-[2] h-1.5 w-px -translate-x-1/2 -translate-y-1/2 bg-slate-400/65"
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
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
            </div>
          );
        })}
      </div>
      {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">GWO algorithm parameters</h4>
          <p className="text-xs text-slate-500">Adjust optimizer behavior and run limits</p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!localConfig || saving}
          className={`${segmentedNavTabItemRadiusClass} px-4 py-2 text-sm font-semibold shadow-sm`}
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {params.map(({ key, label, desc, step }) => (
          <div key={key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <label className="text-xs font-semibold text-slate-700">{label}</label>
            <input
              type="number"
              step={step}
              value={(displayConfig.gwo_params as Record<string, number>)[key]}
              onChange={(e) => updateParam(key, parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            />
            <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
          </div>
        ))}
      </div>
      {saveError && <p className="mt-3 text-xs text-red-600">{saveError}</p>}
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
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
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
        className="min-w-[4.5rem] w-24 max-w-[min(100%,12rem)] rounded border border-slate-300 bg-white px-2 py-1 text-sm font-mono font-bold text-slate-700"
      />
      <input
        type="number"
        value={roomCap(rv)}
        onChange={(e) =>
          updateRoomCapacity(roomKey, parseInt(e.target.value, 10) || 0)
        }
        className="w-16 rounded border border-slate-300 px-2 py-1 text-sm text-center"
      />
      <span className="text-xs text-slate-400">seats</span>
      <select
        value={roomTp(rv)}
        onChange={(e) => updateRoomType(roomKey, e.target.value)}
        className="text-xs rounded border border-slate-300 px-1 py-1 bg-white"
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
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="font-semibold text-slate-900">Configuration</h3>
        </div>
        <div className="p-4 text-sm text-slate-500">
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
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-gradient-to-b from-slate-50 to-slate-100/90 hover:from-slate-100 hover:to-slate-100 transition-colors border-b border-slate-200 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">Configuration</span>
            {hasChanges && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                Unsaved changes
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Rooms, timeslots, lecturer preferences, courses, and optimizer weights
          </p>
        </div>
        <span className="shrink-0 text-slate-500 text-sm tabular-nums" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && displayConfig && (
        <div className="p-4 space-y-6">
          {hasChanges && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 transition-colors"
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
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2">
              <button
                type="button"
                id="config-rooms-toggle"
                aria-expanded={roomsOpen}
                aria-controls="config-rooms-body"
                onClick={() => setRoomsOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-slate-100/80"
              >
                <span
                  className="shrink-0 text-sm tabular-nums text-slate-500"
                  aria-hidden
                >
                  {roomsOpen ? "▾" : "▸"}
                </span>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2">
              <button
                type="button"
                id="config-timeslots-toggle"
                aria-expanded={timeslotsOpen}
                aria-controls="config-timeslots-body"
                onClick={() => setTimeslotsOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-slate-100/80"
              >
                <span
                  className="shrink-0 text-sm tabular-nums text-slate-500"
                  aria-hidden
                >
                  {timeslotsOpen ? "▾" : "▸"}
                </span>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                      <tr className="bg-slate-100 border-b border-slate-200 text-left">
                        <th className="px-2 py-2 font-semibold text-slate-600">ID</th>
                        <th className="px-2 py-2 font-semibold text-slate-600">Code</th>
                        <th className="px-2 py-2 font-semibold text-slate-600">Label</th>
                        <th className="px-2 py-2 font-semibold text-slate-600">Days</th>
                        <th className="px-2 py-2 font-semibold text-slate-600">Start (h)</th>
                        <th className="px-2 py-2 font-semibold text-slate-600">Duration (h)</th>
                        <th className="px-2 py-2 font-semibold text-slate-600">Engine slot_type</th>
                        <th className="px-2 py-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeslotsList.map((ts) => (
                        <tr key={ts.id} className="border-b border-slate-100">
                          <td className="px-2 py-1.5 font-mono text-slate-800">{ts.id}</td>
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
                              className="w-14 rounded border border-slate-300 px-1 py-0.5 font-mono text-center"
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
                              className="w-full min-w-[8rem] rounded border border-slate-300 px-1 py-0.5"
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
                              className="w-full min-w-[10rem] rounded border border-slate-300 px-1 py-0.5"
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
                              className="w-16 rounded border border-slate-300 px-1 py-0.5"
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
                              className="w-16 rounded border border-slate-300 px-1 py-0.5"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={ts.slot_type ?? "lecture_mw"}
                              onChange={(e) =>
                                updateTimeslotRow(ts.id, { slot_type: e.target.value })
                              }
                              className="max-w-[9rem] rounded border border-slate-300 px-1 py-0.5 bg-white"
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
                <p className="mt-2 px-2 pb-2 text-xs text-slate-500">
                  Lab rows should use <span className="font-mono">slot_type = lab</span> and{" "}
                  <span className="font-mono">duration = 3</span> for a three-hour block. The optimiser
                  matches these to course <span className="font-mono">session_type</span>.
                </p>
              </div>
            )}
          </div>

          {/* Lecturers & Preferences */}
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <button
              type="button"
              id="config-lecturer-prefs-toggle"
              aria-expanded={lecturerPrefsOpen}
              aria-controls="config-lecturer-prefs-body"
              onClick={() => setLecturerPrefsOpen((o) => !o)}
              className="flex w-full items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2 text-left transition-colors hover:bg-slate-100/80"
            >
              <span
                className="shrink-0 text-sm tabular-nums text-slate-500"
                aria-hidden
              >
                {lecturerPrefsOpen ? "▾" : "▸"}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Lecturer Preferences
                </h4>
                <p className="mt-0.5 text-xs text-slate-500">
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
                      className="text-xs font-medium text-slate-600"
                    >
                      Lecturer
                    </label>
                    <select
                      id="config-prefs-lecturer-select"
                      className="mt-1 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
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
                        <p className="mb-3 text-xs text-slate-600">
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
                              <span className="font-normal text-slate-600">
                                ({prefs.preferred.length})
                              </span>
                            </label>
                            <select
                              id={prefId}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900 shadow-sm"
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
                            <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border border-slate-200/80 bg-white/90 p-2">
                              {prefs.preferred.length === 0 ? (
                                <span className="text-xs text-slate-500">
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
                              <span className="font-normal text-slate-600">
                                ({prefs.unpreferred.length})
                              </span>
                            </label>
                            <select
                              id={unprefId}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900 shadow-sm"
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
                            <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border border-slate-200/80 bg-white/90 p-2">
                              {prefs.unpreferred.length === 0 ? (
                                <span className="text-xs text-slate-500">
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
                  <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-sm text-slate-500">
                    Select a lecturer above to edit their preferred and unpreferred
                    timeslots.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* GWO Parameters */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
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
                  className="rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <label className="text-xs font-semibold text-slate-700">
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
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Soft Constraint Weights */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Soft Constraint Weights
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
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
                className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300 transition-colors"
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
                  trackTint: "bg-emerald-100/80",
                  tickColor: "text-emerald-700",
                  tickMuted: "text-emerald-400/90",
                  labelTint: "text-emerald-950",
                  descTint: "text-emerald-950/65",
                  accentHex: "#059669",
                  frameBorder:
                    "border border-emerald-200 border-l-4 border-l-emerald-600",
                  inputBorder: "border-emerald-200",
                  focusRing: "focus:ring-emerald-500/90",
                  cardFocusRing: "focus-within:ring-emerald-300/55",
                  cardWash: "bg-gradient-to-br from-white to-emerald-50/50",
                },
                {
                  key: "unpreferred_timeslot",
                  label: "Unpreferred timeslot",
                  desc: "Penalize scheduling in avoided slots",
                  trackTint: "bg-rose-100/80",
                  tickColor: "text-rose-700",
                  tickMuted: "text-rose-400/90",
                  labelTint: "text-rose-950",
                  descTint: "text-rose-950/65",
                  accentHex: "#e11d48",
                  frameBorder:
                    "border border-rose-200 border-l-4 border-l-rose-600",
                  inputBorder: "border-rose-200",
                  focusRing: "focus:ring-rose-500/90",
                  cardFocusRing: "focus-within:ring-rose-300/55",
                  cardWash: "bg-gradient-to-br from-white to-rose-50/50",
                },
                {
                  key: "minimize_gaps",
                  label: "Minimize gaps",
                  desc: "Penalize idle time between a lecturer's classes",
                  trackTint: "bg-amber-100/80",
                  tickColor: "text-amber-800",
                  tickMuted: "text-amber-500/85",
                  labelTint: "text-amber-950",
                  descTint: "text-amber-950/65",
                  accentHex: "#d97706",
                  frameBorder:
                    "border border-amber-200 border-l-4 border-l-amber-600",
                  inputBorder: "border-amber-200",
                  focusRing: "focus:ring-amber-500/90",
                  cardFocusRing: "focus-within:ring-amber-300/55",
                  cardWash: "bg-gradient-to-br from-white to-amber-50/50",
                },
                {
                  key: "room_utilization",
                  label: "Room utilization",
                  desc: "Penalize oversized room assignments",
                  trackTint: "bg-blue-100/80",
                  tickColor: "text-blue-700",
                  tickMuted: "text-blue-400/90",
                  labelTint: "text-blue-950",
                  descTint: "text-blue-950/65",
                  accentHex: "#2563eb",
                  frameBorder:
                    "border border-blue-200 border-l-4 border-l-blue-600",
                  inputBorder: "border-blue-200",
                  focusRing: "focus:ring-blue-500/90",
                  cardFocusRing: "focus-within:ring-blue-300/55",
                  cardWash: "bg-gradient-to-br from-white to-blue-50/50",
                },
                {
                  key: "balanced_workload",
                  label: "Balanced workload",
                  desc: "Penalize uneven class loads across lecturers",
                  trackTint: "bg-violet-100/80",
                  tickColor: "text-violet-700",
                  tickMuted: "text-violet-400/90",
                  labelTint: "text-violet-950",
                  descTint: "text-violet-950/65",
                  accentHex: "#7c3aed",
                  frameBorder:
                    "border border-violet-200 border-l-4 border-l-violet-600",
                  inputBorder: "border-violet-200",
                  focusRing: "focus:ring-violet-500/90",
                  cardFocusRing: "focus-within:ring-violet-300/55",
                  cardWash: "bg-gradient-to-br from-white to-violet-50/50",
                },
                {
                  key: "distribute_classes",
                  label: "Distribute classes",
                  desc: "Spread lectures evenly across timeslots",
                  trackTint: "bg-cyan-100/80",
                  tickColor: "text-cyan-800",
                  tickMuted: "text-cyan-500/85",
                  labelTint: "text-cyan-950",
                  descTint: "text-cyan-950/65",
                  accentHex: "#0891b2",
                  frameBorder:
                    "border border-cyan-200 border-l-4 border-l-cyan-600",
                  inputBorder: "border-cyan-200",
                  focusRing: "focus:ring-cyan-500/90",
                  cardFocusRing: "focus-within:ring-cyan-300/55",
                  cardWash: "bg-gradient-to-br from-white to-cyan-50/50",
                },
                {
                  key: "student_gaps",
                  label: "Student gaps",
                  desc: "Penalize idle gaps between a student's lectures in a day",
                  trackTint: "bg-orange-100/80",
                  tickColor: "text-orange-800",
                  tickMuted: "text-orange-500/85",
                  labelTint: "text-orange-950",
                  descTint: "text-orange-950/65",
                  accentHex: "#ea580c",
                  frameBorder:
                    "border border-orange-200 border-l-4 border-l-orange-600",
                  inputBorder: "border-orange-200",
                  focusRing: "focus:ring-orange-500/90",
                  cardFocusRing: "focus-within:ring-orange-300/55",
                  cardWash: "bg-gradient-to-br from-white to-orange-50/50",
                },
                {
                  key: "single_session_day",
                  label: "Single-session day",
                  desc: "Penalize units with only one session on a day — poor commute vs. class time",
                  trackTint: "bg-pink-100/80",
                  tickColor: "text-pink-700",
                  tickMuted: "text-pink-400/90",
                  labelTint: "text-pink-950",
                  descTint: "text-pink-950/65",
                  accentHex: "#db2777",
                  frameBorder:
                    "border border-pink-200 border-l-4 border-l-pink-600",
                  inputBorder: "border-pink-200",
                  focusRing: "focus:ring-pink-500/90",
                  cardFocusRing: "focus-within:ring-pink-300/55",
                  cardWash: "bg-gradient-to-br from-white to-pink-50/50",
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
                        className={`w-14 shrink-0 rounded-md border bg-white/95 px-2 py-0.5 text-sm text-center font-mono font-bold text-slate-800 tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${inputBorder} ${focusRing}`}
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
                          className="pointer-events-none absolute top-1/2 z-[2] h-1.5 w-px -translate-x-1/2 -translate-y-1/2 bg-slate-400/65"
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
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2">
              <button
                type="button"
                id="config-courses-toggle"
                aria-expanded={coursesOpen}
                aria-controls="config-courses-body"
                onClick={() => setCoursesOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-slate-100/80"
              >
                <span
                  className="shrink-0 text-sm tabular-nums text-slate-500"
                  aria-hidden
                >
                  {coursesOpen ? "▾" : "▸"}
                </span>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                    <tr className="border-b border-slate-200 bg-slate-100">
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Course code
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Delivery
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Session
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">
                        Size
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Allowed lecturers
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayConfig.lectures.map((lec) => (
                      <tr key={lec.id} className="border-b border-slate-100">
                        <td className="px-3 py-2">
                          <input
                            value={lec.course}
                            onChange={(e) =>
                              updateLectureField(lec.id, "course", e.target.value)
                            }
                            className="w-full min-w-[6rem] font-mono font-medium text-slate-800 rounded border border-slate-300 px-2 py-1 text-sm"
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
                            className="rounded border border-slate-300 px-2 py-1 text-xs bg-white"
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
                            className="rounded border border-slate-300 px-2 py-1 text-xs bg-white"
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
                            className="w-16 rounded border border-slate-300 px-2 py-1 text-sm text-center"
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
                                      : "bg-slate-100 text-slate-400 border-slate-200"
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
