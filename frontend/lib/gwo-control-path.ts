import path from "path";

/** Shared with Python via GWO_CONTROL_FILE; pause/resume/cancel orchestration. */
export function getGwoControlFilePath(): string {
  return path.join(process.cwd(), "scripts", ".gwo_run_control");
}
