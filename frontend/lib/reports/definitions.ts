import type { ReportDefinition } from "./types"

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "room-utilization",
    name: "Room Utilization Report",
    shortName: "Room utilization",
    description:
      "Per-room hours, seat-fill (where applicable), busiest weekday, and load vs. the busiest room.",
    formats: ["pdf", "excel"],
    comingSoon: false,
  },
  {
    id: "lecturer-workload",
    name: "Lecturer Workload Report",
    shortName: "Lecturer workload",
    description:
      "Hours, load vs. max workload, sections/courses, labs; optional department roll-up.",
    formats: ["pdf", "excel"],
    comingSoon: false,
  },
  {
    id: "course-distribution",
    name: "Course Distribution Report",
    shortName: "Course distribution",
    description:
      "By department: catalog vs. scheduled courses, coverage gaps, sections, enrollment, modalities, UG vs. grad.",
    formats: ["pdf", "excel"],
    comingSoon: false,
  },
  {
    id: "conflict-analysis",
    name: "Timetable Health Report",
    shortName: "Timetable health",
    description:
      "Constraint violations, room assignment quality, and optimizer run summary for the selected timetable.",
    formats: ["pdf", "excel", "csv"],
    comingSoon: false,
  },
  {
    id: "timeslot-demand",
    name: "Timeslot Demand Report",
    shortName: "Slot demand",
    description:
      "Sections, rooms in use, and enrollment by timeslot. Identifies scheduling bottlenecks and underused slots.",
    formats: ["pdf", "excel"],
    comingSoon: false,
  },
]

export function getReportDefinition(id: string) {
  return REPORT_DEFINITIONS.find((r) => r.id === id)
}
