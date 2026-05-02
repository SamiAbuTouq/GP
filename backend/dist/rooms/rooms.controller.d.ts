import { RoomsService } from './rooms.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
export declare class RoomsController {
    private readonly roomsService;
    constructor(roomsService: RoomsService);
    findAll(): Promise<{
        id: string;
        databaseId: number;
        type: string;
        capacity: number;
        isAvailable: boolean;
    }[]>;
    findArchived(): Promise<{
        id: string;
        databaseId: number;
        type: string;
        capacity: number;
        isAvailable: boolean;
    }[]>;
    create(dto: CreateRoomDto): Promise<{
        id: string;
        databaseId: number;
        type: string;
        capacity: number;
        isAvailable: boolean;
    }>;
    update(id: number, dto: UpdateRoomDto): Promise<{
        id: string;
        databaseId: number;
        type: string;
        capacity: number;
        isAvailable: boolean;
    }>;
    toggleAvailability(id: number): Promise<{
        id: string;
        databaseId: number;
        type: string;
        capacity: number;
        isAvailable: boolean;
    }>;
    remove(id: number): Promise<{
        message: string;
        archived: boolean;
    }>;
    restore(id: number): Promise<{
        message: string;
    }>;
    getDeletionImpact(id: number): Promise<{
        roomId: number;
        roomNumber: string;
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
        id: string;
        databaseId: number;
        type: string;
        capacity: number;
        isAvailable: boolean;
    }>;
}
