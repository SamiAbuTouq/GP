import { Response } from 'express';
import { WhatIfService } from './whatif.service';
import { ApplyScenarioRunDto, CompareDto, ControlRunDto, CreateScenarioDto, DeleteScenarioQueryDto, RunScenarioDto, UpdateScenarioDto } from './dto/whatif.dto';
export declare class WhatIfController {
    private readonly whatIfService;
    constructor(whatIfService: WhatIfService);
    listScenarios(): Promise<{
        id: any;
        name: any;
        status: any;
        description: any;
        conditionCount: any;
        conditions: any;
        latestRun: {
            runId: any;
            status: any;
            startedAt: any;
            completedAt: any;
            resultTimetableId: any;
            baselineMetrics: any;
            resultMetrics: any;
            baseTimetableId: any;
            errorMessage: any;
        } | null;
        isRunning: boolean;
    }[]>;
    getScenario(id: number): Promise<{
        id: any;
        name: any;
        status: any;
        description: any;
        conditionCount: any;
        conditions: any;
        latestRun: {
            runId: any;
            status: any;
            startedAt: any;
            completedAt: any;
            resultTimetableId: any;
            baselineMetrics: any;
            resultMetrics: any;
            baseTimetableId: any;
            errorMessage: any;
        } | null;
        isRunning: boolean;
    }>;
    createScenario(dto: CreateScenarioDto): Promise<{
        id: any;
        name: any;
        status: any;
        description: any;
        conditionCount: any;
        conditions: any;
        latestRun: {
            runId: any;
            status: any;
            startedAt: any;
            completedAt: any;
            resultTimetableId: any;
            baselineMetrics: any;
            resultMetrics: any;
            baseTimetableId: any;
            errorMessage: any;
        } | null;
        isRunning: boolean;
    }>;
    updateScenario(id: number, dto: UpdateScenarioDto): Promise<{
        id: any;
        name: any;
        status: any;
        description: any;
        conditionCount: any;
        conditions: any;
        latestRun: {
            runId: any;
            status: any;
            startedAt: any;
            completedAt: any;
            resultTimetableId: any;
            baselineMetrics: any;
            resultMetrics: any;
            baseTimetableId: any;
            errorMessage: any;
        } | null;
        isRunning: boolean;
    }>;
    cloneScenario(id: number): Promise<{
        id: any;
        name: any;
        status: any;
        description: any;
        conditionCount: any;
        conditions: any;
        latestRun: {
            runId: any;
            status: any;
            startedAt: any;
            completedAt: any;
            resultTimetableId: any;
            baselineMetrics: any;
            resultMetrics: any;
            baseTimetableId: any;
            errorMessage: any;
        } | null;
        isRunning: boolean;
    }>;
    deleteScenario(id: number, query: DeleteScenarioQueryDto): Promise<{
        ok: boolean;
    }>;
    listConditions(id: number): Promise<{
        conditionId: number;
        type: string;
        parameters: import("@prisma/client/runtime/client").JsonValue;
        orderIndex: number;
    }[]>;
    runScenario(id: number, dto: RunScenarioDto): Promise<{
        runs: {
            runId: number;
            timetableId: number;
        }[];
    }>;
    streamRunProgress(runId: number, res: Response): Promise<void>;
    getRunStatus(runId: number): Promise<{
        runId: number;
        scenarioId: number;
        scenarioName: string;
        baseTimetableId: number;
        resultTimetableId: number | null;
        status: string;
        startedAt: Date | null;
        completedAt: Date | null;
        errorMessage: string | null;
        baselineMetrics: import("@prisma/client/runtime/client").JsonValue;
        resultMetrics: import("@prisma/client/runtime/client").JsonValue;
        gwoIterationsRun: number | null;
        generationSeconds: number | null;
        isActive: boolean;
    }>;
    listRuns(id: number): Promise<{
        runId: number;
        scenarioId: number;
        baseTimetableId: number;
        resultTimetableId: number | null;
        status: string;
        startedAt: Date | null;
        completedAt: Date | null;
        errorMessage: string | null;
        baselineMetrics: import("@prisma/client/runtime/client").JsonValue;
        resultMetrics: import("@prisma/client/runtime/client").JsonValue;
        gwoIterationsRun: number | null;
        generationSeconds: number | null;
        semester: {
            academicYear: string;
            semesterType: number;
        } | null;
    }[]>;
    compare(dto: CompareDto): Promise<{
        mode: import("./dto/whatif.dto").CompareMode;
        comparisons: {
            runId: number;
            scenarioId: number;
            scenarioName: string;
            baseTimetableId: number;
            resultTimetableId: number | null;
            status: string;
            semester: {
                semester_type: number;
                academic_year: string;
            } | null;
            baseline: import("./whatif.service").MetricsSnapshot | null;
            result: import("./whatif.service").MetricsSnapshot | null;
            deltas: {
                conflicts: number;
                roomUtilizationRate: number;
                softConstraintsScore: number;
                fitnessScore: number;
                lecturerBalanceScore: number | null;
            } | null;
            recommendation: string;
            sectionChanges: {
                added: number;
                removed: number;
                changed: number;
                unchanged: number;
                baselineCount: number;
                resultCount: number;
            };
        }[];
    }>;
    applyScenarioRun(runId: number, body: ApplyScenarioRunDto): Promise<{
        ok: boolean;
        appliedToTimetableId: number;
        message: string;
    }>;
    controlScenarioRun(runId: number, dto: ControlRunDto): Promise<{
        ok: boolean;
        action: "pause" | "resume";
        runId: number;
    }>;
    cancelScenarioRun(runId: number): Promise<{
        ok: boolean;
        runId: number;
    }>;
}
