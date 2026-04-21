import { Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DepartmentsService } from './departments.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('departments')
@Roles(Role.ADMIN)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Post('seed')
  seed() {
    return this.departmentsService.seed();
  }
}
