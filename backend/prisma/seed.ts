/**
 * prisma/seed.ts
 *
 * Seeds the database with:
 *   1. Predefined users (admin + test lecturers)
 *   2. Schedule data from psut_courses_with_credits.csv when present (includes Credit Hours),
 *      otherwise psut_courses_2023-2025_english.csv, then psut_courses_cleaned.csv (legacy layout)
 *
 * Run with:  npm run prisma:seed  (from website/backend)
 */

import "dotenv/config";
import { DeliveryMode, PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcrypt";
import * as fs from "fs";
import * as path from "path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const SALT_ROUNDS = 12;

// ────────────────────────────────────────────────────
// CSV PARSER
// ────────────────────────────────────────────────────

interface CsvRow {
  Year: string;              // e.g. "2022-2023"
  Semester: string;          // e.g. "First Semester"
  Course_Number: string;     // e.g. "11102"
  English_Name: string;      // e.g. "introduction to computer science"
  Section: string;           // e.g. "1"
  Lecturer_Name: string;
  Lecturer_ID: string;
  Department: string;
  Day: string;               // e.g. "Sun Tue Thu"
  Time: string;              // e.g. "13:30-15:00"
  Room: string;
  Room_ID: string;
  Registered_Students: string;
  Room_Capacity: string;
  Online: string;            // CSV: "Online" | "No" (on-campus) | "Blended" → Prisma DeliveryMode in `deliveryMode()`
  Start_Time: string;        // e.g. "13:30"
  End_Time: string;          // e.g. "15:00"
  islab: string;             // "True" | "False"
  Department_ID: string;
  /** Present on psut_courses_with_credits.csv */
  "Credit Hours"?: string;
}

function parseCsv(filePath: string): CsvRow[] {
  let raw = fs.readFileSync(filePath, "utf-8");
  // Strip UTF-8 BOM if present
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? "").trim();
    }
    rows.push(row as unknown as CsvRow);
  }
  return rows;
}

/** Handles CSV fields that may contain commas within quotes */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsvAsRecords(filePath: string): Record<string, string>[] {
  let raw = fs.readFileSync(filePath, "utf-8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function isEnglishExportCsv(headers: string[]): boolean {
  return headers.includes("Arabic_Name") && headers.includes("Section_Capacity");
}

function padTimePart(part: string): string {
  const p = part.trim();
  const idx = p.indexOf(":");
  if (idx < 0) return p;
  const h = p.slice(0, idx).padStart(2, "0");
  const m = p.slice(idx + 1).padStart(2, "0");
  return `${h}:${m}`;
}

function parseTimeRange(time: string): { start: string; end: string } | null {
  const t = time.trim();
  const m = t.match(/^(\d{1,2}:\d{1,2})\s*-\s*(\d{1,2}:\d{1,2})$/);
  if (!m) return null;
  return { start: padTimePart(m[1]), end: padTimePart(m[2]) };
}

function normalizeOnlineColumn(v: string): string {
  const x = v.trim().toLowerCase();
  if (x === "online") return "Online";
  if (x === "blended") return "Blended";
  return "No";
}

function inferIsLabFromRoomName(roomName: string): boolean {
  const lower = roomName.toLowerCase();
  return (
    lower.includes("lab") ||
    lower.includes("it1") ||
    lower.includes("it3") ||
    lower.includes("lb") ||
    lower.includes("applications lab")
  );
}

/** Map PSUT English export rows into the legacy CsvRow shape used by the rest of the seeder. */
function englishRecordsToCsvRows(records: Record<string, string>[]): CsvRow[] {
  const deptNames = [...new Set(records.map((r) => r.Department?.trim()).filter(Boolean))].sort();
  const roomNames = [...new Set(records.map((r) => r.Room?.trim()).filter(Boolean))].sort();
  const lecturerNames = [...new Set(records.map((r) => r.Lecturer_Name?.trim()).filter(Boolean))].sort();

  const deptIdByName = new Map<string, number>();
  deptNames.forEach((n, i) => deptIdByName.set(n, i + 1));

  const roomIdByName = new Map<string, number>();
  roomNames.forEach((n, i) => roomIdByName.set(n, i + 1));

  const lectCsvIdByName = new Map<string, number>();
  lecturerNames.forEach((n, i) => lectCsvIdByName.set(n, i + 1));

  return records.map((r) => {
    const tr = parseTimeRange(r.Time ?? "");
    const dept = r.Department?.trim() ?? "";
    const room = r.Room?.trim() ?? "";
    const lect = r.Lecturer_Name?.trim() ?? "";
    const cap = Math.round(parseFloat(r.Section_Capacity || "0") || 0);
    const reg = parseInt(r.Registered_Students || "0", 10) || 0;
    const isLab = inferIsLabFromRoomName(room);
    return {
      Year: r.Year?.trim() ?? "",
      Semester: r.Semester?.trim() ?? "",
      Course_Number: r.Course_Number?.trim() ?? "",
      English_Name: r.English_Name?.trim() ?? "",
      Section: r.Section?.trim() ?? "",
      Lecturer_Name: lect,
      Lecturer_ID: String(lectCsvIdByName.get(lect) ?? 0),
      Department: dept,
      Day: r.Day?.trim() ?? "",
      Time: r.Time?.trim() ?? "",
      Room: room,
      Room_ID: String(roomIdByName.get(room) ?? 0),
      Registered_Students: String(reg),
      Room_Capacity: String(cap),
      Online: normalizeOnlineColumn(r.Online ?? ""),
      Start_Time: tr?.start ?? "",
      End_Time: tr?.end ?? "",
      islab: String(isLab),
      Department_ID: String(deptIdByName.get(dept) ?? 0),
      "Credit Hours": (r["Credit Hours"] ?? "").trim(),
    };
  });
}

// ────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────

/** Convert day string like "Sun Tue Thu" to bitmask.
 *  bit 0=Sun, bit 1=Mon, bit 2=Tue, bit 3=Wed, bit 4=Thu, bit 5=Sat
 */
function daysToBitmask(dayStr: string): number {
  const map: Record<string, number> = {
    Sun: 1,   // bit 0
    Mon: 2,   // bit 1
    Tue: 4,   // bit 2
    Wed: 8,   // bit 3
    Thu: 16,  // bit 4
    Sat: 32,  // bit 5
    Daily: 1 | 2 | 4 | 8 | 16, // Sun-Thu
    TBA: 0,
  };
  let mask = 0;
  for (const d of dayStr.split(/\s+/)) {
    mask |= map[d] ?? 0;
  }
  return mask;
}

/** Parse "HH:MM" to a Date with only time portion (1970-01-01) */
function parseTime(t: string): Date | null {
  if (!t || t === "") return null;
  // Normalise: "9:00" -> "09:00"
  const parts = t.split(":");
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return new Date(1970, 0, 1, h, m, 0, 0);
}

/** Determine semester_type from name string */
function semesterType(name: string): number {
  if (name.toLowerCase().includes("first")) return 1;
  if (name.toLowerCase().includes("second")) return 2;
  if (name.toLowerCase().includes("summer")) return 3;
  return 1;
}

function semesterNameFromType(type: number): string {
  if (type === 1) return "First Semester";
  if (type === 2) return "Second Semester";
  return "Summer Semester";
}

function compareSemesterKeys(a: string, b: string): number {
  const [yearA, semA] = a.split("|");
  const [yearB, semB] = b.split("|");
  const startA = parseInt((yearA ?? "").split("-")[0], 10) || 0;
  const startB = parseInt((yearB ?? "").split("-")[0], 10) || 0;
  if (startA !== startB) return startA - startB;
  return semesterType(semA ?? "") - semesterType(semB ?? "");
}

/** Third digit of the numeric course code = academic level (same as `academic-level.util.ts` in Nest). */
function academicLevel(courseCode: string): number {
  const code = courseCode.replace(/\D/g, "");
  if (code.length >= 3) {
    const n = parseInt(code[2], 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 9);
  }
  return 1;
}

/** Determine delivery mode from the Online column */
function deliveryMode(online: string): DeliveryMode {
  const v = online.trim().toLowerCase();
  if (v === "online") return "ONLINE";
  if (v === "blended") return "BLENDED";
  return "FACE_TO_FACE";
}

/** Classify room type: 1=Lecture Hall, 2=Lab, 3=Online, 4=Other */
function roomType(roomName: string): number {
  const lower = roomName.toLowerCase();
  if (lower === "online") return 3;
  if (lower.includes("lab") || lower.includes("it1") || lower.includes("it3") || lower.includes("lb")) return 2;
  if (lower === "training" || lower === "project") return 4;
  return 1;
}

function parseIsLab(v: string): boolean {
  const normalized = v.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function timeslotType(islab: string, online: string): string {
  if (parseIsLab(islab)) return "Lab";
  return online.trim().toLowerCase() === "blended"
    ? "Blended Lecture"
    : "Traditional Lecture";
}

function truncate(str: string, max: number): string {
  if (!str) return "";
  const s = String(str);
  return s.length > max ? s.slice(0, max) : s;
}

/** Read optional "Credit Hours" cell from any CSV row shape. */
function parseCreditHoursCell(r: CsvRow | Record<string, string>): number | null {
  const raw = String((r as Record<string, string>)["Credit Hours"] ?? "").trim();
  if (!raw) return null;
  const n = Math.round(parseFloat(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Pick the most common value; tie-break toward the larger credit count. */
function mostFrequentInt(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [val, cnt] of counts) {
    if (cnt > bestCount || (cnt === bestCount && val > best)) {
      bestCount = cnt;
      best = val;
    }
  }
  return best;
}

// ────────────────────────────────────────────────────
// MAIN SEED
// ────────────────────────────────────────────────────

async function main() {

  // ── 1. PREDEFINED USERS ──────────────────────────
  const predefinedUsers = [
    {
      email: "admin@university.edu",
      password: "Admin@123456",
      first_name: "System",
      last_name: "Admin",
      role_name: Role.ADMIN,
    },
    {
      email: "lecturer@university.edu",
      password: "Lecturer@123456",
      first_name: "Jane",
      last_name: "Doe",
      role_name: Role.LECTURER,
    },
    {
      email: "samiabutouq116@gmail.com",
      password: "Sami1053411!",
      first_name: "Sami",
      last_name: "Abu Touq",
      role_name: Role.LECTURER,
    },
    {
      email: "yazanbedair@gmail.com",
      password: "Lecturer@123456",
      first_name: "Yazan",
      last_name: "Bedair",
      role_name: Role.LECTURER,
    },
  ];

  console.log(`Seeding ${predefinedUsers.length} predefined users...`);
  for (const user of predefinedUsers) {
    const password_hash = await bcrypt.hash(user.password, SALT_ROUNDS);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        password_hash,
        first_name: user.first_name,
        last_name: user.last_name,
        role_name: user.role_name,
      },
    });
    console.log(`   Seeded user: ${user.email} [${user.role_name}]`);
  }
  console.log(`   Predefined users done\n`);

  // ── 2. CSV DATA ───────────────────────────────────
  const withCreditsPath = path.resolve(__dirname, "..", "psut_courses_with_credits.csv");
  const englishPath = path.resolve(__dirname, "..", "psut_courses_2023-2025_english.csv");
  const legacyPath = path.resolve(__dirname, "..", "psut_courses_cleaned.csv");
  const csvPath = fs.existsSync(withCreditsPath)
    ? withCreditsPath
    : fs.existsSync(englishPath)
      ? englishPath
      : legacyPath;
  console.log(`Reading CSV from: ${csvPath}`);
  const rawRecords = parseCsvAsRecords(csvPath);
  const headers = Object.keys(rawRecords[0] ?? {});
  const rows: CsvRow[] = isEnglishExportCsv(headers)
    ? englishRecordsToCsvRows(rawRecords)
    : (rawRecords as unknown as CsvRow[]);
  console.log(`Parsed ${rows.length} rows from CSV\n`);

  // ── 3. DEPARTMENTS ───────────────────────────────
  const deptMap = new Map<number, string>(); // dept_id → name
  for (const r of rows) {
    const id = parseInt(r.Department_ID, 10);
    if (!isNaN(id) && !deptMap.has(id)) {
      deptMap.set(id, r.Department);
    }
  }
  console.log(`Seeding ${deptMap.size} departments...`);
  for (const [id, name] of deptMap) {
    await prisma.department.upsert({
      where: { dept_id: id },
      update: { dept_name: truncate(name, 100) },
      create: { dept_id: id, dept_name: truncate(name, 100) },
    });
  }
  console.log(`   Departments done\n`);

  // ── 4. ROOMS ─────────────────────────────────────
  const roomMap = new Map<number, { name: string; capacity: number; type: number }>();
  for (const r of rows) {
    const id = parseInt(r.Room_ID, 10);
    if (isNaN(id)) continue;
    const roomName = r.Room?.trim() ?? "";
    if (!roomName) continue;
    const cap = parseInt(r.Room_Capacity, 10) || 0;
    const rowIsLab = parseIsLab(r.islab);
    if (!roomMap.has(id)) {
      roomMap.set(id, {
        name: roomName,
        capacity: cap,
        type: rowIsLab ? 2 : roomType(roomName),
      });
    } else {
      // Keep the max capacity seen
      const existing = roomMap.get(id)!;
      if (cap > existing.capacity) existing.capacity = cap;
      // If any section in the room is a lab, classify room as lab.
      if (rowIsLab) existing.type = 2;
    }
  }
  console.log(`Seeding ${roomMap.size} rooms...`);
  for (const [id, info] of roomMap) {
    await prisma.room.upsert({
      where: { room_id: id },
      update: {
        room_number: truncate(info.name, 30),
        capacity: info.capacity,
        room_type: info.type,
      },
      create: {
        room_id: id,
        room_number: truncate(info.name, 30),
        room_type: info.type,
        capacity: info.capacity,
        is_available: true,
      },
    });
  }
  console.log(`   Rooms done\n`);

  // ── 5. COURSES ───────────────────────────────────
  // Group by course_code and pick the most common delivery mode
  const courseSet = new Map<
    string,
    { name: string; deptId: number; modes: DeliveryMode[]; isLab: boolean; creditSamples: number[] }
  >();
  for (const r of rows) {
    const code = r.Course_Number;
    const rowIsLab = parseIsLab(r.islab);
    const creditCell = parseCreditHoursCell(r);
    if (!courseSet.has(code)) {
      courseSet.set(code, {
        name: r.English_Name,
        deptId: parseInt(r.Department_ID, 10),
        modes: [deliveryMode(r.Online)],
        isLab: rowIsLab,
        creditSamples: creditCell != null ? [creditCell] : [],
      });
    } else {
      const cur = courseSet.get(code)!;
      cur.modes.push(deliveryMode(r.Online));
      if (rowIsLab) cur.isLab = true;
      if (creditCell != null) cur.creditSamples.push(creditCell);
    }
  }
  const semesterKeysFromRows = new Set<string>();
  for (const r of rows) {
    if (!r.Year || !r.Semester) continue;
    semesterKeysFromRows.add(`${r.Year}|${r.Semester}`);
  }
  const latestSemesterKeyForSections =
    [...semesterKeysFromRows].sort(compareSemesterKeys).pop() ?? null;

  console.log(`Seeding ${courseSet.size} courses...`);
  const courseIdMap = new Map<string, number>(); // course_code → course_id
  for (const [code, info] of courseSet) {
    // Pick most frequent delivery mode
    const mc = new Map<DeliveryMode, number>();
    for (const m of info.modes) mc.set(m, (mc.get(m) ?? 0) + 1);
    let mode: DeliveryMode = "FACE_TO_FACE";
    let maxCount = 0;
    for (const [m, c] of mc) {
      if (c > maxCount) { maxCount = c; mode = m; }
    }

    const level = academicLevel(code);
    const creditHours = mostFrequentInt(info.creditSamples, 3);
    // Distinct section numbers for this course in the latest semester present in the CSV (0 if not offered then).
    const sectionsInLatestSemester =
      latestSemesterKeyForSections == null
        ? 1
        : new Set(
            rows
              .filter(
                (r) =>
                  r.Course_Number === code &&
                  `${r.Year}|${r.Semester}` === latestSemesterKeyForSections
              )
              .map((r) => r.Section)
          ).size;

    const course = await prisma.course.upsert({
      where: { course_code: code },
      update: {
        course_name: truncate(info.name, 100),
        dept_id: info.deptId,
        academic_level: level,
        credit_hours: creditHours,
        delivery_mode: mode,
        is_lab: info.isLab,
        sections: sectionsInLatestSemester,
      },
      create: {
        dept_id: info.deptId,
        course_code: code,
        course_name: truncate(info.name, 100),
        academic_level: level,
        credit_hours: creditHours,
        delivery_mode: mode,
        is_lab: info.isLab,
        sections: sectionsInLatestSemester,
      },
    });
    courseIdMap.set(code, course.course_id);
  }
  console.log(`   Courses done\n`);

  // ── 6. SEMESTERS ─────────────────────────────────
  const semSet = new Map<string, { type: number; year: string }>();
  for (const r of rows) {
    if (!r.Year || !r.Semester) continue;
    const key = `${r.Year}|${r.Semester}`;
    if (!semSet.has(key)) {
      semSet.set(key, { type: semesterType(r.Semester), year: r.Year });
    }
  }

  // User-provided headcount data (unique students per semester)
  const headcountData: Record<string, number> = {
    "2022-2023|First Semester": 3981,
    "2022-2023|Second Semester": 3716,
    "2022-2023|Summer Semester": 1332,
    "2023-2024|First Semester": 4319,
    "2023-2024|Second Semester": 4090,
    "2023-2024|Summer Semester": 1387,
    "2024-2025|First Semester": 4462,
    "2024-2025|Second Semester": 4236,
    "2024-2025|Summer Semester": 1540,
    "2025-2026|First Semester": 4611,
    "2025-2026|Second Semester": 4588,
  };

  // Ensure headcount semesters are always seeded even if missing in CSV rows.
  // This keeps semester totals as a DB source of truth for dashboard KPIs.
  for (const key of Object.keys(headcountData)) {
    if (!semSet.has(key)) {
      const [year, semester] = key.split("|");
      semSet.set(key, { type: semesterType(semester), year });
    }
  }

  console.log(`Seeding ${semSet.size} semesters...`);
  const semIdMap = new Map<string, number>(); // "year|semester" → semester_id
  for (const [key, info] of semSet) {
    // Generate approximate dates
    const [yearStart] = info.year.split("-").map(Number);
    let startDate: Date, endDate: Date;
    if (info.type === 1) {
      startDate = new Date(yearStart, 8, 1);   // Sep 1
      endDate = new Date(yearStart + 1, 0, 15); // Jan 15
    } else if (info.type === 2) {
      startDate = new Date(yearStart + 1, 1, 1);  // Feb 1
      endDate = new Date(yearStart + 1, 5, 15);   // Jun 15
    } else {
      startDate = new Date(yearStart + 1, 5, 20); // Jun 20
      endDate = new Date(yearStart + 1, 7, 15);   // Aug 15
    }

    const semesterName = semesterNameFromType(info.type);
    const lookupKey = `${info.year}|${semesterName}`;
    const totalEnrollment = headcountData[lookupKey] || null;

    // Check if semester already exists by year + type
    const existing = await prisma.semester.findFirst({
      where: { academic_year: info.year, semester_type: info.type },
    });
    if (existing) {
      await prisma.semester.update({
        where: { semester_id: existing.semester_id },
        data: { total_students: totalEnrollment },
      });
      semIdMap.set(key, existing.semester_id);
    } else {
      const sem = await prisma.semester.create({
        data: {
          semester_type: info.type,
          academic_year: info.year,
          start_date: startDate,
          end_date: endDate,
          total_students: totalEnrollment,
        },
      });
      semIdMap.set(key, sem.semester_id);
    }
  }
  console.log(`   Semesters done\n`);

  // ── 7. SCHEDULE ROW NORMALIZATION ────────────────
  // Merge rows that represent the same section meeting pattern but are split
  // across separate day rows in the CSV export.
  type NormalizedScheduleRow = {
    row: CsvRow;
    daysMask: number;
  };
  const scheduleRowsMap = new Map<string, NormalizedScheduleRow>();
  for (const r of rows) {
    const mask = daysToBitmask(r.Day);
    if (!r.Start_Time || !r.End_Time || mask === 0) continue;
    const key = [
      r.Year,
      r.Semester,
      r.Course_Number,
      r.Section,
      r.Start_Time,
      r.End_Time,
      r.Room_ID,
      r.Lecturer_ID,
    ].join("|");
    const existing = scheduleRowsMap.get(key);
    if (!existing) {
      scheduleRowsMap.set(key, { row: r, daysMask: mask });
      continue;
    }
    existing.daysMask |= mask;
    const currentRegistered = parseInt(existing.row.Registered_Students, 10) || 0;
    const incomingRegistered = parseInt(r.Registered_Students, 10) || 0;
    if (incomingRegistered > currentRegistered) {
      existing.row.Registered_Students = r.Registered_Students;
    }
  }
  const scheduleRows = [...scheduleRowsMap.values()];
  console.log(`Normalized schedule rows: ${scheduleRows.length}`);

  // ── 8. TIMESLOTS ─────────────────────────────────
  // Build unique timeslots from (start_time, end_time, days_mask)
  // to match the DB unique constraint.
  const slotKey = (st: string, et: string, mask: number) =>
    `${st}|${et}|${mask}`;
  const slotMap = new Map<string, number>(); // key → slot_id

  // Collect unique timeslots first
  const uniqueSlots = new Map<
    string,
    { start: Date; end: Date; mask: number; type: string }
  >();
  for (const item of scheduleRows) {
    const r = item.row;
    const start = parseTime(r.Start_Time);
    const end = parseTime(r.End_Time);
    if (!start || !end) continue;
    const mask = item.daysMask;
    const type = timeslotType(r.islab, r.Online);
    const key = slotKey(r.Start_Time, r.End_Time, mask);
    if (!uniqueSlots.has(key)) {
      uniqueSlots.set(key, { start, end, mask, type });
    }
  }

  // Remove historical invalid timeslots with no assigned days.
  await prisma.timeslot.deleteMany({
    where: { days_mask: 0 },
  });

  console.log(`Seeding ${uniqueSlots.size} timeslots...`);
  for (const [key, info] of uniqueSlots) {
    const existing = await prisma.timeslot.findFirst({
      where: {
        start_time: info.start,
        end_time: info.end,
        days_mask: info.mask,
      },
    });
    if (existing) {
      slotMap.set(key, existing.slot_id);
    } else {
      const slot = await prisma.timeslot.create({
        data: {
          start_time: info.start,
          end_time: info.end,
          days_mask: info.mask,
          slot_type: info.type,
        },
      });
      slotMap.set(key, slot.slot_id);
    }
  }
  console.log(`   Timeslots done\n`);

  // ── 9. LECTURERS (Users + Lecturer records) ──────
  const lecturerSet = new Map<
    number,
    { name: string; deptId: number; courseCodes: Set<string> }
  >();
  for (const r of rows) {
    const id = parseInt(r.Lecturer_ID, 10);
    if (isNaN(id)) continue;
    if (!lecturerSet.has(id)) {
      lecturerSet.set(id, {
        name: r.Lecturer_Name,
        deptId: parseInt(r.Department_ID, 10),
        courseCodes: new Set([r.Course_Number]),
      });
    } else {
      lecturerSet.get(id)!.courseCodes.add(r.Course_Number);
    }
  }

  console.log(`Seeding ${lecturerSet.size} lecturers...`);
  const lecturerUserIdMap = new Map<number, number>(); // csv_lecturer_id → user_id
  let skippedLecturersWithInvalidNames = 0;
  for (const [csvId, info] of lecturerSet) {
    const normalizedName = (info.name ?? "").trim();
    const nameParts = normalizedName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");
    if (!firstName || !lastName) {
      skippedLecturersWithInvalidNames += 1;
      continue;
    }
    const email = `lecturer_${csvId}@psut.edu.jo`;

    // Upsert User
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        first_name: firstName,
        last_name: lastName,
      },
      create: {
        email,
        password_hash: "$2b$10$placeholder_hash_for_seed_data",
        first_name: firstName,
        last_name: lastName,
        role_name: "LECTURER",
      },
    });
    lecturerUserIdMap.set(csvId, user.user_id);

    // Upsert Lecturer
    await prisma.lecturer.upsert({
      where: { user_id: user.user_id },
      update: { dept_id: info.deptId },
      create: {
        user_id: user.user_id,
        dept_id: info.deptId,
        max_workload: 15,
        is_available: true,
      },
    });

    // Create LecturerCanTeachCourse entries
    for (const code of info.courseCodes) {
      const courseId = courseIdMap.get(code);
      if (!courseId) continue;
      await prisma.lecturerCanTeachCourse.upsert({
        where: {
          user_id_course_id: { user_id: user.user_id, course_id: courseId },
        },
        update: {},
        create: { user_id: user.user_id, course_id: courseId },
      });
    }
  }
  if (skippedLecturersWithInvalidNames > 0) {
    console.log(
      `   Skipped ${skippedLecturersWithInvalidNames} lecturers with invalid names`,
    );
  }
  console.log(`   Lecturers done\n`);

  // ── 10. TIMETABLES (one per semester) ────────────
  const timetableMap = new Map<string, number>(); // semKey → timetable_id
  for (const [semKey, semId] of semIdMap) {
    const existing = await prisma.timetable.findFirst({
      where: { semester_id: semId },
    });
    if (existing) {
      timetableMap.set(semKey, existing.timetable_id);
    } else {
      const tt = await prisma.timetable.create({
        data: {
          semester_id: semId,
          status: "active",
          generation_type: "imported",
          version_number: 1,
        },
      });
      timetableMap.set(semKey, tt.timetable_id);
    }
  }
  console.log(`Created ${timetableMap.size} timetables\n`);

  // Ensure Sami teaches 4 sections in the latest semester schedule.
  const fixedLecturerEmail = "samiabutouq116@gmail.com";
  const fixedLecturerUser = await prisma.user.findUnique({
    where: { email: fixedLecturerEmail },
    select: { user_id: true },
  });
  if (fixedLecturerUser) {
    // SectionScheduleEntry.user_id points to Lecturer.user_id, so ensure
    // the predefined lecturer account exists in lecturer as well.
    const fallbackDeptId = deptMap.keys().next().value as number | undefined;
    if (fallbackDeptId != null) {
      await prisma.lecturer.upsert({
        where: { user_id: fixedLecturerUser.user_id },
        update: {},
        create: {
          user_id: fixedLecturerUser.user_id,
          dept_id: fallbackDeptId,
          max_workload: 15,
          is_available: true,
        },
      });
    }
  }
  const latestSemesterKey = [...semIdMap.keys()].sort(compareSemesterKeys).pop() ?? null;
  const forcedLecturerAssignments = new Set<string>();
  if (fixedLecturerUser && latestSemesterKey) {
    for (const item of scheduleRows) {
      const r = item.row;
      const semKey = `${r.Year}|${r.Semester}`;
      if (semKey !== latestSemesterKey) continue;
      const assignmentKey = `${r.Course_Number}|${r.Section}|${r.Start_Time}|${r.End_Time}|${item.daysMask}`;
      forcedLecturerAssignments.add(assignmentKey);
      if (forcedLecturerAssignments.size >= 4) break;
    }
  }

  // ── 11. SECTION SCHEDULE ENTRIES ─────────────────
  // Clear seeded timetable entries so reseeding replaces historical row-per-day data.
  await prisma.sectionScheduleEntry.deleteMany({
    where: {
      timetable_id: { in: [...timetableMap.values()] },
    },
  });
  console.log(`Seeding section schedule entries...`);
  let entryCount = 0;
  let skippedCount = 0;

  for (const item of scheduleRows) {
    const r = item.row;
    const semKey = `${r.Year}|${r.Semester}`;
    const timetableId = timetableMap.get(semKey);
    const courseId = courseIdMap.get(r.Course_Number);
    const lecturerId = parseInt(r.Lecturer_ID, 10);
    const assignmentKey = `${r.Course_Number}|${r.Section}|${r.Start_Time}|${r.End_Time}|${item.daysMask}`;
    const forcedUserId = forcedLecturerAssignments.has(assignmentKey)
      ? fixedLecturerUser?.user_id
      : undefined;
    const userId = forcedUserId ?? lecturerUserIdMap.get(lecturerId);
    const roomId = parseInt(r.Room_ID, 10);

    if (!timetableId || !courseId || !userId || isNaN(roomId) || !roomMap.has(roomId)) {
      skippedCount++;
      continue;
    }

    // Find timeslot
    if (!r.Start_Time || !r.End_Time) {
      skippedCount++;
      continue;
    }
    const mask = item.daysMask;
    if (mask === 0) {
      skippedCount++;
      continue;
    }
    const sk = slotKey(r.Start_Time, r.End_Time, mask);
    const slotId = slotMap.get(sk);
    if (!slotId) {
      skippedCount++;
      continue;
    }

    const registered = parseInt(r.Registered_Students, 10) || 0;

    await prisma.sectionScheduleEntry.upsert({
      where: {
        timetable_id_course_id_section_number_slot_id: {
          timetable_id: timetableId,
          course_id: courseId,
          section_number: r.Section,
          slot_id: slotId,
        },
      },
      create: {
        user_id: userId,
        slot_id: slotId,
        course_id: courseId,
        timetable_id: timetableId,
        room_id: roomId,
        registered_students: registered,
        section_number: r.Section,
      },
      update: {
        user_id: userId,
        room_id: roomId,
        registered_students: registered,
      },
    });
    entryCount++;

    if (entryCount % 500 === 0) {
      console.log(`   ... ${entryCount} entries created`);
    }
  }
  console.log(`   Section schedule entries done: ${entryCount} created, ${skippedCount} skipped\n`);

  // ── SUMMARY ──────────────────────────────────────
  console.log("═══════════════════════════════════════════");
  console.log("  SEED COMPLETE!");
  console.log("═══════════════════════════════════════════");
  console.log(`  Predefined Users: ${predefinedUsers.length}`);
  console.log(`  Departments:      ${deptMap.size}`);
  console.log(`  Rooms:            ${roomMap.size}`);
  console.log(`  Courses:          ${courseSet.size}`);
  console.log(`  Semesters:        ${semSet.size}`);
  console.log(`  Timeslots:        ${uniqueSlots.size}`);
  console.log(`  Lecturers:        ${lecturerSet.size}`);
  console.log(`  Timetables:       ${timetableMap.size}`);
  console.log(`  Schedule Entries: ${entryCount}`);
  console.log("═══════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
