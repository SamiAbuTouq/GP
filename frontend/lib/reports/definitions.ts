import type { ReportDefinition } from "./types"

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "room-utilization",
    name: "Room Utilization Report",
    shortName: "Room utilization",
    description:
      "Occupancy rates, peak utilization windows, and capacity usage by room and building.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "lecturer-workload",
    name: "Lecturer Workload Report",
    shortName: "Lecturer workload",
    description:
      "Teaching load, contact hours, and distribution across departments and course levels.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "course-distribution",
    name: "Course Distribution Report",
    shortName: "Course distribution",
    description:
      "Course offerings by department, modality, and level with enrollment and section counts.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "conflict-analysis",
    name: "Conflict Analysis Report",
    shortName: "Conflict analysis",
    description:
      "Scheduling conflicts, overlaps, and constraint violations across the active timetable.",
    formats: ["pdf", "excel"],
    comingSoon: true,
    comingSoonReason:
      "Conflict analysis export is under development. It will aggregate clash detection results from the solver and validation pipeline.",
  },
  {
    id: "student-schedule",
    name: "Student Schedule Report",
    shortName: "Student schedules",
    description:
      "Per-student or cohort timetable extracts for registration and advising.",
    formats: ["pdf", "excel"],
    comingSoon: true,
    comingSoonReason:
      "Bulk student schedule generation requires the upcoming enrollment sync. You will be able to export by program, cohort, or individual student ID.",
  },
  {
    id: "optimization-summary",
    name: "Optimization Summary Report",
    shortName: "Optimization summary",
    description:
      "Algorithm runs, fitness progression, and constraint satisfaction metrics for timetable optimization.",
    formats: ["pdf", "excel"],
    comingSoon: true,
    comingSoonReason:
      "Optimization run history and comparative metrics will be available once the analytics API is connected.",
  },
]

export function getReportDefinition(id: string) {
  return REPORT_DEFINITIONS.find((r) => r.id === id)
}
