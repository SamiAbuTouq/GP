import type { ReportDefinition } from "./types"

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "room-utilization",
    name: "Room Utilization Report",
    shortName: "Room utilization",
    description:
      "Per-room hours, seat-fill (where applicable), busiest weekday, and load vs. the busiest room.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "lecturer-workload",
    name: "Lecturer Workload Report",
    shortName: "Lecturer workload",
    description:
      "Hours, load vs. max workload, sections/courses, labs; optional department roll-up.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "course-distribution",
    name: "Course Distribution Report",
    shortName: "Course distribution",
    description:
      "By department: catalog vs. scheduled courses, sections, enrollment, modalities, UG vs. grad.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "conflict-analysis",
    name: "Conflict Analysis Report",
    shortName: "Conflict analysis",
    description:
      "Hard and soft violations with type, course/section, and narrative detail.",
    formats: ["pdf", "csv"],
    comingSoon: false,
  },
  {
    id: "optimization-summary",
    name: "Optimization Summary Report",
    shortName: "Optimization summary",
    description:
      "Compare optimizer runs: fitness, validity, and scheduled section counts.",
    formats: ["pdf", "csv"],
    comingSoon: false,
  },
  {
    id: "lecturer-preference-compliance",
    name: "Lecturer Preference Compliance Report",
    shortName: "Preference compliance",
    description:
      "Per lecturer: preferred / avoided / neutral sessions and avoided-slot compliance score.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "room-type-matching",
    name: "Room Type Matching Report",
    shortName: "Room matching",
    description:
      "Lab fit, online-in-room, capacity checks. PDF shows mismatches only; Excel/CSV list all sections.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
]

export function getReportDefinition(id: string) {
  return REPORT_DEFINITIONS.find((r) => r.id === id)
}
