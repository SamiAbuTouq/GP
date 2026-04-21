"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  TimetableGrid,
  TimeslotCodeLegend,
  ConflictAlert,
  SoftConstraintPanel,
  TeachingLoadPanel,
  RoomUtilizationPanel,
  StudyPlanTabPanel,
  OptimizationInfo,
  HardConstraintsReadOnlyPanel,
  SoftConstraintWeightsPanel,
  SoftConstraintMetricsPanel,
  GwoParametersPanel,
} from "@/components/timetable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { segmentedNavTabItemRadiusClass, segmentedNavTabListClassName } from "@/lib/segmented-nav-tabs";

type TabValue = "schedule" | "study-plan" | "constraints" | "soft-metrics" | "gwo" | "grid";

const TAB_TRIGGER_CLASS = `relative ${segmentedNavTabItemRadiusClass} px-4 py-2 text-sm font-semibold text-slate-600 shadow-none transition-colors duration-200 data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none dark:text-slate-400 dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-primary-foreground`;

function ActiveTabPill() {
  return (
    <motion.div
      layoutId="timetable-generation-tabs-active"
      className={`absolute inset-0 z-0 ${segmentedNavTabItemRadiusClass} bg-primary shadow-sm`}
      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
    />
  );
}

export function TimetableGenerationTabs() {
  const [activeTab, setActiveTab] = useState<TabValue>("schedule");

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
          <span className="relative z-10">Soft Constraint Metrics</span>
        </TabsTrigger>
        <TabsTrigger value="grid" className={TAB_TRIGGER_CLASS}>
          {activeTab === "grid" && <ActiveTabPill />}
          <span className="relative z-10">Rooms &amp; Timeslots Grid</span>
        </TabsTrigger>
        <TabsTrigger value="study-plan" className={TAB_TRIGGER_CLASS}>
          {activeTab === "study-plan" && <ActiveTabPill />}
          <span className="relative z-10">Study Plan</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" className="mt-0 space-y-5 outline-none">
        <ConflictAlert />
        <OptimizationInfo />
        <div className="grid gap-6 lg:grid-cols-2">
          <TeachingLoadPanel />
          <RoomUtilizationPanel />
        </div>
      </TabsContent>

      <TabsContent value="study-plan" className="mt-0 space-y-4 outline-none">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student cohort health</p>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Review each pathway by year and semester to spot hard overlaps, long idle gaps, and single-class days.
          </p>
        </div>
        <StudyPlanTabPanel />
      </TabsContent>

      <TabsContent value="constraints" className="mt-0 space-y-5 outline-none">
        <SoftConstraintWeightsPanel />
        <HardConstraintsReadOnlyPanel />
      </TabsContent>

      <TabsContent value="soft-metrics" className="mt-0 space-y-3 outline-none">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Soft constraint metrics</p>
        <p className="text-sm text-slate-600">
          Outcomes and detail for each soft goal on the latest generated timetable (weights are configured under Constraints).
        </p>
        <SoftConstraintMetricsPanel embedded />
        <SoftConstraintPanel />
      </TabsContent>

      <TabsContent value="gwo" className="mt-0 space-y-2 outline-none">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grey Wolf Optimizer controls</p>
        <GwoParametersPanel />
      </TabsContent>

      <TabsContent value="grid" className="mt-0 space-y-3 outline-none">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rooms &amp; Timeslots Grid</p>
        <TimetableGrid />
        <p className="text-right text-xs text-muted-foreground">Format: course - lecturer - class size / room capacity</p>
        <TimeslotCodeLegend />
      </TabsContent>
    </Tabs>
  );
}
