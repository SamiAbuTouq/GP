import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { LecturersService } from './lecturers.service';
import { CreateLecturerDto, UpdateLecturerDto } from './dto/lecturer.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('lecturers')
export class LecturersController {
  constructor(private readonly lecturersService: LecturersService) {}

  @Public()
  @Get()
  findAll() {
    return this.lecturersService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lecturersService.findOne(id);
  }

  @Public()
  @Post()
  create(@Body() dto: CreateLecturerDto) {
    return this.lecturersService.create(dto);
  }

  @Public()
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLecturerDto) {
    return this.lecturersService.update(id, dto);
  }

  @Public()
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.lecturersService.remove(id);
  }
}
