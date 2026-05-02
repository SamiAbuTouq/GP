"use client"

import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { TimetableConflictRow, TimetableConflictSummary } from "@/lib/timetable-conflicts"
import { formatConflictRowSummary } from "@/lib/timetable-conflicts"

/** Banner at top of schedule viewer when a scenario result has conflicts or invalid metrics. */
export function HardConflictsViewerBanner({
  summary,
  loading,
}: {
  summary: TimetableConflictSummary | null
  loading: boolean
}) {
  if (loading) {
    return (
      <Alert className="border-amber-500/60 bg-amber-50 dark:bg-amber-950/25">
        <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden />
        <AlertTitle>Checking timetable validity…</AlertTitle>
        <AlertDescription className="text-sm">Loading conflict details.</AlertDescription>
      </Alert>
    )
  }

  if (!summary?.requiresConflictAcknowledgment) return null

  const syntheticNote =
    summary.metricsIsValid === false && summary.conflicts.length === 0
      ? "Metrics flagged this timetable as invalid, but no per-session conflict rows were stored."
      : null

  return (
    <Alert variant="destructive" className="border-2 shadow-sm">
      <AlertTriangle className="h-4 w-4" aria-hidden />
      <AlertTitle>
        Hard conflicts detected ({summary.hardConflictCount})
      </AlertTitle>
      <AlertDescription className="space-y-3 text-sm">
        <p className="font-medium text-destructive-foreground">
          This timetable has hard scheduling conflicts. Do not apply it to production or publish it until you understand
          every issue below. You can still browse sessions normally.
        </p>
        {syntheticNote ? <p className="text-destructive-foreground/95">{syntheticNote}</p> : null}
        {summary.conflicts.length > 0 ? (
          <ScrollArea className="max-h-52 rounded-md border border-destructive/40 bg-background/80 pr-3 dark:bg-background/40">
            <ul className="list-disc space-y-2 py-2 pl-5 pr-2 text-left">
              {summary.conflicts.map((c: TimetableConflictRow) => (
                <li key={c.conflictId} className="marker:text-destructive">
                  <span className="text-foreground">{formatConflictRowSummary(c)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({c.severity})
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

/** Lists conflicts and requires checkbox acknowledgment before destructive actions. */
export function HardConflictsAcknowledgmentFields({
  summary,
  loading,
  acknowledged,
  onAcknowledgedChange,
  contextLabel,
}: {
  summary: TimetableConflictSummary | null
  loading: boolean
  acknowledged: boolean
  onAcknowledgedChange: (next: boolean) => void
  /** e.g. "apply this result" / "publish this draft" */
  contextLabel: string
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading conflict details…</p>
  }

  if (!summary?.requiresConflictAcknowledgment) return null

  const id = "hard-conflicts-ack"

  return (
    <div className="space-y-3">
      <Alert variant="destructive" className="border-2 shadow-sm">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <AlertTitle>Hard conflicts</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            This timetable has {summary.hardConflictCount} hard conflict
            {summary.hardConflictCount === 1 ? "" : "s"}.{contextLabel ? ` ${contextLabel}` : ""} Only proceed if you accept
            the risk.
          </p>
          {summary.metricsIsValid === false && summary.conflicts.length === 0 ? (
            <p>Metrics report this timetable as invalid; there are no detailed conflict rows.</p>
          ) : null}
        </AlertDescription>
      </Alert>
      {summary.conflicts.length > 0 ? (
        <ScrollArea className="max-h-48 rounded-md border border-border bg-muted/40 pr-3">
          <ul className="list-disc space-y-2 py-2 pl-5 pr-2 text-left text-sm">
            {summary.conflicts.map((c) => (
              <li key={c.conflictId}>
                {formatConflictRowSummary(c)}
                <span className="ml-2 text-xs text-muted-foreground">({c.severity})</span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      ) : null}
      <div className="flex items-start gap-2 rounded-md border border-border p-3">
        <Checkbox
          id={id}
          checked={acknowledged}
          onCheckedChange={(v) => onAcknowledgedChange(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug">
          I understand this schedule has conflicts and I still want to proceed.
        </Label>
      </div>
    </div>
  )
}
