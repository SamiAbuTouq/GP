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
import { TimeslotsService } from './timeslots.service';
import {
  CreateTimeslotDto,
  UpdateTimeslotDto,
  UpdateLecturerPreferencesDto,
} from './dto/timeslot.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@Controller('timeslots')
@Roles(Role.ADMIN)
export class TimeslotsController {
  constructor(private readonly timeslotsService: TimeslotsService) {}

  @Get('lecturer/preferences')
  @Roles(Role.LECTURER)
  getLecturerPreferences(@CurrentUser() user: User) {
    return this.timeslotsService.getLecturerPreferences(user.user_id);
  }

  @Put('lecturer/preferences')
  @Roles(Role.LECTURER)
  updateLecturerPreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdateLecturerPreferencesDto,
  ) {
    return this.timeslotsService.updateLecturerPreferences(
      user.user_id,
      dto.preferences ?? [],
    );
  }

  @Get('lecturer/preferences/:userId')
  getLecturerPreferencesForAdmin(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.timeslotsService.getLecturerPreferencesForAdmin(userId);
  }

  @Get()
  findAll() {
    return this.timeslotsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.timeslotsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTimeslotDto) {
    return this.timeslotsService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTimeslotDto) {
    return this.timeslotsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.timeslotsService.remove(id);
  }
}
