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

  @Get('deactivated/list')
  findDeactivated() {
    return this.lecturersService.findDeactivated();
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

  @Patch(':id/reactivate')
  reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.lecturersService.reactivate(id);
  }

  @Get(':id/purge-impact')
  getPurgeImpact(@Param('id', ParseIntPipe) id: number) {
    return this.lecturersService.getPurgeImpact(id);
  }

  @Delete(':id/purge')
  purge(@Param('id', ParseIntPipe) id: number) {
    return this.lecturersService.purgeDeactivated(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lecturersService.findOne(id);
  }
}
