import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';

// Room type mapping: 0 = Classroom, 1 = Lecture Hall, 2 = Lab, 3 = Seminar Room
const ROOM_TYPES = ['Classroom', 'Lecture Hall', 'Lab', 'Seminar Room'];

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const rooms = await this.prisma.room.findMany({
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

    await this.prisma.room.delete({
      where: { room_id: id },
    });

    return { message: 'Room deleted successfully' };
  }
}
