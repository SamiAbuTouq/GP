"use client";

import { Loader2, Pause } from "lucide-react";
import { useSWRConfig } from "swr";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SchedulePayload } from "@/lib/schedule-data";
import { parseSseBlocks } from "@/lib/parse-sse-blocks";

/** Mirrors JSON emitted by the Python optimizer (`__GWO_PROGRESS__` lines). */
export type GwoOptimizerProgressPayload = {
  current: number;
  total: number;
  run?: number;
  numRuns?: number;
  best?: number;
};

type GwoRunBarState = {
  visible: boolean;
  percent: number;
  phase: string;
  detail: string;
};

function formatElapsed(totalSec: number): string {
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** x = active ms (pauses excluded), y = iteration index */
type ProgressSample = { activeMs: number; c: number };

const ETA_SAMPLE_CAP = 40;
const ETA_SAMPLE_MAX_SPAN_MS = 120_000;
const ETA_MIN_DT_MS = 400;
const ETA_MIN_ITER_DELTA = 1;
const ETA_MAX_MS = 48 * 60 * 60 * 1000;

function trimSamples(samples: ProgressSample[]): ProgressSample[] {
  if (samples.length <= 2) return samples;
  const newest = samples[samples.length - 1].activeMs;
  let start = 0;
  while (
    start < samples.length - 1 &&
    newest - samples[start].activeMs > ETA_SAMPLE_MAX_SPAN_MS
  ) {
    start++;
  }
  return samples.slice(start);
}

/**
 * Iterations per active ms: robust slope from recent samples, blended with
 * long-run throughput to damp noise when the window is short or jittery.
 */
function estimateIterationsPerMs(
  samples: ProgressSample[],
  current: number,
  activeElapsedMs: number,
): number | null {
  if (samples.length < 2) return null;

  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = last.activeMs - first.activeMs;
  const dc = last.c - first.c;
  if (dt < ETA_MIN_DT_MS || dc < ETA_MIN_ITER_DELTA) return null;

  const n = samples.length;
  let sumA = 0;
  let sumC = 0;
  for (let i = 0; i < n; i++) {
    sumA += samples[i].activeMs;
    sumC += samples[i].c;
  }
  const meanA = sumA / n;
  const meanC = sumC / n;
  let varA = 0;
  let covAC = 0;
  for (let i = 0; i < n; i++) {
    const da = samples[i].activeMs - meanA;
    varA += da * da;
    covAC += da * (samples[i].c - meanC);
  }
  if (varA < 1e-6) return null;
  const slope = covAC / varA;
  if (!Number.isFinite(slope) || slope <= 0) return null;

  let rate = slope;
  if (activeElapsedMs >= ETA_MIN_DT_MS && current > 0) {
    const longRun = current / activeElapsedMs;
    if (Number.isFinite(longRun) && longRun > 0) {
      rate = 0.5 * slope + 0.5 * longRun;
    }
  }

  const segRate = dc / Math.max(dt, ETA_MIN_DT_MS);
  if (Number.isFinite(segRate) && segRate > 0) {
    rate = Math.min(rate, segRate * 3);
    rate = Math.max(rate, segRate / 3);
  }

  return rate;
}

async function jsonFetcher(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

type GwoRunContextValue = {
  isRunning: boolean;
  isPaused: boolean;
  runStartedAt: number | null;
  bar: GwoRunBarState;
  /**
   * Wall-clock instant when the optimizer is expected to finish (iteration phase only).
   * Updated from smoothed throughput; ticks down in the UI between SSE updates.
   */
  etaDeadlineMs: number | null;
  /** Snapshot when pausing so the countdown does not drain while work is stopped */
  etaPausedRemainingSec: number | null;
  /** Creates a new AbortController for the current run; returned signal must be passed to fetch. */
  beginRun: () => AbortController;
  updateProgress: (p: GwoOptimizerProgressPayload) => void;
  /** Update high-level status (e.g. while waiting on the network or stream). */
  setRunPhase: (phase: string, detail?: string) => void;
  setFinalizing: () => void;
  endRun: () => void;
  cancelRun: () => void;
  pauseRun: () => Promise<void>;
  resumeRun: () => Promise<void>;
  /**
   * Runs the optimizer (SSE) with state updates on this provider.
   * Safe to call from any page: the provider stays mounted for the whole app shell.
   * @returns `null` on success or user cancel; an error message string on failure.
   */
  runOptimizer: () => Promise<string | null>;
  /** Wall time since the run began minus optimizer pauses (UI “Elapsed” clock). */
  getRunElapsedActiveSec: () => number;
  /**
   * Increments only after a successful optimizer run once the new `/api/schedule` payload
   * is written to the SWR cache. Grid UI uses this to refresh “generated” baselines.
   */
  optimizerScheduleEpoch: number;
};

const GwoRunContext = createContext<GwoRunContextValue | null>(null);

export function GwoRunProvider({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();
  const [optimizerScheduleEpoch, setOptimizerScheduleEpoch] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Wall time when first iteration sample is taken — origin for active-ms axis */
  const progressEpochWallRef = useRef<number | null>(null);
  const progressSamplesRef = useRef<ProgressSample[]>([]);
  const etaDeadlineMsRef = useRef<number | null>(null);
  const pausedAccumMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const [etaDeadlineMs, setEtaDeadlineMs] = useState<number | null>(null);
  const [etaPausedRemainingSec, setEtaPausedRemainingSec] = useState<number | null>(
    null,
  );
  const [bar, setBar] = useState<GwoRunBarState>({
    visible: false,
    percent: 0,
    phase: "",
    detail: "",
  });

  const getActiveMs = useCallback((now: number): number => {
    if (progressEpochWallRef.current === null) return 0;
    let pauseTotal = pausedAccumMsRef.current;
    if (pauseStartedAtRef.current !== null) {
      pauseTotal += now - pauseStartedAtRef.current;
    }
    return now - progressEpochWallRef.current - pauseTotal;
  }, []);

  const getRunElapsedActiveSec = useCallback((): number => {
    if (runStartedAt == null) return 0;
    const now = Date.now();
    let pauseTotal = pausedAccumMsRef.current;
    if (pauseStartedAtRef.current !== null) {
      pauseTotal += now - pauseStartedAtRef.current;
    }
    return Math.max(0, Math.floor((now - runStartedAt - pauseTotal) / 1000));
  }, [runStartedAt]);

  const setDeadline = useCallback((ms: number | null) => {
    etaDeadlineMsRef.current = ms;
    setEtaDeadlineMs(ms);
  }, []);

  const beginRun = useCallback((): AbortController => {
    const ac = new AbortController();
    abortRef.current = ac;
    setIsPaused(false);
    setIsRunning(true);
    setRunStartedAt(Date.now());
    progressEpochWallRef.current = null;
    progressSamplesRef.current = [];
    pausedAccumMsRef.current = 0;
    pauseStartedAtRef.current = null;
    setDeadline(null);
    setEtaPausedRemainingSec(null);
    setBar({
      visible: true,
      percent: 0,
      phase: "Starting optimizer…",
      detail: "Sending request to the server",
    });
    return ac;
  }, [setDeadline]);

  const setRunPhase = useCallback((phase: string, detail?: string) => {
    setBar((b) => ({
      ...b,
      visible: true,
      phase,
      ...(detail !== undefined ? { detail } : {}),
    }));
  }, []);

  const updateProgress = useCallback((p: GwoOptimizerProgressPayload) => {
    const current = Number(p.current);
    const total = Number(p.total);
    const safeTotal = total > 0 ? total : 1;
    const pct = Math.min(95, Math.round((95 * current) / safeTotal));

    const numRuns = p.numRuns != null ? Number(p.numRuns) : undefined;
    const run = p.run != null ? Number(p.run) : undefined;
    const best = p.best != null ? Number(p.best) : undefined;

    const detailParts: string[] = [];
    detailParts.push(
      `Iteration ${current.toLocaleString()} / ${total.toLocaleString()}`,
    );
    if (
      numRuns != null &&
      numRuns > 0 &&
      run != null &&
      run > 0 &&
      numRuns > 1
    ) {
      detailParts.push(`run ${run} of ${numRuns}`);
    }
    if (best != null && Number.isFinite(best)) {
      detailParts.push(`best fitness ${best}`);
    }
    const detail = detailParts.join(" · ");

    const now = Date.now();
    if (current > 0 && progressEpochWallRef.current === null) {
      progressEpochWallRef.current = now;
    }

    if (
      progressEpochWallRef.current !== null &&
      current > 0 &&
      total >= current &&
      pauseStartedAtRef.current === null
    ) {
      const activeMs = getActiveMs(now);
      const samples = progressSamplesRef.current;
      samples.push({ activeMs, c: current });
      if (samples.length > ETA_SAMPLE_CAP) {
        samples.splice(0, samples.length - ETA_SAMPLE_CAP);
      }
      progressSamplesRef.current = trimSamples(samples);

      const activeElapsed = activeMs;
      const windowed = progressSamplesRef.current;
      const rate = estimateIterationsPerMs(
        windowed,
        current,
        activeElapsed,
      );

      if (
        rate != null &&
        total > current &&
        Number.isFinite(rate) &&
        rate > 0
      ) {
        let remainingMs = (total - current) / rate;
        if (!Number.isFinite(remainingMs) || remainingMs < 0) remainingMs = 0;
        remainingMs = Math.min(remainingMs, ETA_MAX_MS);
        setDeadline(now + remainingMs);
      }
    }

    setBar((b) => {
      const paused = b.phase.startsWith("Paused");
      let phase = b.phase;
      if (!paused) {
        if (numRuns != null && numRuns > 1 && run != null && run > 0) {
          phase = `Run ${run} of ${numRuns} — optimizing`;
        } else {
          phase = "Grey Wolf optimization running";
        }
      }
      return {
        ...b,
        visible: true,
        percent: pct,
        phase,
        detail: paused ? b.detail : detail,
      };
    });
  }, [getActiveMs, setDeadline]);

  const setFinalizing = useCallback(() => {
    setDeadline(null);
    setEtaPausedRemainingSec(null);
    setBar({
      visible: true,
      percent: 100,
      phase: "Finalizing solution…",
      detail: "Loading the updated timetable",
    });
  }, [setDeadline]);

  const endRun = useCallback(() => {
    abortRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setRunStartedAt(null);
    progressEpochWallRef.current = null;
    progressSamplesRef.current = [];
    pausedAccumMsRef.current = 0;
    pauseStartedAtRef.current = null;
    setDeadline(null);
    setEtaPausedRemainingSec(null);
    window.setTimeout(() => {
      setBar({
        visible: false,
        percent: 0,
        phase: "",
        detail: "",
      });
    }, 450);
  }, [setDeadline]);

  const cancelRun = useCallback(() => {
    void (async () => {
      try {
        await fetch("/api/run/cancel", { method: "POST", cache: "no-store" });
      } catch {
        /* ignore */
      }
      abortRef.current?.abort();
    })();
  }, []);

  const runOptimizer = useCallback(async (): Promise<string | null> => {
    const runAbort = beginRun();
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        signal: runAbort.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 409) {
          try {
            const data = JSON.parse(text) as { error?: string };
            return data.error ?? (text || "A run is already in progress.");
          } catch {
            return text || "A run is already in progress.";
          }
        }
        try {
          const data = JSON.parse(text) as { error?: string };
          return data.error || text || `HTTP ${response.status}`;
        } catch {
          return text || `HTTP ${response.status}`;
        }
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream") || !response.body) {
        const text = await response.text();
        try {
          const data = JSON.parse(text) as { success?: boolean; error?: string };
          if (!data.success) {
            return data.error || "Algorithm execution failed";
          }
        } catch {
          return text || "Unexpected response from server";
        }
        return "Unexpected response from server";
      }

      setRunPhase(
        "Connected to optimizer",
        "Waiting for the first iteration — Python startup can take a few seconds",
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rawBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawBuffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseBlocks(rawBuffer);
        rawBuffer = rest;

        for (const { event, data } of events) {
          if (event === "progress") {
            try {
              const p = JSON.parse(data) as GwoOptimizerProgressPayload;
              updateProgress({
                current: Number(p.current),
                total: Number(p.total),
                ...(p.run != null ? { run: Number(p.run) } : {}),
                ...(p.numRuns != null ? { numRuns: Number(p.numRuns) } : {}),
                ...(p.best != null ? { best: Number(p.best) } : {}),
              });
            } catch {
              /* ignore */
            }
          } else if (event === "complete") {
            const payload = JSON.parse(data) as {
              success?: boolean;
              cancelled?: boolean;
              error?: string;
              output?: string;
              message?: string;
            };
            if (payload.cancelled) {
              return null;
            }
            if (!payload.success) {
              console.error("[v0] Algorithm error:", payload.error, payload.output);
              return (
                payload.error ||
                payload.output ||
                "Algorithm execution failed"
              );
            }
            console.log("[v0] Algorithm completed successfully");
            setFinalizing();
            const schedule = (await jsonFetcher(
              "/api/schedule",
            )) as SchedulePayload;
            await mutate("/api/schedule", schedule, { revalidate: false });
            setOptimizerScheduleEpoch((n) => n + 1);
            return null;
          }
        }
      }
      return "Connection closed before the optimizer finished.";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return null;
      }
      const errorMsg =
        err instanceof Error ? err.message : "Failed to run algorithm";
      console.error("[v0] Error running algorithm:", err);
      return errorMsg;
    } finally {
      endRun();
    }
  }, [beginRun, endRun, mutate, setFinalizing, setRunPhase, updateProgress]);

  const pauseRun = useCallback(async () => {
    try {
      await fetch("/api/run/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      setIsPaused(true);
      pauseStartedAtRef.current = Date.now();
      const d = etaDeadlineMsRef.current;
      setEtaPausedRemainingSec(
        d != null ? Math.max(0, Math.ceil((d - Date.now()) / 1000)) : null,
      );
      setDeadline(null);
      setBar((b) => ({
        ...b,
        phase: "Paused — click Resume to continue",
        detail:
          b.detail ||
          "Optimization is idle until you resume or cancel",
      }));
    } catch {
      /* ignore */
    }
  }, []);

  const resumeRun = useCallback(async () => {
    try {
      await fetch("/api/run/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      setIsPaused(false);
      setEtaPausedRemainingSec(null);
      if (pauseStartedAtRef.current != null) {
        pausedAccumMsRef.current += Date.now() - pauseStartedAtRef.current;
        pauseStartedAtRef.current = null;
      }
      setBar((b) => ({
        ...b,
        phase: "Grey Wolf optimization running",
      }));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      isRunning,
      isPaused,
      runStartedAt,
      bar,
      etaDeadlineMs,
      etaPausedRemainingSec,
      beginRun,
      updateProgress,
      setRunPhase,
      setFinalizing,
      endRun,
      cancelRun,
      pauseRun,
      resumeRun,
      runOptimizer,
      getRunElapsedActiveSec,
      optimizerScheduleEpoch,
    }),
    [
      isRunning,
      isPaused,
      runStartedAt,
      bar,
      etaDeadlineMs,
      etaPausedRemainingSec,
      beginRun,
      updateProgress,
      setRunPhase,
      setFinalizing,
      endRun,
      cancelRun,
      pauseRun,
      resumeRun,
      runOptimizer,
      getRunElapsedActiveSec,
      optimizerScheduleEpoch,
    ],
  );

  return (
    <GwoRunContext.Provider value={value}>{children}</GwoRunContext.Provider>
  );
}

export function useGwoRun(): GwoRunContextValue {
  const ctx = useContext(GwoRunContext);
  if (!ctx) {
    throw new Error("useGwoRun must be used within GwoRunProvider");
  }
  return ctx;
}

export function GwoTopProgressBar() {
  const {
    isRunning,
    isPaused,
    runStartedAt,
    bar,
    cancelRun,
    pauseRun,
    resumeRun,
    getRunElapsedActiveSec,
  } = useGwoRun();

  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (runStartedAt == null) {
      setElapsedSec(0);
      return;
    }
    const tick = () => setElapsedSec(getRunElapsedActiveSec());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [runStartedAt, getRunElapsedActiveSec, isPaused]);

  if (!bar.visible) return null;

  const displayPct = Math.min(100, Math.max(0, bar.percent));

  return (
    <div className="mb-0" aria-live="polite" aria-busy={displayPct < 100}>
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04] dark:border-slate-700 dark:bg-slate-900 dark:ring-white/[0.06] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-1 gap-3">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400"
              aria-hidden
            >
              {isPaused ? (
                <Pause className="h-4 w-4" strokeWidth={2.25} />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
                  {bar.phase}
                </h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {displayPct}%
                </span>
              </div>
              {bar.detail ? (
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {bar.detail}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
            {runStartedAt != null && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-slate-500 dark:text-slate-400 sm:justify-end">
                <span title="Active elapsed time — pauses while the optimizer is stopped are not counted">
                  Elapsed {formatElapsed(elapsedSec)}
                </span>
              </div>
            )}
            {isRunning ? (
              <div className="flex flex-wrap justify-end gap-2">
                {!isPaused ? (
                  <button
                    type="button"
                    onClick={() => void pauseRun()}
                    className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm transition-colors hover:bg-amber-100/90 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/40"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void resumeRun()}
                    className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-100/90 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                  >
                    Resume
                  </button>
                )}
                <button
                  type="button"
                  onClick={cancelRun}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-4 pb-4 pt-0">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 transition-[width] duration-300 ease-out dark:from-sky-400 dark:via-blue-400 dark:to-indigo-500"
              style={{
                width: `${displayPct}%`,
                boxShadow: "0 0 14px rgba(56, 189, 248, 0.35)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
