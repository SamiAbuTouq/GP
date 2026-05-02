"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduleConfig, ScheduleEntry } from "@/lib/schedule-data";
import {
  allowedLecturerNamesForLecture,
  allowedRoomNamesForLecture,
  allocateExtraLectureId,
  explainNoAddSectionCandidates,
  isTimeslotAllowedForLecture,
  lectureConfigCourseSectionKey,
  lecturerTimeslotAllowed,
  listLectureConfigsForAddDialog,
  mergeEntryWithPlacement,
  nextFreeSectionLabelForCourse,
  normDelivery,
  engineSlotTypeForCatalogueRow,
  scheduleEntryCourseSectionKey,
} from "@/lib/schedule-edit-rules";
import {
  catalogueById,
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

type TargetCell = { rowKey: string; timeslotId: string } | null;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetCell: TargetCell;
  config: ScheduleConfig;
  catalogue: TimeslotCatalogueEntry[];
  scheduleEntries: ScheduleEntry[];
  /** When true, any configured section may be added again with a new id beyond the official per-course limit. */
  extraSectionsOverride: boolean;
  onAdd: (entry: ScheduleEntry) => void;
};

function roomCap(config: ScheduleConfig, roomName: string): number {
  const rv = config.rooms?.[roomName];
  if (rv == null) return 0;
  return typeof rv === "number" ? rv : (rv.capacity ?? 0);
}

export function TimetableGridAddSectionDialog({
  open,
  onOpenChange,
  targetCell,
  config,
  catalogue,
  scheduleEntries,
  extraSectionsOverride,
  onAdd,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedLectureId, setSelectedLectureId] = useState<string>("");
  const [selectedLecturer, setSelectedLecturer] = useState("");

  const catMap = useMemo(() => catalogueById(catalogue), [catalogue]);
  const targetTs = targetCell?.timeslotId ?? "";
  const targetRow = targetCell?.rowKey ?? "";
  const tsRow = targetTs ? catMap.get(targetTs) : undefined;
  const engineSlotType = engineSlotTypeForCatalogueRow(tsRow);
  const isOnlineRow = targetRow === "__online__";

  /** Sections not on the timetable yet that match delivery + timeslot pattern + have instructors; `fitsThisCell` is false when no allowed room equals this row (still listed so you can see the full catalog). */
  const candidateRows = useMemo(() => {
    if (!targetCell || !tsRow) return [];
    const all = listLectureConfigsForAddDialog(config, scheduleEntries, extraSectionsOverride);
    const rows: { lecture: (typeof all)[0]; fitsThisCell: boolean }[] = [];
    for (const lec of all) {
      const delivery = normDelivery(lec.delivery_mode);
      if (isOnlineRow && delivery !== "online") continue;
      if (!isOnlineRow && delivery === "online") continue;
      if (!isTimeslotAllowedForLecture(lec, tsRow)) continue;
      const names = allowedLecturerNamesForLecture(config, lec);
      if (names.length === 0) continue;
      let fitsThisCell = true;
      if (!isOnlineRow) {
        const allowedRooms = allowedRoomNamesForLecture(config, lec, engineSlotType, lec.size ?? 0);
        if (allowedRooms.length === 0) continue;
        if (!allowedRooms.includes(targetRow)) fitsThisCell = false;
      }
      rows.push({ lecture: lec, fitsThisCell });
    }
    rows.sort((a, b) => {
      if (a.fitsThisCell !== b.fitsThisCell) return a.fitsThisCell ? -1 : 1;
      return String(a.lecture.course).localeCompare(String(b.lecture.course));
    });
    return rows;
  }, [config, scheduleEntries, extraSectionsOverride, targetCell, tsRow, isOnlineRow, engineSlotType, targetRow]);

  const filteredCandidateRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidateRows;
    return candidateRows.filter(({ lecture: lec }) => {
      const code = String(lec.course).toLowerCase();
      const name = (lec.course_name ?? "").toLowerCase();
      const sec = (lec.section_number ?? "").toLowerCase();
      return code.includes(q) || name.includes(q) || sec.includes(q);
    });
  }, [candidateRows, query]);

  const emptyListHint = useMemo(() => {
    if (!targetCell) return "";
    return explainNoAddSectionCandidates(config, scheduleEntries, targetCell, catalogue, {
      extraSectionsOverride,
    });
  }, [config, scheduleEntries, targetCell, catalogue, extraSectionsOverride]);

  const selectedRow = useMemo(
    () => candidateRows.find((r) => String(r.lecture.id) === selectedLectureId),
    [candidateRows, selectedLectureId],
  );
  const selectedLecture = selectedRow?.lecture;

  const allLecturerNames = useMemo(() => {
    if (!selectedLecture) return [];
    return allowedLecturerNamesForLecture(config, selectedLecture);
  }, [config, selectedLecture]);

  const lecturersPreferredForSlot = useMemo(() => {
    if (!targetTs) return allLecturerNames;
    return allLecturerNames.filter((n) => lecturerTimeslotAllowed(config, n, targetTs));
  }, [allLecturerNames, config, targetTs]);

  const lecturersOther = useMemo(
    () => allLecturerNames.filter((n) => !lecturersPreferredForSlot.includes(n)),
    [allLecturerNames, lecturersPreferredForSlot],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const first = candidateRows.find((r) => r.fitsThisCell) ?? candidateRows[0];
    if (first) {
      setSelectedLectureId(String(first.lecture.id));
      const names = allowedLecturerNamesForLecture(config, first.lecture);
      const preferred = targetTs
        ? names.filter((n) => lecturerTimeslotAllowed(config, n, targetTs))
        : names;
      setSelectedLecturer(preferred[0] ?? names[0] ?? "");
    } else {
      setSelectedLectureId("");
      setSelectedLecturer("");
    }
  }, [open, candidateRows, config, targetTs]);

  useEffect(() => {
    if (!selectedLecture) return;
    if (selectedLecturer && allLecturerNames.includes(selectedLecturer)) return;
    setSelectedLecturer(lecturersPreferredForSlot[0] ?? allLecturerNames[0] ?? "");
  }, [selectedLecture, selectedLecturer, allLecturerNames, lecturersPreferredForSlot]);

  if (!targetCell) return null;

  const canSubmit =
    !!selectedLecture &&
    !!selectedLecturer &&
    !!targetTs &&
    !!tsRow &&
    selectedRow?.fitsThisCell === true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add section to empty block</DialogTitle>
          <DialogDescription>
            Selected block:{" "}
            <span className="font-medium">
              {isOnlineRow ? "Online row" : `Room ${targetRow}`}
            </span>{" "}
            at <span className="font-mono">{targetTs}</span>
            {tsRow ? ` (${timeslotLongLabel(tsRow)})` : ""}.
          </DialogDescription>
        </DialogHeader>

        {!tsRow && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Unknown timeslot</AlertTitle>
            <AlertDescription>
              This grid cell references a timeslot not found in the active catalogue.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Section (course + section number)</Label>
            <Input
              placeholder="Search by course code/name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="max-h-56 overflow-auto rounded-md border border-border text-sm">
              {filteredCandidateRows.length === 0 ? (
                <li className="space-y-2 px-3 py-2">
                  <p className="text-muted-foreground">No addable section matches this timeslot and delivery mode.</p>
                  <p className="text-xs leading-snug text-muted-foreground">{emptyListHint}</p>
                </li>
              ) : (
                filteredCandidateRows.map(({ lecture: lec, fitsThisCell }) => (
                  <li key={lec.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedLectureId(String(lec.id))}
                      className={`block w-full px-3 py-2 text-left hover:bg-muted/60 ${
                        selectedLectureId === String(lec.id) ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="font-semibold">
                        {String(lec.course)}
                        {lec.section_number ? ` · ${lec.section_number}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {lec.course_name ?? "—"} · size {lec.size ?? 0}
                      </div>
                      {!fitsThisCell ? (
                        <div className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-200/90">
                          Not for this room — choose another empty cell in an allowed room for this section.
                        </div>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          {selectedRow && !selectedRow.fitsThisCell ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Wrong room for this section</AlertTitle>
              <AlertDescription className="text-sm">
                Add is disabled until you select a section that allows this room, or click an empty cell in one of the
                rooms listed for that course in the configuration.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label>Lecturer</Label>
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={selectedLecturer}
              onChange={(e) => setSelectedLecturer(e.target.value)}
              disabled={!selectedLecture || allLecturerNames.length === 0}
            >
              {allLecturerNames.length === 0 ? (
                <option value="">No instructors configured for this section</option>
              ) : (
                <>
                  {lecturersPreferredForSlot.length > 0 ? (
                    <optgroup label="Available for this timeslot">
                      {lecturersPreferredForSlot.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {lecturersOther.length > 0 ? (
                    <optgroup
                      label={
                        lecturersPreferredForSlot.length > 0
                          ? "Also allowed for this section (may fail slot availability)"
                          : "Allowed for this section"
                      }
                    >
                      {lecturersOther.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </>
              )}
            </select>
            <p className="text-[11px] leading-snug text-muted-foreground">
              All instructors listed for the section are shown. Hard rules still block Add if the choice is not
              allowed for this timeslot in configuration.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!selectedLecture || !selectedLecturer) return;
              const roomName = isOnlineRow ? null : targetRow;
              const cap = roomName ? roomCap(config, roomName) : 0;
              const usedIds = new Set(scheduleEntries.map((e) => String(e.lecture_id)));
              const usedCourseSections = new Set(
                scheduleEntries.map(scheduleEntryCourseSectionKey).filter((k): k is string => k != null),
              );
              const idPlaced = usedIds.has(String(selectedLecture.id));
              const ck = lectureConfigCourseSectionKey(selectedLecture);
              const csPlaced = ck != null && usedCourseSections.has(ck);
              const needSyntheticPlacement = extraSectionsOverride && (idPlaced || csPlaced);
              const lectureId = needSyntheticPlacement
                ? allocateExtraLectureId(scheduleEntries, config)
                : selectedLecture.id;
              const sectionLabel = needSyntheticPlacement
                ? nextFreeSectionLabelForCourse(String(selectedLecture.course), scheduleEntries, config)
                : (selectedLecture.section_number ?? undefined);
              const entryBase: ScheduleEntry = {
                lecture_id: lectureId,
                ...(needSyntheticPlacement ? { template_lecture_id: selectedLecture.id } : {}),
                ...(sectionLabel ? { section_number: sectionLabel } : {}),
                course_code: String(selectedLecture.course),
                course_name: selectedLecture.course_name ?? String(selectedLecture.course),
                room: roomName,
                room_capacity: cap,
                class_size: selectedLecture.size ?? 0,
                timeslot: targetTs,
                timeslot_label: tsRow ? timeslotLongLabel(tsRow) : targetTs,
                day: tsRow?.days?.[0] ?? "",
                lecturer: selectedLecturer,
                delivery_mode: selectedLecture.delivery_mode,
                session_type: selectedLecture.session_type,
                room_required: !isOnlineRow,
                requires_room: !isOnlineRow,
                slot_type: tsRow?.slot_type,
                days: tsRow?.days,
                start_hour: tsRow?.start_hour,
                duration: tsRow?.duration,
                allowed_lecturers: allowedLecturerNamesForLecture(config, selectedLecture),
              };
              const placed = mergeEntryWithPlacement(
                entryBase,
                catalogue,
                roomName,
                targetTs,
                cap,
              );
              onAdd(placed);
              onOpenChange(false);
            }}
          >
            Add section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
