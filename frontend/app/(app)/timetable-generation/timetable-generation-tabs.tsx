"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import {
  TimetableGrid,
  ConflictAlert,
  StudyPlanTabPanel,
  OptimizationInfo,
  HardConstraintsReadOnlyPanel,
  LastAllowedHourPhysicalLecturesPanel,
  SoftConstraintWeightsPanel,
  QualityAnalyticsTabPanel,
  GwoParametersPanel,
} from "@/components/timetable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { segmentedNavTabItemRadiusClass, segmentedNavTabListClassName } from "@/lib/segmented-nav-tabs";

type TabValue = "schedule" | "study-plan" | "constraints" | "soft-metrics" | "gwo" | "grid";

const TAB_VALUES: TabValue[] = ["schedule", "study-plan", "constraints", "soft-metrics", "gwo", "grid"];

function isTabValue(value: string | null): value is TabValue {
  return value !== null && (TAB_VALUES as string[]).includes(value);
}

const TAB_TRIGGER_CLASS = `relative ${segmentedNavTabItemRadiusClass} px-4 py-2 text-sm font-semibold text-muted-foreground shadow-none transition-colors duration-200 data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-primary-foreground`;
function ActiveTabPill() {
  return (
    <motion.div
      layoutId="timetable-generation-tabs-active"
      className={`absolute inset-0 z-0 ${segmentedNavTabItemRadiusClass} bg-primary shadow-sm`}
      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
    />
  );
}

function TimetableGenerationTabsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabFromUrl = useMemo((): TabValue => {
    const raw = searchParams.get("tab");
    return isTabValue(raw) ? raw : "schedule";
  }, [searchParams]);

  const [activeTab, setActiveTabState] = useState<TabValue>(tabFromUrl);

  useEffect(() => {
    setActiveTabState((prev) => (prev === tabFromUrl ? prev : tabFromUrl));
  }, [tabFromUrl]);

  const setActiveTab = useCallback(
    (tab: TabValue) => {
      setActiveTabState(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "schedule") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-5">
      <TabsList className={segmentedNavTabListClassName}>
        <TabsTrigger value="schedule" className={TAB_TRIGGER_CLASS}>
          {activeTab === "schedule" && <ActiveTabPill />}
          <span className="relative z-10">Schedule &amp; Optimization</span>
        </TabsTrigger>
        <TabsTrigger value="constraints" className={TAB_TRIGGER_CLASS}>
          {activeTab === "constraints" && <ActiveTabPill />}
          <span className="relative z-10">Constraints</span>
        </TabsTrigger>
        <TabsTrigger value="gwo" className={TAB_TRIGGER_CLASS}>
          {activeTab === "gwo" && <ActiveTabPill />}
          <span className="relative z-10">GWO Parameters</span>
        </TabsTrigger>
        <TabsTrigger value="soft-metrics" className={TAB_TRIGGER_CLASS}>
          {activeTab === "soft-metrics" && <ActiveTabPill />}
          <span className="relative z-10">Quality &amp; Analytics</span>
        </TabsTrigger>
        <TabsTrigger value="grid" className={TAB_TRIGGER_CLASS}>
          {activeTab === "grid" && <ActiveTabPill />}
          <span className="relative z-10">Rooms &amp; Timeslots Grid</span>
        </TabsTrigger>
        <TabsTrigger value="study-plan" className={TAB_TRIGGER_CLASS}>
          {activeTab === "study-plan" && <ActiveTabPill />}
          <span className="relative z-10">Study Plans</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" className="mt-0 space-y-5 outline-none">
        <OptimizationInfo />
      </TabsContent>

      <TabsContent value="study-plan" className="mt-0 space-y-4 outline-none">

        <StudyPlanTabPanel />
      </TabsContent>

      <TabsContent value="constraints" className="mt-0 space-y-5 outline-none">
        <SoftConstraintWeightsPanel />
        <LastAllowedHourPhysicalLecturesPanel />
        <HardConstraintsReadOnlyPanel />
      </TabsContent>

      <TabsContent value="soft-metrics" className="mt-0 space-y-3 outline-none">
        <QualityAnalyticsTabPanel />
      </TabsContent>

      <TabsContent value="gwo" className="mt-0 space-y-2 outline-none">
        <GwoParametersPanel />
      </TabsContent>

      <TabsContent value="grid" className="mt-0 space-y-3 outline-none">
        <TimetableGrid />
      </TabsContent>
    </Tabs>
  );
}

export function TimetableGenerationTabs() {
  return (
    <Suspense
      fallback={<div className="h-12 w-full max-w-3xl animate-pulse rounded-lg bg-muted" aria-hidden />}
    >
      <TimetableGenerationTabsInner />
    </Suspense>
  );
}
