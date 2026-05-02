import { ApiClient } from "@/lib/api-client";
import type { GwoOptimizerProgressPayload } from "@/components/gwo-run-context";

export type ScenarioSseHandlers = {
  updateProgress: (p: GwoOptimizerProgressPayload) => void;
  setRunPhase: (phase: string, detail?: string) => void;
};

export type ScenarioSseOutcome = "continue" | "completed" | "failed";

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

    // Match timetable-generation UX: only iteration telemetry should drive live phase/detail.
    if (!hasIterationProgress && !shouldHideScenarioDetailMessage(parsed.message)) {
      // Keep signal from useful non-iteration messages without replacing with noisy raw logs.
      handlers.setRunPhase("Connected to optimizer", (parsed.message as string).trim());
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
): Promise<{ ok: boolean; errorMessage?: string; resultTimetableId?: number | null }> {
  const token = ApiClient.getAccessToken();
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/what-if/runs/${runId}/stream`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal,
  });
  if (!response.ok || !response.body) {
    return { ok: false, errorMessage: "Failed to connect to run stream." };
  }
  handlers.setRunPhase(
    "Connected to optimizer",
    "Waiting for the first iteration — Python startup can take a few seconds",
  );

  const reader = response.body.getReader();
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
  return { ok: false, errorMessage: "Stream ended before the run finished." };
}
