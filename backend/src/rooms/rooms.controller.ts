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
import { RoomsService } from './rooms.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('rooms')
@Roles(Role.ADMIN)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get('archived/list')
  findArchived() {
    return this.roomsService.findArchived();
  }

  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }

  @Patch(':id/toggle-availability')
  toggleAvailability(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.toggleAvailability(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.restoreArchived(id);
  }

  @Get(':id/deletion-impact')
  getDeletionImpact(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.getDeletionImpact(id);
  }

  @Delete(':id/permanent')
  permanentlyDelete(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.permanentlyDeleteArchived(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.findOne(id);
  }
}
