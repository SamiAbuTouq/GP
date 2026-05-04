import { ApiClient } from "@/lib/api-client";
import type { GwoOptimizerProgressPayload } from "@/components/gwo-run-context";

export type ScenarioSseHandlers = {
  updateProgress: (p: GwoOptimizerProgressPayload) => void;
  setPercent: (pct: number) => void;
  setRunPhase: (phase: string, detail?: string) => void;
};

export type ScenarioSseOutcome = "continue" | "completed" | "failed";
type ScenarioRunTerminalState = "cancelled" | "failed" | "completed" | null;

function isCancelledMessage(message: unknown): boolean {
  if (typeof message !== "string") return false;
  const t = message.trim().toLowerCase();
  if (t === "run cancelled by user." || t === "run cancelled by user") return true;
  if (t.includes("cancelled by user")) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRunTerminalStateWithRetry(
  runId: number,
  opts?: { attempts?: number; delayMs?: number; signal?: AbortSignal },
): Promise<Awaited<ReturnType<typeof fetchRunTerminalState>>> {
  const attempts = Math.max(1, opts?.attempts ?? 10);
  const delayMs = Math.max(0, opts?.delayMs ?? 120);
  const signal = opts?.signal;
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) break;
    const t = await fetchRunTerminalState(runId);
    if (t.state !== null) return t;
    if (i < attempts - 1 && delayMs > 0) await sleep(delayMs);
  }
  return { state: null };
}

async function fetchRunTerminalState(
  runId: number,
): Promise<{
  state: ScenarioRunTerminalState;
  resultTimetableId?: number | null;
  errorMessage?: string;
}> {
  try {
    const row = await ApiClient.request<Record<string, unknown>>(`/what-if/runs/${runId}`);
    const status = String(row.status ?? "").trim().toLowerCase();
    const message = row.errorMessage ?? row.error_message;
    const rawResultId = row.resultTimetableId ?? row.result_timetable_id;
    const resultTimetableId =
      typeof rawResultId === "number" && Number.isFinite(rawResultId) && rawResultId > 0
        ? rawResultId
        : null;
    if (status === "completed" || status === "applied") {
      return { state: "completed", resultTimetableId };
    }
    if (status === "failed" && isCancelledMessage(message)) {
      return { state: "cancelled" };
    }
    if (status === "failed") {
      const err =
        typeof message === "string" && message.trim()
          ? message.trim()
          : "Scenario run failed.";
      return { state: "failed", errorMessage: err };
    }
    return { state: null };
  } catch {
    return { state: null };
  }
}

async function resolveOutcomeAfterAbort(
  runId: number,
): Promise<{ ok: boolean; cancelled?: boolean; streamInterrupted?: boolean; errorMessage?: string; resultTimetableId?: number | null }> {
  const terminal = await fetchRunTerminalStateWithRetry(runId, { attempts: 8, delayMs: 120 });
  if (terminal.state === "cancelled") return { ok: false, cancelled: true };
  if (terminal.state === "failed" && isCancelledMessage(terminal.errorMessage)) {
    return { ok: false, cancelled: true };
  }
  if (terminal.state === "completed") {
    return { ok: true, resultTimetableId: terminal.resultTimetableId ?? null };
  }
  if (terminal.state === "failed") {
    return { ok: false, errorMessage: terminal.errorMessage ?? "Scenario run failed." };
  }
  return { ok: false, streamInterrupted: true };
}

function scenarioPhaseTitle(phase: string): string {
  const p = phase.trim().toLowerCase();
  switch (p) {
    case "cloning":
      return "Preparing sandbox";
    case "conditions":
      return "Applying conditions";
    case "gwo":
      return "Grey Wolf optimization";
    case "validating":
      return "Validating solution";
    case "computing_metrics":
      return "Saving results";
    default:
      return phase
        .replace(/_/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
}

function shouldHideScenarioDetailMessage(message: unknown): boolean {
  if (typeof message !== "string") return true;
  const trimmed = message.trim();
  if (!trimmed) return true;
  // Internal fallback noise from legacy GWO output path; keep UI feedback clean.
  if (/^\[warn\]\s*repair fallback\b/i.test(trimmed)) return true;
  return false;
}

function parseTextGwoProgress(message: unknown): GwoOptimizerProgressPayload | null {
  if (typeof message !== "string") return null;
  const text = message.trim();
  if (!text) return null;
  // Example:
  // GWO: 50%|█████ | 2/4 [00:13<00:11, 5.77s/iter, best=1215.7643, run=1/2]
  const iterMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!iterMatch) return null;
  const current = Number(iterMatch[1]);
  const total = Number(iterMatch[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return null;

  const payload: GwoOptimizerProgressPayload = { current, total };
  const bestMatch = text.match(/best\s*=\s*([+-]?\d+(?:\.\d+)?)/i);
  if (bestMatch) {
    const best = Number(bestMatch[1]);
    if (Number.isFinite(best)) payload.best = best;
  }
  const runMatch = text.match(/run\s*=\s*(\d+)\s*\/\s*(\d+)/i);
  if (runMatch) {
    const run = Number(runMatch[1]);
    const numRuns = Number(runMatch[2]);
    if (Number.isFinite(run) && run > 0) payload.run = run;
    if (Number.isFinite(numRuns) && numRuns > 0) payload.numRuns = numRuns;
  }
  return payload;
}

/**
 * Maps one JSON line from GET /what-if/runs/:id/stream into GWO bar state.
 * Handles run_scenario.py phases (pct/phase/message) and GWO iteration lines
 * ({ type, current, total, best, ... }).
 */
export function applyScenarioSsePayload(
  parsed: Record<string, unknown>,
  handlers: ScenarioSseHandlers,
): ScenarioSseOutcome {
  const t = parsed.type as string | undefined;
  if (t === "error") return "failed";
  if (t === "result") return "completed";

  if (t === "progress") {
    let hasIterationProgress = false;
    const cur = parsed.current;
    const tot = parsed.total;
    if (typeof cur === "number" && typeof tot === "number" && tot > 0) {
      hasIterationProgress = true;
      handlers.updateProgress({
        current: cur,
        total: tot,
        ...(typeof parsed.run === "number" ? { run: parsed.run } : {}),
        ...(typeof parsed.numRuns === "number" ? { numRuns: parsed.numRuns } : {}),
        ...(typeof parsed.best === "number" ? { best: parsed.best } : {}),
        ...(typeof parsed.fitness === "number" && typeof parsed.best !== "number"
          ? { best: parsed.fitness }
          : {}),
      });
    } else {
      const textProgress = parseTextGwoProgress(parsed.message);
      if (textProgress) {
        hasIterationProgress = true;
        handlers.updateProgress(textProgress);
      }
    }

    const rawPct = parsed.pct;
    if (typeof rawPct === "number" && Number.isFinite(rawPct)) {
      handlers.setPercent(rawPct);
    }

    // Non-iteration updates: show run_scenario.py phase + message (not a generic “connected” label).
    if (!hasIterationProgress && !shouldHideScenarioDetailMessage(parsed.message)) {
      const phaseKey = typeof parsed.phase === "string" ? parsed.phase.trim() : "";
      const title = phaseKey ? scenarioPhaseTitle(phaseKey) : "Waiting on server";
      handlers.setRunPhase(title, (parsed.message as string).trim());
    }
    return "continue";
  }

  if (t === "stream_closed") return "continue";
  return "continue";
}

function parseSseDataBlocks(buffer: string): { lines: string[]; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const lines: string[] = [];
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n")
      .trim();
    if (data) lines.push(data);
  }
  return { lines, rest };
}

export async function streamScenarioRunSse(
  runId: number,
  signal: AbortSignal,
  handlers: ScenarioSseHandlers,
): Promise<{
  ok: boolean;
  cancelled?: boolean;
  streamInterrupted?: boolean;
  errorMessage?: string;
  resultTimetableId?: number | null;
}> {
  const token = ApiClient.getAccessToken();
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1").replace(/\/+$/, "");
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    const response = await fetch(`${baseUrl}/what-if/runs/${runId}/stream`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: "include",
      signal,
    });
    if (!response.ok || !response.body) {
      return { ok: false, errorMessage: "Failed to connect to run stream." };
    }
    handlers.setRunPhase(
      "Connected to optimizer",
      "Waiting for the first iteration — Python startup can take a few seconds",
    );

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawResult = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { lines, rest } = parseSseDataBlocks(buffer);
      buffer = rest;

      for (const line of lines) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }

        const outcome = applyScenarioSsePayload(parsed, handlers);
        if (outcome === "failed") {
          const msg =
            (typeof parsed.message === "string" && parsed.message) ||
            (typeof parsed.detail === "string" && parsed.detail) ||
            "Scenario run failed.";
          if (isCancelledMessage(msg)) {
            return { ok: false, cancelled: true };
          }
          return { ok: false, errorMessage: msg };
        }
        if (outcome === "completed") {
          sawResult = true;
          const rawResultId = parsed.result_timetable_id ?? parsed.resultTimetableId;
          const resultTimetableId =
            typeof rawResultId === "number" && Number.isFinite(rawResultId) && rawResultId > 0
              ? rawResultId
              : null;
          return { ok: true, resultTimetableId };
        }
      }
    }

    if (sawResult) return { ok: true };
    if (signal.aborted) {
      return resolveOutcomeAfterAbort(runId);
    }
    const terminal = await fetchRunTerminalStateWithRetry(runId, {
      attempts: 10,
      delayMs: 150,
      signal,
    });
    if (signal.aborted) {
      return resolveOutcomeAfterAbort(runId);
    }
    if (terminal.state === "completed") {
      return { ok: true, resultTimetableId: terminal.resultTimetableId ?? null };
    }
    if (terminal.state === "cancelled") {
      return { ok: false, cancelled: true };
    }
    if (terminal.state === "failed") {
      if (isCancelledMessage(terminal.errorMessage)) {
        return { ok: false, cancelled: true };
      }
      return { ok: false, errorMessage: terminal.errorMessage ?? "Scenario run failed." };
    }
    if (signal.aborted) {
      return resolveOutcomeAfterAbort(runId);
    }
    return { ok: false, errorMessage: "Stream ended before the run finished." };
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      try {
        reader?.releaseLock();
      } catch {
        /* ignore */
      }
      return resolveOutcomeAfterAbort(runId);
    }
    throw e;
  }
}
