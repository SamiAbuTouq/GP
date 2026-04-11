// Mock data for the University Course Timetabling System

export const departments = [
  "Accounting",
  "Basic Sciences",
  "Business Administration",
  "Business Information Technology",
  "Communications Engineering",
  "Computer Engineering",
  "Computer Graphics",
  "Computer Science",
  "Coordination Unit for Service Courses",
  "Cyber Security",
  "Data Science",
  "E-Marketing & Social Media",
  "Electrical Engineering",
  "Software Engineering",
] as const

export type Department = (typeof departments)[number]

/** Prisma `DeliveryMode` — API and client state use these values; use `formatDeliveryModeLabel` for display. */
export const DELIVERY_MODE_VALUES = ["ONLINE", "BLENDED", "FACE_TO_FACE"] as const
export type DeliveryMode = (typeof DELIVERY_MODE_VALUES)[number]

export const deliveryModeOptions: readonly { value: DeliveryMode; label: string }[] = [
  { value: "ONLINE", label: "Online" },
  { value: "BLENDED", label: "Blended" },
  { value: "FACE_TO_FACE", label: "On-Campus" },
]

export function formatDeliveryModeLabel(mode: DeliveryMode): string {
  return deliveryModeOptions.find((o) => o.value === mode)?.label ?? mode
}

/** Normalize CSV/API/legacy UI strings to a Prisma `DeliveryMode`. */
export function parseDeliveryMode(value: unknown): DeliveryMode {
  if (typeof value !== "string") return "FACE_TO_FACE"
  const raw = value.trim()
  if (!raw) return "FACE_TO_FACE"
  const canonical = raw.toUpperCase().replace(/-/g, "_").replace(/\s+/g, "_")
  if (canonical === "ONLINE") return "ONLINE"
  if (canonical === "BLENDED") return "BLENDED"
  if (canonical === "FACE_TO_FACE" || canonical === "FACETOFACE") return "FACE_TO_FACE"
  const n = raw.toLowerCase()
  if (n === "online") return "ONLINE"
  if (n === "blended") return "BLENDED"
  if (n === "no" || n === "false") return "FACE_TO_FACE"
  if (
    n === "face_to_face" ||
    n === "face-to-face" ||
    n === "face to face" ||
    n === "on-campus" ||
    n === "on campus" ||
    n === "in-person" ||
    n === "in person"
  )
    return "FACE_TO_FACE"
  return "FACE_TO_FACE"
}

export const slotTypes = ["Lecture", "Lab"] as const
export type SlotType = (typeof slotTypes)[number]

export const mockLecturers = [
  { id: "LEC001", name: "Dr. Mohammad Saleh", email: "m.saleh@psut.edu.jo", department: "Computer Science" as Department, load: 12, maxWorkload: 18, courses: ["CS101", "CS201", "DS301"] },
  { id: "LEC002", name: "Dr. Rania Ahmad", email: "r.ahmad@psut.edu.jo", department: "Software Engineering" as Department, load: 15, maxWorkload: 18, courses: ["CS101", "SE201"] },
  { id: "LEC003", name: "Prof. Yousef Kamal", email: "y.kamal@psut.edu.jo", department: "Data Science" as Department, load: 9, maxWorkload: 15, courses: ["CS301", "CS401", "DS301"] },
  { id: "LEC004", name: "Dr. Hana Ibrahim", email: "h.ibrahim@psut.edu.jo", department: "Business Information Technology" as Department, load: 12, maxWorkload: 18, courses: ["CS201", "SE201"] },
]

export const mockCourses = [
  { code: "CS101", name: "Introduction to Programming", creditHours: 3, academicLevel: 1, deliveryMode: "FACE_TO_FACE" as DeliveryMode, department: "Computer Science" as Department, sections: 3 },
  { code: "CS201", name: "Data Structures", creditHours: 3, academicLevel: 2, deliveryMode: "FACE_TO_FACE" as DeliveryMode, department: "Computer Science" as Department, sections: 2 },
  { code: "CS301", name: "Algorithms", creditHours: 3, academicLevel: 3, deliveryMode: "BLENDED" as DeliveryMode, department: "Computer Science" as Department, sections: 2 },
  { code: "CS401", name: "Machine Learning", creditHours: 3, academicLevel: 4, deliveryMode: "FACE_TO_FACE" as DeliveryMode, department: "Data Science" as Department, sections: 1 },
  { code: "SE201", name: "Software Engineering", creditHours: 3, academicLevel: 2, deliveryMode: "FACE_TO_FACE" as DeliveryMode, department: "Software Engineering" as Department, sections: 2 },
  { code: "DS301", name: "Big Data Analytics", creditHours: 3, academicLevel: 3, deliveryMode: "ONLINE" as DeliveryMode, department: "Data Science" as Department, sections: 1 },
]

export const mockRooms = [
  { id: "R101", type: "Lecture Hall", capacity: 40, isAvailable: true },
  { id: "R102", type: "Classroom", capacity: 30, isAvailable: true },
  { id: "R201", type: "Lab", capacity: 25, isAvailable: true },
  { id: "R202", type: "Lecture Hall", capacity: 50, isAvailable: false },
  { id: "R301", type: "Seminar Room", capacity: 20, isAvailable: true },
]

export const mockTimeSlots = [
  { id: 1, days: ["Sunday"], start: "08:00", end: "09:30", slotType: "Lecture" as SlotType },
  { id: 2, days: ["Sunday"], start: "10:00", end: "11:30", slotType: "Lecture" as SlotType },
  { id: 3, days: ["Sunday"], start: "12:00", end: "13:30", slotType: "Lab" as SlotType },
  { id: 4, days: ["Monday", "Wednesday"], start: "08:00", end: "09:30", slotType: "Lecture" as SlotType },
  { id: 5, days: ["Monday", "Wednesday"], start: "10:00", end: "11:30", slotType: "Lecture" as SlotType },
  { id: 6, days: ["Tuesday", "Thursday"], start: "08:00", end: "09:30", slotType: "Lecture" as SlotType },
  { id: 7, days: ["Tuesday", "Thursday"], start: "10:00", end: "11:30", slotType: "Lab" as SlotType },
  { id: 8, days: ["Sunday", "Tuesday", "Thursday"], start: "14:00", end: "15:30", slotType: "Lecture" as SlotType },
  { id: 9, days: ["Thursday"], start: "08:00", end: "09:30", slotType: "Lab" as SlotType },
]

export const mockScheduleEntries = [
  {
    id: 1,
    course: "CS101",
    section: "A",
    lecturer: "Dr. Mohammad Saleh",
    room: "R202",
    day: "Sunday",
    time: "08:00-09:30",
    students: 45,
  },
  {
    id: 2,
    course: "CS201",
    section: "A",
    lecturer: "Dr. Rania Ahmad",
    room: "R101",
    day: "Sunday",
    time: "10:00-11:30",
    students: 38,
  },
  {
    id: 3,
    course: "CS301",
    section: "A",
    lecturer: "Prof. Yousef Kamal",
    room: "R102",
    day: "Monday",
    time: "08:00-09:30",
    students: 28,
  },
  {
    id: 4,
    course: "SE201",
    section: "A",
    lecturer: "Dr. Hana Ibrahim",
    room: "R101",
    day: "Monday",
    time: "10:00-11:30",
    students: 35,
  },
  {
    id: 5,
    course: "CS401",
    section: "A",
    lecturer: "Prof. Yousef Kamal",
    room: "R301",
    day: "Tuesday",
    time: "08:00-09:30",
    students: 18,
  },
  {
    id: 6,
    course: "DS301",
    section: "A",
    lecturer: "Dr. Mohammad Saleh",
    room: "R201",
    day: "Tuesday",
    time: "10:00-11:30",
    students: 22,
  },
  {
    id: 7,
    course: "CS101",
    section: "B",
    lecturer: "Dr. Rania Ahmad",
    room: "R202",
    day: "Wednesday",
    time: "08:00-09:30",
    students: 42,
  },
  {
    id: 8,
    course: "CS201",
    section: "B",
    lecturer: "Dr. Hana Ibrahim",
    room: "R102",
    day: "Thursday",
    time: "08:00-09:30",
    students: 30,
  },
]

export const mockKPIs = {
  /** Sum of all seeded `semester.total_students` (all terms) */
  totalStudents: 38262,
  totalCourses: 48,
  totalSections: 124,
  totalLecturers: 35,
  totalRooms: 28,
  roomUtilization: 78,
  conflictRate: 2.3,
  avgClassSize: 32,
}

export const kpiDataBySemester: Record<string, typeof mockKPIs> = {
  "fall-2024": {
    totalStudents: 4462,
    totalCourses: 48,
    totalSections: 124,
    totalLecturers: 156,
    totalRooms: 28,
    roomUtilization: 78,
    conflictRate: 2.3,
    avgClassSize: 32,
  },
  "spring-2024": {
    totalStudents: 4236,
    totalCourses: 45,
    totalSections: 118,
    totalLecturers: 148,
    totalRooms: 28,
    roomUtilization: 74,
    conflictRate: 3.1,
    avgClassSize: 30,
  },
  "summer-2024": {
    totalStudents: 1540,
    totalCourses: 28,
    totalSections: 65,
    totalLecturers: 82,
    totalRooms: 20,
    roomUtilization: 52,
    conflictRate: 1.8,
    avgClassSize: 24,
  },
  "fall-2023": {
    totalStudents: 4319,
    totalCourses: 46,
    totalSections: 120,
    totalLecturers: 142,
    totalRooms: 26,
    roomUtilization: 76,
    conflictRate: 4.2,
    avgClassSize: 31,
  },
}

export const kpiDataByDepartment: Record<
  string,
  { students: number; courses: number; lecturers: number; utilization: number }
> = {
  all: { students: 38262, courses: 48, lecturers: 156, utilization: 78 },
  cs: { students: 420, courses: 14, lecturers: 45, utilization: 82 },
  se: { students: 280, courses: 10, lecturers: 32, utilization: 76 },
  ds: { students: 180, courses: 8, lecturers: 24, utilization: 71 },
  is: { students: 220, courses: 9, lecturers: 28, utilization: 68 },
  cys: { students: 150, courses: 7, lecturers: 27, utilization: 74 },
}

export const kpiDataByCollege: Record<
  string,
  { students: number; courses: number; lecturers: number; utilization: number; conflictRate: number }
> = {
  all: { students: 38262, courses: 48, lecturers: 156, utilization: 78, conflictRate: 2.3 },
  khscs: { students: 520, courses: 18, lecturers: 52, utilization: 85, conflictRate: 1.8 },
  kaiioe: { students: 380, courses: 15, lecturers: 48, utilization: 79, conflictRate: 2.5 },
  ktsbt: { students: 240, courses: 10, lecturers: 35, utilization: 72, conflictRate: 3.1 },
  kaisgssr: { students: 110, courses: 5, lecturers: 21, utilization: 65, conflictRate: 1.2 },
}

export const mockConflicts = [
  { id: 1, type: "Room", description: "CS101-A and SE201-B both scheduled in R202 at 10:00", severity: "High" },
  { id: 2, type: "Lecturer", description: "Dr. Saleh double-booked on Monday 08:00", severity: "High" },
  { id: 3, type: "Student", description: "15 students have overlapping CS201 and DS301", severity: "Medium" },
]

export const roomUtilizationData = [
  { name: "Building A", utilization: 85, capacity: 70 },
  { name: "Building B", utilization: 72, capacity: 75 },
  { name: "Building C", utilization: 68, capacity: 45 },
]

export const weeklyDistribution = [
  { day: "Sun", classes: 24 },
  { day: "Mon", classes: 28 },
  { day: "Tue", classes: 22 },
  { day: "Wed", classes: 26 },
  { day: "Thu", classes: 18 },
]

export const semesterComparison = [
  { semester: "Fall 2023", conflicts: 12, utilization: 75 },
  { semester: "Spring 2024", conflicts: 8, utilization: 78 },
  { semester: "Summer 2024", conflicts: 5, utilization: 65 },
  { semester: "Fall 2024", conflicts: 3, utilization: 82 },
]
