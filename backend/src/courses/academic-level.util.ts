/**
 * Academic level = the third digit of the numeric course code (1-based position).
 * Examples: "12311" → 3, "12111" → 1, "13432" → 4.
 */
export function academicLevelFromCourseCode(courseCode: string): number {
  const digits = String(courseCode).replace(/\D/g, '');
  if (digits.length >= 3) {
    const n = parseInt(digits.charAt(2), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 9);
  }
  return 1;
}
