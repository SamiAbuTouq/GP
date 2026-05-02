import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('courses')
@Roles(Role.ADMIN)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll() {
    return this.coursesService.findAll();
  }

  @Get('archived/list')
  findArchived() {
    return this.coursesService.findArchived();
  }

  @Post()
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.restoreArchived(id);
  }

  @Get(':id/deletion-impact')
  getDeletionImpact(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.getDeletionImpact(id);
  }

  @Delete(':id/permanent')
  permanentlyDelete(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.permanentlyDeleteArchived(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.findOne(id);
  }
}
