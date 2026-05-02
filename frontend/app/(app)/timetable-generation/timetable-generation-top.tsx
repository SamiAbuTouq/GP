"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { GwoTopProgressBar } from "@/components/gwo-run-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TimetableGenerationRunActions } from "./timetable-generation-run-actions";

export function TimetableGenerationTop() {
  const [algorithmError, setAlgorithmError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="min-w-0 text-2xl font-bold text-balance">Timetable Generation</h1>
        <TimetableGenerationRunActions onAlgorithmRunError={setAlgorithmError} />
      </div>
      {algorithmError ? (
        <Alert variant="destructive" className="border shadow-sm">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle className="flex min-w-0 items-center justify-between gap-2">
            <span>Run failed</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Dismiss error"
              onClick={() => setAlgorithmError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription>{algorithmError}</AlertDescription>
        </Alert>
      ) : null}
      <GwoTopProgressBar sources={["timetable"]} />
    </div>
  );
}
