import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { TimetableGenerationTabs } from "./timetable-generation-tabs";
import { TimetableGenerationTop } from "./timetable-generation-top";
import { SimulationViewBanner } from "./simulation-view-banner";

export default function Page() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px]">
            <div className="mb-6">
              <TimetableGenerationTop />
            </div>
            <SimulationViewBanner />

            <TimetableGenerationTabs />
          </div>
        </main>
      </div>
    </div>
  );
}
