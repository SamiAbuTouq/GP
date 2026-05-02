import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTimeslotDto,
  UpdateTimeslotDto,
  UpdateLecturerPreferenceItemDto,
} from './dto/timeslot.dto';

// Days mapping using bitmask: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_VALUES = { Sunday: 1, Monday: 2, Tuesday: 4, Wednesday: 8, Thursday: 16 };

@Injectable()
export class TimeslotsService {
  constructor(private prisma: PrismaService) {}

  private async ensureLecturerProfileExists(
    tx: Prisma.TransactionClient,
    userId: number,
  ) {
    const user = await tx.user.findUnique({
      where: { user_id: userId },
      select: { user_id: true, role_name: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.role_name !== Role.LECTURER) {
      throw new NotFoundException(`Lecturer with ID ${userId} not found`);
    }

    const existingLecturer = await tx.lecturer.findUnique({
      where: { user_id: userId },
      select: { user_id: true },
    });

    if (existingLecturer) return;

    let fallbackDepartment = await tx.department.findFirst({
      orderBy: { dept_id: 'asc' },
      select: { dept_id: true },
    });

    if (!fallbackDepartment) {
      fallbackDepartment = await tx.department.create({
        data: { dept_name: 'General' },
        select: { dept_id: true },
      });
    }

    await tx.lecturer.create({
      data: {
        user_id: userId,
        dept_id: fallbackDepartment.dept_id,
        max_workload: 15,
        is_available: true,
      },
    });
  }

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

  async findAll(isSummer?: boolean) {
    const timeslots = await this.prisma.timeslot.findMany({
      where: {
        is_active: true,
        ...(isSummer !== undefined ? { is_summer: isSummer } : {}),
      },
      orderBy: [{ start_time: 'asc' }],
    });

    return timeslots.map((slot) => ({
      id: slot.slot_id,
      days: this.daysMaskToArray(slot.days_mask),
      start: this.formatTime(slot.start_time),
      end: this.formatTime(slot.end_time),
      slotType: slot.slot_type,
      isSummer: slot.is_summer,
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
      isSummer: slot.is_summer,
    };
  }

  async create(dto: CreateTimeslotDto) {
    const slot = await this.prisma.timeslot.create({
      data: {
        days_mask: this.daysArrayToMask(dto.days),
        start_time: this.parseTime(dto.start),
        end_time: this.parseTime(dto.end),
        slot_type: dto.slotType,
        is_summer: dto.isSummer,
      },
    });

    return {
      id: slot.slot_id,
      days: this.daysMaskToArray(slot.days_mask),
      start: this.formatTime(slot.start_time),
      end: this.formatTime(slot.end_time),
      slotType: slot.slot_type,
      isSummer: slot.is_summer,
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
        ...(dto.isSummer !== undefined ? { is_summer: dto.isSummer } : {}),
      },
    });

    return {
      id: slot.slot_id,
      days: this.daysMaskToArray(slot.days_mask),
      start: this.formatTime(slot.start_time),
      end: this.formatTime(slot.end_time),
      slotType: slot.slot_type,
      isSummer: slot.is_summer,
    };
  }

  async remove(id: number) {
    const existing = await this.prisma.timeslot.findUnique({
      where: { slot_id: id },
    });

    if (!existing) {
      throw new NotFoundException(`Timeslot with ID ${id} not found`);
    }

    await this.prisma.timeslot.update({
      where: { slot_id: id },
      data: { is_active: false },
    });

    return { message: 'Timeslot archived successfully', archived: true };
  }

  async getLecturerPreferences(userId: number) {
    return this.getPreferencesByUserId(userId);
  }

  async getLecturerPreferencesForAdmin(userId: number) {
    return this.getPreferencesByUserId(userId);
  }

  private async getPreferencesByUserId(userId: number) {
    const slots = await this.prisma.timeslot.findMany({
      where: { is_active: true },
      orderBy: [{ start_time: 'asc' }, { end_time: 'asc' }, { slot_id: 'asc' }],
      include: {
        lecturer_preferences: {
          where: { user_id: userId },
          select: { is_preferred: true },
          take: 1,
        },
      },
    });

    return slots.map((slot) => ({
      slotId: slot.slot_id,
      days: this.daysMaskToArray(slot.days_mask),
      start: this.formatTime(slot.start_time),
      end: this.formatTime(slot.end_time),
      slotType: slot.slot_type,
      isSummer: slot.is_summer,
      preference:
        slot.lecturer_preferences.length > 0
          ? slot.lecturer_preferences[0].is_preferred
            ? 'PREFERRED'
            : 'NOT_PREFERRED'
          : 'NEUTRAL',
    }));
  }

  async updateLecturerPreferences(
    userId: number,
    preferences: UpdateLecturerPreferenceItemDto[],
  ) {
    const uniqueBySlot = new Map<number, boolean>();
    for (const item of preferences) {
      uniqueBySlot.set(item.slotId, item.isPreferred);
    }

    const normalized = Array.from(uniqueBySlot.entries()).map(
      ([slotId, isPreferred]) => ({ slotId, isPreferred }),
    );

    await this.prisma.$transaction(async (tx) => {
      await this.ensureLecturerProfileExists(tx, userId);

      await tx.lecturerPreference.deleteMany({
        where: { user_id: userId },
      });

      if (normalized.length > 0) {
        await tx.lecturerPreference.createMany({
          data: normalized.map((item) => ({
            user_id: userId,
            slot_id: item.slotId,
            is_preferred: item.isPreferred,
          })),
          skipDuplicates: true,
        });
      }
    });

    return { success: true };
  }

  async findArchived(isSummer?: boolean) {
    const timeslots = await this.prisma.timeslot.findMany({
      where: {
        is_active: false,
        ...(isSummer !== undefined ? { is_summer: isSummer } : {}),
      },
      orderBy: [{ start_time: 'asc' }],
    });

    return timeslots.map((slot) => ({
      id: slot.slot_id,
      days: this.daysMaskToArray(slot.days_mask),
      start: this.formatTime(slot.start_time),
      end: this.formatTime(slot.end_time),
      slotType: slot.slot_type,
      isSummer: slot.is_summer,
    }));
  }

  async restoreArchived(id: number) {
    const slot = await this.prisma.timeslot.findUnique({
      where: { slot_id: id },
      select: { slot_id: true },
    });
    if (!slot) {
      throw new NotFoundException(`Timeslot with ID ${id} not found`);
    }

    await this.prisma.timeslot.update({
      where: { slot_id: id },
      data: { is_active: true },
    });
    return { message: 'Timeslot restored successfully' };
  }

  async getDeletionImpact(id: number) {
    const slot = await this.prisma.timeslot.findUnique({
      where: { slot_id: id },
      select: { slot_id: true },
    });
    if (!slot) {
      throw new NotFoundException(`Timeslot with ID ${id} not found`);
    }

    const entries = await this.prisma.sectionScheduleEntry.findMany({
      where: { slot_id: id },
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
      slotId: id,
      entryCount: await this.prisma.sectionScheduleEntry.count({ where: { slot_id: id } }),
      timetables: entries.map((entry) => ({
        timetableId: entry.timetable_id,
        generationType: entry.timetable.generation_type,
        status: entry.timetable.status,
        versionNumber: entry.timetable.version_number,
      })),
    };
  }

  async permanentlyDeleteArchived(id: number) {
    const slot = await this.prisma.timeslot.findUnique({
      where: { slot_id: id },
      select: { slot_id: true, is_active: true },
    });
    if (!slot) {
      throw new NotFoundException(`Timeslot with ID ${id} not found`);
    }
    if (slot.is_active) {
      throw new ConflictException('Only archived timeslots can be permanently deleted.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sectionScheduleEntry.deleteMany({ where: { slot_id: id } });
      await tx.lecturerPreference.deleteMany({ where: { slot_id: id } });
      await tx.lecturerOfficeHours.deleteMany({ where: { slot_id: id } });
      await tx.timeslot.delete({ where: { slot_id: id } });
    });

    return { message: 'Timeslot permanently deleted successfully' };
  }
}
