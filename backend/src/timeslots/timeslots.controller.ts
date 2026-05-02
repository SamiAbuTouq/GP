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
  Query,
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
  findAll(@Query('filter') filter?: string) {
    let isSummer: boolean | undefined;
    if (filter === 'summer') isSummer = true;
    else if (filter === 'normal') isSummer = false;
    return this.timeslotsService.findAll(isSummer);
  }

  @Get('archived/list')
  findArchived(@Query('filter') filter?: string) {
    let isSummer: boolean | undefined;
    if (filter === 'summer') isSummer = true;
    else if (filter === 'normal') isSummer = false;
    return this.timeslotsService.findArchived(isSummer);
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

  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.timeslotsService.restoreArchived(id);
  }

  @Get(':id/deletion-impact')
  getDeletionImpact(@Param('id', ParseIntPipe) id: number) {
    return this.timeslotsService.getDeletionImpact(id);
  }

  @Delete(':id/permanent')
  permanentlyDelete(@Param('id', ParseIntPipe) id: number) {
    return this.timeslotsService.permanentlyDeleteArchived(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.timeslotsService.findOne(id);
  }
}
