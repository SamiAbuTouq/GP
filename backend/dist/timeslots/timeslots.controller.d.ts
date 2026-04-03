import { TimeslotsService } from './timeslots.service';
import { CreateTimeslotDto, UpdateTimeslotDto } from './dto/timeslot.dto';
export declare class TimeslotsController {
    private readonly timeslotsService;
    constructor(timeslotsService: TimeslotsService);
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
