import { Controller, Get, Post } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Public()
  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Public()
  @Post('seed')
  seed() {
    return this.departmentsService.seed();
  }
}
