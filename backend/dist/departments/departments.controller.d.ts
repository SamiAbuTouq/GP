import { DepartmentsService } from './departments.service';
export declare class DepartmentsController {
    private readonly departmentsService;
    constructor(departmentsService: DepartmentsService);
    findAll(): Promise<{
        id: number;
        name: string;
    }[]>;
    seed(): Promise<{
        message: string;
    }>;
}
