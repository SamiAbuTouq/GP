import { ReportDatasetSchema, type ReportDataset } from "./dataset"

export type FetchReportDatasetParams =
  | { semesterId: number; timetableId?: undefined }
  | { timetableId: number; semesterId?: undefined }

export async function fetchReportDataset(params: FetchReportDatasetParams): Promise<ReportDataset> {
  const sp = new URLSearchParams()
  const tid = "timetableId" in params ? params.timetableId : undefined
  const sid = "semesterId" in params ? params.semesterId : undefined
  if (typeof tid === "number" && tid > 0) {
    sp.set("timetableId", String(tid))
  } else if (typeof sid === "number" && Number.isFinite(sid) && sid > 0) {
    sp.set("semesterId", String(sid))
  } else {
    throw new Error("Provide semesterId or timetableId.")
  }

  const res = await fetch(`/api/reports/aggregates?${sp.toString()}`)
  const raw: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof raw === "object" && raw && "error" in raw
        ? String((raw as { error: unknown }).error)
        : res.statusText
    throw new Error(msg || `Failed to load report data (${res.status})`)
  }
  return ReportDatasetSchema.parse(raw)
}
