"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WhatIfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatIfService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const prisma_service_1 = require("../prisma/prisma.service");
const optimizer_global_lock_1 = require("../common/optimizer-global-lock");
const whatif_dto_1 = require("./dto/whatif.dto");
const timetables_service_1 = require("../timetables/timetables.service");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_prefs_1 = require("../notifications/notification-prefs");
function isOptimizerScenarioRunBaseGenerationType(gen) {
    const g = String(gen ?? "")
        .trim()
        .toLowerCase();
    return g === "gwo_ui" || g === "gwo";
}
let WhatIfService = WhatIfService_1 = class WhatIfService {
    constructor(prisma, config, timetablesService, notifications) {
        this.prisma = prisma;
        this.config = config;
        this.timetablesService = timetablesService;
        this.notifications = notifications;
        this.logger = new common_1.Logger(WhatIfService_1.name);
        this.activeProcesses = new Map();
        this.userCancelledRunIds = new Set();
        this.holdsGlobalOptimizerLock = false;
        this.pendingProcessStarts = 0;
        this.queuedScenarioRuns = [];
        this._dayLabelByBit = {
            0: "Sunday",
            1: "Monday",
            2: "Tuesday",
            3: "Wednesday",
            4: "Thursday",
            5: "Friday",
            6: "Saturday",
        };
    }
    async listScenarios() {
        const rows = await this.prisma.scenario.findMany({
            orderBy: { scenario_id: "desc" },
            include: {
                conditions: { orderBy: { order_index: "asc" } },
                runs: {
                    orderBy: { run_id: "desc" },
                    take: 1,
                    include: {
                        base_timetable: { select: { timetable_id: true, status: true } },
                    },
                },
            },
        });
        return rows.map((row) => this.serializeScenario(row));
    }
    async getScenario(id) {
        const row = await this.prisma.scenario.findUnique({
            where: { scenario_id: id },
            include: {
                conditions: { orderBy: { order_index: "asc" } },
                runs: {
                    orderBy: { run_id: "desc" },
                    include: {
                        base_timetable: {
                            select: { timetable_id: true, status: true, semester_id: true },
                        },
                        result_timetable: {
                            select: { timetable_id: true, status: true },
                        },
                    },
                },
            },
        });
        if (!row)
            throw new common_1.NotFoundException("Scenario not found.");
        return this.serializeScenario(row);
    }
    async createScenario(dto) {
        const scenario = await this.prisma.scenario.create({
            data: {
                name: dto.name.trim(),
                status: "draft",
                description: dto.description?.trim() ?? "",
                conditions: dto.conditions?.length
                    ? {
                        create: dto.conditions.map((c, i) => ({
                            condition_type: c.type,
                            parameters: c.parameters,
                            order_index: c.orderIndex ?? i,
                        })),
                    }
                    : undefined,
            },
            include: {
                conditions: { orderBy: { order_index: "asc" } },
                runs: { take: 1 },
            },
        });
        return this.serializeScenario(scenario);
    }
    async updateScenario(id, dto) {
        const existing = await this.prisma.scenario.findUnique({
            where: { scenario_id: id },
        });
        if (!existing)
            throw new common_1.NotFoundException("Scenario not found.");
        const updated = await this.prisma.$transaction(async (tx) => {
            if (dto.conditions !== undefined) {
                await tx.scenarioCondition.deleteMany({ where: { scenario_id: id } });
                if (dto.conditions.length > 0) {
                    await tx.scenarioCondition.createMany({
                        data: dto.conditions.map((c, i) => ({
                            scenario_id: id,
                            condition_type: c.type,
                            parameters: c.parameters,
                            order_index: c.orderIndex ?? i,
                        })),
                    });
                }
            }
            return tx.scenario.update({
                where: { scenario_id: id },
                data: {
                    ...(dto.name ? { name: dto.name.trim() } : {}),
                    ...(dto.description !== undefined
                        ? { description: dto.description.trim() }
                        : {}),
                },
                include: {
                    conditions: { orderBy: { order_index: "asc" } },
                    runs: { take: 1 },
                },
            });
        });
        return this.serializeScenario(updated);
    }
    async cloneScenario(id) {
        const original = await this.prisma.scenario.findUnique({
            where: { scenario_id: id },
            include: { conditions: { orderBy: { order_index: "asc" } } },
        });
        if (!original)
            throw new common_1.NotFoundException("Scenario not found.");
        return this.createScenario({
            name: `${original.name} (Copy)`,
            description: original.description,
            conditions: original.conditions.map((c) => ({
                type: c.condition_type,
                parameters: c.parameters,
                orderIndex: c.order_index,
            })),
        });
    }
    async deleteScenario(id, force = false) {
        const scenario = await this.prisma.scenario.findUnique({
            where: { scenario_id: id },
            include: { runs: { where: { status: "applied" }, take: 1 } },
        });
        if (!scenario)
            throw new common_1.NotFoundException("Scenario not found.");
        if (scenario.runs.length > 0 && !force) {
            throw new common_1.BadRequestException("This scenario has applied runs. Pass force=true to delete anyway.");
        }
        await this.prisma.scenario.delete({ where: { scenario_id: id } });
        return { ok: true };
    }
    async listConditions(scenarioId) {
        const conditions = await this.prisma.scenarioCondition.findMany({
            where: { scenario_id: scenarioId },
            orderBy: { order_index: "asc" },
        });
        return conditions.map((c) => ({
            conditionId: c.condition_id,
            type: c.condition_type,
            parameters: c.parameters,
            orderIndex: c.order_index,
        }));
    }
    async runScenario(scenarioId, timetableIds) {
        const lock = (0, optimizer_global_lock_1.tryAcquireOptimizerGlobalLock)("whatif");
        if (!lock.ok) {
            throw new common_1.BadRequestException(lock.holder === "timetable"
                ? "Timetable generation is currently running. Wait for it to finish before running a scenario."
                : "Another scenario run is already in progress. Wait for it to finish first.");
        }
        this.holdsGlobalOptimizerLock = true;
        try {
            const alreadyRunning = await this.prisma.scenarioRun.findFirst({
                where: { status: { in: ["pending", "running"] } },
                select: { run_id: true },
            });
            if (alreadyRunning) {
                throw new common_1.BadRequestException("Another scenario run is already in progress. Wait for it to finish first.");
            }
            const scenario = await this.prisma.scenario.findUnique({
                where: { scenario_id: scenarioId },
                include: { conditions: { orderBy: { order_index: "asc" } } },
            });
            if (!scenario)
                throw new common_1.NotFoundException("Scenario not found.");
            if (scenario.conditions.length === 0) {
                throw new common_1.BadRequestException("Scenario has no conditions. Add at least one condition before running.");
            }
            if (timetableIds.length === 0) {
                throw new common_1.BadRequestException("Provide at least one timetable ID.");
            }
            const timetables = await this.prisma.timetable.findMany({
                where: { timetable_id: { in: timetableIds } },
                select: {
                    timetable_id: true,
                    semester_id: true,
                    generation_type: true,
                    _count: { select: { scenario_runs_as_result: true } },
                },
            });
            const foundIds = new Set(timetables.map((t) => t.timetable_id));
            const missing = timetableIds.filter((id) => !foundIds.has(id));
            if (missing.length > 0) {
                throw new common_1.BadRequestException(`Timetable IDs not found: ${missing.join(", ")}`);
            }
            const disallowedScenarioResult = timetables
                .filter((t) => t.generation_type === "what_if" ||
                t.generation_type === "what_if_applied" ||
                t._count.scenario_runs_as_result > 0)
                .map((t) => t.timetable_id);
            if (disallowedScenarioResult.length > 0) {
                throw new common_1.BadRequestException(`Scenario result timetables cannot be used as bases: ${disallowedScenarioResult.join(", ")}`);
            }
            const invalidDraftBases = timetables
                .filter((t) => t.semester_id == null &&
                !isOptimizerScenarioRunBaseGenerationType(t.generation_type))
                .map((t) => t.timetable_id);
            if (invalidDraftBases.length > 0) {
                throw new common_1.BadRequestException(`Only published timetables or timetables saved from timetable generation (optimizer drafts) can be used as scenario bases. Invalid IDs: ${invalidDraftBases.join(", ")}`);
            }
            const startedRuns = [];
            for (const timetableId of timetableIds) {
                const run = await this.prisma.scenarioRun.create({
                    data: {
                        scenario_id: scenarioId,
                        base_timetable_id: timetableId,
                        status: "pending",
                    },
                });
                this.queuedScenarioRuns.push({
                    runId: run.run_id,
                    scenarioId,
                    timetableId,
                    conditions: scenario.conditions,
                });
                startedRuns.push({ runId: run.run_id, timetableId });
            }
            await this.prisma.scenario.update({
                where: { scenario_id: scenarioId },
                data: { status: "active" },
            });
            await this._startNextQueuedRunIfIdle();
            return { runs: startedRuns };
        }
        catch (err) {
            const queuedRunIds = this.queuedScenarioRuns.map((r) => r.runId);
            this.queuedScenarioRuns = [];
            if (queuedRunIds.length > 0) {
                await this.prisma.scenarioRun.updateMany({
                    where: {
                        run_id: { in: queuedRunIds },
                        status: "pending",
                    },
                    data: {
                        status: "failed",
                        completed_at: new Date(),
                        error_message: "Batch initialization failed before execution started.",
                    },
                });
            }
            this.releaseGlobalOptimizerLockIfIdle();
            throw err;
        }
    }
    releaseGlobalOptimizerLockIfIdle() {
        if (!this.holdsGlobalOptimizerLock)
            return;
        if (this.pendingProcessStarts > 0)
            return;
        if (this.activeProcesses.size > 0)
            return;
        if (this.queuedScenarioRuns.length > 0)
            return;
        (0, optimizer_global_lock_1.releaseOptimizerGlobalLock)("whatif");
        this.holdsGlobalOptimizerLock = false;
    }
    async _startNextQueuedRunIfIdle() {
        if (this.pendingProcessStarts > 0)
            return;
        if (this.activeProcesses.size > 0)
            return;
        const next = this.queuedScenarioRuns.shift();
        if (!next) {
            this.releaseGlobalOptimizerLockIfIdle();
            return;
        }
        this.pendingProcessStarts += 1;
        this._spawnRunnerProcess(next.runId, next.scenarioId, next.timetableId, next.conditions).catch(async (err) => {
            this.logger.error(`Failed to spawn runner for run ${next.runId}: ${err.message}`);
            await this.prisma.scenarioRun.update({
                where: { run_id: next.runId },
                data: {
                    status: "failed",
                    completed_at: new Date(),
                    error_message: err.message,
                },
            });
            await this._startNextQueuedRunIfIdle();
        });
    }
    async waitForActiveScenarioProcess(runId, sendEvent, options) {
        const { maxWaitMs, pollMs } = options;
        const deadline = Date.now() + maxWaitMs;
        let lastKeepalive = 0;
        while (Date.now() < deadline) {
            const proc = this.activeProcesses.get(runId);
            if (proc)
                return proc;
            const row = await this.prisma.scenarioRun.findUnique({
                where: { run_id: runId },
                select: { status: true },
            });
            if (!row)
                return undefined;
            if (row.status === "completed" ||
                row.status === "applied" ||
                row.status === "failed") {
                return undefined;
            }
            const now = Date.now();
            if (now - lastKeepalive >= 5000) {
                lastKeepalive = now;
                sendEvent({
                    type: "progress",
                    phase: "starting",
                    pct: 1,
                    message: "Preparing scenario runner…",
                });
            }
            await new Promise((r) => setTimeout(r, pollMs));
        }
        return undefined;
    }
    async streamRunProgress(runId, res) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();
        const sendEvent = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        let proc = this.activeProcesses.get(runId);
        if (!proc) {
            const runPeek = await this.prisma.scenarioRun.findUnique({
                where: { run_id: runId },
                select: { status: true },
            });
            if (runPeek &&
                (runPeek.status === "pending" || runPeek.status === "running")) {
                proc = await this.waitForActiveScenarioProcess(runId, sendEvent, {
                    maxWaitMs: 120_000,
                    pollMs: 50,
                });
            }
        }
        if (proc) {
            const onData = (chunk) => {
                const lines = chunk.toString().split("\n");
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        sendEvent(parsed);
                    }
                    catch {
                        sendEvent({ type: "progress", phase: "gwo", message: trimmed });
                    }
                }
            };
            const onClose = (code) => {
                sendEvent({
                    type: "stream_closed",
                    code,
                    message: code === 0
                        ? "Process exited cleanly."
                        : `Process exited with code ${code}.`,
                });
                res.end();
            };
            const onError = (err) => {
                sendEvent({ type: "error", message: err.message });
                res.end();
            };
            proc.stdout?.on("data", onData);
            proc.on("close", onClose);
            proc.on("error", onError);
            res.on("close", () => {
                proc.stdout?.off("data", onData);
                proc.off("close", onClose);
                proc.off("error", onError);
            });
        }
        else {
            const run = await this.prisma.scenarioRun.findUnique({
                where: { run_id: runId },
            });
            if (!run) {
                sendEvent({ type: "error", message: `Run ${runId} not found.` });
                res.end();
                return;
            }
            if (run.status === "completed" || run.status === "applied") {
                sendEvent({
                    type: "result",
                    run_id: run.run_id,
                    result_timetable_id: run.result_timetable_id,
                    baseline_metrics: run.baseline_metrics,
                    result_metrics: run.result_metrics,
                    gwo_iterations_run: run.gwo_iterations_run,
                    generation_seconds: run.generation_seconds,
                    pct: 100,
                    phase: "done",
                    message: "Simulation complete.",
                });
            }
            else if (run.status === "failed") {
                sendEvent({
                    type: "error",
                    run_id: run.run_id,
                    message: run.error_message ?? "Run failed.",
                });
            }
            else {
                sendEvent({
                    type: "error",
                    run_id: run.run_id,
                    message: "Run was interrupted. Please re-run the scenario.",
                });
            }
            res.end();
        }
    }
    async getRunStatus(runId) {
        const run = await this.prisma.scenarioRun.findUnique({
            where: { run_id: runId },
            include: {
                scenario: { select: { name: true } },
                base_timetable: { select: { timetable_id: true, status: true } },
                result_timetable: { select: { timetable_id: true, status: true } },
            },
        });
        if (!run)
            throw new common_1.NotFoundException("Run not found.");
        return {
            runId: run.run_id,
            scenarioId: run.scenario_id,
            scenarioName: run.scenario.name,
            baseTimetableId: run.base_timetable_id,
            resultTimetableId: run.result_timetable_id,
            status: run.status,
            startedAt: run.started_at,
            completedAt: run.completed_at,
            errorMessage: run.error_message,
            baselineMetrics: run.baseline_metrics,
            resultMetrics: run.result_metrics,
            gwoIterationsRun: run.gwo_iterations_run,
            generationSeconds: run.generation_seconds,
            isActive: this.activeProcesses.has(runId),
        };
    }
    async listRuns(scenarioId) {
        const scenario = await this.prisma.scenario.findUnique({
            where: { scenario_id: scenarioId },
            select: { scenario_id: true },
        });
        if (!scenario)
            throw new common_1.NotFoundException("Scenario not found.");
        const runs = await this.prisma.scenarioRun.findMany({
            where: { scenario_id: scenarioId },
            orderBy: { run_id: "desc" },
            include: {
                base_timetable: {
                    select: {
                        timetable_id: true,
                        status: true,
                        semester: { select: { academic_year: true, semester_type: true } },
                    },
                },
                result_timetable: { select: { timetable_id: true, status: true } },
            },
        });
        return runs.map((r) => ({
            runId: r.run_id,
            scenarioId: r.scenario_id,
            baseTimetableId: r.base_timetable_id,
            baseTimetableName: (() => {
                const sem = r.base_timetable.semester;
                if (sem) {
                    const parts = [sem.academic_year, sem.semester_type].filter(Boolean);
                    if (parts.length)
                        return parts.join(" · ");
                }
                return `Timetable ${r.base_timetable_id}`;
            })(),
            resultTimetableId: r.result_timetable_id,
            status: r.status,
            startedAt: r.started_at,
            completedAt: r.completed_at,
            errorMessage: r.error_message,
            baselineMetrics: r.baseline_metrics,
            resultMetrics: r.result_metrics,
            gwoIterationsRun: r.gwo_iterations_run,
            generationSeconds: r.generation_seconds,
            semester: r.base_timetable.semester
                ? {
                    academicYear: r.base_timetable.semester.academic_year,
                    semesterType: r.base_timetable.semester.semester_type,
                }
                : null,
        }));
    }
    async compare(dto) {
        if (dto.runIds.length === 0) {
            throw new common_1.BadRequestException("Provide at least one run ID.");
        }
        const runs = await this.prisma.scenarioRun.findMany({
            where: {
                run_id: { in: dto.runIds },
                status: { in: ["completed", "applied"] },
            },
            include: {
                scenario: {
                    select: {
                        scenario_id: true,
                        name: true,
                        _count: { select: { conditions: true } },
                    },
                },
                base_timetable: {
                    select: {
                        timetable_id: true,
                        semester: { select: { academic_year: true, semester_type: true } },
                    },
                },
            },
        });
        if (runs.length === 0) {
            throw new common_1.BadRequestException("None of the supplied run IDs have completed results.");
        }
        if (dto.mode === whatif_dto_1.CompareMode.BEFORE_AFTER && runs.length !== 1) {
            throw new common_1.BadRequestException("before_after mode requires exactly one run ID.");
        }
        if (dto.mode === whatif_dto_1.CompareMode.CROSS_TIMETABLE &&
            new Set(runs.map((r) => r.scenario_id)).size !== 1) {
            throw new common_1.BadRequestException("cross_timetable mode requires all runs to belong to the same scenario.");
        }
        if (dto.mode === whatif_dto_1.CompareMode.CROSS_SCENARIO &&
            new Set(runs.map((r) => r.base_timetable_id)).size !== 1) {
            throw new common_1.BadRequestException("cross_scenario mode requires all runs to use the same base timetable.");
        }
        const involvedTimetableIds = Array.from(new Set(runs.flatMap((run) => [run.base_timetable_id, run.result_timetable_id].filter((id) => typeof id === "number" && id > 0))));
        const entries = await this.prisma.sectionScheduleEntry.findMany({
            where: { timetable_id: { in: involvedTimetableIds } },
            select: {
                timetable_id: true,
                course_id: true,
                section_number: true,
                slot_id: true,
                room_id: true,
                user_id: true,
                timeslot: {
                    select: { days_mask: true, start_time: true, end_time: true },
                },
                course: { select: { course_code: true } },
            },
        });
        const entriesByTimetable = new Map();
        for (const row of entries) {
            const bucket = entriesByTimetable.get(row.timetable_id) ?? [];
            bucket.push(row);
            entriesByTimetable.set(row.timetable_id, bucket);
        }
        const comparisons = runs.map((run) => {
            const baseline = run.baseline_metrics;
            const result = run.result_metrics;
            const baseEntries = entriesByTimetable.get(run.base_timetable_id) ?? [];
            const resultEntries = run.result_timetable_id != null
                ? (entriesByTimetable.get(run.result_timetable_id) ?? [])
                : [];
            const sectionChanges = this._computeSectionChangeSummary(baseEntries, resultEntries);
            const baselineConflictBreakdown = this._computeConflictBreakdownFromSchedule(baseEntries);
            const resultConflictBreakdown = resultEntries.length > 0
                ? this._computeConflictBreakdownFromSchedule(resultEntries)
                : null;
            const conflictBreakdownDelta = baselineConflictBreakdown && resultConflictBreakdown
                ? {
                    roomConflicts: resultConflictBreakdown.roomConflicts -
                        baselineConflictBreakdown.roomConflicts,
                    lecturerConflicts: resultConflictBreakdown.lecturerConflicts -
                        baselineConflictBreakdown.lecturerConflicts,
                    timeslotClashes: resultConflictBreakdown.timeslotClashes -
                        baselineConflictBreakdown.timeslotClashes,
                }
                : null;
            const deltas = baseline && result
                ? {
                    conflicts: (result.conflicts ?? 0) - (baseline.conflicts ?? 0),
                    roomUtilizationRate: +((result.roomUtilizationRate ?? 0) -
                        (baseline.roomUtilizationRate ?? 0)).toFixed(2),
                    softConstraintsScore: +((result.softConstraintsScore ?? 0) -
                        (baseline.softConstraintsScore ?? 0)).toFixed(2),
                    fitnessScore: +((result.fitnessScore ?? 0) - (baseline.fitnessScore ?? 0)).toFixed(4),
                    lecturerBalanceScore: baseline.lecturerBalanceScore != null &&
                        result.lecturerBalanceScore != null
                        ? +(result.lecturerBalanceScore -
                            baseline.lecturerBalanceScore).toFixed(2)
                        : null,
                }
                : null;
            const disruption = sectionChanges.percentSectionsAffected <= 12
                ? "Low"
                : sectionChanges.percentSectionsAffected <= 28
                    ? "Moderate"
                    : "High";
            return {
                runId: run.run_id,
                scenarioId: run.scenario_id,
                scenarioName: run.scenario.name,
                conditionCount: run.scenario._count?.conditions ?? 0,
                baseTimetableId: run.base_timetable_id,
                resultTimetableId: run.result_timetable_id,
                status: run.status,
                semester: run.base_timetable.semester,
                baseline,
                result,
                deltas,
                baselineConflictBreakdown,
                resultConflictBreakdown,
                conflictBreakdownDelta,
                gwoIterationsRun: run.gwo_iterations_run ?? null,
                generationSeconds: run.generation_seconds ?? null,
                disruptionLevel: disruption,
                recommendation: deltas
                    ? this._generateRecommendation(run.scenario.name, deltas, {
                        disruptionPercent: sectionChanges.percentSectionsAffected,
                        disruptionLevel: disruption,
                        gwoIterations: run.gwo_iterations_run ?? null,
                        conflictBreakdownDelta,
                    })
                    : "Run the scenario first to see a recommendation.",
                sectionChanges,
            };
        });
        return {
            mode: dto.mode,
            comparisons,
        };
    }
    async applyScenarioRun(runId, dto) {
        const run = await this.prisma.scenarioRun.findUnique({
            where: { run_id: runId },
            include: {
                result_timetable: {
                    include: {
                        section_schedule_entries: true,
                        timetable_metrics: true,
                    },
                },
            },
        });
        if (!run)
            throw new common_1.NotFoundException("Run not found.");
        if (run.status !== "completed") {
            throw new common_1.BadRequestException(`Run is not completed (current status: ${run.status}).`);
        }
        if (!run.result_timetable) {
            throw new common_1.BadRequestException("Run has no result timetable to apply.");
        }
        await this.timetablesService.ensureHardConflictsAcknowledged(run.result_timetable.timetable_id, dto?.acknowledgedHardConflicts);
        const resultTimetable = run.result_timetable;
        const baseTimetableId = run.base_timetable_id;
        await this.prisma.$transaction(async (tx) => {
            await tx.sectionScheduleEntry.deleteMany({
                where: { timetable_id: baseTimetableId },
            });
            if (resultTimetable.section_schedule_entries.length > 0) {
                await tx.sectionScheduleEntry.createMany({
                    data: resultTimetable.section_schedule_entries.map((e) => ({
                        user_id: e.user_id,
                        lecturer_name_snapshot: e.lecturer_name_snapshot,
                        slot_id: e.slot_id,
                        course_id: e.course_id,
                        timetable_id: baseTimetableId,
                        room_id: e.room_id,
                        registered_students: e.registered_students,
                        section_number: e.section_number,
                    })),
                });
            }
            if (resultTimetable.timetable_metrics) {
                await tx.timetableMetrics.upsert({
                    where: { timetable_id: baseTimetableId },
                    create: {
                        timetable_id: baseTimetableId,
                        room_utilization_rate: resultTimetable.timetable_metrics.room_utilization_rate,
                        soft_constraints_score: resultTimetable.timetable_metrics.soft_constraints_score,
                        fitness_score: resultTimetable.timetable_metrics.fitness_score,
                        is_valid: resultTimetable.timetable_metrics.is_valid,
                    },
                    update: {
                        room_utilization_rate: resultTimetable.timetable_metrics.room_utilization_rate,
                        soft_constraints_score: resultTimetable.timetable_metrics.soft_constraints_score,
                        fitness_score: resultTimetable.timetable_metrics.fitness_score,
                        is_valid: resultTimetable.timetable_metrics.is_valid,
                    },
                });
            }
            await tx.timetableConflict.deleteMany({
                where: { timetable_id: baseTimetableId },
            });
            await tx.scenarioProducesTimetable.deleteMany({
                where: { timetable_id: resultTimetable.timetable_id },
            });
            await tx.scenarioRun.update({
                where: { run_id: runId },
                data: { result_timetable_id: null },
            });
            await tx.timetable.delete({
                where: { timetable_id: resultTimetable.timetable_id },
            });
            await tx.scenarioRun.update({
                where: { run_id: runId },
                data: { status: "applied" },
            });
            await tx.timetable.update({
                where: { timetable_id: baseTimetableId },
                data: { generation_type: "what_if_applied" },
            });
        });
        return {
            ok: true,
            appliedToTimetableId: baseTimetableId,
            message: "Scenario result has been applied. The base timetable schedule has been replaced.",
        };
    }
    async controlRun(runId, action) {
        const proc = this.activeProcesses.get(runId);
        if (!proc || !proc.pid) {
            throw new common_1.BadRequestException("Run is not currently active.");
        }
        try {
            if (process.platform === "win32") {
                const psCmd = action === "pause"
                    ? `Suspend-Process -Id ${proc.pid} -ErrorAction Stop`
                    : `Resume-Process -Id ${proc.pid} -ErrorAction Stop`;
                const ps = (0, child_process_1.spawnSync)("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCmd], { encoding: "utf8" });
                if (ps.status !== 0) {
                    throw new Error((ps.stderr || ps.stdout || "").trim() ||
                        "PowerShell control failed.");
                }
            }
            else {
                process.kill(proc.pid, action === "pause" ? "SIGSTOP" : "SIGCONT");
            }
        }
        catch (err) {
            throw new common_1.BadRequestException(err instanceof Error ? err.message : `Failed to ${action} run.`);
        }
        return { ok: true, action, runId };
    }
    async cancelRun(runId) {
        this.userCancelledRunIds.add(runId);
        const proc = this.activeProcesses.get(runId);
        if (proc) {
            try {
                proc.kill();
            }
            catch {
            }
        }
        const run = await this.prisma.scenarioRun.findUnique({
            where: { run_id: runId },
            select: { status: true },
        });
        if (run && (run.status === "running" || run.status === "pending")) {
            await this.prisma.scenarioRun.update({
                where: { run_id: runId },
                data: {
                    status: "failed",
                    completed_at: new Date(),
                    error_message: "Run cancelled by user.",
                },
            });
        }
        if (!proc) {
            this.userCancelledRunIds.delete(runId);
        }
        this.releaseGlobalOptimizerLockIfIdle();
        return { ok: true, runId };
    }
    async _spawnRunnerProcess(runId, scenarioId, timetableId, conditions) {
        try {
            const config = await this._buildRunnerConfig(runId, scenarioId, timetableId, conditions);
            await this.prisma.scenarioRun.update({
                where: { run_id: runId },
                data: {
                    status: "running",
                    started_at: new Date(),
                    baseline_metrics: config.baseline_metrics,
                },
            });
            const tmpDir = os.tmpdir();
            const configPath = path.join(tmpDir, `whatif_run_${runId}.json`);
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            const scriptPath = path.resolve(process.cwd(), "whatif", "run_scenario.py");
            const python = process.env.PYTHON_BIN ??
                process.env.PYTHON ??
                (process.platform === "win32" ? "python" : "python3");
            this.logger.log(`Spawning scenario runner: ${python} ${scriptPath} --config ${configPath}`);
            const proc = (0, child_process_1.spawn)(python, [scriptPath, "--config", configPath], {
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: "1",
                },
            });
            this.activeProcesses.set(runId, proc);
            let lineBuffer = "";
            let stderrBuffer = "";
            proc.stdout?.on("data", (chunk) => {
                lineBuffer += chunk.toString();
                const lines = lineBuffer.split("\n");
                lineBuffer = lines.pop() ?? "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    this._handlePythonLine(runId, trimmed).catch((err) => {
                        this.logger.error(`Error handling Python line for run ${runId}: ${err.message}`);
                    });
                }
            });
            proc.stderr?.on("data", (chunk) => {
                const text = chunk.toString();
                stderrBuffer += text;
                this.logger.warn(`[run ${runId} stderr] ${text.trim()}`);
            });
            proc.on("close", async (code, signal) => {
                this.activeProcesses.delete(runId);
                const wasUserCancel = this.userCancelledRunIds.has(runId);
                this.userCancelledRunIds.delete(runId);
                if (lineBuffer.trim()) {
                    await this._handlePythonLine(runId, lineBuffer.trim()).catch(() => { });
                }
                try {
                    fs.unlinkSync(configPath);
                }
                catch {
                }
                const exitedNonZero = typeof code === "number" && code !== 0;
                const exitedWithNullCode = code === null || code === undefined;
                const shouldRecordFailure = exitedNonZero || exitedWithNullCode || wasUserCancel;
                if (shouldRecordFailure) {
                    const run = await this.prisma.scenarioRun.findUnique({
                        where: { run_id: runId },
                        select: { status: true },
                    });
                    if (run?.status === "running") {
                        const stderrDetail = stderrBuffer.trim();
                        let error_message;
                        if (wasUserCancel) {
                            error_message = "Run cancelled by user.";
                        }
                        else if (exitedWithNullCode) {
                            const sig = typeof signal === "string" && signal.trim()
                                ? signal.trim()
                                : null;
                            error_message = stderrDetail
                                ? `Process stopped${sig ? ` (${sig})` : ""}. ${stderrDetail.slice(0, 1800)}`
                                : `Process stopped${sig ? ` (${sig})` : ""} before producing a result.`;
                        }
                        else {
                            error_message = stderrDetail
                                ? `Process exited with code ${code}. ${stderrDetail.slice(0, 1800)}`
                                : `Process exited with code ${code}.`;
                        }
                        await this.prisma.scenarioRun.update({
                            where: { run_id: runId },
                            data: {
                                status: "failed",
                                completed_at: new Date(),
                                error_message,
                            },
                        });
                        if (!wasUserCancel) {
                            void this.notifications
                                .notifyAdmins("Optimization Failed", `Scenario run #${runId} failed: ${error_message.slice(0, 800)}`, {
                                preferenceKey: notification_prefs_1.ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_FAILED,
                            })
                                .catch(() => { });
                        }
                    }
                }
                this.logger.log(`Scenario runner for run ${runId} exited with code ${code}${signal ? ` signal=${signal}` : ""}.`);
                await this._startNextQueuedRunIfIdle();
                this.releaseGlobalOptimizerLockIfIdle();
            });
            proc.on("error", async (err) => {
                this.activeProcesses.delete(runId);
                await this.prisma.scenarioRun.update({
                    where: { run_id: runId },
                    data: {
                        status: "failed",
                        completed_at: new Date(),
                        error_message: err.message,
                    },
                });
                void this.notifications
                    .notifyAdmins("Optimization Failed", `Scenario run #${runId} could not start: ${err.message.slice(0, 800)}`, {
                    preferenceKey: notification_prefs_1.ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_FAILED,
                })
                    .catch(() => { });
                this.logger.error(`Scenario runner spawn error for run ${runId}: ${err.message}`);
                await this._startNextQueuedRunIfIdle();
                this.releaseGlobalOptimizerLockIfIdle();
            });
        }
        finally {
            this.pendingProcessStarts = Math.max(0, this.pendingProcessStarts - 1);
            this.releaseGlobalOptimizerLockIfIdle();
        }
    }
    async _handlePythonLine(runId, line) {
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch {
            return;
        }
        if (parsed.type === "result") {
            await this.prisma.scenarioRun.update({
                where: { run_id: runId },
                data: {
                    status: "completed",
                    completed_at: new Date(),
                    result_timetable_id: parsed.result_timetable_id ?? null,
                    result_metrics: parsed.result_metrics ?? undefined,
                    gwo_iterations_run: parsed.gwo_iterations_run ?? null,
                    generation_seconds: parsed.generation_seconds ?? null,
                },
            });
            void this.notifyAdminsScenarioRunSucceeded(runId, parsed).catch(() => { });
        }
        else if (parsed.type === "error") {
            const detail = (parsed.detail ?? "").trim();
            const message = (parsed.message ?? "").trim();
            const fallbackPayload = JSON.stringify(parsed);
            const resolvedError = detail ||
                message ||
                `Python returned an error event without details: ${fallbackPayload}`;
            this.logger.error(`[run ${runId}] Python reported error: ${resolvedError}`);
            await this.prisma.scenarioRun.update({
                where: { run_id: runId },
                data: {
                    status: "failed",
                    completed_at: new Date(),
                    error_message: resolvedError,
                },
            });
            void this.notifications
                .notifyAdmins("Optimization Failed", `Scenario run #${runId} failed: ${resolvedError.slice(0, 800)}`, {
                preferenceKey: notification_prefs_1.ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_FAILED,
            })
                .catch(() => { });
        }
    }
    async notifyAdminsScenarioRunSucceeded(runId, parsed) {
        const run = await this.prisma.scenarioRun.findUnique({
            where: { run_id: runId },
            include: {
                scenario: { select: { name: true } },
                base_timetable: {
                    include: { semester: true },
                },
            },
        });
        if (!run)
            return;
        const sem = run.base_timetable.semester;
        const semesterLabel = sem
            ? `${sem.academic_year} (${this.decodeSemesterTypeLabel(sem.semester_type)})`
            : `Draft timetable #${run.base_timetable_id}`;
        const rm = parsed.result_metrics;
        const fitness = rm &&
            typeof rm.fitnessScore === "number" &&
            Number.isFinite(rm.fitnessScore)
            ? rm.fitnessScore.toFixed(4)
            : rm && rm.fitnessScore != null
                ? String(rm.fitnessScore)
                : "n/a";
        const hardFromMetrics = rm && typeof rm.conflicts === "number" && Number.isFinite(rm.conflicts)
            ? rm.conflicts
            : null;
        let hardConflictCount = hardFromMetrics ?? 0;
        const tid = parsed.result_timetable_id ?? run.result_timetable_id ?? null;
        if (tid != null) {
            try {
                const summary = await this.timetablesService.getTimetableConflictSummary(tid);
                hardConflictCount = summary.hardConflictCount;
            }
            catch {
            }
        }
        const scenarioName = run.scenario?.name?.trim() || `Scenario #${run.scenario_id}`;
        const resultTimetableTag = tid != null ? ` [[timetable_id:${tid}]]` : "";
        await this.notifications.notifyAdmins("Timetable Generated", `${semesterLabel}: scenario "${scenarioName}" finished (run #${runId}). Fitness score ${fitness}. Hard conflicts reported: ${hardConflictCount}. [[scenario_run_id:${runId}]]${resultTimetableTag}`, { preferenceKey: notification_prefs_1.ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_COMPLETED });
        if (hardConflictCount > 0 && tid != null) {
            await this.notifications.notifyAdmins("Hard Conflicts Detected", `${hardConflictCount} hard conflict(s) found in generated timetable #${tid} (${scenarioName}, run #${runId}). [[timetable_id:${tid}]]`, { preferenceKey: notification_prefs_1.ADMIN_NOTIFICATION_PREF_KEYS.HARD_CONFLICTS });
        }
    }
    decodeSemesterTypeLabel(type) {
        const map = {
            1: "First Semester",
            2: "Second Semester",
            3: "Summer Semester",
        };
        return map[type] ?? `Semester ${type}`;
    }
    _timetableCourseSectionStats(entries) {
        const distinctKeysByCourse = new Map();
        for (const e of entries) {
            let set = distinctKeysByCourse.get(e.course_id);
            if (!set) {
                set = new Set();
                distinctKeysByCourse.set(e.course_id, set);
            }
            const label = String(e.section_number ?? "").trim();
            set.add(label || `__entry_${e.entry_id}`);
        }
        const sectionCountByCourseId = new Map();
        for (const [courseId, set] of distinctKeysByCourse) {
            sectionCountByCourseId.set(courseId, set.size);
        }
        const courseIds = [...distinctKeysByCourse.keys()].sort((a, b) => a - b);
        return { courseIds, sectionCountByCourseId };
    }
    async _buildRunnerConfig(runId, scenarioId, timetableId, conditions) {
        const timetable = await this.prisma.timetable.findUnique({
            where: { timetable_id: timetableId },
            include: {
                semester: true,
                timetable_metrics: true,
                section_schedule_entries: {
                    include: {
                        course: true,
                        room: true,
                        timeslot: true,
                        lecturer: {
                            include: {
                                user: { select: { first_name: true, last_name: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!timetable)
            throw new common_1.NotFoundException(`Timetable ${timetableId} not found.`);
        let isSummer = timetable.semester?.semester_type === 3;
        if (timetable.semester_id == null) {
            const sampleEntry = timetable.section_schedule_entries.find((e) => e.timeslot != null);
            if (sampleEntry?.timeslot != null) {
                isSummer = sampleEntry.timeslot.is_summer;
            }
        }
        const { courseIds, sectionCountByCourseId } = this._timetableCourseSectionStats(timetable.section_schedule_entries.map((e) => ({
            course_id: e.course_id,
            section_number: e.section_number,
            entry_id: e.entry_id,
        })));
        const usedLecturerIds = Array.from(new Set(timetable.section_schedule_entries
            .map((e) => e.user_id)
            .filter((id) => typeof id === "number" && Number.isFinite(id))));
        const [lecturers, rooms, courses, timeslots] = await Promise.all([
            this.prisma.lecturer.findMany({
                where: {
                    is_available: true,
                    ...(usedLecturerIds.length > 0
                        ? { user_id: { in: usedLecturerIds } }
                        : {}),
                },
                include: {
                    user: {
                        select: { user_id: true, first_name: true, last_name: true },
                    },
                    lecturer_can_teach_course: { select: { course_id: true } },
                },
            }),
            this.prisma.room.findMany({
                where: { is_available: true },
            }),
            courseIds.length === 0
                ? Promise.resolve([])
                : this.prisma.course.findMany({
                    where: { course_id: { in: courseIds } },
                    orderBy: { course_id: "asc" },
                }),
            this.prisma.timeslot.findMany({
                where: {
                    is_active: true,
                    is_summer: isSummer,
                },
            }),
        ]);
        const loadedCourseIds = new Set(courses.map((c) => c.course_id));
        const missingCourseIds = courseIds.filter((id) => !loadedCourseIds.has(id));
        if (missingCourseIds.length > 0) {
            this.logger.warn(`What-if run config: base timetable references course_id(s) not found in DB: ${missingCourseIds.join(", ")}`);
        }
        const lecturerBalanceScore = this._computeLecturerBalanceScore(timetable.section_schedule_entries, lecturers);
        const baselineMetrics = timetable.timetable_metrics
            ? {
                conflicts: 0,
                roomUtilizationRate: Number(timetable.timetable_metrics.room_utilization_rate),
                softConstraintsScore: Number(timetable.timetable_metrics.soft_constraints_score),
                fitnessScore: Number(timetable.timetable_metrics.fitness_score),
                lecturerBalanceScore,
                isValid: timetable.timetable_metrics.is_valid,
            }
            : {
                conflicts: 0,
                roomUtilizationRate: 0,
                softConstraintsScore: 0,
                fitnessScore: 0,
                lecturerBalanceScore,
                isValid: false,
            };
        const conflictCount = await this.prisma.timetableConflict.count({
            where: { timetable_id: timetableId },
        });
        baselineMetrics.conflicts = conflictCount;
        const configuredGwoPath = process.env.GWO_SCRIPT_PATH;
        const cwd = process.cwd();
        const candidates = [
            configuredGwoPath ? path.resolve(cwd, configuredGwoPath) : null,
            path.resolve(cwd, "GWO-v6.py"),
            path.resolve(cwd, "scripts", "GWO-v6.py"),
            path.resolve(cwd, "..", "frontend", "scripts", "GWO-v6.py"),
            path.resolve(cwd, "..", "GWO-v6.py"),
        ].filter((p) => Boolean(p));
        const gwoScriptPath = candidates.find((p) => fs.existsSync(p)) ??
            path.resolve(cwd, configuredGwoPath ?? "GWO-v6.py");
        return {
            run_id: runId,
            scenario_id: scenarioId,
            base_timetable_id: timetableId,
            semester_id: timetable.semester_id,
            semester_type: timetable.semester?.semester_type ?? 1,
            is_summer: isSummer,
            gwo_script_path: gwoScriptPath,
            database_url: this.config.get("DATABASE_URL") ?? process.env.DATABASE_URL,
            baseline_metrics: baselineMetrics,
            conditions: conditions.map((c) => ({
                condition_id: c.condition_id,
                type: c.condition_type,
                parameters: c.parameters,
                order_index: c.order_index,
            })),
            timetable_data: {
                lecturers: lecturers.map((l) => ({
                    user_id: l.user_id,
                    first_name: l.user.first_name,
                    last_name: l.user.last_name,
                    dept_id: l.dept_id,
                    max_workload: l.max_workload,
                    is_available: l.is_available,
                    teachable_course_ids: l.lecturer_can_teach_course.map((x) => x.course_id),
                })),
                rooms: rooms.map((r) => ({
                    room_id: r.room_id,
                    room_number: r.room_number,
                    room_type: r.room_type,
                    capacity: r.capacity,
                    is_available: r.is_available,
                })),
                courses: courses.map((c) => {
                    const n = sectionCountByCourseId.get(c.course_id) ?? 0;
                    return {
                        course_id: c.course_id,
                        course_code: c.course_code,
                        course_name: c.course_name,
                        dept_id: c.dept_id,
                        academic_level: c.academic_level,
                        is_lab: c.is_lab,
                        credit_hours: c.credit_hours,
                        delivery_mode: c.delivery_mode,
                        sections_normal: isSummer ? 0 : n,
                        sections_summer: isSummer ? n : 0,
                    };
                }),
                timeslots: timeslots.map((t) => ({
                    slot_id: t.slot_id,
                    start_time: `${String(t.start_time.getHours()).padStart(2, "0")}:${String(t.start_time.getMinutes()).padStart(2, "0")}`,
                    end_time: `${String(t.end_time.getHours()).padStart(2, "0")}:${String(t.end_time.getMinutes()).padStart(2, "0")}`,
                    days_mask: t.days_mask,
                    slot_type: t.slot_type,
                    is_summer: t.is_summer,
                })),
                existing_entries: timetable.section_schedule_entries.map((e) => ({
                    entry_id: e.entry_id,
                    user_id: e.user_id,
                    lecturer_name_snapshot: e.lecturer_name_snapshot,
                    slot_id: e.slot_id,
                    course_id: e.course_id,
                    room_id: e.room_id,
                    registered_students: e.registered_students,
                    section_number: e.section_number,
                })),
            },
        };
    }
    _computeLecturerBalanceScore(entries, lecturers) {
        if (lecturers.length === 0)
            return 0;
        const loadByLecturer = new Map();
        for (const lecturer of lecturers) {
            loadByLecturer.set(lecturer.user_id, 0);
        }
        for (const entry of entries) {
            if (entry.user_id == null)
                continue;
            loadByLecturer.set(entry.user_id, (loadByLecturer.get(entry.user_id) ?? 0) + 1);
        }
        const loads = Array.from(loadByLecturer.values());
        if (loads.length === 0)
            return 0;
        const mean = loads.reduce((sum, value) => sum + value, 0) / loads.length;
        const variance = loads.reduce((sum, value) => sum + (value - mean) ** 2, 0) / loads.length;
        const stdDev = Math.sqrt(variance);
        const maxWorkload = Math.max(...lecturers.map((lecturer) => Number(lecturer.max_workload ?? 0)), 0);
        if (maxWorkload <= 0)
            return 0;
        const normalizedDispersion = stdDev / maxWorkload;
        const score = (1 - normalizedDispersion) * 100;
        return +Math.max(0, Math.min(100, score)).toFixed(2);
    }
    serializeScenario(row) {
        const latestRun = row.runs?.[0] ?? null;
        return {
            id: row.scenario_id,
            name: row.name,
            status: row.status,
            description: row.description,
            conditionCount: row.conditions?.length ?? 0,
            conditions: row.conditions?.map((c) => ({
                conditionId: c.condition_id,
                type: c.condition_type,
                parameters: c.parameters,
                orderIndex: c.order_index,
            })) ?? [],
            latestRun: latestRun
                ? {
                    runId: latestRun.run_id,
                    status: latestRun.status,
                    startedAt: latestRun.started_at,
                    completedAt: latestRun.completed_at,
                    resultTimetableId: latestRun.result_timetable_id,
                    baselineMetrics: latestRun.baseline_metrics,
                    resultMetrics: latestRun.result_metrics,
                    baseTimetableId: latestRun.base_timetable_id,
                    errorMessage: latestRun.error_message,
                }
                : null,
            isRunning: this.activeProcesses.has(latestRun?.run_id),
        };
    }
    _generateRecommendation(scenarioName, deltas, ctx) {
        let positives = 0;
        let negatives = 0;
        if (deltas.conflicts < 0)
            positives++;
        else if (deltas.conflicts > 0)
            negatives++;
        if (deltas.roomUtilizationRate > 0)
            positives++;
        else if (deltas.roomUtilizationRate < -2)
            negatives++;
        if (deltas.softConstraintsScore > 0)
            positives++;
        else if (deltas.softConstraintsScore < -2)
            negatives++;
        if (deltas.fitnessScore > 0)
            positives++;
        else if (deltas.fitnessScore < 0)
            negatives++;
        if (typeof deltas.lecturerBalanceScore === "number") {
            if (deltas.lecturerBalanceScore > 0)
                positives++;
            else if (deltas.lecturerBalanceScore < -0.1)
                negatives++;
        }
        const total = positives + negatives;
        const parts = [];
        if (total === 0) {
            parts.push(`"${scenarioName}" produces no measurable change in headline metrics.`);
        }
        else {
            const ratio = positives / total;
            const verdict = ratio >= 0.8 && negatives === 0
                ? "Apply recommended"
                : ratio >= 0.6
                    ? "Apply with caution"
                    : negatives > positives
                        ? "Apply not recommended"
                        : "Mixed outcome";
            parts.push(`${verdict}: "${scenarioName}" shifts ${positives} headline metric(s) favorably vs ${negatives} unfavorably (among comparable deltas).`);
            const metricNotes = [];
            if (deltas.conflicts !== 0)
                metricNotes.push(`Recorded conflicts ${deltas.conflicts > 0 ? "rose" : "fell"} by ${Math.abs(deltas.conflicts)}.`);
            if (Math.abs(deltas.fitnessScore) >= 0.0001)
                metricNotes.push(`Fitness ${deltas.fitnessScore > 0 ? "improved" : "worsened"} by ${Math.abs(deltas.fitnessScore)}.`);
            if (Math.abs(deltas.roomUtilizationRate) >= 0.05)
                metricNotes.push(`Room utilization ${deltas.roomUtilizationRate > 0 ? "up" : "down"} ${Math.abs(deltas.roomUtilizationRate)} points.`);
            if (Math.abs(deltas.softConstraintsScore) >= 0.05)
                metricNotes.push(`Soft-constraint score ${deltas.softConstraintsScore > 0 ? "up" : "down"} ${Math.abs(deltas.softConstraintsScore)}.`);
            if (typeof deltas.lecturerBalanceScore === "number" &&
                Math.abs(deltas.lecturerBalanceScore) >= 0.05)
                metricNotes.push(`Lecturer balance ${deltas.lecturerBalanceScore > 0 ? "improved" : "worsened"} by ${Math.abs(deltas.lecturerBalanceScore)}.`);
            if (metricNotes.length)
                parts.push(metricNotes.join(" "));
            if (ctx?.conflictBreakdownDelta) {
                const cd = ctx.conflictBreakdownDelta;
                const breakdownPieces = [
                    cd.roomConflicts !== 0
                        ? `room Δ ${cd.roomConflicts > 0 ? "+" : ""}${cd.roomConflicts}`
                        : null,
                    cd.lecturerConflicts !== 0
                        ? `lecturer Δ ${cd.lecturerConflicts > 0 ? "+" : ""}${cd.lecturerConflicts}`
                        : null,
                    cd.timeslotClashes !== 0
                        ? `timeslot/cohort Δ ${cd.timeslotClashes > 0 ? "+" : ""}${cd.timeslotClashes}`
                        : null,
                ].filter(Boolean);
                if (breakdownPieces.length)
                    parts.push(`Schedule-derived clash pairs: ${breakdownPieces.join(", ")}.`);
            }
        }
        if (ctx)
            parts.push(`Structural churn is ${ctx.disruptionLevel.toLowerCase()} (~${ctx.disruptionPercent.toFixed(1)}% of section slots touched).`);
        if (ctx?.gwoIterations != null && ctx.gwoIterations <= 20)
            parts.push(`Optimizer ran only ${ctx.gwoIterations} iteration(s); the timetable may still be far from optimal.`);
        return parts.join(" ");
    }
    _decodeDaysMask(daysMask) {
        const days = [];
        for (let bit = 0; bit <= 6; bit += 1) {
            if (((daysMask >> bit) & 1) === 1) {
                const label = this._dayLabelByBit[bit];
                if (label)
                    days.push(label);
            }
        }
        return days;
    }
    _timeToMinutes(d) {
        return d.getHours() * 60 + d.getMinutes();
    }
    _expandAtomicSlots(entries) {
        const atoms = [];
        for (const e of entries) {
            if (!e.timeslot)
                continue;
            const startMin = this._timeToMinutes(e.timeslot.start_time);
            let endMin = this._timeToMinutes(e.timeslot.end_time);
            if (endMin <= startMin)
                endMin += 24 * 60;
            const days = this._decodeDaysMask(e.timeslot.days_mask);
            const sectionKey = `${e.course_id}|${String(e.section_number)}`;
            for (const day of days) {
                atoms.push({
                    roomId: e.room_id,
                    userId: e.user_id,
                    sectionKey,
                    day,
                    startMin,
                    endMin,
                });
            }
        }
        return atoms;
    }
    _pairOverlaps(a, b) {
        return a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin;
    }
    _countGroupedOverlaps(atoms, groupKey) {
        const groups = new Map();
        for (const atom of atoms) {
            const key = groupKey(atom);
            if (key === null)
                continue;
            const bucket = groups.get(key) ?? [];
            bucket.push(atom);
            groups.set(key, bucket);
        }
        let total = 0;
        for (const group of groups.values()) {
            for (let i = 0; i < group.length; i += 1) {
                for (let j = i + 1; j < group.length; j += 1) {
                    if (this._pairOverlaps(group[i], group[j]))
                        total += 1;
                }
            }
        }
        return total;
    }
    _computeConflictBreakdownFromSchedule(entries) {
        const atoms = this._expandAtomicSlots(entries);
        const roomConflicts = this._countGroupedOverlaps(atoms, (a) => a.roomId);
        const lecturerConflicts = this._countGroupedOverlaps(atoms, (a) => a.userId != null ? a.userId : null);
        const timeslotClashes = this._countGroupedOverlaps(atoms, (a) => a.sectionKey);
        return { roomConflicts, lecturerConflicts, timeslotClashes };
    }
    _computeSectionChangeSummary(baselineEntries, resultEntries) {
        const sectionKey = (e) => `${e.course_id}|${String(e.section_number)}`;
        const groupBySection = (list) => {
            const m = new Map();
            for (const e of list) {
                const k = sectionKey(e);
                const bucket = m.get(k) ?? [];
                bucket.push(e);
                m.set(k, bucket);
            }
            return m;
        };
        const slotsSig = (rows) => [...rows]
            .map((e) => String(e.slot_id))
            .sort()
            .join(",");
        const roomsSig = (rows) => [...rows]
            .map((e) => String(e.room_id))
            .sort()
            .join(",");
        const lecturersSig = (rows) => [...rows]
            .map((e) => String(e.user_id ?? "none"))
            .sort()
            .join(",");
        const baseline = groupBySection(baselineEntries);
        const result = groupBySection(resultEntries);
        const assignmentSig = (rows) => [...rows]
            .map((e) => `${e.slot_id}|${e.room_id}|${e.user_id ?? "none"}`)
            .sort()
            .join("||");
        let added = 0;
        let removed = 0;
        let changed = 0;
        let unchanged = 0;
        const courseAgg = new Map();
        const allKeys = new Set([...baseline.keys(), ...result.keys()]);
        let affectedUnion = 0;
        const bumpCourse = (cid, code, dims) => {
            const agg = courseAgg.get(cid) ?? {
                courseCode: code,
                sectionsAffected: 0,
                sectionsWithRoomChange: 0,
                sectionsWithLecturerChange: 0,
                sectionsWithSlotChange: 0,
            };
            agg.courseCode = code;
            agg.sectionsAffected += 1;
            if (dims?.room)
                agg.sectionsWithRoomChange += 1;
            if (dims?.lec)
                agg.sectionsWithLecturerChange += 1;
            if (dims?.slot)
                agg.sectionsWithSlotChange += 1;
            courseAgg.set(cid, agg);
        };
        for (const key of allKeys) {
            const br = baseline.get(key);
            const rr = result.get(key);
            const courseId = Number(key.split("|")[0] ?? 0);
            const courseCode = br?.[0]?.course?.course_code ??
                rr?.[0]?.course?.course_code ??
                String(courseId);
            if (!br && rr) {
                added += 1;
                affectedUnion += 1;
                bumpCourse(courseId, courseCode);
                continue;
            }
            if (br && !rr) {
                removed += 1;
                affectedUnion += 1;
                bumpCourse(courseId, courseCode);
                continue;
            }
            if (br && rr) {
                if (assignmentSig(br) === assignmentSig(rr))
                    unchanged += 1;
                else {
                    changed += 1;
                    affectedUnion += 1;
                    bumpCourse(courseId, courseCode, {
                        room: roomsSig(br) !== roomsSig(rr),
                        lec: lecturersSig(br) !== lecturersSig(rr),
                        slot: slotsSig(br) !== slotsSig(rr),
                    });
                }
            }
        }
        const percentSectionsAffected = allKeys.size > 0
            ? Math.round((affectedUnion / allKeys.size) * 1000) / 10
            : 0;
        const perCourse = [...courseAgg.entries()]
            .map(([courseId, v]) => ({
            courseId,
            courseCode: v.courseCode,
            sectionsAffected: v.sectionsAffected,
            sectionsWithRoomChange: v.sectionsWithRoomChange,
            sectionsWithLecturerChange: v.sectionsWithLecturerChange,
            sectionsWithSlotChange: v.sectionsWithSlotChange,
        }))
            .sort((a, b) => b.sectionsAffected - a.sectionsAffected);
        return {
            added,
            removed,
            changed,
            unchanged,
            baselineCount: baseline.size,
            resultCount: result.size,
            percentSectionsAffected,
            perCourse,
        };
    }
};
exports.WhatIfService = WhatIfService;
exports.WhatIfService = WhatIfService = WhatIfService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        timetables_service_1.TimetablesService,
        notifications_service_1.NotificationsService])
], WhatIfService);
//# sourceMappingURL=whatif.service.js.map