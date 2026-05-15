import type { ScheduleConfig, SchedulingMode } from "@/lib/schedule-data";

export async function persistSchedulingMode(
  mode: SchedulingMode,
  semesterMode: "normal" | "summer",
): Promise<ScheduleConfig> {
  const getRes = await fetch(`/api/config?mode=${semesterMode}`);
  if (!getRes.ok) {
    throw new Error("Failed to load schedule configuration.");
  }
  const current = (await getRes.json()) as ScheduleConfig;
  const postRes = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...current, scheduling_mode: mode }),
  });
  if (!postRes.ok) {
    throw new Error("Failed to save scheduling mode.");
  }
  return { ...current, scheduling_mode: mode };
}
