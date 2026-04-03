import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
export declare class RoomsService {
    private prisma;
    constructor(prisma: PrismaService);
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
