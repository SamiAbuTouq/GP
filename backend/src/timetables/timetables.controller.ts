import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { TimetablesService } from './timetables.service';

@Controller('timetables')
@Roles(Role.ADMIN, Role.LECTURER)
export class TimetablesController {
  constructor(private readonly timetablesService: TimetablesService) {}

  @Get()
  list(
    @Query('semesterId') semesterIdRaw?: string,
    @Query('draftsOnly') draftsOnlyRaw?: string,
  ) {
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
    return this.timetablesService.list(semesterId, draftsOnly);
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
}

