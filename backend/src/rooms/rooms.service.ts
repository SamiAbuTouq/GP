import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';

// Room type mapping: 0 = Classroom, 1 = Lecture Hall, 2 = Lab, 3 = Seminar Room
const ROOM_TYPES = ['Classroom', 'Lecture Hall', 'Lab', 'Seminar Room'];

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const rooms = await this.prisma.room.findMany({
      where: { is_available: true },
      orderBy: { room_number: 'asc' },
    });

    return rooms.map((room) => ({
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type] || 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    }));
  }

  async findOne(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: id },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    return {
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type] || 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    };
  }

  async create(dto: CreateRoomDto) {
    const roomTypeIndex = ROOM_TYPES.indexOf(dto.type);
    
    const room = await this.prisma.room.create({
      data: {
        room_number: dto.id,
        room_type: roomTypeIndex >= 0 ? roomTypeIndex : 0,
        capacity: dto.capacity,
        is_available: dto.isAvailable ?? true,
      },
    });

    return {
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type] || 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    };
  }

  async update(id: number, dto: UpdateRoomDto) {
    const existing = await this.prisma.room.findUnique({
      where: { room_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const roomTypeIndex = dto.type ? ROOM_TYPES.indexOf(dto.type) : existing.room_type;

    const room = await this.prisma.room.update({
      where: { room_id: id },
      data: {
        ...(dto.type && { room_type: roomTypeIndex >= 0 ? roomTypeIndex : 0 }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.isAvailable !== undefined && { is_available: dto.isAvailable }),
      },
    });

    return {
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type] || 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    };
  }

  async toggleAvailability(id: number) {
    const existing = await this.prisma.room.findUnique({
      where: { room_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const room = await this.prisma.room.update({
      where: { room_id: id },
      data: { is_available: !existing.is_available },
    });

    return {
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type] || 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    };
  }

  async remove(id: number) {
    const existing = await this.prisma.room.findUnique({
      where: { room_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    await this.prisma.room.update({
      where: { room_id: id },
      data: { is_available: false },
    });

    return { message: 'Room archived successfully', archived: true };
  }

  async findArchived() {
    const rooms = await this.prisma.room.findMany({
      where: { is_available: false },
      orderBy: { room_number: 'asc' },
    });

    return rooms.map((room) => ({
      id: room.room_number,
      databaseId: room.room_id,
      type: ROOM_TYPES[room.room_type] || 'Classroom',
      capacity: room.capacity,
      isAvailable: room.is_available,
    }));
  }

  async restoreArchived(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: id },
      select: { room_id: true },
    });
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    await this.prisma.room.update({
      where: { room_id: id },
      data: { is_available: true },
    });
    return { message: 'Room restored successfully' };
  }

  async getDeletionImpact(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: id },
      select: { room_id: true, room_number: true },
    });
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const entries = await this.prisma.sectionScheduleEntry.findMany({
      where: { room_id: id },
      select: {
        timetable_id: true,
        timetable: {
          select: { generation_type: true, status: true, version_number: true },
        },
      },
      distinct: ['timetable_id'],
      orderBy: { timetable_id: 'asc' },
    });

    return {
      roomId: room.room_id,
      roomNumber: room.room_number,
      entryCount: await this.prisma.sectionScheduleEntry.count({ where: { room_id: id } }),
      timetables: entries.map((entry) => ({
        timetableId: entry.timetable_id,
        generationType: entry.timetable.generation_type,
        status: entry.timetable.status,
        versionNumber: entry.timetable.version_number,
      })),
    };
  }

  async permanentlyDeleteArchived(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: id },
      select: { room_id: true, is_available: true },
    });
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }
    if (room.is_available) {
      throw new ConflictException('Only archived rooms can be permanently deleted.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sectionScheduleEntry.deleteMany({ where: { room_id: id } });
      await tx.room.delete({ where: { room_id: id } });
    });

    return { message: 'Room permanently deleted successfully' };
  }
}
