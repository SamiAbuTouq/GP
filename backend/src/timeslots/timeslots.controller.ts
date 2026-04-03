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
import { TimeslotsService } from './timeslots.service';
import { CreateTimeslotDto, UpdateTimeslotDto } from './dto/timeslot.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('timeslots')
export class TimeslotsController {
  constructor(private readonly timeslotsService: TimeslotsService) {}

  @Public()
  @Get()
  findAll() {
    return this.timeslotsService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.timeslotsService.findOne(id);
  }

  @Public()
  @Post()
  create(@Body() dto: CreateTimeslotDto) {
    return this.timeslotsService.create(dto);
  }

  @Public()
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTimeslotDto) {
    return this.timeslotsService.update(id, dto);
  }

  @Public()
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.timeslotsService.remove(id);
  }
}
