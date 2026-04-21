"use client";

import useSWR from "swr";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ScheduleEntry, SchedulePayload } from "@/lib/schedule-data";
import { useGwoRun } from "@/components/gwo-run-context";

async function jsonFetcher(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function cloneScheduleEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries.map((e) => ({ ...e }));
}

function scheduleJson(entries: ScheduleEntry[]): string {
  return JSON.stringify(entries);
}

export type TimetableGridDraftContextValue = {
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  draft: ScheduleEntry[] | null;
  setDraft: (next: ScheduleEntry[] | null) => void;
  generatedBaseline: ScheduleEntry[] | null;
  /** True when the working copy differs from the last generated (or initial) baseline. */
  isDirtyVersusGenerated: boolean;
  /** Replace draft with the generated baseline (or current server schedule if baseline missing). */
  resetDraftToGenerated: () => void;
  /** After a successful “Save to workspace file”: clear draft, exit edit, baseline = saved rows. */
  markWorkspaceSaved: (savedSchedule: ScheduleEntry[]) => void;
};

const TimetableGridDraftContext = createContext<TimetableGridDraftContextValue | null>(null);

export function TimetableGridDraftProvider({ children }: { children: ReactNode }) {
  const { optimizerScheduleEpoch } = useGwoRun();
  const { data } = useSWR<SchedulePayload>("/api/schedule", jsonFetcher, {
    refreshInterval: 3000,
    dedupingInterval: 0,
  });

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<ScheduleEntry[] | null>(null);
  const [generatedBaseline, setGeneratedBaseline] = useState<ScheduleEntry[] | null>(null);

  const baselineInitializedRef = useRef(false);
  const lastOptimizerEpochAppliedRef = useRef(0);

  const entries = data?.schedule ?? [];

  useEffect(() => {
    if (!entries.length || baselineInitializedRef.current) return;
    setGeneratedBaseline(cloneScheduleEntries(entries));
    baselineInitializedRef.current = true;
  }, [entries]);

  useEffect(() => {
    if (optimizerScheduleEpoch <= 0) return;
    if (lastOptimizerEpochAppliedRef.current === optimizerScheduleEpoch) return;
    if (!entries.length) return;
    lastOptimizerEpochAppliedRef.current = optimizerScheduleEpoch;
    setGeneratedBaseline(cloneScheduleEntries(entries));
    setDraft(null);
    setEditMode(false);
  }, [optimizerScheduleEpoch, entries]);

  const isDirtyVersusGenerated = useMemo(() => {
    if (draft == null) return false;
    const base = generatedBaseline ?? entries;
    if (!base.length) return false;
    return scheduleJson(draft) !== scheduleJson(base);
  }, [draft, generatedBaseline, entries]);

  const resetDraftToGenerated = useCallback(() => {
    const base = generatedBaseline ?? entries;
    if (!base.length) return;
    setDraft(cloneScheduleEntries(base));
  }, [generatedBaseline, entries]);

  const markWorkspaceSaved = useCallback((savedSchedule: ScheduleEntry[]) => {
    setGeneratedBaseline(cloneScheduleEntries(savedSchedule));
    setDraft(null);
    setEditMode(false);
  }, []);

  const value = useMemo(
    () => ({
      editMode,
      setEditMode,
      draft,
      setDraft,
      generatedBaseline,
      isDirtyVersusGenerated,
      resetDraftToGenerated,
      markWorkspaceSaved,
    }),
    [
      editMode,
      draft,
      generatedBaseline,
      isDirtyVersusGenerated,
      resetDraftToGenerated,
      markWorkspaceSaved,
    ],
  );

  return (
    <TimetableGridDraftContext.Provider value={value}>{children}</TimetableGridDraftContext.Provider>
  );
}

export function useTimetableGridDraft(): TimetableGridDraftContextValue {
  const ctx = useContext(TimetableGridDraftContext);
  if (!ctx) {
    throw new Error("useTimetableGridDraft must be used within TimetableGridDraftProvider");
  }
  return ctx;
}
