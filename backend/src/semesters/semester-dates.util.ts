import { BadRequestException } from "@nestjs/common";

const ACADEMIC_YEAR_RE = /^(\d{4})-(\d{4})$/;

/** First calendar year in a YYYY-YYYY academic year label. */
export function parseAcademicYearStart(academicYear: string): number {
  const trimmed = academicYear.trim();
  const match = ACADEMIC_YEAR_RE.exec(trimmed);
  if (!match) {
    throw new BadRequestException(
      'academicYear must be in YYYY-YYYY format (for example: "2025-2026").',
    );
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) {
    throw new BadRequestException(
      "academicYear end year must be exactly one year after the start year.",
    );
  }
  return start;
}

/** Approximate term dates (aligned with seed data). */
export function semesterDateRange(
  yearStart: number,
  semesterType: number,
): { startDate: Date; endDate: Date } {
  if (semesterType === 1) {
    return {
      startDate: new Date(yearStart, 8, 1),
      endDate: new Date(yearStart + 1, 0, 15),
    };
  }
  if (semesterType === 2) {
    return {
      startDate: new Date(yearStart + 1, 1, 1),
      endDate: new Date(yearStart + 1, 5, 15),
    };
  }
  if (semesterType === 3) {
    return {
      startDate: new Date(yearStart + 1, 5, 20),
      endDate: new Date(yearStart + 1, 7, 15),
    };
  }
  throw new BadRequestException(
    "semesterType must be one of: 1 (First), 2 (Second), 3 (Summer).",
  );
}
