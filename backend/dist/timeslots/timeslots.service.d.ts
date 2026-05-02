import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeslotDto, UpdateTimeslotDto, UpdateLecturerPreferenceItemDto } from './dto/timeslot.dto';
export declare class TimeslotsService {
    private prisma;
    constructor(prisma: PrismaService);
    private ensureLecturerProfileExists;
    private daysMaskToArray;
    private daysArrayToMask;
    private formatTime;
    private parseTime;
    findAll(isSummer?: boolean): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
    }>;
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
    getLecturerPreferences(userId: number): Promise<{
        slotId: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
        preference: string;
    }[]>;
    getLecturerPreferencesForAdmin(userId: number): Promise<{
        slotId: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
        preference: string;
    }[]>;
    private getPreferencesByUserId;
    updateLecturerPreferences(userId: number, preferences: UpdateLecturerPreferenceItemDto[]): Promise<{
        success: boolean;
    }>;
    findArchived(isSummer?: boolean): Promise<{
        id: number;
        days: string[];
        start: string;
        end: string;
        slotType: string;
        isSummer: boolean;
    }[]>;
    restoreArchived(id: number): Promise<{
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
    permanentlyDeleteArchived(id: number): Promise<{
        message: string;
    }>;
}
