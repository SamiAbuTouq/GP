"use client";

import { Suspense, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/timetable";

function parseMode(raw: string | null): "normal" | "summer" {
  return raw === "summer" ? "summer" : "normal";
}

type ScenarioRunOption = {
  value: string;
  label: string;
};

type TimetableGenerationRunActionsProps =
  | {
      mode?: "default";
      onAlgorithmRunError?: (message: string | null) => void;
    }
  | {
      mode: "scenario";
      timetableOptions: ScenarioRunOption[];
      selectedTimetableId: string;
      onSelectTimetable: (value: string) => void;
      onRunScenario: () => void;
      runDisabled?: boolean;
      runLabel?: string;
    };

function TimetableGenerationRunActionsInner(props: TimetableGenerationRunActionsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const semesterMode = useMemo(
    () => parseMode(searchParams.get("mode")),
    [searchParams],
  );

  const setSemesterMode = useCallback(
    (mode: "normal" | "summer") => {
      const params = new URLSearchParams(searchParams.toString());
      if (mode === "normal") {
        params.delete("mode");
      } else {
        params.set("mode", "summer");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  if (props.mode === "scenario") {
    return (
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <div className="flex h-10 min-w-0 overflow-hidden rounded-md border border-border bg-background shadow-sm">
          <Label
            id="scenario-timetable-label"
            htmlFor="scenario-timetable"
            className="flex shrink-0 cursor-default flex-col justify-center border-r border-border/70 bg-muted/35 px-2.5 py-0.5 text-right"
          >
            <span className="text-[8px] font-semibold uppercase leading-[0.9] tracking-wide text-muted-foreground">
              Base
            </span>
            <span className="-mt-0.5 text-[8px] font-semibold uppercase leading-[0.9] tracking-wide text-muted-foreground">
              Timetable
            </span>
          </Label>
          <Select value={props.selectedTimetableId} onValueChange={props.onSelectTimetable}>
            <SelectTrigger
              id="scenario-timetable"
              className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-w-[14rem] sm:max-w-[20rem]"
              aria-labelledby="scenario-timetable-label"
            >
              <SelectValue placeholder="Choose timetable" />
            </SelectTrigger>
            <SelectContent align="end">
              {props.timetableOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={props.onRunScenario} disabled={props.runDisabled} className="sm:w-auto">
          {props.runLabel ?? "Run Scenario"}
        </Button>
      </div>
    );
  }

  if (pathname?.includes("/what-if")) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <div className="flex h-10 min-w-0 overflow-hidden rounded-md border border-border bg-background shadow-sm">
        <Label
          id="tg-semester-mode-label"
          htmlFor="tg-semester-mode"
          className="flex shrink-0 cursor-default flex-col justify-center border-r border-border/70 bg-muted/35 px-2.5 py-0.5 text-right"
        >
          <span className="text-[8px] font-semibold uppercase leading-[0.9] tracking-wide text-muted-foreground">
            Semester
          </span>
          <span className="-mt-0.5 text-[8px] font-semibold uppercase leading-[0.9] tracking-wide text-muted-foreground">
            Mode
          </span>
        </Label>
        <Select
          value={semesterMode}
          onValueChange={(v) => setSemesterMode(v as "normal" | "summer")}
        >
          <SelectTrigger
            id="tg-semester-mode"
            className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-w-[12rem] sm:max-w-[18rem]"
            aria-labelledby="tg-semester-mode-label"
          >
            <SelectValue placeholder="Choose semester" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="normal">First or second semester</SelectItem>
            <SelectItem value="summer">Summer semester</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <RefreshButton
        semesterMode={semesterMode}
        className="sm:w-auto sm:max-w-none"
        onRunError={props.onAlgorithmRunError}
      />
    </div>
  );
}

export function TimetableGenerationRunActions(
  props: TimetableGenerationRunActionsProps = { mode: "default" },
) {
  return (
    <Suspense
      fallback={
        <div
          className="h-10 w-full max-w-md animate-pulse rounded-md bg-muted sm:max-w-lg"
          aria-hidden
        />
      }
    >
      <TimetableGenerationRunActionsInner {...props} />
    </Suspense>
  );
}
