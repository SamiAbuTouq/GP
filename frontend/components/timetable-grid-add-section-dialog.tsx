"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduleConfig, ScheduleEntry } from "@/lib/schedule-data";
import {
  allowedLecturerNamesForLecture,
  allowedRoomNamesForLecture,
  explainNoAddSectionCandidates,
  isTimeslotAllowedForLecture,
  lecturerTimeslotAllowed,
  listLectureConfigsNotOnSchedule,
  mergeEntryWithPlacement,
  normDelivery,
  engineSlotTypeForCatalogueRow,
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

  const candidates = useMemo(() => {
    if (!targetCell || !tsRow) return [];
    const all = listLectureConfigsNotOnSchedule(config, scheduleEntries);
    return all.filter((lec) => {
      const delivery = normDelivery(lec.delivery_mode);
      if (isOnlineRow && delivery !== "online") return false;
      if (!isOnlineRow && delivery === "online") return false;
      if (!isTimeslotAllowedForLecture(lec, tsRow)) return false;
      if (!isOnlineRow) {
        const allowedRooms = allowedRoomNamesForLecture(config, lec, engineSlotType, lec.size ?? 0);
        if (!allowedRooms.includes(targetRow)) return false;
      }
      return allowedLecturerNamesForLecture(config, lec).length > 0;
    });
  }, [config, scheduleEntries, targetCell, tsRow, isOnlineRow, engineSlotType, targetRow]);

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((lec) => {
      const code = String(lec.course).toLowerCase();
      const name = (lec.course_name ?? "").toLowerCase();
      const sec = (lec.section_number ?? "").toLowerCase();
      return code.includes(q) || name.includes(q) || sec.includes(q);
    });
  }, [candidates, query]);

  const emptyListHint = useMemo(() => {
    if (!targetCell) return "";
    return explainNoAddSectionCandidates(config, scheduleEntries, targetCell, catalogue);
  }, [config, scheduleEntries, targetCell, catalogue]);

  const selectedLecture = useMemo(
    () => candidates.find((c) => String(c.id) === selectedLectureId),
    [candidates, selectedLectureId],
  );

  const lecturerChoices = useMemo(() => {
    if (!selectedLecture) return [];
    const base = allowedLecturerNamesForLecture(config, selectedLecture);
    if (!targetTs) return base;
    return base.filter((name) => lecturerTimeslotAllowed(config, name, targetTs));
  }, [config, selectedLecture, targetTs]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const first = candidates[0];
    if (first) {
      setSelectedLectureId(String(first.id));
      const firstLecturer = allowedLecturerNamesForLecture(config, first).find((n) =>
        targetTs ? lecturerTimeslotAllowed(config, n, targetTs) : true,
      );
      setSelectedLecturer(firstLecturer ?? "");
    } else {
      setSelectedLectureId("");
      setSelectedLecturer("");
    }
  }, [open, candidates, config, targetTs]);

  useEffect(() => {
    if (!selectedLecture) return;
    if (selectedLecturer && lecturerChoices.includes(selectedLecturer)) return;
    setSelectedLecturer(lecturerChoices[0] ?? "");
  }, [selectedLecture, selectedLecturer, lecturerChoices]);

  if (!targetCell) return null;

  const canSubmit = !!selectedLecture && !!selectedLecturer && !!targetTs && !!tsRow;

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
            <ul className="max-h-48 overflow-auto rounded-md border border-slate-200 text-sm">
              {filteredCandidates.length === 0 ? (
                <li className="space-y-2 px-3 py-2">
                  <p className="text-muted-foreground">No addable section fits this cell.</p>
                  <p className="text-xs leading-snug text-muted-foreground">{emptyListHint}</p>
                </li>
              ) : (
                filteredCandidates.map((lec) => (
                  <li key={lec.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedLectureId(String(lec.id))}
                      className={`block w-full px-3 py-2 text-left hover:bg-slate-50 ${
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
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="space-y-2">
            <Label>Lecturer</Label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              value={selectedLecturer}
              onChange={(e) => setSelectedLecturer(e.target.value)}
              disabled={!selectedLecture || lecturerChoices.length === 0}
            >
              {lecturerChoices.length === 0 ? (
                <option value="">No lecturer available for this timeslot</option>
              ) : (
                lecturerChoices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              )}
            </select>
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
              const entryBase: ScheduleEntry = {
                lecture_id: selectedLecture.id,
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
