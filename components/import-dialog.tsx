"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileSpreadsheet, FileText, AlertCircle, CheckCircle2, X } from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import { parseFile, type ParsedRow } from "@/lib/import-utils"

interface ColumnMapping {
  /** The display label for this column in the preview table */
  label: string
  /** Key in the final mapped data */
  key: string
}

interface ImportDialogProps<T> {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void
  /** Title for the dialog */
  title: string
  /** Description shown below the title */
  description: string
  /** Column definitions for the preview table */
  columns: ColumnMapping[]
  /**
   * Map a raw parsed row into the entity type.
   * Return null to skip invalid rows.
   */
  mapRow: (row: ParsedRow, index: number) => T | null
  /**
   * Called with the successfully mapped rows when the user confirms import.
   */
  onImport: (data: T[]) => void
  /** Optional: example headers to show as hint text */
  exampleHeaders?: string[]
}

type ImportStep = "upload" | "preview" | "done"

export function ImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  columns,
  mapRow,
  onImport,
  exampleHeaders,
}: ImportDialogProps<T>) {
  const [step, setStep] = useState<ImportStep>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [mappedRows, setMappedRows] = useState<T[]>([])
  const [skippedCount, setSkippedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep("upload")
    setFile(null)
    setRawRows([])
    setMappedRows([])
    setSkippedCount(0)
    setError(null)
    setIsDragging(false)
  }, [])

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) reset()
      onOpenChange(isOpen)
    },
    [onOpenChange, reset],
  )

  const processFile = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile)
      setError(null)

      try {
        const rows = await parseFile(selectedFile)
        if (rows.length === 0) {
          setError("The file appears to be empty or has no data rows.")
          return
        }

        setRawRows(rows)

        const mapped: T[] = []
        let skipped = 0

        rows.forEach((row, index) => {
          const result = mapRow(row, index)
          if (result !== null) {
            mapped.push(result)
          } else {
            skipped++
          }
        })

        if (mapped.length === 0) {
          setError(
            "No valid rows could be parsed. Please check that your file headers match the expected format.",
          )
          return
        }

        setMappedRows(mapped)
        setSkippedCount(skipped)
        setStep("preview")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse the file.")
      }
    },
    [mapRow],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) processFile(selectedFile)
    },
    [processFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) processFile(droppedFile)
    },
    [processFile],
  )

  const handleConfirmImport = useCallback(() => {
    onImport(mappedRows)
    setStep("done")
  }, [mappedRows, onImport])

  const getFileIcon = () => {
    if (!file) return <ImportIcon className="h-10 w-10" />
    const name = file.name.toLowerCase()
    if (name.endsWith(".csv")) return <FileText className="h-10 w-10 text-emerald-600" />
    return <FileSpreadsheet className="h-10 w-10 text-emerald-600" />
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {getFileIcon()}
              <p className="mt-3 text-sm font-medium text-foreground">
                Drag and drop your file here, or{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports CSV, XLSX, and XLS files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {exampleHeaders && (
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Expected column headers:</p>
                <div className="flex flex-wrap gap-1.5">
                  {exampleHeaders.map((h) => (
                    <Badge key={h} variant="secondary" className="text-xs font-mono">
                      {h}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {file && (
                  <Badge variant="outline" className="font-mono text-xs gap-1.5">
                    {file.name.toLowerCase().endsWith(".csv") ? (
                      <FileText className="h-3 w-3" />
                    ) : (
                      <FileSpreadsheet className="h-3 w-3" />
                    )}
                    {file.name}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-emerald-600 font-medium">
                  {mappedRows.length} valid
                </span>
                {skippedCount > 0 && (
                  <span className="text-amber-600 font-medium">
                    {skippedCount} skipped
                  </span>
                )}
              </div>
            </div>

            <ScrollArea className="h-[300px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      {columns.map((col) => (
                        <TableCell key={col.key} className="text-sm">
                          {String((row as Record<string, unknown>)[col.key] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {mappedRows.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing first 50 of {mappedRows.length} rows
              </p>
            )}
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Import Successful</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {mappedRows.length} records have been imported successfully.
              {skippedCount > 0 && ` ${skippedCount} rows were skipped.`}
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                <X className="mr-2 h-4 w-4" />
                Start Over
              </Button>
              <Button onClick={handleConfirmImport}>
                <ImportIcon className="mr-2 h-4 w-4" />
                Import {mappedRows.length} Records
              </Button>
            </>
          )}

          {step === "done" && (
            <Button onClick={() => handleClose(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
