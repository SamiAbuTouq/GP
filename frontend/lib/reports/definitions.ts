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
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "optimization-summary",
    name: "Optimization Summary Report",
    shortName: "Optimization summary",
    description:
      "Algorithm runs, fitness progression, and constraint satisfaction metrics for timetable optimization.",
    formats: ["pdf", "excel"],
    comingSoon: false,
  },
  {
    id: "lecturer-preference-compliance",
    name: "Lecturer Preference Compliance Report",
    shortName: "Preference compliance",
    description:
      "Preferred and avoided-slot compliance per lecturer, highlighting violations that require attention.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "room-type-matching",
    name: "Room Type Matching Report",
    shortName: "Room matching",
    description:
      "Flags sections assigned to unsuitable room types and distinguishes hard vs soft mismatches.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
]

export function getReportDefinition(id: string) {
  return REPORT_DEFINITIONS.find((r) => r.id === id)
}
