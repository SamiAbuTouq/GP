"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

function DashboardPanelLoader() {
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/90">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading dashboard" />
        <p className="text-sm">Loading dashboard...</p>
      </div>
    </div>
  );
}

const CourseAnalyticsEmbed = dynamic(
  () => import("@/components/course-analytics/course-analytics-embed").then((mod) => mod.CourseAnalyticsEmbed),
  {
    ssr: false,
    loading: () => <DashboardPanelLoader />,
  },
);

export default function DashboardPage() {
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);

  return (
    <div className="flex h-screen bg-gradient-to-b from-background to-muted/20">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="relative flex-1 overflow-auto">
          <CourseAnalyticsEmbed onInitialLoadComplete={() => setIsDashboardLoading(false)} />

          {isDashboardLoading && <DashboardPanelLoader />}
        </main>
      </div>
    </div>
  );
}
