export type ExportFormat = "pdf" | "excel" | "csv"

export type ReportTypeId =
  | "room-utilization"
  | "lecturer-workload"
  | "course-distribution"
  | "conflict-analysis"
  | "optimization-summary"
  | "lecturer-preference-compliance"
  | "room-type-matching"

export type ReportDefinition = {
  id: ReportTypeId
  name: string
  shortName: string
  description: string
  formats: ExportFormat[]
  comingSoon: boolean
  comingSoonReason?: string
}

export type TimetableOption = {
  id: string
  label: string
}

export type GeneratedReportRecord = {
  id: string
  displayName: string
  reportTypeName: string
  reportTypeId: ReportTypeId
  format: "PDF" | "Excel" | "CSV"
  timetableLabel: string
  generatedAt: Date
  sizeBytes: number
  blob: Blob
  mimeType: string
  extension: string
}
