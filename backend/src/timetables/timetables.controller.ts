import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PublishDraftDto } from './dto/publish-draft.dto';
import { TimetablesService } from './timetables.service';

@Controller('timetables')
@Roles(Role.ADMIN, Role.LECTURER)
export class TimetablesController {
  constructor(private readonly timetablesService: TimetablesService) {}

  @Get()
  list(
    @Query('semesterId') semesterIdRaw?: string,
    @Query('draftsOnly') draftsOnlyRaw?: string,
    @Query('scenarioRunBasesOnly') scenarioRunBasesOnlyRaw?: string,
  ) {
    const scenarioRunBasesOnly =
      scenarioRunBasesOnlyRaw === 'true' ||
      scenarioRunBasesOnlyRaw === '1' ||
      scenarioRunBasesOnlyRaw?.toLowerCase() === 'yes';
    const draftsOnly =
      draftsOnlyRaw === 'true' ||
      draftsOnlyRaw === '1' ||
      draftsOnlyRaw?.toLowerCase() === 'yes';
    const rawTrimmed =
      typeof semesterIdRaw === 'string' ? semesterIdRaw.trim() : '';
    const parsedSemester =
      rawTrimmed !== '' &&
      rawTrimmed.toLowerCase() !== 'null' &&
      rawTrimmed.toLowerCase() !== 'undefined'
        ? Number(rawTrimmed)
        : undefined;
    const semesterId =
      typeof parsedSemester === 'number' &&
      Number.isFinite(parsedSemester) &&
      parsedSemester > 0
        ? parsedSemester
        : undefined;
    return this.timetablesService.list(semesterId, draftsOnly, scenarioRunBasesOnly);
  }

  @Get(':id/entries')
  listEntries(
    @Param('id', ParseIntPipe) id: number,
    @Query('courseId') courseIdRaw?: string,
    @Query('lecturerUserId') lecturerUserIdRaw?: string,
    @Query('roomId') roomIdRaw?: string,
  ) {
    const courseId = courseIdRaw ? Number(courseIdRaw) : undefined;
    const lecturerUserId = lecturerUserIdRaw ? Number(lecturerUserIdRaw) : undefined;
    const roomId = roomIdRaw ? Number(roomIdRaw) : undefined;

    return this.timetablesService.listEntries({
      timetableId: id,
      courseId: Number.isFinite(courseId) ? courseId : undefined,
      lecturerUserId: Number.isFinite(lecturerUserId) ? lecturerUserId : undefined,
      roomId: Number.isFinite(roomId) ? roomId : undefined,
    });
  }

  @Get(':id/conflicts')
  listConflicts(@Param('id', ParseIntPipe) id: number) {
    return this.timetablesService.getTimetableConflictSummary(id);
  }

  @Get(':id/schedule-payload')
  schedulePayload(@Param('id', ParseIntPipe) id: number) {
    return this.timetablesService.buildSchedulePayload(id);
  }

  @Put(':id/schedule-payload')
  replaceSchedulePayload(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { schedule?: unknown[] },
  ) {
    return this.timetablesService.replaceScheduleFromPayload(id, body?.schedule);
  }

  @Post(':id/publish')
  @Roles(Role.ADMIN)
  publishDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PublishDraftDto,
  ) {
    return this.timetablesService.publishDraftTimetable(id, {
      academicYear: body?.academicYear,
      semesterType: body?.semesterType,
      acknowledgedHardConflicts: body?.acknowledgedHardConflicts,
    });
  }
}

