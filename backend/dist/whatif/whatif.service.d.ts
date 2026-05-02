import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyScenarioRunDto, CompareDto, CompareMode, CreateScenarioDto, UpdateScenarioDto } from './dto/whatif.dto';
import { TimetablesService } from '../timetables/timetables.service';
export interface MetricsSnapshot {
    conflicts: number;
    roomUtilizationRate: number;
    softConstraintsScore: number;
    fitnessScore: number;
    lecturerBalanceScore: number | null;
    isValid: boolean;
}
export declare class WhatIfService {
    private readonly prisma;
    private readonly config;
    private readonly timetablesService;
    private readonly logger;
    private readonly activeProcesses;
    private holdsGlobalOptimizerLock;
    private pendingProcessStarts;
    private queuedScenarioRuns;
    constructor(prisma: PrismaService, config: ConfigService, timetablesService: TimetablesService);
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
    deleteScenario(id: number, force?: boolean): Promise<{
        ok: boolean;
    }>;
    listConditions(scenarioId: number): Promise<{
        conditionId: number;
        type: string;
        parameters: import("@prisma/client/runtime/client").JsonValue;
        orderIndex: number;
    }[]>;
    runScenario(scenarioId: number, timetableIds: number[]): Promise<{
        runs: {
            runId: number;
            timetableId: number;
        }[];
    }>;
    private releaseGlobalOptimizerLockIfIdle;
    private _startNextQueuedRunIfIdle;
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
    listRuns(scenarioId: number): Promise<{
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
        mode: CompareMode;
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
            baseline: MetricsSnapshot | null;
            result: MetricsSnapshot | null;
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
    applyScenarioRun(runId: number, dto?: ApplyScenarioRunDto): Promise<{
        ok: boolean;
        appliedToTimetableId: number;
        message: string;
    }>;
    controlRun(runId: number, action: 'pause' | 'resume'): Promise<{
        ok: boolean;
        action: "pause" | "resume";
        runId: number;
    }>;
    cancelRun(runId: number): Promise<{
        ok: boolean;
        runId: number;
    }>;
    private _spawnRunnerProcess;
    private _handlePythonLine;
    private _buildRunnerConfig;
    private _computeLecturerBalanceScore;
    private serializeScenario;
    private _generateRecommendation;
    private _computeSectionChangeSummary;
}
