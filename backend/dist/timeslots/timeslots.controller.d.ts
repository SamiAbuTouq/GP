import { TimeslotsService } from './timeslots.service';
import { CreateTimeslotDto, UpdateTimeslotDto, UpdateLecturerPreferencesDto } from './dto/timeslot.dto';
import type { User } from '@prisma/client';
export declare class TimeslotsController {
    private readonly timeslotsService;
    constructor(timeslotsService: TimeslotsService);
    getLecturerPreferences(user: User): Promise<{
        slotId: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        preference: string;
    }[]>;
    updateLecturerPreferences(user: User, dto: UpdateLecturerPreferencesDto): Promise<{
        success: boolean;
    }>;
    getLecturerPreferencesForAdmin(userId: number): Promise<{
        slotId: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        preference: string;
    }[]>;
    findAll(): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
    }>;
    create(dto: CreateTimeslotDto): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
    }>;
    update(id: number, dto: UpdateTimeslotDto): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
