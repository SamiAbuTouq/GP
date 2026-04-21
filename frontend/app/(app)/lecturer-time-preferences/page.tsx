"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Save } from "lucide-react";
import { ChevronDownIcon } from "@/components/ui/chevron-down-icon";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type PreferenceState = "PREFERRED" | "NOT_PREFERRED" | "NEUTRAL";

type LecturerPreferenceSlot = {
  slotId: number;
  days: string[];
  start: string;
  end: string;
  slotType: string;
  preference: PreferenceState;
};
type GroupByMode = "days" | "slotType";

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const normalizeSlotType = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

function sortDays(days: string[]) {
  return [...days].sort(
    (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
  );
}

function formatDays(days: string[]) {
  return sortDays(days).join(", ");
}

export default function LecturerTimePreferencesPage() {
  const [slots, setSlots] = useState<LecturerPreferenceSlot[]>([]);
  const [savedSignature, setSavedSignature] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dayFilter, setDayFilter] = useState("all");
  const [slotTypeFilter, setSlotTypeFilter] = useState("all");
  const [preferenceFilter, setPreferenceFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupByMode>("days");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const buildSignature = (items: LecturerPreferenceSlot[]) =>
    items
      .map((item) => `${item.slotId}:${item.preference}`)
      .sort((a, b) => a.localeCompare(b))
      .join("|");

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiClient.request<LecturerPreferenceSlot[]>(
        "/timeslots/lecturer/preferences",
      );
      setSlots(data);
      setSavedSignature(buildSignature(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preferences.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPreferences();
  }, []);

  const filteredSlots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return slots.filter((slot) => {
      if (dayFilter !== "all" && !slot.days.includes(dayFilter)) return false;
      if (slotTypeFilter !== "all" && normalizeSlotType(slot.slotType) !== slotTypeFilter) return false;
      if (preferenceFilter !== "all" && slot.preference !== preferenceFilter) return false;
      if (!q) return true;
      const searchable = [
        slot.days.join(" "),
        slot.start,
        slot.end,
        slot.slotType,
        normalizeSlotType(slot.slotType),
        `${slot.start} - ${slot.end}`,
      ].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [slots, searchQuery, dayFilter, slotTypeFilter, preferenceFilter]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, LecturerPreferenceSlot[]>();
    for (const slot of filteredSlots) {
      const groupKey =
        groupBy === "days" ? sortDays(slot.days).join(", ") : slot.slotType.trim();
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(slot);
    }
    for (const value of groups.values()) {
      value.sort((a, b) => `${a.start}-${a.end}`.localeCompare(`${b.start}-${b.end}`));
    }
    if (groupBy === "days") {
      return Array.from(groups.entries()).sort(
        (a, b) =>
          DAY_ORDER.indexOf(a[0].split(", ")[0]) - DAY_ORDER.indexOf(b[0].split(", ")[0]),
      );
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSlots, groupBy]);

  const counts = useMemo(() => {
    return slots.reduce(
      (acc, slot) => {
        if (slot.preference === "PREFERRED" || slot.preference === "NOT_PREFERRED") {
          acc[slot.preference] += 1;
        }
        return acc;
      },
      { PREFERRED: 0, NOT_PREFERRED: 0 } as Record<"PREFERRED" | "NOT_PREFERRED", number>,
    );
  }, [slots]);

  const availableSlotTypes = useMemo(() => {
    return Array.from(
      new Map(
        slots.map((slot) => {
          const display = slot.slotType.trim();
          return [normalizeSlotType(display), display] as const;
        }),
      ).entries(),
    ).sort((a, b) => a[1].localeCompare(b[1]));
  }, [slots]);

  const currentSignature = useMemo(() => buildSignature(slots), [slots]);
  const hasUnsavedChanges = currentSignature !== savedSignature;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handlePreferenceChange = (slotId: number, preference: Exclude<PreferenceState, "NEUTRAL">) => {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.slotId !== slotId) return slot;
        return {
          ...slot,
          preference: slot.preference === preference ? "NEUTRAL" : preference,
        };
      }),
    );
  };

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupLabel]: !(prev[groupLabel] ?? true),
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = slots
        .filter((slot) => slot.preference !== "NEUTRAL")
        .map((slot) => ({
          slotId: slot.slotId,
          isPreferred: slot.preference === "PREFERRED",
        }));

      await ApiClient.request("/timeslots/lecturer/preferences", {
        method: "PUT",
        body: JSON.stringify({ preferences: payload }),
      });

      toast({
        title: "Preferences saved",
        description: "Your time-slot preferences were updated successfully.",
      });
      await fetchPreferences();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Could not save preferences.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px]">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">Time Preference</h1>
              <p className="text-sm text-muted-foreground">
                Mark each predefined time slot as preferred or not preferred.
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving || loading || !hasUnsavedChanges}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Preferences
            </Button>
          </div>

          <Card className="mb-4 border bg-card">
            <CardContent className="space-y-3 p-3">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search day, time, or slot type..."
                  className="h-9"
                />
                <Select value={dayFilter} onValueChange={setDayFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Filter by day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All days</SelectItem>
                    {DAY_ORDER.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={slotTypeFilter} onValueChange={setSlotTypeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Filter by slot type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All slot types</SelectItem>
                    {availableSlotTypes.map(([slotTypeValue, slotTypeLabel]) => (
                      <SelectItem key={slotTypeValue} value={slotTypeValue}>
                        {slotTypeLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={preferenceFilter} onValueChange={setPreferenceFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Filter by preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All preferences</SelectItem>
                    <SelectItem value="PREFERRED">Preferred</SelectItem>
                    <SelectItem value="NOT_PREFERRED">Not Preferred</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupByMode)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Group by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Group by days</SelectItem>
                    <SelectItem value="slotType">Group by slot type</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  Showing {filteredSlots.length} of {slots.length} slots
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setSearchQuery("");
                    setDayFilter("all");
                    setSlotTypeFilter("all");
                    setPreferenceFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {error ? (
            <Card className="border-destructive/40">
              <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Preferred: {counts.PREFERRED}</Badge>
            <Badge variant="secondary">Not Preferred: {counts.NOT_PREFERRED}</Badge>
            {hasUnsavedChanges ? (
              <Badge className="bg-amber-500 text-black hover:bg-amber-500/90 dark:bg-amber-500 dark:text-black">
                Unsaved changes
              </Badge>
            ) : (
              <Badge variant="outline">All changes saved</Badge>
            )}
          </div>

          {loading ? (
            <Card>
              <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading time slots...
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredSlots.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    No slots match the current filters.
                  </CardContent>
                </Card>
              ) : null}
              {groupedSlots.map(([groupLabel, daySlots]) => {
                const collapseKey = `${groupBy}:${groupLabel}`;
                return (
                <Card key={collapseKey}>
                  <CardHeader className="pb-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md text-left hover:bg-muted/40"
                      onClick={() => toggleGroup(collapseKey)}
                      aria-expanded={!(collapsedGroups[collapseKey] ?? true)}
                    >
                      <div>
                        <CardTitle className="text-base">{groupLabel}</CardTitle>
                        <CardDescription>{daySlots.length} slots</CardDescription>
                      </div>
                      {collapsedGroups[collapseKey] ?? true ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDownIcon
                          size={16}
                          className="h-4 w-4 text-muted-foreground"
                        />
                      )}
                    </button>
                  </CardHeader>
                  {!(collapsedGroups[collapseKey] ?? true) ? (
                    <CardContent className="space-y-3">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.slotId}
                          className="flex flex-col gap-3 rounded-lg border bg-card p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              {slot.start} - {slot.end}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {groupBy === "slotType" ? formatDays(slot.days) : slot.slotType}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={slot.preference === "PREFERRED" ? "default" : "outline"}
                              onClick={() => handlePreferenceChange(slot.slotId, "PREFERRED")}
                              className={cn(
                                "min-w-[108px]",
                                slot.preference === "PREFERRED" &&
                                  "bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90",
                              )}
                            >
                              Preferred
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={slot.preference === "NOT_PREFERRED" ? "default" : "outline"}
                              onClick={() => handlePreferenceChange(slot.slotId, "NOT_PREFERRED")}
                              className={cn(
                                "min-w-[124px]",
                                slot.preference === "NOT_PREFERRED" &&
                                  "bg-rose-600 text-white hover:bg-rose-600/90 dark:bg-rose-600 dark:hover:bg-rose-600/90",
                              )}
                            >
                              Not Preferred
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  ) : null}
                </Card>
                );
              })}
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
