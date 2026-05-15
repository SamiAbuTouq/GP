"use client"

import { ScheduleViewerPage } from "../schedule/page"

export default function LecturerSchedulePage() {
  return (
    <ScheduleViewerPage
      enableMySchedule
      publishedTimetablesOnly
      hideVersionInTitle
    />
  )
}
