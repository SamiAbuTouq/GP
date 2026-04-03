"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileSpreadsheet, FileText, FileDown, FileJson } from "lucide-react"
import { ExportIcon } from "@/components/custom-icons"
import { exportToCSV, exportToJSON, exportToExcel, exportToPDF } from "@/lib/export-utils"

type ExportFormat = "csv" | "json" | "xlsx" | "pdf"

interface ExportDialogProps<T extends Record<string, unknown>> {
  allData: T[]
  filteredData: T[]
  columns: { key: keyof T; label: string }[]
  filenamePrefix: string
  pdfTitle: string
  totalLabel?: string
  filteredLabel?: string
  isFiltered?: boolean
  filterDescription?: string
}

export function ExportDropdownWithDialog<T extends Record<string, unknown>>({
  allData,
  filteredData,
  columns,
  filenamePrefix,
  pdfTitle,
  totalLabel,
  filteredLabel,
  isFiltered = false,
  filterDescription,
}: ExportDialogProps<T>) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [format, setFormat] = useState<ExportFormat>("csv")
  const [scope, setScope] = useState<"all" | "filtered">("filtered")

  const formatLabel = (f: ExportFormat) => {
    switch (f) {
      case "csv": return "CSV"
      case "json": return "JSON"
      case "xlsx": return "Excel (.xlsx)"
      case "pdf": return "PDF"
    }
  }

  const openDialog = useCallback((f: ExportFormat) => {
    setFormat(f)
    setScope("filtered")
    setDialogOpen(true)
  }, [])

  const handleExport = useCallback(() => {
    const data = scope === "all" ? allData : filteredData
    const filename = `${filenamePrefix}-${scope === "all" ? "all" : "current"}`
    switch (format) {
      case "csv":
        exportToCSV(data, columns, filename)
        break
      case "json":
        exportToJSON(data, columns, filename)
        break
      case "xlsx":
        exportToExcel(data, columns, filename)
        break
      case "pdf":
        exportToPDF(data, columns, pdfTitle)
        break
    }
    setDialogOpen(false)
  }, [format, scope, allData, filteredData, columns, filenamePrefix, pdfTitle])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="bg-transparent">
            <ExportIcon className="mr-2 h-4 w-4" />Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openDialog("csv")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog("json")}>
            <FileJson className="mr-2 h-4 w-4" />
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog("xlsx")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export as Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openDialog("pdf")}>
            <FileDown className="mr-2 h-4 w-4" />
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export {pdfTitle}</DialogTitle>
            <DialogDescription>
              Choose which records to export as {formatLabel(format)}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as "all" | "filtered")} className="gap-4">
              <div
                className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setScope("all")}
              >
                <RadioGroupItem value="all" id="export-all-entity" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="export-all-entity" className="font-medium cursor-pointer">All Records</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Export all {totalLabel || `${allData.length}`} records regardless of filters.
                  </p>
                </div>
              </div>
              <div
                className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setScope("filtered")}
              >
                <RadioGroupItem value="filtered" id="export-filtered-entity" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="export-filtered-entity" className="font-medium cursor-pointer">
                    Currently Displayed Records
                    {isFiltered && <Badge variant="secondary" className="ml-2">Filtered</Badge>}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Export {filteredLabel || `${filteredData.length}`} records currently shown on the page.
                    {isFiltered && filterDescription && ` (${filterDescription})`}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExport}>
              <ExportIcon className="mr-2 h-4 w-4" />
              Export {formatLabel(format)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
