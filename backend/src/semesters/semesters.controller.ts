import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SemestersService } from './semesters.service';

@Controller('semesters')
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Public()
  @Get()
  findAll() {
    return this.semestersService.findAll();
  }
}

