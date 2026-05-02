"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HardConflictsAcknowledgmentFields } from "@/components/hard-conflicts-ui";
import { ApiClient } from "@/lib/api-client";
import {
  fetchTimetableConflictSummary,
  type TimetableConflictSummary,
} from "@/lib/timetable-conflicts";
import { useToast } from "@/hooks/use-toast";

export function SimulationViewBanner() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [applying, setApplying] = useState(false);
  const [conflictSummary, setConflictSummary] = useState<TimetableConflictSummary | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [applyAckOpen, setApplyAckOpen] = useState(false);
  const [applyAcknowledged, setApplyAcknowledged] = useState(false);

  const simulationTimetableIdRaw = searchParams.get("simulationTimetableId");
  const runIdRaw = searchParams.get("runId");
  const baseTimetableIdRaw = searchParams.get("baseTimetableId");

  const simulationTimetableId = useMemo(() => {
    if (!simulationTimetableIdRaw) return null;
    const n = Number(simulationTimetableIdRaw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [simulationTimetableIdRaw]);

  const runId = useMemo(() => {
    if (!runIdRaw) return null;
    const n = Number(runIdRaw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [runIdRaw]);

  const baseTimetableId = useMemo(() => {
    if (!baseTimetableIdRaw) return null;
    const n = Number(baseTimetableIdRaw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [baseTimetableIdRaw]);

  useEffect(() => {
    if (simulationTimetableId == null) {
      setConflictSummary(null);
      setConflictLoading(false);
      return;
    }
    let cancelled = false;
    setConflictLoading(true);
    fetchTimetableConflictSummary(simulationTimetableId)
      .then((data) => {
        if (!cancelled) setConflictSummary(data);
      })
      .catch(() => {
        if (!cancelled) setConflictSummary(null);
      })
      .finally(() => {
        if (!cancelled) setConflictLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [simulationTimetableId]);

  if (!simulationTimetableId) return null;

  async function executeApply(withAck: boolean): Promise<boolean> {
    if (!runId) return false;
    setApplying(true);
    try {
      await ApiClient.request(`/what-if/runs/${runId}/apply`, {
        method: "POST",
        body: JSON.stringify(withAck ? { acknowledgedHardConflicts: true } : {}),
      });
      router.push("/timetable-generation");
      return true;
    } catch (e: unknown) {
      toast({
        title: "Apply failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      return false;
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <Card className="mb-5 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200" />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Simulation view: you are viewing timetable #{simulationTimetableId}. This is not production data and does
              not overwrite `data/schedule.json`.
            </p>
          </div>
          <Button
            size="sm"
            disabled={!runId || !baseTimetableId || applying || conflictLoading}
            onClick={() => {
              if (!runId || !baseTimetableId || conflictLoading) return;
              if (!conflictSummary?.requiresConflictAcknowledgment) {
                void executeApply(false);
                return;
              }
              setApplyAcknowledged(false);
              setApplyAckOpen(true);
            }}
          >
            {applying ? "Applying..." : "Apply to production"}
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={applyAckOpen}
        onOpenChange={(open) => {
          setApplyAckOpen(open);
          if (!open) setApplyAcknowledged(false);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply timetable with hard conflicts?</DialogTitle>
            <DialogDescription>
              This merges the scenario result into the base timetable. Only continue if you understand the issues below.
            </DialogDescription>
          </DialogHeader>
          <HardConflictsAcknowledgmentFields
            summary={conflictSummary}
            loading={conflictLoading}
            acknowledged={applyAcknowledged}
            onAcknowledgedChange={setApplyAcknowledged}
            contextLabel="Applying replaces the base timetable’s schedule with this result."
          />
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setApplyAckOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={
                conflictLoading ||
                !conflictSummary?.requiresConflictAcknowledgment ||
                !applyAcknowledged ||
                !runId
              }
              onClick={() => {
                void (async () => {
                  const ok = await executeApply(true);
                  if (ok) setApplyAckOpen(false);
                })();
              }}
            >
              Confirm apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
