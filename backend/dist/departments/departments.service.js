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
exports.DepartmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DepartmentsService = class DepartmentsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        const departments = await this.prisma.department.findMany({
            orderBy: { dept_name: 'asc' },
        });
        return departments.map((dept) => ({
            id: dept.dept_id,
            name: dept.dept_name,
        }));
    }
    async seed() {
        const defaultDepartments = [
            'Accounting',
            'Basic Sciences',
            'Business Administration',
            'Business Information Technology',
            'Communications Engineering',
            'Computer Engineering',
            'Computer Graphics',
            'Computer Science',
            'Coordination Unit for Service Courses',
            'Cyber Security',
            'Data Science',
            'E-Marketing & Social Media',
            'Electrical Engineering',
            'Software Engineering',
        ];
        for (const deptName of defaultDepartments) {
            await this.prisma.department.upsert({
                where: { dept_id: defaultDepartments.indexOf(deptName) + 1 },
                update: {},
                create: { dept_name: deptName },
            });
        }
        return { message: 'Departments seeded successfully' };
    }
};
exports.DepartmentsService = DepartmentsService;
exports.DepartmentsService = DepartmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DepartmentsService);
//# sourceMappingURL=departments.service.js.map