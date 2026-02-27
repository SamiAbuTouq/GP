// Mock data for the University Course Timetabling System

export const mockStudents = [
  { id: "STU001", name: "Ahmad Al-Khateeb", major: "Computer Science", year: 3, email: "ahmad.k@psut.edu.jo" },
  { id: "STU002", name: "Sara Mansour", major: "Software Engineering", year: 2, email: "sara.m@psut.edu.jo" },
  { id: "STU003", name: "Omar Hassan", major: "Data Science", year: 4, email: "omar.h@psut.edu.jo" },
  { id: "STU004", name: "Layla Nasser", major: "Computer Science", year: 1, email: "layla.n@psut.edu.jo" },
  { id: "STU005", name: "Khaled Yousef", major: "Information Systems", year: 3, email: "khaled.y@psut.edu.jo" },
]

export const mockLecturers = [
  { id: "LEC001", name: "Dr. Mohammad Saleh", department: "Computer Science", load: 12, email: "m.saleh@psut.edu.jo" },
  { id: "LEC002", name: "Dr. Rania Ahmad", department: "Software Engineering", load: 15, email: "r.ahmad@psut.edu.jo" },
  { id: "LEC003", name: "Prof. Yousef Kamal", department: "Data Science", load: 9, email: "y.kamal@psut.edu.jo" },
  {
    id: "LEC004",
    name: "Dr. Hana Ibrahim",
    department: "Information Systems",
    load: 12,
    email: "h.ibrahim@psut.edu.jo",
  },
]

export const mockCourses = [
  { code: "CS101", name: "Introduction to Programming", credits: 3, type: "Core", sections: 3 },
  { code: "CS201", name: "Data Structures", credits: 3, type: "Core", sections: 2 },
  { code: "CS301", name: "Algorithms", credits: 3, type: "Core", sections: 2 },
  { code: "CS401", name: "Machine Learning", credits: 3, type: "Elective", sections: 1 },
  { code: "SE201", name: "Software Engineering", credits: 3, type: "Core", sections: 2 },
  { code: "DS301", name: "Big Data Analytics", credits: 3, type: "Elective", sections: 1 },
]

export const mockRooms = [
  { id: "R101", building: "Building A", capacity: 40, type: "Lecture Hall" },
  { id: "R102", building: "Building A", capacity: 30, type: "Classroom" },
  { id: "R201", building: "Building B", capacity: 25, type: "Lab" },
  { id: "R202", building: "Building B", capacity: 50, type: "Lecture Hall" },
  { id: "R301", building: "Building C", capacity: 20, type: "Seminar Room" },
]

export const mockTimeSlots = [
  { id: 1, day: "Sunday", start: "08:00", end: "09:30" },
  { id: 2, day: "Sunday", start: "10:00", end: "11:30" },
  { id: 3, day: "Sunday", start: "12:00", end: "13:30" },
  { id: 4, day: "Monday", start: "08:00", end: "09:30" },
  { id: 5, day: "Monday", start: "10:00", end: "11:30" },
  { id: 6, day: "Tuesday", start: "08:00", end: "09:30" },
  { id: 7, day: "Tuesday", start: "10:00", end: "11:30" },
  { id: 8, day: "Wednesday", start: "08:00", end: "09:30" },
  { id: 9, day: "Thursday", start: "08:00", end: "09:30" },
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
  totalStudents: 1250,
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
    totalStudents: 1250,
    totalCourses: 48,
    totalSections: 124,
    totalLecturers: 156,
    totalRooms: 28,
    roomUtilization: 78,
    conflictRate: 2.3,
    avgClassSize: 32,
  },
  "spring-2024": {
    totalStudents: 1180,
    totalCourses: 45,
    totalSections: 118,
    totalLecturers: 148,
    totalRooms: 28,
    roomUtilization: 74,
    conflictRate: 3.1,
    avgClassSize: 30,
  },
  "summer-2024": {
    totalStudents: 620,
    totalCourses: 28,
    totalSections: 65,
    totalLecturers: 82,
    totalRooms: 20,
    roomUtilization: 52,
    conflictRate: 1.8,
    avgClassSize: 24,
  },
  "fall-2023": {
    totalStudents: 1150,
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
  all: { students: 1250, courses: 48, lecturers: 156, utilization: 78 },
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
  all: { students: 1250, courses: 48, lecturers: 156, utilization: 78, conflictRate: 2.3 },
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
