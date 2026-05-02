import { NextResponse } from "next/server";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import { existsSync, writeFileSync } from "fs";
import { getGwoControlFilePath } from "@/lib/gwo-control-path";
import {
  endGwoRun,
  getGwoRunStatus,
  setGwoRunFinalizing,
  setGwoRunPhase,
  setGwoRunProgress,
  tryBeginGwoRun,
} from "@/lib/gwo-server-run-lock";
import {
  getOptimizerGlobalLockOwner,
  releaseOptimizerGlobalLock,
  tryAcquireOptimizerGlobalLock,
} from "@/lib/optimizer-global-lock";
import { writeGwoConfigFileMergedWithDatabase } from "@/lib/write-gwo-config";

/** Next.js route max duration (seconds). Match the Python spawn timeout below. */
export const maxDuration = 10_800; // 3 hours
export const runtime = "nodejs";

type PythonAttempt = { label: string; program: string; prefixArgs: string[] };

/** Only true when the *Python executable* is missing — not script/import errors ("no such file" for .py). */
function looksLikePythonInterpreterMissing(
  spawnFailed: boolean,
  error: string,
  exitCode?: number,
): boolean {
  if (spawnFailed) return true;
  const e = error.toLowerCase();
  if (/is not recognized as an internal or external command/.test(error)) return true;
  if (e.includes("command not found")) return true;
  if (e.includes("microsoft store") || e.includes("app execution alias")) return true;
  if (exitCode === 9009 && !error.trim()) return true;
  if (exitCode === 127) return true;
  return false;
}

function buildPythonAttempts(): PythonAttempt[] {
  const user =
    process.env.GWO_PYTHON?.trim() || process.env.PYTHON?.trim() || "";
  const fromEnv: PythonAttempt[] = user
    ? [{ label: user, program: user, prefixArgs: [] }]
    : [];

  if (process.platform === "win32") {
    return [
      ...fromEnv,
      { label: "py -3", program: "py", prefixArgs: ["-3"] },
      { label: "py", program: "py", prefixArgs: [] },
      { label: "python3", program: "python3", prefixArgs: [] },
      { label: "python", program: "python", prefixArgs: [] },
    ];
  }

  return [
    ...fromEnv,
    { label: "python3", program: "python3", prefixArgs: [] },
    { label: "python", program: "python", prefixArgs: [] },
    { label: "py", program: "py", prefixArgs: [] },
  ];
}

type StreamOutcome =
  | { kind: "spawn_error"; message: string }
  | {
      kind: "finished";
      exitCode: number | null;
      stdout: string;
      stderr: string;
      aborted: boolean;
    };

type RunPythonOptions = {
  abortSignal: AbortSignal;
  controlFilePath: string;
};

function runPythonAttemptStreaming(
  att: PythonAttempt,
  scriptPath: string,
  scriptsCwd: string,
  onProgress: (payload: Record<string, unknown>) => void,
  options: RunPythonOptions,
): Promise<StreamOutcome> {
  return new Promise((resolve) => {
    if (options.abortSignal.aborted) {
      resolve({
        kind: "finished",
        exitCode: null,
        stdout: "",
        stderr: "",
        aborted: true,
      });
      return;
    }

    const argv = [...att.prefixArgs, "-u", scriptPath];
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(att.program, argv, {
        cwd: scriptsCwd,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1",
          GWO_UI_PROGRESS: "1",
          GWO_CONTROL_FILE: options.controlFilePath,
        },
      }) as ChildProcessWithoutNullStreams;
    } catch (err) {
      resolve({
        kind: "spawn_error",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    let stdoutBuf = "";
    let fullStdout = "";
    let fullStderr = "";
    let settled = false;
    let abortedByClient = false;

    const onAbort = () => {
      if (settled) return;
      abortedByClient = true;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    };

    options.abortSignal.addEventListener("abort", onAbort);

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        options.abortSignal.removeEventListener("abort", onAbort);
        child.kill();
        resolve({
          kind: "finished",
          exitCode: null,
          stdout: fullStdout,
          stderr: fullStderr + "\nProcess timeout after 3 hours",
          aborted: false,
        });
      }
    }, 3 * 60 * 60 * 1000);

    const flushStdoutLines = (chunk: string) => {
      fullStdout += chunk;
      stdoutBuf += chunk;
      const parts = stdoutBuf.split("\n");
      stdoutBuf = parts.pop() ?? "";
      for (const line of parts) {
        if (line.startsWith("__GWO_PROGRESS__")) {
          const raw = line.slice("__GWO_PROGRESS__".length);
          try {
            const payload = JSON.parse(raw) as Record<string, unknown>;
            onProgress(payload);
          } catch {
            /* ignore malformed */
          }
        }
      }
    };

    child.stdout?.on("data", (data: Buffer) => {
      flushStdoutLines(data.toString());
    });

    child.stderr?.on("data", (data: Buffer) => {
      fullStderr += data.toString();
    });

    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        options.abortSignal.removeEventListener("abort", onAbort);
        resolve({
          kind: "spawn_error",
          message: err.message,
        });
      }
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.abortSignal.removeEventListener("abort", onAbort);
      if (stdoutBuf.startsWith("__GWO_PROGRESS__")) {
        try {
          const raw = stdoutBuf.slice("__GWO_PROGRESS__".length);
          onProgress(JSON.parse(raw) as Record<string, unknown>);
        } catch {
          /* ignore */
        }
      }
      stdoutBuf = "";
      resolve({
        kind: "finished",
        exitCode: code,
        stdout: fullStdout,
        stderr: fullStderr,
        aborted: abortedByClient,
      });
    });
  });
}

function safeCloseStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  try {
    controller.close();
  } catch {
    /* already closed or broken pipe */
  }
}

export async function POST(request: Request) {
  console.log("[v0] POST /api/run called (SSE stream)");

  let semesterMode: "normal" | "summer" = "normal";
  try {
    const body = (await request.json()) as { semesterMode?: string };
    if (body?.semesterMode === "summer") semesterMode = "summer";
  } catch {
    /* empty or non-JSON body — default normal */
  }

  const scriptsDir = path.join(process.cwd(), "scripts");
  const scriptCandidates = ["GWO-v6.py", "GWO-v5.py"];
  const scriptName =
    scriptCandidates.find((n) => existsSync(path.join(scriptsDir, n))) ??
    scriptCandidates[0];
  const scriptPath = path.join(scriptsDir, scriptName);
  const controlFilePath = getGwoControlFilePath();

  if (!existsSync(scriptPath)) {
    return NextResponse.json(
      {
        success: false,
        error: `Optimizer script not found under scripts/ (looked for ${scriptCandidates.join(", ")}).`,
        output: "",
      },
      { status: 500 },
    );
  }

  const runAbort = new AbortController();
  const globalLock = tryAcquireOptimizerGlobalLock("timetable");
  if (!globalLock.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          globalLock.holder === "whatif"
            ? "A What-If scenario run is already in progress. Wait for it to finish first."
            : "An optimizer run is already in progress on the server. Wait for it to finish or cancel it first.",
        output: "",
      },
      { status: 409 },
    );
  }
  if (!tryBeginGwoRun(runAbort)) {
    releaseOptimizerGlobalLock("timetable");
    return NextResponse.json(
      {
        success: false,
        error:
          "An optimizer run is already in progress on the server. Wait for it to finish or cancel it first.",
        output: "",
      },
      { status: 409 },
    );
  }

  try {
    await writeGwoConfigFileMergedWithDatabase({ semesterMode });
  } catch (e) {
    console.error("[api/run] Failed to refresh config from database:", e);
  }

  try {
    writeFileSync(controlFilePath, "run", "utf8");
  } catch (e) {
    console.error("[api/run] Failed to write control file:", e);
    endGwoRun();
    releaseOptimizerGlobalLock("timetable");
    return NextResponse.json(
      {
        success: false,
        error: "Could not initialize optimizer control file.",
        output: "",
      },
      { status: 500 },
    );
  }

  const attempts = buildPythonAttempts();
  const encoder = new TextEncoder();
  const runSignal = runAbort.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let clientOpen = true;
      const send = (event: string, data: unknown) => {
        if (!clientOpen) return;
        try {
          const line =
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          clientOpen = false;
        }
      };

      try {
        setGwoRunPhase(
          "Connected to optimizer",
          "Waiting for the first iteration — Python startup can take a few seconds",
        );
        for (const att of attempts) {
          if (runSignal.aborted) {
            send("complete", {
              success: false,
              cancelled: true,
              message: "Run cancelled",
              output: "",
            });
            safeCloseStream(controller);
            return;
          }
          console.log(`[v0] Trying Python (stream): ${att.label}`);
          const outcome = await runPythonAttemptStreaming(
            att,
            scriptPath,
            scriptsDir,
            (payload) => {
              const progress = {
                current: Number(payload.current ?? 0),
                total: Number(payload.total ?? 0),
                ...(payload.run != null ? { run: Number(payload.run) } : {}),
                ...(payload.numRuns != null ? { numRuns: Number(payload.numRuns) } : {}),
                ...(payload.best != null ? { best: Number(payload.best) } : {}),
              };
              setGwoRunProgress(progress);
              send("progress", payload);
            },
            { abortSignal: runSignal, controlFilePath },
          );

          if (outcome.kind === "spawn_error") {
            console.log(`[v0] Spawn error for ${att.label}:`, outcome.message);
            continue;
          }

          const { exitCode, stdout, stderr, aborted } = outcome;
          const errText = (stderr || "").trim();
          const combinedErr = errText;

          if (aborted) {
            send("complete", {
              success: false,
              cancelled: true,
              message: "Run cancelled",
              output: stdout,
            });
            safeCloseStream(controller);
            return;
          }

          if (
            looksLikePythonInterpreterMissing(false, combinedErr, exitCode ?? undefined)
          ) {
            console.log(`[v0] ${att.label} not runnable (interpreter missing), trying next...`);
            continue;
          }

          if (exitCode === 0) {
            setGwoRunFinalizing();
            send("complete", {
              success: true,
              output: stdout,
              message: "Algorithm completed successfully",
            });
            safeCloseStream(controller);
            return;
          }

          send("complete", {
            success: false,
            error:
              combinedErr ||
              stdout.trim() ||
              `Algorithm execution failed with exit code ${exitCode}`,
            output: stdout,
            exitCode,
          });
          safeCloseStream(controller);
          return;
        }

        const tried = attempts.map((a) => a.label).join(", ");
        const winHint =
          process.platform === "win32"
            ? " On Windows, install Python from python.org (check “Add to PATH”), or set GWO_PYTHON to your python.exe. If `python` opens the Microsoft Store, disable App execution aliases for python.exe under Settings → Apps → Advanced app settings."
            : "";
        send("complete", {
          success: false,
          error: `Python not found. Tried: ${tried}.${winHint}`,
          output: "",
        });
        safeCloseStream(controller);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send("complete", { success: false, error: message, output: "" });
        safeCloseStream(controller);
      } finally {
        endGwoRun();
        releaseOptimizerGlobalLock("timetable");
      }
    },
    cancel() {
      /* Client disconnected or aborted fetch — keep Python running until it exits or /api/run/cancel */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  const status = getGwoRunStatus();
  const globalLockOwner = getOptimizerGlobalLockOwner();
  return NextResponse.json({ ...status, globalLockOwner }, {
    headers: { "Cache-Control": "no-store" },
  });
}
