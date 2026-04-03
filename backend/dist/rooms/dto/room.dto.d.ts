export declare class CreateRoomDto {
    id: string;
    type: string;
    capacity: number;
    isAvailable?: boolean;
}
export declare class UpdateRoomDto {
    type?: string;
    capacity?: number;
    isAvailable?: boolean;
}
