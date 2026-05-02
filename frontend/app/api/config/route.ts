import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { mergeFileConfigWithDatabase, type SemesterMode } from "@/lib/db-schedule-config";
import { mergeConfigWithDefaults, SCHEDULE_CONFIG_DEFAULTS } from "@/lib/schedule-config-merge";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

/** Query `mode` wins; otherwise use `semester_mode` from saved config (written after each GWO run). */
function resolveSemesterModeForGet(
  request: NextRequest,
  parsedFromFile: Record<string, unknown>,
): SemesterMode {
  const q = request.nextUrl.searchParams.get("mode");
  if (q === "summer") return "summer";
  if (q === "normal") return "normal";
  return parsedFromFile.semester_mode === "summer" ? "summer" : "normal";
}

export async function GET(request: NextRequest) {
  try {
    if (!existsSync(CONFIG_FILE)) {
      if (!existsSync(DATA_DIR)) {
        await mkdir(DATA_DIR, { recursive: true });
      }
      const semesterMode = resolveSemesterModeForGet(request, {});
      const initial = await mergeFileConfigWithDatabase(
        mergeConfigWithDefaults({} as Record<string, unknown>),
        semesterMode,
      );
      await writeFile(CONFIG_FILE, JSON.stringify(initial, null, 2), "utf-8");
      return NextResponse.json(initial);
    }
    const raw = await readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const semesterMode = resolveSemesterModeForGet(request, parsed);
    const out = await mergeFileConfigWithDatabase(mergeConfigWithDefaults(parsed), semesterMode);
    return NextResponse.json(out);
  } catch {
    const fallback = await mergeFileConfigWithDatabase(
      mergeConfigWithDefaults({} as Record<string, unknown>),
      "normal",
    );
    return NextResponse.json(fallback);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }

    const rawSoft = { ...(body.soft_weights ?? {}) } as Record<string, number>;
    if (rawSoft.single_session_day == null && rawSoft.early_thursday_penalty != null) {
      rawSoft.single_session_day = rawSoft.early_thursday_penalty;
    }

    const config = {
      rooms: body.rooms ?? SCHEDULE_CONFIG_DEFAULTS.rooms,
      timeslots: body.timeslots ?? SCHEDULE_CONFIG_DEFAULTS.timeslots,
      lecturers: body.lecturers ?? SCHEDULE_CONFIG_DEFAULTS.lecturers,
      lecturer_preferences:
        body.lecturer_preferences ?? SCHEDULE_CONFIG_DEFAULTS.lecturer_preferences,
      lectures: body.lectures ?? SCHEDULE_CONFIG_DEFAULTS.lectures,
      gwo_params: {
        ...SCHEDULE_CONFIG_DEFAULTS.gwo_params,
        ...(body.gwo_params ?? {}),
      },
      soft_weights: {
        ...SCHEDULE_CONFIG_DEFAULTS.soft_weights,
        ...rawSoft,
      },
      ...(body.study_plan_units != null ? { study_plan_units: body.study_plan_units } : {}),
      last_allowed_hour:
        body.last_allowed_hour === undefined
          ? SCHEDULE_CONFIG_DEFAULTS.last_allowed_hour
          : body.last_allowed_hour === null
            ? null
            : String(body.last_allowed_hour),
    };

    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
