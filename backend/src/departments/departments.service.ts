import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

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
}
