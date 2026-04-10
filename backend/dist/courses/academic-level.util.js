"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.academicLevelFromCourseCode = academicLevelFromCourseCode;
function academicLevelFromCourseCode(courseCode) {
    const digits = String(courseCode).replace(/\D/g, '');
    if (digits.length >= 3) {
        const n = parseInt(digits.charAt(2), 10);
        if (Number.isFinite(n) && n >= 1)
            return Math.min(n, 9);
    }
    return 1;
}
//# sourceMappingURL=academic-level.util.js.map