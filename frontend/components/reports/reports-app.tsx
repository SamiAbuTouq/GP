"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Building2,
  FileText,
  FileSpreadsheet,
  Download,
  Eye,
  Trash2,
  Check,
  ChevronRight,
  Search,
} from "lucide-react"
import { ChartPieIcon } from "@/components/ui/chart-pie-icon"
import { UserRoundIcon } from "@/components/ui/user-round-icon"
import { TriangleAlertIcon } from "@/components/ui/triangle-alert-icon"
import { GraduationCapIcon } from "@/components/ui/graduation-cap"
import { ActivityIcon } from "@/components/ui/activity"
import { SparklesIcon } from "@/components/ui/sparkles-icon"
import { FileTextIcon } from "@/components/ui/file-text-icon"
import { format } from "date-fns"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { REPORT_DEFINITIONS } from "@/lib/reports/definitions"
import type { ExportFormat, GeneratedReportRecord, ReportTypeId } from "@/lib/reports/types"
import { fetchReportDataset } from "@/lib/reports/fetch-dataset"
import { generateReportBlob, triggerDownload } from "@/lib/reports/generate-report"
import { deleteRecentReport, loadRecentReports, saveRecentReport } from "@/lib/reports/recent-storage"
import * as XLSX from "xlsx"

const REPORT_ICONS: Record<ReportTypeId, any> = {
  "room-utilization": Building2,
  "lecturer-workload": UserRoundIcon,
  "course-distribution": ChartPieIcon,
  "conflict-analysis": TriangleAlertIcon,
  "optimization-summary": ActivityIcon,
  "lecturer-preference-compliance": GraduationCapIcon,
  "room-type-matching": TriangleAlertIcon,
}

const ZIP_CSV_REPORT_TYPES = new Set<ReportTypeId>([
  "room-utilization",
  "lecturer-workload",
  "course-distribution",
  "conflict-analysis",
  "lecturer-preference-compliance",
  "room-type-matching",
])

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatLabel(f: ExportFormat): "PDF" | "Excel" | "CSV" {
  if (f === "excel") return "Excel"
  if (f === "csv") return "CSV"
  return "PDF"
}

function formatChoiceLabel(f: ExportFormat, reportTypeId: ReportTypeId | ""): string {
  if (f === "csv" && reportTypeId && ZIP_CSV_REPORT_TYPES.has(reportTypeId)) {
    return "CSV (zip)"
  }
  return formatLabel(f)
}

type SemesterListItem = {
  semesterId: number
  academicYear: string
  semester: string
  totalStudents: number | null
}

function semesterDisplayLabel(s: SemesterListItem) {
  const yr = s.academicYear.replace(/-/g, "–")
  return `${yr} ${s.semester}`
}

function ReportTypeButton({
  report,
  active,
  onClick,
}: {
  report: (typeof REPORT_DEFINITIONS)[number]
  active: boolean
  onClick: () => void
}) {
  const Icon = REPORT_ICONS[report.id]
  const iconRef = useRef<any>(null)
  const startIconAnimation = () => {
    const fn = iconRef.current?.startAnimation
    if (typeof fn === "function") fn.call(iconRef.current)
  }
  const stopIconAnimation = () => {
    const fn = iconRef.current?.stopAnimation
    if (typeof fn === "function") fn.call(iconRef.current)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={startIconAnimation}
      onMouseLeave={stopIconAnimation}
      className={cn(
        "rounded-xl border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md",
        active ? "border-primary ring-2 ring-primary/20 shadow-sm" : "border-border/80",
      )}
    >
      <div className="flex gap-3 p-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon ref={iconRef} size={20} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium leading-tight">{report.name}</span>
            {report.comingSoon ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                Coming soon
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm leading-snug">{report.description}</p>
          <div className="flex flex-wrap gap-1 pt-1">
            {report.formats.map((f: any) => (
              <Badge key={f} variant="secondary" className="text-[10px] font-normal">
                {formatLabel(f)}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}

export function ReportsApp() {
  const { toast } = useToast()
  const [mainTab, setMainTab] = useState("generate")
  const sparkleRef = useRef<any>(null)
  const fileTextRef = useRef<any>(null)

  const [selectedReportId, setSelectedReportId] = useState<ReportTypeId | "">("")
  const [exportFormat, setExportFormat] = useState<ExportFormat | "">("")
  const [hasChosenFormat, setHasChosenFormat] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [semesters, setSemesters] = useState<SemesterListItem[]>([])
  const [semestersLoading, setSemestersLoading] = useState(true)
  const [semestersError, setSemestersError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>("")
  const [hasChosenYear, setHasChosenYear] = useState(false)
  const [semesterId, setSemesterId] = useState<string>("")
  const [hasChosenSemester, setHasChosenSemester] = useState(false)
  const [selectionResetKey, setSelectionResetKey] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)

  const [recentReports, setRecentReports] = useState<GeneratedReportRecord[]>([])
  const [recentFilter, setRecentFilter] = useState("")
  const [previewReport, setPreviewReport] = useState<GeneratedReportRecord | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTable, setPreviewTable] = useState<string[][] | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GeneratedReportRecord | null>(null)

  const selectedDef = useMemo(
    () => REPORT_DEFINITIONS.find((r) => r.id === selectedReportId),
    [selectedReportId],
  )

  const timetableLabel = useMemo(() => {
    const s = semesters.find((x) => String(x.semesterId) === semesterId)
    return s ? semesterDisplayLabel(s) : semesterId ? `Semester #${semesterId}` : ""
  }, [semesters, semesterId])

  const yearOptions = useMemo(() => {
    const set = new Set(semesters.map((s) => s.academicYear))
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [semesters])

  const semesterOptionsForYear = useMemo(() => {
    if (!selectedYear) return []
    return semesters
      .filter((s) => s.academicYear === selectedYear)
      .sort((a, b) => a.semester.localeCompare(b.semester, undefined, { numeric: true }))
  }, [semesters, selectedYear])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setSemestersLoading(true)
      setSemestersError(null)
      try {
        const res = await fetch("/api/semesters")
        const data: unknown = await res.json()
        if (!res.ok) {
          throw new Error(
            typeof data === "object" && data && "error" in data
              ? String((data as { error: unknown }).error)
              : "Could not load semesters",
          )
        }
        const list = Array.isArray(data)
          ? (data as SemesterListItem[]).filter((r) => typeof r.semesterId === "number")
          : []
        if (!cancelled) {
          setSemesters(list)
          setSelectedYear((prev) => {
            // Do not auto-select a year: the user must explicitly choose it for Step 3
            if (hasChosenYear && prev && list.some((x) => x.academicYear === prev)) return prev
            return ""
          })
          setSemesterId((prev) => {
            // Do not auto-select a semester: the user must explicitly choose it for Step 3
            if (hasChosenSemester && prev && list.some((x) => String(x.semesterId) === prev)) return prev
            return ""
          })
        }
      } catch (e) {
        if (!cancelled) {
          setSemestersError(e instanceof Error ? e.message : "Could not load semesters")
          setSemesters([])
        }
      } finally {
        if (!cancelled) setSemestersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasChosenSemester, hasChosenYear])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stored = await loadRecentReports()
        if (!cancelled) setRecentReports(stored)
      } catch (e) {
        console.error(e)
        // Non-fatal: allow the page to function even if persistence fails.
        toast({
          title: "Could not restore recent reports",
          description: "Recent Reports will still work, but won’t persist on this device.",
          variant: "destructive",
        })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wizardProgress = useMemo(() => {
    let p = 0
    if (selectedReportId) p += 30
    if (selectedReportId && exportFormat !== "" && hasChosenFormat) p += 25
    if (selectedReportId && selectedYear && hasChosenYear && semesterId && hasChosenSemester) p += 25
    if (
      selectedReportId &&
      exportFormat !== "" &&
      hasChosenFormat &&
      selectedYear &&
      hasChosenYear &&
      semesterId &&
      hasChosenSemester &&
      !selectedDef?.comingSoon
    )
      p += 20
    return Math.min(p, 100)
  }, [
    selectedReportId,
    exportFormat,
    hasChosenFormat,
    selectedYear,
    hasChosenYear,
    semesterId,
    hasChosenSemester,
    selectedDef?.comingSoon,
  ])

  const handleSelectReport = (id: ReportTypeId) => {
    setSelectedReportId(id)
    // Format must be explicitly chosen by the user.
    setExportFormat("")
    setHasChosenFormat(false)
    setSelectedYear("")
    setHasChosenYear(false)
    setSemesterId("")
    setHasChosenSemester(false)
    setHasGenerated(false)
  }

  const generationKey = `${selectedReportId}|${exportFormat}|${selectedYear}|${semesterId}`
  useEffect(() => {
    setHasGenerated(false)
  }, [generationKey])

  const canGenerate =
    !!selectedReportId &&
    exportFormat !== "" &&
    hasChosenFormat &&
    !!selectedYear &&
    hasChosenYear &&
    !!semesterId &&
    hasChosenSemester &&
    !selectedDef?.comingSoon &&
    !semestersLoading &&
    !semestersError &&
    !isGenerating

  const handleGenerate = async (opts: { download: boolean }) => {
    if (
      !selectedReportId ||
      exportFormat === "" ||
      !hasChosenFormat ||
      !selectedYear ||
      !hasChosenYear ||
      !semesterId ||
      !hasChosenSemester ||
      !selectedDef ||
      selectedDef.comingSoon
    )
      return
    setIsGenerating(true)
    try {
      const dataset = await fetchReportDataset(Number(semesterId))
      const { blob, mimeType, extension, baseFilename } = await generateReportBlob({
        reportTypeId: selectedReportId,
        format: exportFormat as ExportFormat,
        dataset,
      })
      const filename = `${baseFilename}.${extension}`
      if (opts.download) {
        triggerDownload(blob, filename, mimeType)
      }

      const label = dataset.semesterLabel
      const record: GeneratedReportRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        displayName: `${selectedDef.name.replace(/ Report$/, "")} — ${label}`,
        reportTypeName: selectedDef.name,
        reportTypeId: selectedReportId,
        format: formatLabel(exportFormat as ExportFormat),
        timetableLabel: label,
        generatedAt: new Date(),
        sizeBytes: blob.size,
        blob,
        mimeType,
        extension,
      }
      setRecentReports((prev) => [record, ...prev])
      void saveRecentReport(record)
      setHasGenerated(true)
      // Reset the wizard after successful generation so the next report starts from a fresh selection.
      setExportFormat("")
      setHasChosenFormat(false)
      setSelectedYear("")
      setHasChosenYear(false)
      setSemesterId("")
      setHasChosenSemester(false)
      setSelectionResetKey((prev) => prev + 1)
      toast({
        title: "Report generated",
        description: opts.download
          ? `${filename} was downloaded and added to Recent Reports.`
          : "Saved to Recent Reports for this session.",
      })
    } catch (e) {
      console.error(e)
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Could not build the report.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const openPreview = useCallback((r: GeneratedReportRecord) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewReport(r)
    setPreviewUrl(null)
    setPreviewTable(null)

    if (r.extension === "pdf") {
      const url = URL.createObjectURL(r.blob)
      previewUrlRef.current = url
      setPreviewUrl(url)
      return
    }
    if (r.extension === "csv") {
      r.blob.text().then((text) => {
        const lines = text.trim().split(/\r?\n/)
        const rows = lines.map((line) => {
          const out: string[] = []
          let cur = ""
          let q = false
          for (let i = 0; i < line.length; i++) {
            const c = line[i]
            if (c === '"') {
              q = !q
            } else if (c === "," && !q) {
              out.push(cur)
              cur = ""
            } else cur += c
          }
          out.push(cur)
          return out
        })
        setPreviewTable(rows)
      })
      return
    }
    if (r.extension === "zip") {
      setPreviewTable([
        ["Preview unavailable for ZIP exports"],
        ["Download the file to inspect the packaged CSV files."],
      ])
      return
    }
    if (r.extension === "xlsx") {
      r.blob.arrayBuffer().then((buf) => {
        const wb = XLSX.read(buf, { type: "array" })
        const sheet = wb.SheetNames[0]
        if (!sheet) return
        const data = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheet], {
          header: 1,
          defval: "",
        }) as string[][]
        setPreviewTable(data)
      })
    }
  }, [])

  const closePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
    setPreviewTable(null)
    setPreviewReport(null)
  }

  const handleDownloadRecent = (r: GeneratedReportRecord) => {
    const safe = r.displayName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")
    triggerDownload(r.blob, `${safe.slice(0, 80)}.${r.extension}`, r.mimeType)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setRecentReports((prev) => prev.filter((x) => x.id !== deleteTarget.id))
    void deleteRecentReport(deleteTarget.id)
    setDeleteTarget(null)
    toast({ title: "Report removed", description: "The entry was deleted from this session." })
  }

  const filteredRecent = useMemo(() => {
    const q = recentFilter.trim().toLowerCase()
    if (!q) return recentReports
    return recentReports.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        r.reportTypeName.toLowerCase().includes(q) ||
        r.timetableLabel.toLowerCase().includes(q) ||
        r.format.toLowerCase().includes(q),
    )
  }, [recentReports, recentFilter])

  const stepItems = [
    { n: 1, label: "Type", done: Boolean(selectedReportId), showCircle: true },
    { n: 2, label: "Format", done: Boolean(selectedReportId && exportFormat !== "" && hasChosenFormat), showCircle: true },
    {
      n: 3,
      label: "Timetable",
      done: Boolean(selectedReportId && selectedYear && hasChosenYear && semesterId && hasChosenSemester),
      showCircle: true,
    },
    { n: 4, label: "Generate", done: Boolean(hasGenerated), showCircle: false },
  ]

  return (
    <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className="min-h-0 flex-1 overflow-auto">
            <div className="mx-auto max-w-6xl space-y-8 p-4 lg:p-8">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-balance">
                    Reports
                  </h1>
                  <Badge variant="secondary" className="font-normal">
                    Export &amp; analytics
                  </Badge>
                </div>
              </div>

              <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
                  <TabsList className="grid h-auto w-full max-w-md grid-cols-2 p-1">
                    <TabsTrigger
                      value="generate"
                      className="group gap-2 py-2.5"
                      onMouseEnter={() => sparkleRef.current?.startAnimation()}
                      onMouseLeave={() => sparkleRef.current?.stopAnimation()}
                    >
                      <SparklesIcon ref={sparkleRef} className="h-4 w-4 opacity-70 transition-transform group-hover:scale-110" />
                      Generate Report
                    </TabsTrigger>
                    <TabsTrigger
                      value="recent"
                      className="group gap-2 py-2.5"
                      onMouseEnter={() => fileTextRef.current?.startAnimation()}
                      onMouseLeave={() => fileTextRef.current?.stopAnimation()}
                    >
                      <FileTextIcon ref={fileTextRef} className="h-4 w-4 opacity-70 transition-transform group-hover:scale-110" />
                      Recent Reports
                      {recentReports.length > 0 ? (
                        <Badge variant="outline" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                          {recentReports.length}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                  </TabsList>

                <TabsContent value="generate" className="mt-0 space-y-6 focus-visible:outline-none">
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                      <section className="space-y-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Step 1 — Report type
                          </h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {REPORT_DEFINITIONS.map((report) => (
                            <ReportTypeButton
                              key={report.id}
                              report={report}
                              active={selectedReportId === report.id}
                              onClick={() => handleSelectReport(report.id)}
                            />
                          ))}
                        </div>
                      </section>

                      <Separator />

                      <section className={cn("space-y-4", !selectedReportId && "opacity-50 pointer-events-none")}>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Step 2 — Export format
                        </h2>
                        <RadioGroup
                          value={exportFormat}
                          onValueChange={(v) => {
                            setExportFormat(v as ExportFormat)
                            setHasChosenFormat(true)
                          }}
                          className="grid gap-3 sm:grid-cols-3"
                          disabled={!selectedReportId}
                        >
                          {(["pdf", "excel", "csv"] as const).map((f) => {
                            const allowed = selectedDef?.formats.includes(f) ?? false
                            return (
                              <label
                                key={f}
                                className={cn(
                                  "flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card p-4 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5",
                                  !allowed && "cursor-not-allowed opacity-40",
                                )}
                              >
                                <RadioGroupItem value={f} id={`fmt-${f}`} disabled={!selectedReportId || !allowed} />
                                <div className="flex flex-1 items-center gap-2">
                                  {f === "pdf" ? (
                                    <FileText className="h-5 w-5 text-red-600/90" />
                                  ) : f === "excel" ? (
                                    <FileSpreadsheet className="h-5 w-5 text-emerald-600/90" />
                                  ) : (
                                    <FileSpreadsheet className="h-5 w-5 text-sky-600/90" />
                                  )}
                                  <div>
                                    <div className="text-sm font-medium">
                                      {formatChoiceLabel(f, selectedReportId)}
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                      {f === "pdf"
                                        ? "Print-ready layout"
                                        : f === "excel"
                                          ? "Multi-sheet workbook"
                                          : "Flat data interchange"}
                                    </div>
                                  </div>
                                </div>
                              </label>
                            )
                          })}
                        </RadioGroup>
                      </section>

                      <Separator />

                      <section className={cn("space-y-3", !selectedReportId && "opacity-50 pointer-events-none")}>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Step 3 — Timetable
                        </h2>
                        <div className="max-w-md space-y-2">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="year-select">Academic year</Label>
                              <Select
                                key={`year-${selectionResetKey}`}
                                value={selectedYear || undefined}
                                onValueChange={(v) => {
                                  setSelectedYear(v)
                                  setHasChosenYear(true)
                                  setSemesterId("")
                                  setHasChosenSemester(false)
                                }}
                                disabled={!selectedReportId || semestersLoading || semesters.length === 0}
                              >
                                <SelectTrigger id="year-select" className="h-11">
                                  <SelectValue placeholder={semestersLoading ? "Loading years…" : "Select year"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {yearOptions.map((y) => (
                                    <SelectItem key={y} value={y}>
                                      {y.replace(/-/g, "–")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="semester-select">Semester</Label>
                              <Select
                                key={`semester-${selectionResetKey}`}
                                value={semesterId || undefined}
                                onValueChange={(v) => {
                                  setSemesterId(v)
                                  setHasChosenSemester(true)
                                }}
                                disabled={
                                  !selectedReportId ||
                                  semestersLoading ||
                                  semesters.length === 0 ||
                                  !selectedYear ||
                                  !hasChosenYear
                                }
                              >
                                <SelectTrigger id="semester-select" className="h-11">
                                  <SelectValue placeholder={selectedYear ? "Select semester" : "Select year first"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {semesterOptionsForYear.map((t) => (
                                    <SelectItem key={t.semesterId} value={String(t.semesterId)}>
                                      {t.semester}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {semestersError ? (
                            <p className="text-destructive text-xs">{semestersError}</p>
                          ) : (
                            <p className="text-muted-foreground text-xs">
                              Select an academic year and semester to generate a report for that period.
                            </p>
                          )}
                        </div>
                      </section>

                      <Separator />

                      <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Step 4 — Generate
                        </h2>
                        {selectedDef?.comingSoon ? (
                          <Card className="border-dashed bg-muted/30">
                            <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1">
                                <p className="font-medium">This report is not available yet</p>
                                <p className="text-muted-foreground text-sm max-w-prose">
                                  {selectedDef.comingSoonReason}
                                </p>
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex w-full sm:w-auto">
                                    <Button disabled className="w-full sm:w-auto">
                                      Generate &amp; download
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-sm text-pretty">
                                  {selectedDef.comingSoonReason ??
                                    "This export is not available yet."}
                                </TooltipContent>
                              </Tooltip>
                            </CardContent>
                          </Card>
                        ) : (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                              <Button
                                size="lg"
                                className="min-w-[200px]"
                                disabled={!canGenerate}
                                onClick={() => handleGenerate({ download: true })}
                              >
                                {isGenerating ? (
                                  <>
                                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                    Generating…
                                  </>
                                ) : (
                                  <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Generate &amp; download
                                  </>
                                )}
                              </Button>
                              <Button
                                size="lg"
                                variant="outline"
                                className="min-w-[150px] bg-transparent"
                                disabled={!canGenerate}
                                onClick={() => handleGenerate({ download: false })}
                              >
                                Generate
                              </Button>
                            </div>
                          </div>
                        )}
                      </section>
                    </div>

                    <div className="lg:col-span-1">
                      <Card className="sticky top-6 z-10 border-border/80 shadow-sm lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:overflow-auto">
                        <CardHeader className="pb-3">
                          <div className="space-y-1">
                            <CardTitle className="text-base">Guided export</CardTitle>
                            <CardDescription>Complete each step in order.</CardDescription>
                          </div>
                          <div className="pt-3">
                            <Progress value={wizardProgress} className="h-1.5" />
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {stepItems.map((s, i) => (
                                <div key={s.n} className="flex items-center gap-2">
                                  {s.showCircle ? (
                                    <div
                                      className={cn(
                                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                                        s.done
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-muted-foreground/25 text-muted-foreground",
                                      )}
                                    >
                                      {s.done ? <Check className="h-3.5 w-3.5" /> : s.n}
                                    </div>
                                  ) : null}
                                  <span
                                    className={cn(
                                      "text-xs font-medium",
                                      s.done ? "text-foreground" : "text-muted-foreground",
                                      !s.showCircle && "pl-1",
                                    )}
                                  >
                                    {s.label}
                                  </span>
                                  {i < stepItems.length - 1 ? (
                                    <ChevronRight className="hidden h-4 w-4 text-muted-foreground/40 sm:inline" />
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                          <Separator />
                          <div className="space-y-1">
                            <div className="text-muted-foreground text-xs uppercase tracking-wide">
                              Current selection
                            </div>
                            <div className="text-muted-foreground text-xs">
                              Review before you generate.
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs uppercase tracking-wide">
                              Report
                            </div>
                            <div className="font-medium">
                              {selectedDef?.name ?? "—"}
                              {selectedDef?.comingSoon ? (
                                <Badge variant="outline" className="ml-2 align-middle text-[10px]">
                                  Soon
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <Separator />
                          <div>
                            <div className="text-muted-foreground text-xs uppercase tracking-wide">
                              Format
                            </div>
                            <div className="font-medium">
                              {selectedReportId && exportFormat !== "" && hasChosenFormat
                                ? formatChoiceLabel(exportFormat as ExportFormat, selectedReportId)
                                : "—"}
                            </div>
                          </div>
                          <Separator />
                          <div>
                            <div className="text-muted-foreground text-xs uppercase tracking-wide">
                              Timetable
                            </div>
                            <div className="font-medium">
                              {selectedReportId && selectedYear && hasChosenYear && semesterId && hasChosenSemester
                                ? timetableLabel
                                : "—"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="recent" className="mt-0 space-y-6 focus-visible:outline-none">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Recent Reports</h2>
                      <p className="text-muted-foreground text-sm">
                        Session-only history. Reloading the page clears this list.
                      </p>
                    </div>
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search name, type, semester…"
                        className="h-10 pl-9"
                        value={recentFilter}
                        onChange={(e) => setRecentFilter(e.target.value)}
                      />
                    </div>
                  </div>

                  {filteredRecent.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground/40" />
                      <p className="font-medium text-muted-foreground">
                        {recentReports.length === 0 ? "No reports yet" : "No matches for your search"}
                      </p>
                      <p className="text-muted-foreground text-sm max-w-sm">
                        {recentReports.length === 0
                          ? "Generate a report from the other tab — it will show up here instantly."
                          : "Try a different search term."}
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[min(560px,calc(100vh-280px))] pr-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="min-w-[200px]">Report</TableHead>
                            <TableHead>Format</TableHead>
                            <TableHead className="min-w-[160px]">Timetable</TableHead>
                            <TableHead className="text-right">Size</TableHead>
                            <TableHead className="min-w-[140px]">Generated</TableHead>
                            <TableHead className="text-right w-[140px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecent.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>
                                <div className="font-medium leading-snug">{r.displayName}</div>
                                <div className="text-muted-foreground text-xs">{r.reportTypeName}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="font-normal">
                                  {r.format}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{r.timetableLabel}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {formatBytes(r.sizeBytes)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm tabular-nums">
                                {format(r.generatedAt, "MMM d, yyyy · HH:mm")}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-0.5">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openPreview(r)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleDownloadRecent(r)}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Download</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteTarget(r)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>

        <Dialog open={Boolean(previewReport)} onOpenChange={(o) => !o && closePreview()}>
          <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4 text-left">
              <DialogTitle className="pr-8">{previewReport?.displayName ?? "Preview"}</DialogTitle>
              <DialogDescription className="line-clamp-2">
                {previewReport
                  ? `${previewReport.reportTypeName} · ${previewReport.format} · ${previewReport.timetableLabel}`
                  : null}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-[50vh] max-h-[calc(90vh-120px)]">
              {previewUrl ? (
                <iframe title="PDF preview" src={previewUrl} className="h-[min(70vh,600px)] w-full border-0" />
              ) : previewTable ? (
                <ScrollArea className="h-[min(70vh,600px)] p-4">
                  <Table>
                    <TableBody>
                      {(() => {
                        const maxCols = Math.max(1, ...previewTable.map((row) => row.length))
                        return previewTable.map((row, ri) => (
                          <TableRow key={ri} className="hover:bg-transparent">
                            {Array.from({ length: maxCols }, (_, ci) => (
                              <TableCell
                                key={ci}
                                className={cn(
                                  "max-w-[220px] whitespace-pre-wrap align-top text-xs",
                                  ri === 0 && "bg-muted/50 font-medium",
                                )}
                              >
                                {row[ci] != null && row[ci] !== "" ? String(row[ci]) : ""}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      })()}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
                  Loading preview…
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this report?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `"${deleteTarget.displayName}" will be removed from your session list. The file on disk is unchanged.`
                  : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  )
}
