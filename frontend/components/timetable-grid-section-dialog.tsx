"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduleConfig, ScheduleEntry } from "@/lib/schedule-data";
import {
  allowedLecturerNamesForLecture,
  allowedRoomNamesForLecture,
  allowedTimeslotIdsForEntry,
  engineSlotTypeForCatalogueRow,
  entryNeedsRoom,
  findLectureConfig,
  mergeEntryWithPlacement,
} from "@/lib/schedule-edit-rules";
import {
  catalogueById,
  formatDeliveryMode,
  timeslotLongLabel,
  type TimeslotCatalogueEntry,
} from "@/lib/timetable-model";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

function roomCap(config: ScheduleConfig, name: string): number {
  const rv = config.rooms?.[name];
  if (rv == null) return 0;
  return typeof rv === "number" ? rv : (rv.capacity ?? 0);
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: ScheduleEntry | null;
  readOnly: boolean;
  config: ScheduleConfig;
  catalogue: TimeslotCatalogueEntry[];
  onApply: (next: ScheduleEntry) => void;
  /** When set, shows a destructive “Remove section” control (edit mode only). */
  onDelete?: () => void;
};

export function TimetableGridSectionDialog({
  open,
  onOpenChange,
  entry,
  readOnly,
  config,
  catalogue,
  onApply,
  onDelete,
}: Props) {
  const lec = entry ? findLectureConfig(config, entry) : undefined;
  const [ts, setTs] = useState("");
  const [room, setRoom] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [qTs, setQTs] = useState("");
  const [qRoom, setQRoom] = useState("");
  const [qLec, setQLec] = useState("");

  useEffect(() => {
    if (!entry) return;
    setTs(entry.timeslot);
    setRoom((entry.room || "").trim());
    setLecturer(entry.lecturer);
    setQTs("");
    setQRoom("");
    setQLec("");
  }, [entry, open]);

  const catMap = useMemo(() => catalogueById(catalogue), [catalogue]);

  const slotEngine = useMemo(() => {
    const row = catMap.get(ts);
    return engineSlotTypeForCatalogueRow(row);
  }, [catMap, ts]);

  const allowedTs = useMemo(() => {
    if (!entry || !lec) return [] as string[];
    const draft = { ...entry, timeslot: ts, room: room || null, lecturer };
    const base = allowedTimeslotIdsForEntry(config, catalogue, draft, lecturer);
    const set = new Set(base);
    if (entry.timeslot) set.add(entry.timeslot);
    return [...set].sort((a, b) => {
      const ra = catMap.get(a);
      const rb = catMap.get(b);
      const sa = ra ? (ra.start_hour ?? 0) : 0;
      const sb = rb ? (rb.start_hour ?? 0) : 0;
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b);
    });
  }, [entry, lec, config, catalogue, ts, room, lecturer, catMap]);

  const allowedRooms = useMemo(() => {
    if (!entry || !lec || !entryNeedsRoom(entry)) return [] as string[];
    const draft = { ...entry, timeslot: ts, room: room || null, lecturer };
    const row = catMap.get(ts);
    const eng = engineSlotTypeForCatalogueRow(row);
    return allowedRoomNamesForLecture(config, lec, eng, lec.size ?? draft.class_size ?? 0);
  }, [entry, lec, config, ts, room, lecturer, catMap]);

  /** When timeslot changes, pick a valid room if the current one is no longer allowed. */
  useEffect(() => {
    if (!entry || !lec || readOnly || !entryNeedsRoom(entry)) return;
    if (allowedRooms.length === 0) return;
    if (!room || !allowedRooms.includes(room)) {
      setRoom(allowedRooms[0]!);
    }
  }, [ts, allowedRooms, entry, lec, readOnly, room]);

  const allowedLecs = useMemo(() => {
    if (!lec) return [] as string[];
    return allowedLecturerNamesForLecture(config, lec);
  }, [lec, config]);

  const filteredTs = useMemo(() => {
    const q = qTs.trim().toLowerCase();
    return allowedTs.filter((id) => {
      if (!q) return true;
      const row = catMap.get(id);
      const lab = `${id} ${row ? timeslotLongLabel(row) : ""}`.toLowerCase();
      return lab.includes(q);
    });
  }, [allowedTs, qTs, catMap]);

  const filteredRooms = useMemo(() => {
    const q = qRoom.trim().toLowerCase();
    return allowedRooms.filter((r) => r.toLowerCase().includes(q));
  }, [allowedRooms, qRoom]);

  const filteredLecs = useMemo(() => {
    const q = qLec.trim().toLowerCase();
    return allowedLecs.filter((n) => n.toLowerCase().includes(q));
  }, [allowedLecs, qLec]);

  if (!entry) return null;

  const courseCode = String(entry.course_code ?? "").trim();
  const courseName =
    (entry.course_name || "").trim() ||
    (lec?.course_name && lec.course_name.trim()) ||
    "";
  const courseHeading = courseName || courseCode;
  const showCodeInHeading = Boolean(courseName && courseCode);

  const tsRow = catMap.get(ts);
  const canApply =
    !!lec &&
    !!tsRow &&
    (!entryNeedsRoom(entry) || (!!room && allowedRooms.includes(room))) &&
    allowedTs.includes(ts) &&
    allowedLecs.includes(lecturer);

  const applyHint = !lec
    ? "This section does not match any row in the active configuration (check lecture id / course code)."
    : !tsRow
      ? "Pick a valid timeslot from the list."
      : entryNeedsRoom(entry) && (!room || !allowedRooms.includes(room))
        ? "Pick a room that matches this session type and capacity."
        : !allowedLecs.includes(lecturer)
          ? "Pick an allowed lecturer."
          : !allowedTs.includes(ts)
            ? "Pick a timeslot allowed for this delivery mode and session type."
            : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-left text-base sm:text-lg">
            <span className="font-semibold tracking-tight text-foreground">{courseHeading}</span>
            {showCodeInHeading ? (
              <span className="font-mono font-semibold tracking-tight text-muted-foreground">
                {" "}
                ({courseCode})
              </span>
            ) : null}
            {lec?.section_number ? (
              <span className="text-muted-foreground font-normal"> · {lec.section_number}</span>
            ) : null}
          </DialogTitle>
          <DialogDescription className={readOnly ? "text-balance" : undefined}>
            {readOnly ? (
              "View-only summary. Turn on Edit timetable to make changes."
            ) : (
              <>
                Choose a timeslot, room (if required), and lecturer.{" "}
                <span className="whitespace-nowrap">
                  Only combinations that satisfy scheduling rules are listed.
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {readOnly ? (
          <div className="grid gap-3 text-sm">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Course</div>
              <div className="font-medium text-foreground">{courseHeading}</div>
              {showCodeInHeading ? (
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">Code {courseCode}</div>
              ) : null}
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Lecturer</div>
              <div className="font-medium text-foreground">{entry.lecturer}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Timeslot</div>
              <div className="font-medium text-foreground">
                {entry.timeslot_label ??
                  timeslotLongLabel(catMap.get(entry.timeslot) ?? { id: entry.timeslot, days: [] })}
              </div>
              <div className="mt-0.5 font-mono text-xs text-muted-foreground">{entry.timeslot}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Room</div>
              <div className="font-medium text-foreground">
                {entryNeedsRoom(entry) ? entry.room || "—" : "— (online)"}
              </div>
            </div>
            {entry.class_size != null && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Class size</div>
                <div>{entry.class_size}</div>
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-muted-foreground">Mode</div>
              <div>
                {formatDeliveryMode(entry.delivery_mode)}
                {(entry.session_type || "").toLowerCase() === "lab" ? " · Lab" : ""}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!lec && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Cannot edit this row</AlertTitle>
                <AlertDescription>
                  No matching lecture was found in <span className="font-mono">config.json</span> (merged with the
                  database). Check that <span className="font-mono">lecture_id {String(entry.lecture_id)}</span> exists
                  under <span className="font-mono">lectures</span>.
                </AlertDescription>
              </Alert>
            )}

            <div
              className={`grid gap-4 ${entryNeedsRoom(entry) ? "sm:grid-cols-2" : ""}`}
            >
              <div className="min-w-0 space-y-2">
                <Label className="text-foreground">Timeslot</Label>
                <p className="text-xs text-muted-foreground">
                  Slot pattern for this course: <span className="font-mono font-medium">{slotEngine}</span>
                </p>
                <Input placeholder="Filter timeslots…" value={qTs} onChange={(e) => setQTs(e.target.value)} className="h-9" />
                {filteredTs.length === 0 ? (
                  <p className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-950">
                    No compatible timeslots. If you use database slots, ensure the timetable catalogue includes them.
                  </p>
                ) : (
                  <ul className="max-h-[min(14rem,40vh)] overflow-auto rounded-md border border-border text-sm sm:max-h-[min(18rem,45vh)]">
                    {filteredTs.map((id) => {
                      const row = catMap.get(id);
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => setTs(id)}
                            className={`flex w-full flex-col items-start px-2 py-1.5 text-left hover:bg-muted/80 ${
                              ts === id ? "bg-primary/15 font-medium" : ""
                            }`}
                          >
                            <span>{row ? timeslotLongLabel(row) : id}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{id}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {entryNeedsRoom(entry) ? (
                <div className="min-w-0 space-y-2">
                  <Label className="text-foreground">Room</Label>
                  <p className="text-xs text-muted-foreground">
                    Only suitable rooms with enough seats are shown.
                  </p>
                  <Input placeholder="Filter rooms…" value={qRoom} onChange={(e) => setQRoom(e.target.value)} className="h-9" />
                  {filteredRooms.length === 0 ? (
                    <p className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-950">
                      No room fits this timeslot pattern and class size. Try another timeslot.
                    </p>
                  ) : (
                    <ul className="max-h-[min(14rem,40vh)] overflow-auto rounded-md border border-border text-sm sm:max-h-[min(18rem,45vh)]">
                      {filteredRooms.map((r) => (
                        <li key={r}>
                          <button
                            type="button"
                            onClick={() => setRoom(r)}
                            className={`block w-full px-2 py-1.5 text-left hover:bg-muted/80 ${
                              room === r ? "bg-primary/15 font-medium" : ""
                            }`}
                          >
                            {r}{" "}
                            <span className="text-muted-foreground">(capacity {roomCap(config, r)})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Lecturer</Label>
              <Input placeholder="Filter lecturers…" value={qLec} onChange={(e) => setQLec(e.target.value)} className="h-9" />
              {filteredLecs.length === 0 ? (
                <p className="rounded-md border border-dashed border-destructive/30 bg-destructive/5 px-2 py-2 text-xs">
                  No allowed lecturers are configured for this course.
                </p>
              ) : (
                <ul className="max-h-32 overflow-auto rounded-md border border-border text-sm">
                  {filteredLecs.map((n) => (
                    <li key={n}>
                      <button
                        type="button"
                        onClick={() => setLecturer(n)}
                        className={`block w-full px-2 py-1.5 text-left hover:bg-muted/80 ${
                          lecturer === n ? "bg-primary/15 font-medium" : ""
                        }`}
                      >
                        {n}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {applyHint && lec && (
              <Alert>
                <AlertCircle className="text-amber-600" />
                <AlertTitle className="text-amber-950">Before you can apply</AlertTitle>
                <AlertDescription className="text-amber-950/90">{applyHint}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {!readOnly && (
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <div className="flex w-full flex-wrap justify-end gap-2">
              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  className="mr-auto"
                  onClick={() => {
                    onDelete();
                    onOpenChange(false);
                  }}
                >
                  Remove section
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={!canApply} onClick={() => {
                if (!lec || !tsRow) return;
                const cap = entryNeedsRoom(entry) ? roomCap(config, room) : 0;
                const next = mergeEntryWithPlacement(
                  { ...entry, lecturer },
                  catalogue,
                  entryNeedsRoom(entry) ? room : null,
                  ts,
                  cap,
                );
                onApply(next);
                onOpenChange(false);
              }}>
                Apply changes
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
