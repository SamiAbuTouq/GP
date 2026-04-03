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
    findOne(id: number): Promise<{
        id: string;
        databaseId: number;
        type: string;
        capacity: number;
        isAvailable: boolean;
    }>;
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
    }>;
}
