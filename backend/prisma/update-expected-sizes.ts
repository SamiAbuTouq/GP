/**
 * Backfill course.expected_size_normal / expected_size_summer from schedule history.
 * Values are the total enrolled students across all sections in the latest term (0 = not offered).
 *
 * Run: npm run prisma:update-expected-sizes
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type SemesterPickRow = {
  semester_id: number;
  academic_year: string;
  semester_type: number;
};

function semesterNameFromType(type: number): string {
  if (type === 1) return "First Semester";
  if (type === 2) return "Second Semester";
  return "Summer Semester";
}

function pickNewestSemester(semesters: SemesterPickRow[]): SemesterPickRow | null {
  if (semesters.length === 0) return null;
  const startYear = (y: string) => {
    const m = String(y).trim().match(/^(\d{4})/);
    return m ? parseInt(m[1], 10) : 0;
  };
  return [...semesters].sort((a, b) => {
    const yd = startYear(b.academic_year) - startYear(a.academic_year);
    if (yd !== 0) return yd;
    return b.semester_type - a.semester_type;
  })[0] ?? null;
}

type TermExpectedStats = {
  sectionSets: Map<number, Set<string>>;
  sumTotal: Map<number, number>;
};

function buildTermExpectedStats(
  entries: Array<{
    course_id: number;
    section_number: string;
    registered_students: number | null;
    timetable: { semester: SemesterPickRow | null };
  }>,
  targetSemesterId: number,
): TermExpectedStats {
  const sectionSets = new Map<number, Set<string>>();
  const regBySection = new Map<number, Map<string, number>>();
  for (const row of entries) {
    const sem = row.timetable.semester;
    if (!sem || sem.semester_id !== targetSemesterId) continue;
    const cid = row.course_id;
    let set = sectionSets.get(cid);
    if (!set) {
      set = new Set();
      sectionSets.set(cid, set);
    }
    const sn = String(row.section_number).trim() || "1";
    set.add(sn);
    let perCourse = regBySection.get(cid);
    if (!perCourse) {
      perCourse = new Map();
      regBySection.set(cid, perCourse);
    }
    const reg = row.registered_students ?? 0;
    perCourse.set(sn, Math.max(perCourse.get(sn) ?? 0, reg));
  }
  const sumTotal = new Map<number, number>();
  for (const [cid, perSection] of regBySection) {
    let sum = 0;
    for (const v of perSection.values()) sum += v;
    sumTotal.set(cid, sum);
  }
  return { sectionSets, sumTotal };
}

function resolveExpectedSizeFromTermStats(
  courseId: number,
  stats: TermExpectedStats,
): number {
  const sectionCount = stats.sectionSets.get(courseId)?.size ?? 0;
  if (sectionCount === 0) return 0;
  return stats.sumTotal.get(courseId) ?? 0;
}

async function main() {
  const entries = await prisma.sectionScheduleEntry.findMany({
    where: { timetable: { semester_id: { not: null } } },
    select: {
      course_id: true,
      section_number: true,
      registered_students: true,
      timetable: {
        select: {
          semester: {
            select: {
              semester_id: true,
              academic_year: true,
              semester_type: true,
            },
          },
        },
      },
    },
  });

  const semesterById = new Map<number, SemesterPickRow>();
  for (const row of entries) {
    const s = row.timetable.semester;
    if (!s) continue;
    semesterById.set(s.semester_id, s);
  }

  const allSems = [...semesterById.values()];
  const normalTarget = pickNewestSemester(
    allSems.filter((s) => s.semester_type === 1 || s.semester_type === 2),
  );
  const summerTarget = pickNewestSemester(
    allSems.filter((s) => s.semester_type === 3),
  );

  const normalStats = normalTarget
    ? buildTermExpectedStats(entries, normalTarget.semester_id)
    : null;
  const summerStats = summerTarget
    ? buildTermExpectedStats(entries, summerTarget.semester_id)
    : null;

  let zeroNormal = 0;
  let zeroSummer = 0;
  let withEnrollment = 0;

  const courses = await prisma.course.findMany({ select: { course_id: true } });
  for (const c of courses) {
    const expected_size_normal = normalStats
      ? resolveExpectedSizeFromTermStats(c.course_id, normalStats)
      : null;
    const expected_size_summer = summerStats
      ? resolveExpectedSizeFromTermStats(c.course_id, summerStats)
      : null;
    if (expected_size_normal === 0) zeroNormal += 1;
    if (expected_size_summer === 0) zeroSummer += 1;
    if (
      (expected_size_normal != null && expected_size_normal > 0) ||
      (expected_size_summer != null && expected_size_summer > 0)
    ) {
      withEnrollment += 1;
    }
    await prisma.course.update({
      where: { course_id: c.course_id },
      data: { expected_size_normal, expected_size_summer },
    });
  }

  console.log(
    normalTarget
      ? `Normal: ${normalTarget.academic_year} (${semesterNameFromType(normalTarget.semester_type)}) — ${zeroNormal} courses at 0 (not scheduled); totals are sum of all sections`
      : "Normal: no schedule semester found",
  );
  console.log(
    summerTarget
      ? `Summer: ${summerTarget.academic_year} (${semesterNameFromType(summerTarget.semester_type)}) — ${zeroSummer} courses at 0 (not scheduled)`
      : "Summer: no schedule semester found",
  );
  console.log(`${withEnrollment} courses with at least one positive total expected size.`);
  console.log(`Updated ${courses.length} courses.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
