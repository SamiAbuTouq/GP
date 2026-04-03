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
exports.TimeslotsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_VALUES = { Sunday: 1, Monday: 2, Tuesday: 4, Wednesday: 8, Thursday: 16 };
let TimeslotsService = class TimeslotsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    daysMaskToArray(mask) {
        const days = [];
        for (let i = 0; i < DAYS.length; i++) {
            if (mask & (1 << i)) {
                days.push(DAYS[i]);
            }
        }
        return days;
    }
    daysArrayToMask(days) {
        let mask = 0;
        for (const day of days) {
            if (DAY_VALUES[day]) {
                mask |= DAY_VALUES[day];
            }
        }
        return mask;
    }
    formatTime(date) {
        return date.toTimeString().slice(0, 5);
    }
    parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    }
    async findAll() {
        const timeslots = await this.prisma.timeslot.findMany({
            orderBy: [{ start_time: 'asc' }],
        });
        return timeslots.map((slot) => ({
            id: slot.slot_id,
            days: this.daysMaskToArray(slot.days_mask),
            start: this.formatTime(slot.start_time),
            end: this.formatTime(slot.end_time),
            slotType: slot.slot_type,
        }));
    }
    async findOne(id) {
        const slot = await this.prisma.timeslot.findUnique({
            where: { slot_id: id },
        });
        if (!slot) {
            throw new common_1.NotFoundException(`Timeslot with ID ${id} not found`);
        }
        return {
            id: slot.slot_id,
            days: this.daysMaskToArray(slot.days_mask),
            start: this.formatTime(slot.start_time),
            end: this.formatTime(slot.end_time),
            slotType: slot.slot_type,
        };
    }
    async create(dto) {
        const slot = await this.prisma.timeslot.create({
            data: {
                days_mask: this.daysArrayToMask(dto.days),
                start_time: this.parseTime(dto.start),
                end_time: this.parseTime(dto.end),
                slot_type: dto.slotType,
            },
        });
        return {
            id: slot.slot_id,
            days: this.daysMaskToArray(slot.days_mask),
            start: this.formatTime(slot.start_time),
            end: this.formatTime(slot.end_time),
            slotType: slot.slot_type,
        };
    }
    async update(id, dto) {
        const existing = await this.prisma.timeslot.findUnique({
            where: { slot_id: id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Timeslot with ID ${id} not found`);
        }
        const slot = await this.prisma.timeslot.update({
            where: { slot_id: id },
            data: {
                ...(dto.days && { days_mask: this.daysArrayToMask(dto.days) }),
                ...(dto.start && { start_time: this.parseTime(dto.start) }),
                ...(dto.end && { end_time: this.parseTime(dto.end) }),
                ...(dto.slotType && { slot_type: dto.slotType }),
            },
        });
        return {
            id: slot.slot_id,
            days: this.daysMaskToArray(slot.days_mask),
            start: this.formatTime(slot.start_time),
            end: this.formatTime(slot.end_time),
            slotType: slot.slot_type,
        };
    }
    async remove(id) {
        const existing = await this.prisma.timeslot.findUnique({
            where: { slot_id: id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Timeslot with ID ${id} not found`);
        }
        await this.prisma.timeslot.delete({
            where: { slot_id: id },
        });
        return { message: 'Timeslot deleted successfully' };
    }
};
exports.TimeslotsService = TimeslotsService;
exports.TimeslotsService = TimeslotsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TimeslotsService);
//# sourceMappingURL=timeslots.service.js.map