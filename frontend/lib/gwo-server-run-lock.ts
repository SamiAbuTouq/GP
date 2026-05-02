/**
 * Single-flight lock for the GWO optimizer on this Node process.
 * Cancelling a run uses this controller — not the HTTP request signal — so
 * navigating away does not stop the Python child.
 */

let activeRunAbort: AbortController | null = null;

type GwoServerProgress = {
  current: number;
  total: number;
  run?: number;
  numRuns?: number;
  best?: number;
};

type GwoServerRunStatus = {
  running: boolean;
  paused: boolean;
  startedAt: number | null;
  lastProgressAt: number | null;
  phase: string;
  detail: string;
  progress: GwoServerProgress | null;
};

let runStatus: GwoServerRunStatus = {
  running: false,
  paused: false,
  startedAt: null,
  lastProgressAt: null,
  phase: "",
  detail: "",
  progress: null,
};

export function tryBeginGwoRun(controller: AbortController): boolean {
  if (activeRunAbort) return false;
  activeRunAbort = controller;
  runStatus = {
    running: true,
    paused: false,
    startedAt: Date.now(),
    lastProgressAt: null,
    phase: "Starting optimizer…",
    detail: "Sending request to the server",
    progress: null,
  };
  return true;
}

export function endGwoRun(): void {
  activeRunAbort = null;
  runStatus = {
    running: false,
    paused: false,
    startedAt: null,
    lastProgressAt: null,
    phase: "",
    detail: "",
    progress: null,
  };
}

/** User-initiated cancel (and optional cleanup); returns whether a run was active. */
export function abortActiveGwoRun(): boolean {
  if (!activeRunAbort) return false;
  try {
    activeRunAbort.abort();
  } catch {
    /* ignore */
  }
  return true;
}

export function setGwoRunPhase(phase: string, detail?: string): void {
  if (!runStatus.running) return;
  runStatus = {
    ...runStatus,
    phase,
    ...(detail !== undefined ? { detail } : {}),
  };
}

export function setGwoRunPaused(paused: boolean): void {
  if (!runStatus.running) return;
  runStatus = {
    ...runStatus,
    paused,
    phase: paused ? "Paused — click Resume to continue" : "Grey Wolf optimization running",
    detail: paused
      ? runStatus.detail || "Optimization is idle until you resume or cancel"
      : runStatus.detail,
  };
}

export function setGwoRunProgress(progress: GwoServerProgress): void {
  if (!runStatus.running) return;
  const numRuns = progress.numRuns != null ? Number(progress.numRuns) : undefined;
  const run = progress.run != null ? Number(progress.run) : undefined;

  const phase = runStatus.paused
    ? "Paused — click Resume to continue"
    : numRuns != null && numRuns > 1 && run != null && run > 0
      ? `Run ${run} of ${numRuns} — optimizing`
      : "Grey Wolf optimization running";

  const detailParts: string[] = [
    `Iteration ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`,
  ];
  if (
    numRuns != null &&
    numRuns > 0 &&
    run != null &&
    run > 0 &&
    numRuns > 1
  ) {
    detailParts.push(`run ${run} of ${numRuns}`);
  }
  if (progress.best != null && Number.isFinite(progress.best)) {
    detailParts.push(`best fitness ${progress.best}`);
  }

  runStatus = {
    ...runStatus,
    phase,
    detail: detailParts.join(" · "),
    progress,
    lastProgressAt: Date.now(),
  };
}

export function setGwoRunFinalizing(): void {
  if (!runStatus.running) return;
  runStatus = {
    ...runStatus,
    paused: false,
    phase: "Finalizing solution…",
    detail: "Loading the updated timetable",
  };
}

export function getGwoRunStatus(): GwoServerRunStatus {
  return runStatus;
}
