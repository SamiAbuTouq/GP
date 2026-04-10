import { ReportDatasetSchema, type ReportDataset } from "./dataset"

export async function fetchReportDataset(semesterId: number): Promise<ReportDataset> {
  const res = await fetch(`/api/reports/aggregates?semesterId=${semesterId}`)
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
