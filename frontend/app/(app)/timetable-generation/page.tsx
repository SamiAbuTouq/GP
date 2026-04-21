import { GwoTopProgressBar } from "@/components/gwo-run-context";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { TimetableGenerationTabs } from "./timetable-generation-tabs";
import { TimetableGenerationRunActions } from "./timetable-generation-run-actions";

export default function Page() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px]">
            <div className="mb-6 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <h1 className="text-2xl font-bold text-balance">Timetable Generation</h1>
                <TimetableGenerationRunActions />
              </div>
              <GwoTopProgressBar />
            </div>

            <TimetableGenerationTabs />
          </div>
        </main>
      </div>
    </div>
  );
}
