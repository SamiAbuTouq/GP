import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { SemestersService } from './semesters.service';

@Controller('semesters')
@Roles(Role.ADMIN)
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Get()
  findAll() {
    return this.semestersService.findAll();
  }
}

