export declare class CreateTimeslotDto {
    days: string[];
    start: string;
    end: string;
    slotType: string;
}
export declare class UpdateTimeslotDto {
    days?: string[];
    start?: string;
    end?: string;
    slotType?: string;
}
export declare class UpdateLecturerPreferenceItemDto {
    slotId: number;
    isPreferred: boolean;
}
export declare class UpdateLecturerPreferencesDto {
    preferences: UpdateLecturerPreferenceItemDto[];
}
