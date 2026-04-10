"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemestersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function decodeSemesterType(type) {
    const map = {
        1: 'First Semester',
        2: 'Second Semester',
        3: 'Summer Semester',
    };
    return map[type] ?? `Semester ${type}`;
}
let SemestersService = class SemestersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        const semesters = await this.prisma.semester.findMany({
            select: {
                semester_id: true,
                academic_year: true,
                semester_type: true,
                total_students: true,
                start_date: true,
                end_date: true,
            },
            orderBy: [{ academic_year: 'asc' }, { semester_type: 'asc' }],
        });
        return semesters.map((s) => ({
            semesterId: s.semester_id,
            academicYear: s.academic_year,
            semesterType: s.semester_type,
            semester: decodeSemesterType(s.semester_type),
            totalStudents: s.total_students,
            startDate: s.start_date,
            endDate: s.end_date,
        }));
    }
};
exports.SemestersService = SemestersService;
exports.SemestersService = SemestersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SemestersService);
//# sourceMappingURL=semesters.service.js.map