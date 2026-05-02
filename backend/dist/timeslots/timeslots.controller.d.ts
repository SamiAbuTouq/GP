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
        isSummer: boolean;
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
        isSummer: boolean;
        preference: string;
    }[]>;
    findAll(filter?: string): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
    }[]>;
    findArchived(filter?: string): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
    }[]>;
    create(dto: CreateTimeslotDto): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
    }>;
    update(id: number, dto: UpdateTimeslotDto): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
    }>;
    remove(id: number): Promise<{
        message: string;
        archived: boolean;
    }>;
    restore(id: number): Promise<{
        message: string;
    }>;
    getDeletionImpact(id: number): Promise<{
        slotId: number;
        entryCount: number;
        timetables: {
            timetableId: number;
            generationType: string;
            status: string;
            versionNumber: number;
        }[];
    }>;
    permanentlyDelete(id: number): Promise<{
        message: string;
    }>;
    findOne(id: number): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
    }>;
}
