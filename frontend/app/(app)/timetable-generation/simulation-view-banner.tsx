"use client";

import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function SimulationViewBanner() {
  const searchParams = useSearchParams();

  const simulationTimetableIdRaw = searchParams.get("simulationTimetableId");
  const simulationTimetableId = (() => {
    if (!simulationTimetableIdRaw) return null;
    const n = Number(simulationTimetableIdRaw);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  if (simulationTimetableId == null) return null;

  return (
    <Card className="mb-5 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200" />
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
          Simulation view: you are viewing timetable #{simulationTimetableId}. This is a sandbox draft and does not
          change your production timetable.
        </p>
      </CardContent>
    </Card>
  );
}
