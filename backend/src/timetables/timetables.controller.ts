import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { TimetablesService } from './timetables.service';

@Controller('timetables')
export class TimetablesController {
  constructor(private readonly timetablesService: TimetablesService) {}

  @Public()
  @Get()
  list(@Query('semesterId') semesterIdRaw?: string) {
    const semesterId = semesterIdRaw ? Number(semesterIdRaw) : undefined;
    return this.timetablesService.list(Number.isFinite(semesterId) ? semesterId : undefined);
  }

  @Public()
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

