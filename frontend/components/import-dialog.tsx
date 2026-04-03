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
import { FileSpreadsheet, FileText, AlertCircle, CheckCircle2, X, Loader2, AlertTriangle, Copy } from "lucide-react"
import { ImportIcon } from "@/components/custom-icons"
import { parseFile, type ParsedRow } from "@/lib/import-utils"
import { ScrollBar } from "@/components/ui/scroll-area"

interface ColumnMapping {
  /** The display label for this column in the preview table */
  label: string
  /** Key in the final mapped data */
  key: string
}

export interface ImportResult {
  added: number
  duplicates: number
  errors: number
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
   * Should return an ImportResult with counts of added, duplicates, and errors.
   */
  onImport: (data: T[]) => Promise<ImportResult>
  /** Optional: example headers to show as hint text */
  exampleHeaders?: string[]
  /**
   * A function that returns a unique key for each row, used to detect
   * duplicates within the file itself before sending to the server.
   * If not provided, no intra-file dedup is performed.
   */
  getRowKey?: (row: T) => string
}

type ImportStep = "upload" | "preview" | "importing" | "done"

export function ImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  columns,
  mapRow,
  onImport,
  exampleHeaders,
  getRowKey,
}: ImportDialogProps<T>) {
  const [step, setStep] = useState<ImportStep>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [mappedRows, setMappedRows] = useState<T[]>([])
  const [skippedCount, setSkippedCount] = useState(0)
  const [fileDuplicateCount, setFileDuplicateCount] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep("upload")
    setFile(null)
    setRawRows([])
    setMappedRows([])
    setSkippedCount(0)
    setFileDuplicateCount(0)
    setImportResult(null)
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
        let fileDupes = 0

        // Use a Set to detect duplicate keys within the file
        const seenKeys = new Set<string>()

        rows.forEach((row, index) => {
          const result = mapRow(row, index)
          if (result !== null) {
            // Check for intra-file duplicates if getRowKey is provided
            if (getRowKey) {
              const key = getRowKey(result)
              if (seenKeys.has(key)) {
                fileDupes++
                return // skip this duplicate within the file
              }
              seenKeys.add(key)
            }
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
        setFileDuplicateCount(fileDupes)
        setStep("preview")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse the file.")
      }
    },
    [mapRow, getRowKey],
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

  const handleConfirmImport = useCallback(async () => {
    setStep("importing")
    try {
      const result = await onImport(mappedRows)
      // Merge file-level duplicates into the result
      setImportResult({
        added: result.added,
        duplicates: result.duplicates + fileDuplicateCount,
        errors: result.errors,
      })
      setStep("done")
    } catch {
      setImportResult({
        added: 0,
        duplicates: fileDuplicateCount,
        errors: mappedRows.length,
      })
      setStep("done")
    }
  }, [mappedRows, onImport, fileDuplicateCount])

  const getFileIcon = () => {
    if (!file) return <ImportIcon className="h-10 w-10" />
    const name = file.name.toLowerCase()
    if (name.endsWith(".csv")) return <FileText className="h-10 w-10 text-emerald-600" />
    return <FileSpreadsheet className="h-10 w-10 text-emerald-600" />
  }

  const totalProcessed = importResult
    ? importResult.added + importResult.duplicates + importResult.errors + skippedCount
    : 0

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
          <div className="space-y-4 py-2 overflow-hidden">
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
                {fileDuplicateCount > 0 && (
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <Copy className="h-3 w-3" />
                    {fileDuplicateCount} duplicate{fileDuplicateCount !== 1 ? 's' : ''} in file
                  </span>
                )}
                {skippedCount > 0 && (
                  <span className="text-amber-600 font-medium">
                    {skippedCount} skipped
                  </span>
                )}
              </div>
            </div>

            <ScrollArea className="h-[300px] w-full rounded-md border">
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
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {mappedRows.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing first 50 of {mappedRows.length} rows
              </p>
            )}
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">Importing...</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Processing {mappedRows.length} records. Please wait.
            </p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && importResult && (
          <div className="flex flex-col items-center justify-center py-6">
            {importResult.added > 0 ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
            )}
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {importResult.added > 0 ? "Import Complete" : "No Records Added"}
            </h3>

            {/* Result breakdown */}
            <div className="mt-4 w-full max-w-sm space-y-2">
              {/* Added */}
              <div className="flex items-center justify-between rounded-md border bg-emerald-50 dark:bg-emerald-900/10 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-foreground">Successfully added</span>
                </div>
                <span className="text-sm font-bold text-emerald-600">{importResult.added}</span>
              </div>

              {/* Duplicates */}
              {importResult.duplicates > 0 && (
                <div className="flex items-center justify-between rounded-md border bg-amber-50 dark:bg-amber-900/10 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Copy className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-foreground">Duplicates skipped</span>
                  </div>
                  <span className="text-sm font-bold text-amber-600">{importResult.duplicates}</span>
                </div>
              )}

              {/* Errors */}
              {importResult.errors > 0 && (
                <div className="flex items-center justify-between rounded-md border bg-red-50 dark:bg-red-900/10 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-foreground">Failed</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">{importResult.errors}</span>
                </div>
              )}

              {/* Invalid rows */}
              {skippedCount > 0 && (
                <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Invalid rows skipped</span>
                  </div>
                  <span className="text-sm font-bold text-muted-foreground">{skippedCount}</span>
                </div>
              )}
            </div>

            {importResult.duplicates > 0 && (
              <p className="mt-3 text-xs text-muted-foreground text-center max-w-sm">
                Duplicate records were not added because they already exist in the database or appeared multiple times in the file.
              </p>
            )}
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

          {step === "importing" && (
            <Button variant="outline" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </Button>
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
