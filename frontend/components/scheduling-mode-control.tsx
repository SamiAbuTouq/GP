"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleConfig, SchedulingMode } from "@/lib/schedule-data";
import { persistSchedulingMode } from "@/lib/persist-scheduling-mode";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

type SchedulingModeControlProps = {
  semesterMode: "normal" | "summer";
  onMissingExpectedSizes?: (missing: boolean) => void;
};

export function SchedulingModeControl({
  semesterMode,
  onMissingExpectedSizes,
}: SchedulingModeControlProps) {
  const swrKey = `/api/config?mode=${semesterMode}`;
  const { data: config, mutate } = useSWR<ScheduleConfig>(swrKey, jsonFetcher, {
    dedupingInterval: 0,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const schedulingMode: SchedulingMode =
    config?.scheduling_mode === "student_based" ? "student_based" : "section_based";

  const selectValue: SchedulingMode =
    schedulingMode === "student_based" ? "section_based" : schedulingMode;

  useEffect(() => {
    if (!config || schedulingMode !== "student_based" || saving) return;
    let cancelled = false;
    (async () => {
      try {
        await persistSchedulingMode("section_based", semesterMode);
        if (!cancelled) await mutate();
      } catch {
        /* ignore — user cannot select student-based while disabled */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config, schedulingMode, semesterMode, mutate, saving]);

  useEffect(() => {
    if (schedulingMode !== "student_based") {
      onMissingExpectedSizes?.(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/courses/catalog");
        if (!res.ok) return;
        const data = (await res.json()) as {
          courses?: Array<{
            expectedSizeNormal?: number | null;
            expectedSizeSummer?: number | null;
          }>;
        };
        if (cancelled) return;
        const anySet = (data.courses ?? []).some(
          (c) =>
            (c.expectedSizeNormal != null && c.expectedSizeNormal > 0) ||
            (c.expectedSizeSummer != null && c.expectedSizeSummer > 0),
        );
        onMissingExpectedSizes?.(!anySet);
      } catch {
        if (!cancelled) onMissingExpectedSizes?.(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schedulingMode, onMissingExpectedSizes]);

  const handleChange = async (value: string) => {
    if (value === "student_based") return;
    const mode: SchedulingMode = "section_based";
    if (mode === schedulingMode || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await persistSchedulingMode(mode, semesterMode);
      await mutate();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-10 min-w-0 overflow-hidden rounded-md border border-border bg-background shadow-sm">
      <Label
        id="tg-scheduling-mode-label"
        htmlFor="tg-scheduling-mode"
        className="flex shrink-0 cursor-default flex-col justify-center border-r border-border/70 bg-muted/35 px-2.5 py-0.5 text-right"
      >
        <span className="text-[8px] font-semibold uppercase leading-[0.9] tracking-wide text-muted-foreground">
          Scheduling
        </span>
        <span className="-mt-0.5 text-[8px] font-semibold uppercase leading-[0.9] tracking-wide text-muted-foreground">
          Mode
        </span>
      </Label>
      <Select
        value={selectValue}
        onValueChange={handleChange}
        disabled={saving || !config}
      >
        <SelectTrigger
          id="tg-scheduling-mode"
          className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-w-[12rem] sm:max-w-[20rem]"
          aria-labelledby="tg-scheduling-mode-label"
          title={saveError ?? undefined}
        >
          <SelectValue placeholder="Choose scheduling" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="section_based">Section-based</SelectItem>
          <SelectItem value="student_based" disabled>
            <span className="flex w-full items-center justify-between gap-2 pr-6">
              <span>Student-based</span>
              <Badge variant="secondary" className="text-[10px] font-normal">
                Coming soon
              </Badge>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
