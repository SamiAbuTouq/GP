import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeslotDto, UpdateTimeslotDto } from './dto/timeslot.dto';

// Days mapping using bitmask: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_VALUES = { Sunday: 1, Monday: 2, Tuesday: 4, Wednesday: 8, Thursday: 16 };

@Injectable()
export class TimeslotsService {
  constructor(private prisma: PrismaService) {}

  private daysMaskToArray(mask: number): string[] {
    const days: string[] = [];
    for (let i = 0; i < DAYS.length; i++) {
      if (mask & (1 << i)) {
        days.push(DAYS[i]);
      }
    }
    return days;
  }

  private daysArrayToMask(days: string[]): number {
    let mask = 0;
    for (const day of days) {
      if (DAY_VALUES[day as keyof typeof DAY_VALUES]) {
        mask |= DAY_VALUES[day as keyof typeof DAY_VALUES];
      }
    }
    return mask;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  private parseTime(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  async findAll() {
    const timeslots = await this.prisma.timeslot.findMany({
      orderBy: [{ start_time: 'asc' }],
    });

    return timeslots.map((slot) => ({
      id: slot.slot_id,
      days: this.daysMaskToArray(slot.days_mask),
      start: this.formatTime(slot.start_time),
      end: this.formatTime(slot.end_time),
      slotType: slot.slot_type,
    }));
  }

  async findOne(id: number) {
    const slot = await this.prisma.timeslot.findUnique({
      where: { slot_id: id },
    });

    if (!slot) {
      throw new NotFoundException(`Timeslot with ID ${id} not found`);
    }

    return {
      id: slot.slot_id,
      days: this.daysMaskToArray(slot.days_mask),
      start: this.formatTime(slot.start_time),
      end: this.formatTime(slot.end_time),
      slotType: slot.slot_type,
    };
  }

  async create(dto: CreateTimeslotDto) {
    const slot = await this.prisma.timeslot.create({
      data: {
        days_mask: this.daysArrayToMask(dto.days),
        start_time: this.parseTime(dto.start),
        end_time: this.parseTime(dto.end),
        slot_type: dto.slotType,
      },
    });

    return {
      id: slot.slot_id,
      days: this.daysMaskToArray(slot.days_mask),
      start: this.formatTime(slot.start_time),
      end: this.formatTime(slot.end_time),
      slotType: slot.slot_type,
    };
  }

  async update(id: number, dto: UpdateTimeslotDto) {
    const existing = await this.prisma.timeslot.findUnique({
      where: { slot_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Timeslot with ID ${id} not found`);
    }

    const slot = await this.prisma.timeslot.update({
      where: { slot_id: id },
      data: {
        ...(dto.days && { days_mask: this.daysArrayToMask(dto.days) }),
        ...(dto.start && { start_time: this.parseTime(dto.start) }),
        ...(dto.end && { end_time: this.parseTime(dto.end) }),
        ...(dto.slotType && { slot_type: dto.slotType }),
      },
    });

    return {
      id: slot.slot_id,
      days: this.daysMaskToArray(slot.days_mask),
      start: this.formatTime(slot.start_time),
      end: this.formatTime(slot.end_time),
      slotType: slot.slot_type,
    };
  }

  async remove(id: number) {
    const existing = await this.prisma.timeslot.findUnique({
      where: { slot_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Timeslot with ID ${id} not found`);
    }

    await this.prisma.timeslot.delete({
      where: { slot_id: id },
    });

    return { message: 'Timeslot deleted successfully' };
  }
}
