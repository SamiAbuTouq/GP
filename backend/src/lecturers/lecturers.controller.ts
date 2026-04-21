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
import { Role } from '@prisma/client';
import { LecturersService } from './lecturers.service';
import { CreateLecturerDto, UpdateLecturerDto } from './dto/lecturer.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('lecturers')
@Roles(Role.ADMIN)
export class LecturersController {
  constructor(private readonly lecturersService: LecturersService) {}

  @Get()
  findAll() {
    return this.lecturersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lecturersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLecturerDto) {
    return this.lecturersService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLecturerDto) {
    return this.lecturersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.lecturersService.remove(id);
  }
}
