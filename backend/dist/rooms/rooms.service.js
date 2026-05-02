"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ROOM_TYPES = ['Classroom', 'Lecture Hall', 'Lab', 'Seminar Room'];
let RoomsService = class RoomsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        const rooms = await this.prisma.room.findMany({
            where: { is_available: true },
            orderBy: { room_number: 'asc' },
        });
        return rooms.map((room) => ({
            id: room.room_number,
            databaseId: room.room_id,
            type: ROOM_TYPES[room.room_type] || 'Classroom',
            capacity: room.capacity,
            isAvailable: room.is_available,
        }));
    }
    async findOne(id) {
        const room = await this.prisma.room.findUnique({
            where: { room_id: id },
        });
        if (!room) {
            throw new common_1.NotFoundException(`Room with ID ${id} not found`);
        }
        return {
            id: room.room_number,
            databaseId: room.room_id,
            type: ROOM_TYPES[room.room_type] || 'Classroom',
            capacity: room.capacity,
            isAvailable: room.is_available,
        };
    }
    async create(dto) {
        const roomTypeIndex = ROOM_TYPES.indexOf(dto.type);
        const room = await this.prisma.room.create({
            data: {
                room_number: dto.id,
                room_type: roomTypeIndex >= 0 ? roomTypeIndex : 0,
                capacity: dto.capacity,
                is_available: dto.isAvailable ?? true,
            },
        });
        return {
            id: room.room_number,
            databaseId: room.room_id,
            type: ROOM_TYPES[room.room_type] || 'Classroom',
            capacity: room.capacity,
            isAvailable: room.is_available,
        };
    }
    async update(id, dto) {
        const existing = await this.prisma.room.findUnique({
            where: { room_id: id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Room with ID ${id} not found`);
        }
        const roomTypeIndex = dto.type ? ROOM_TYPES.indexOf(dto.type) : existing.room_type;
        const room = await this.prisma.room.update({
            where: { room_id: id },
            data: {
                ...(dto.type && { room_type: roomTypeIndex >= 0 ? roomTypeIndex : 0 }),
                ...(dto.capacity !== undefined && { capacity: dto.capacity }),
                ...(dto.isAvailable !== undefined && { is_available: dto.isAvailable }),
            },
        });
        return {
            id: room.room_number,
            databaseId: room.room_id,
            type: ROOM_TYPES[room.room_type] || 'Classroom',
            capacity: room.capacity,
            isAvailable: room.is_available,
        };
    }
    async toggleAvailability(id) {
        const existing = await this.prisma.room.findUnique({
            where: { room_id: id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Room with ID ${id} not found`);
        }
        const room = await this.prisma.room.update({
            where: { room_id: id },
            data: { is_available: !existing.is_available },
        });
        return {
            id: room.room_number,
            databaseId: room.room_id,
            type: ROOM_TYPES[room.room_type] || 'Classroom',
            capacity: room.capacity,
            isAvailable: room.is_available,
        };
    }
    async remove(id) {
        const existing = await this.prisma.room.findUnique({
            where: { room_id: id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Room with ID ${id} not found`);
        }
        await this.prisma.room.update({
            where: { room_id: id },
            data: { is_available: false },
        });
        return { message: 'Room archived successfully', archived: true };
    }
    async findArchived() {
        const rooms = await this.prisma.room.findMany({
            where: { is_available: false },
            orderBy: { room_number: 'asc' },
        });
        return rooms.map((room) => ({
            id: room.room_number,
            databaseId: room.room_id,
            type: ROOM_TYPES[room.room_type] || 'Classroom',
            capacity: room.capacity,
            isAvailable: room.is_available,
        }));
    }
    async restoreArchived(id) {
        const room = await this.prisma.room.findUnique({
            where: { room_id: id },
            select: { room_id: true },
        });
        if (!room) {
            throw new common_1.NotFoundException(`Room with ID ${id} not found`);
        }
        await this.prisma.room.update({
            where: { room_id: id },
            data: { is_available: true },
        });
        return { message: 'Room restored successfully' };
    }
    async getDeletionImpact(id) {
        const room = await this.prisma.room.findUnique({
            where: { room_id: id },
            select: { room_id: true, room_number: true },
        });
        if (!room) {
            throw new common_1.NotFoundException(`Room with ID ${id} not found`);
        }
        const entries = await this.prisma.sectionScheduleEntry.findMany({
            where: { room_id: id },
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
            roomId: room.room_id,
            roomNumber: room.room_number,
            entryCount: await this.prisma.sectionScheduleEntry.count({ where: { room_id: id } }),
            timetables: entries.map((entry) => ({
                timetableId: entry.timetable_id,
                generationType: entry.timetable.generation_type,
                status: entry.timetable.status,
                versionNumber: entry.timetable.version_number,
            })),
        };
    }
    async permanentlyDeleteArchived(id) {
        const room = await this.prisma.room.findUnique({
            where: { room_id: id },
            select: { room_id: true, is_available: true },
        });
        if (!room) {
            throw new common_1.NotFoundException(`Room with ID ${id} not found`);
        }
        if (room.is_available) {
            throw new common_1.ConflictException('Only archived rooms can be permanently deleted.');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.sectionScheduleEntry.deleteMany({ where: { room_id: id } });
            await tx.room.delete({ where: { room_id: id } });
        });
        return { message: 'Room permanently deleted successfully' };
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RoomsService);
//# sourceMappingURL=rooms.service.js.map