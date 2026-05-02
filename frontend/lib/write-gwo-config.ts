import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { mergeFileConfigWithDatabase } from "./db-schedule-config";
import { mergeConfigWithDefaults } from "./schedule-config-merge";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

export type SemesterMode = "normal" | "summer";

/**
 * Refreshes `data/config.json` with Prisma-backed rooms, lecturers, lectures,
 * timeslots (from the `timeslot` table when present), and lecturer preferences
 * (from `lecturer_preference`), while preserving GWO params, soft weights, and
 * study plan from the existing file (or defaults). Invoked before spawning the Python optimizer.
 */
export async function writeGwoConfigFileMergedWithDatabase(options?: {
  semesterMode?: SemesterMode;
}): Promise<void> {
  const semesterMode: SemesterMode =
    options?.semesterMode === "summer" ? "summer" : "normal";

  let parsed: Record<string, unknown> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      const raw = await readFile(CONFIG_FILE, "utf-8");
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  const merged = mergeConfigWithDefaults(parsed);
  const forGwo = await mergeFileConfigWithDatabase(merged, semesterMode);
  const withMode = { ...forGwo, semester_mode: semesterMode };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(withMode, null, 2), "utf-8");
}
