import { z } from "zod"

/** Response from GET /api/reports/aggregates — used to build exports. */
export const ReportDatasetSchema = z.object({
  semesterLabel: z.string(),
  academicYear: z.string(),
  semesterTypeName: z.string(),
  /** Semester enrollment headcount (`semester.total_students`). */
  totalStudents: z.number().nullable(),
  timetable: z
    .object({
      timetableId: z.number(),
      status: z.string(),
      versionNumber: z.number(),
      generatedAt: z.string(),
      generationType: z.string(),
      roomUtilizationRate: z.number().nullable(),
      fitnessScore: z.number().nullable(),
      softConstraintsScore: z.number().nullable(),
      isValid: z.boolean().nullable(),
    })
    .nullable(),
  insights: z.object({
    totalScheduleEntries: z.number(),
    totalRoomsInCatalog: z.number(),
    roomsWithSchedule: z.number(),
    totalWeeklyScheduledHours: z.number(),
    maxWeeklyHoursAnyRoom: z.number(),
    avgWeeklyHoursPerUsedRoom: z.number(),
    totalSeatFillWeightedPct: z.number().nullable(),
    lecturerCountScheduled: z.number(),
    distinctCoursesScheduled: z.number(),
    departmentsScheduled: z.number(),
  }),
  roomRows: z.array(
    z.object({
      roomId: z.number(),
      roomNumber: z.string(),
      roomTypeLabel: z.string(),
      capacity: z.number(),
      isAvailable: z.boolean(),
      sessionsCount: z.number(),
      weeklyInstructionalHours: z.number(),
      relativeLoadPct: z.number(),
      avgSeatFillPct: z.number().nullable(),
      peakDay: z.string(),
      onlineOrBlendedSessions: z.number(),
    }),
  ),
  lecturerRows: z.array(
    z.object({
      userId: z.number(),
      lecturerName: z.string(),
      department: z.string(),
      maxWorkloadHours: z.number(),
      sectionsScheduled: z.number(),
      distinctCourses: z.number(),
      labSections: z.number(),
      weeklyContactHours: z.number(),
      loadIndex: z.number(),
      loadPctOfMax: z.number().nullable(),
    }),
  ),
  courseDistributionRows: z.array(
    z.object({
      department: z.string(),
      catalogCourseCount: z.number(),
      scheduledDistinctCourses: z.number(),
      sectionInstances: z.number(),
      totalEnrollment: z.number(),
      undergraduateCourseCount: z.number(),
      graduateCourseCount: z.number(),
      onlineSections: z.number(),
      blendedSections: z.number(),
      faceToFaceSections: z.number(),
      avgSectionEnrollment: z.number(),
    }),
  ),
})

export type ReportDataset = z.infer<typeof ReportDatasetSchema>
