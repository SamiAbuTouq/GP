// src/whatif/whatif.service.ts
// =============================================================================
// What-If Scenario System — NestJS Service
//
// Responsibilities:
//  • Scenario CRUD (proper ScenarioCondition table, no JSON-in-description hacks)
//  • Spawning run_scenario.py as a child process with a full timetable config JSON
//  • SSE streaming: piping the child-process stdout to the HTTP response
//  • Persistent ScenarioRun records in DB (runs survive server restarts)
//  • Comparison: before/after, cross-timetable, cross-scenario
//  • Apply: replacing base timetable entries with the scenario result
// =============================================================================

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  releaseOptimizerGlobalLock,
  tryAcquireOptimizerGlobalLock,
} from '../common/optimizer-global-lock';
import {
  ApplyScenarioRunDto,
  CompareDto,
  CompareMode,
  ConditionDto,
  CreateScenarioDto,
  UpdateScenarioDto,
} from './dto/whatif.dto';
import { TimetablesService } from '../timetables/timetables.service';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export interface MetricsSnapshot {
  conflicts: number;
  roomUtilizationRate: number;
  softConstraintsScore: number;
  fitnessScore: number;
  lecturerBalanceScore: number | null;
  isValid: boolean;
}

interface BaselineLecturer {
  user_id: number;
  max_workload: number | null;
}

interface BaselineEntry {
  user_id: number | null;
}

interface GwoProgressLine {
  type: 'progress' | 'result' | 'error';
  phase?: string;
  pct?: number;
  message?: string;
  // GWO-specific live stats
  iteration?: number;
  fitness?: number;
  hard_conflicts?: number;
  room_utilization?: number;
  lecturer_balance?: number;
  // Final result payload (type === 'result')
  run_id?: number;
  result_timetable_id?: number;
  baseline_metrics?: MetricsSnapshot;
  result_metrics?: MetricsSnapshot;
  gwo_iterations_run?: number;
  generation_seconds?: number;
  // Error payload (type === 'error')
  detail?: string;
}

@Injectable()
export class WhatIfService {
  private readonly logger = new Logger(WhatIfService.name);

  /**
   * Keeps live child processes so the SSE endpoint can attach to their stdout.
   * Key = run_id (DB).  Cleared when process exits.
   */
  private readonly activeProcesses = new Map<number, ChildProcess>();
  private holdsGlobalOptimizerLock = false;
  private pendingProcessStarts = 0;
  private queuedScenarioRuns: Array<{
    runId: number;
    scenarioId: number;
    timetableId: number;
    conditions: Array<{
      condition_id: number;
      condition_type: string;
      parameters: unknown;
      order_index: number;
    }>;
  }> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly timetablesService: TimetablesService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO CRUD
  // ══════════════════════════════════════════════════════════════════════════

  async listScenarios() {
    const rows = await this.prisma.scenario.findMany({
      orderBy: { scenario_id: 'desc' },
      include: {
        conditions: { orderBy: { order_index: 'asc' } },
        runs: {
          orderBy: { run_id: 'desc' },
          take: 1,
          include: { base_timetable: { select: { timetable_id: true, status: true } } },
        },
      },
    });

    return rows.map((row) => this.serializeScenario(row));
  }

  async getScenario(id: number) {
    const row = await this.prisma.scenario.findUnique({
      where: { scenario_id: id },
      include: {
        conditions: { orderBy: { order_index: 'asc' } },
        runs: {
          orderBy: { run_id: 'desc' },
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

    if (!row) throw new NotFoundException('Scenario not found.');
    return this.serializeScenario(row);
  }

  async createScenario(dto: CreateScenarioDto) {
    const scenario = await this.prisma.scenario.create({
      data: {
        name: dto.name.trim(),
        status: 'draft',
        description: dto.description?.trim() ?? '',
        conditions: dto.conditions?.length
          ? {
              create: dto.conditions.map((c, i) => ({
                condition_type: c.type,
                parameters: c.parameters as object,
                order_index: c.orderIndex ?? i,
              })),
            }
          : undefined,
      },
      include: {
        conditions: { orderBy: { order_index: 'asc' } },
        runs: { take: 1 },
      },
    });

    return this.serializeScenario(scenario);
  }

  async updateScenario(id: number, dto: UpdateScenarioDto) {
    const existing = await this.prisma.scenario.findUnique({
      where: { scenario_id: id },
    });
    if (!existing) throw new NotFoundException('Scenario not found.');

    // Replace conditions atomically if provided
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.conditions !== undefined) {
        await tx.scenarioCondition.deleteMany({ where: { scenario_id: id } });
        if (dto.conditions.length > 0) {
          await tx.scenarioCondition.createMany({
            data: dto.conditions.map((c, i) => ({
              scenario_id: id,
              condition_type: c.type,
              parameters: c.parameters as object,
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
          conditions: { orderBy: { order_index: 'asc' } },
          runs: { take: 1 },
        },
      });
    });

    return this.serializeScenario(updated);
  }

  async cloneScenario(id: number) {
    const original = await this.prisma.scenario.findUnique({
      where: { scenario_id: id },
      include: { conditions: { orderBy: { order_index: 'asc' } } },
    });
    if (!original) throw new NotFoundException('Scenario not found.');

    return this.createScenario({
      name: `${original.name} (Copy)`,
      description: original.description,
      conditions: original.conditions.map((c) => ({
        type: c.condition_type as any,
        parameters: c.parameters as Record<string, unknown>,
        orderIndex: c.order_index,
      })),
    });
  }

  async deleteScenario(id: number, force = false) {
    const scenario = await this.prisma.scenario.findUnique({
      where: { scenario_id: id },
      include: { runs: { where: { status: 'applied' }, take: 1 } },
    });
    if (!scenario) throw new NotFoundException('Scenario not found.');

    if (scenario.runs.length > 0 && !force) {
      throw new BadRequestException(
        'This scenario has applied runs. Pass force=true to delete anyway.',
      );
    }

    await this.prisma.scenario.delete({ where: { scenario_id: id } });
    return { ok: true };
  }

  async listConditions(scenarioId: number) {
    const conditions = await this.prisma.scenarioCondition.findMany({
      where: { scenario_id: scenarioId },
      orderBy: { order_index: 'asc' },
    });
    return conditions.map((c) => ({
      conditionId: c.condition_id,
      type: c.condition_type,
      parameters: c.parameters,
      orderIndex: c.order_index,
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RUN LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Start one ScenarioRun per timetable ID.
   * For each run: create a DB record, build the config JSON, spawn Python.
   */
  async runScenario(scenarioId: number, timetableIds: number[]) {
    const lock = tryAcquireOptimizerGlobalLock('whatif');
    if (!lock.ok) {
      throw new BadRequestException(
        lock.holder === 'timetable'
          ? 'Timetable generation is currently running. Wait for it to finish before running a scenario.'
          : 'Another scenario run is already in progress. Wait for it to finish first.',
      );
    }
    this.holdsGlobalOptimizerLock = true;
    try {
      const alreadyRunning = await this.prisma.scenarioRun.findFirst({
        where: { status: { in: ['pending', 'running'] } },
        select: { run_id: true },
      });
      if (alreadyRunning) {
        throw new BadRequestException(
          'Another scenario run is already in progress. Wait for it to finish first.',
        );
      }

      const scenario = await this.prisma.scenario.findUnique({
        where: { scenario_id: scenarioId },
        include: { conditions: { orderBy: { order_index: 'asc' } } },
      });
      if (!scenario) throw new NotFoundException('Scenario not found.');
      if (scenario.conditions.length === 0) {
        throw new BadRequestException(
          'Scenario has no conditions. Add at least one condition before running.',
        );
      }

      if (timetableIds.length === 0) {
        throw new BadRequestException('Provide at least one timetable ID.');
      }

      // Verify all timetable IDs exist
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
        throw new BadRequestException(
          `Timetable IDs not found: ${missing.join(', ')}`,
        );
      }
      const disallowedScenarioResult = timetables
        .filter(
          (t) =>
            t.generation_type === 'what_if' ||
            t.generation_type === 'what_if_applied' ||
            t._count.scenario_runs_as_result > 0,
        )
        .map((t) => t.timetable_id);
      if (disallowedScenarioResult.length > 0) {
        throw new BadRequestException(
          `Scenario result timetables cannot be used as bases: ${disallowedScenarioResult.join(', ')}`,
        );
      }
      const invalidDraftBases = timetables
        .filter(
          (t) =>
            t.semester_id == null &&
            t.generation_type !== 'gwo_ui',
        )
        .map((t) => t.timetable_id);
      if (invalidDraftBases.length > 0) {
        throw new BadRequestException(
          `Only optimizer drafts or published timetables can be used as scenario bases. Invalid IDs: ${invalidDraftBases.join(', ')}`,
        );
      }

      const startedRuns: { runId: number; timetableId: number }[] = [];

      for (const timetableId of timetableIds) {
        const run = await this.prisma.scenarioRun.create({
          data: {
            scenario_id: scenarioId,
            base_timetable_id: timetableId,
            status: 'pending',
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

      // Mark scenario as active
      await this.prisma.scenario.update({
        where: { scenario_id: scenarioId },
        data: { status: 'active' },
      });

      // Start batch execution; subsequent runs are triggered after each process exits.
      await this._startNextQueuedRunIfIdle();

      return { runs: startedRuns };
    } catch (err) {
      const queuedRunIds = this.queuedScenarioRuns.map((r) => r.runId);
      this.queuedScenarioRuns = [];
      if (queuedRunIds.length > 0) {
        await this.prisma.scenarioRun.updateMany({
          where: {
            run_id: { in: queuedRunIds },
            status: 'pending',
          },
          data: {
            status: 'failed',
            completed_at: new Date(),
            error_message: 'Batch initialization failed before execution started.',
          },
        });
      }
      this.releaseGlobalOptimizerLockIfIdle();
      throw err;
    }
  }

  private releaseGlobalOptimizerLockIfIdle() {
    if (!this.holdsGlobalOptimizerLock) return;
    if (this.pendingProcessStarts > 0) return;
    if (this.activeProcesses.size > 0) return;
    if (this.queuedScenarioRuns.length > 0) return;
    releaseOptimizerGlobalLock('whatif');
    this.holdsGlobalOptimizerLock = false;
  }

  private async _startNextQueuedRunIfIdle() {
    if (this.pendingProcessStarts > 0) return;
    if (this.activeProcesses.size > 0) return;

    const next = this.queuedScenarioRuns.shift();
    if (!next) {
      this.releaseGlobalOptimizerLockIfIdle();
      return;
    }

    this.pendingProcessStarts += 1;
    this._spawnRunnerProcess(
      next.runId,
      next.scenarioId,
      next.timetableId,
      next.conditions,
    ).catch(async (err) => {
      this.logger.error(
        `Failed to spawn runner for run ${next.runId}: ${err.message}`,
      );
      await this.prisma.scenarioRun.update({
        where: { run_id: next.runId },
        data: {
          status: 'failed',
          completed_at: new Date(),
          error_message: err.message,
        },
      });
      await this._startNextQueuedRunIfIdle();
    });
  }

  /**
   * SSE endpoint handler.
   * Attaches to the active child process stdout (if still running) or returns
   * the final DB state immediately (if already completed/failed).
   */
  async streamRunProgress(runId: number, res: Response) {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const proc = this.activeProcesses.get(runId);

    if (proc) {
      // Process is still running — pipe stdout events
      const onData = (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed: GwoProgressLine = JSON.parse(trimmed);
            sendEvent(parsed);
          } catch {
            // Non-JSON line from Python (debug print, traceback, etc.) — forward as message
            sendEvent({ type: 'progress', phase: 'gwo', message: trimmed });
          }
        }
      };

      const onClose = (code: number | null) => {
        sendEvent({
          type: 'stream_closed',
          code,
          message: code === 0 ? 'Process exited cleanly.' : `Process exited with code ${code}.`,
        });
        res.end();
      };

      const onError = (err: Error) => {
        sendEvent({ type: 'error', message: err.message });
        res.end();
      };

      proc.stdout?.on('data', onData);
      proc.on('close', onClose);
      proc.on('error', onError);

      // Clean up listeners when the client disconnects
      res.on('close', () => {
        proc.stdout?.off('data', onData);
        proc.off('close', onClose);
        proc.off('error', onError);
      });
    } else {
      // Process not active — fetch final state from DB
      const run = await this.prisma.scenarioRun.findUnique({
        where: { run_id: runId },
      });

      if (!run) {
        sendEvent({ type: 'error', message: `Run ${runId} not found.` });
        res.end();
        return;
      }

      if (run.status === 'completed' || run.status === 'applied') {
        sendEvent({
          type: 'result',
          run_id: run.run_id,
          result_timetable_id: run.result_timetable_id,
          baseline_metrics: run.baseline_metrics,
          result_metrics: run.result_metrics,
          gwo_iterations_run: run.gwo_iterations_run,
          generation_seconds: run.generation_seconds,
          pct: 100,
          phase: 'done',
          message: 'Simulation complete.',
        });
      } else if (run.status === 'failed') {
        sendEvent({
          type: 'error',
          run_id: run.run_id,
          message: run.error_message ?? 'Run failed.',
        });
      } else {
        // pending but no active process — something crashed
        sendEvent({
          type: 'error',
          run_id: run.run_id,
          message: 'Run was interrupted. Please re-run the scenario.',
        });
      }

      res.end();
    }
  }

  async getRunStatus(runId: number) {
    const run = await this.prisma.scenarioRun.findUnique({
      where: { run_id: runId },
      include: {
        scenario: { select: { name: true } },
        base_timetable: { select: { timetable_id: true, status: true } },
        result_timetable: { select: { timetable_id: true, status: true } },
      },
    });
    if (!run) throw new NotFoundException('Run not found.');

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

  async listRuns(scenarioId: number) {
    const scenario = await this.prisma.scenario.findUnique({
      where: { scenario_id: scenarioId },
      select: { scenario_id: true },
    });
    if (!scenario) throw new NotFoundException('Scenario not found.');

    const runs = await this.prisma.scenarioRun.findMany({
      where: { scenario_id: scenarioId },
      orderBy: { run_id: 'desc' },
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

  // ══════════════════════════════════════════════════════════════════════════
  // COMPARISON
  // ══════════════════════════════════════════════════════════════════════════

  async compare(dto: CompareDto) {
    if (dto.runIds.length === 0) {
      throw new BadRequestException('Provide at least one run ID.');
    }

    const runs = await this.prisma.scenarioRun.findMany({
      where: {
        run_id: { in: dto.runIds },
        status: { in: ['completed', 'applied'] },
      },
      include: {
        scenario: { select: { scenario_id: true, name: true } },
        base_timetable: {
          select: {
            timetable_id: true,
            semester: { select: { academic_year: true, semester_type: true } },
          },
        },
      },
    });

    if (runs.length === 0) {
      throw new BadRequestException(
        'None of the supplied run IDs have completed results.',
      );
    }

    // Validate mode constraints
    if (dto.mode === CompareMode.BEFORE_AFTER && runs.length !== 1) {
      throw new BadRequestException(
        'before_after mode requires exactly one run ID.',
      );
    }
    if (
      dto.mode === CompareMode.CROSS_TIMETABLE &&
      new Set(runs.map((r) => r.scenario_id)).size !== 1
    ) {
      throw new BadRequestException(
        'cross_timetable mode requires all runs to belong to the same scenario.',
      );
    }
    if (
      dto.mode === CompareMode.CROSS_SCENARIO &&
      new Set(runs.map((r) => r.base_timetable_id)).size !== 1
    ) {
      throw new BadRequestException(
        'cross_scenario mode requires all runs to use the same base timetable.',
      );
    }

    const involvedTimetableIds = Array.from(
      new Set(
        runs.flatMap((run) =>
          [run.base_timetable_id, run.result_timetable_id].filter(
            (id): id is number => typeof id === 'number' && id > 0,
          ),
        ),
      ),
    );
    const entries = await this.prisma.sectionScheduleEntry.findMany({
      where: { timetable_id: { in: involvedTimetableIds } },
      select: {
        timetable_id: true,
        course_id: true,
        section_number: true,
        slot_id: true,
        room_id: true,
        user_id: true,
      },
    });
    const entriesByTimetable = new Map<number, typeof entries>();
    for (const row of entries) {
      const bucket = entriesByTimetable.get(row.timetable_id) ?? [];
      bucket.push(row);
      entriesByTimetable.set(row.timetable_id, bucket);
    }

    const comparisons = runs.map((run) => {
      const baseline = run.baseline_metrics as MetricsSnapshot | null;
      const result = run.result_metrics as MetricsSnapshot | null;
      const baseEntries = entriesByTimetable.get(run.base_timetable_id) ?? [];
      const resultEntries =
        run.result_timetable_id != null
          ? entriesByTimetable.get(run.result_timetable_id) ?? []
          : [];
      const sectionChanges = this._computeSectionChangeSummary(
        baseEntries,
        resultEntries,
      );

      const deltas =
        baseline && result
          ? {
              conflicts:
                (result.conflicts ?? 0) - (baseline.conflicts ?? 0),
              roomUtilizationRate:
                +((result.roomUtilizationRate ?? 0) -
                  (baseline.roomUtilizationRate ?? 0)).toFixed(2),
              softConstraintsScore:
                +((result.softConstraintsScore ?? 0) -
                  (baseline.softConstraintsScore ?? 0)).toFixed(2),
              fitnessScore:
                +((result.fitnessScore ?? 0) - (baseline.fitnessScore ?? 0)).toFixed(4),
              lecturerBalanceScore:
                baseline.lecturerBalanceScore != null && result.lecturerBalanceScore != null
                  ? +(
                      result.lecturerBalanceScore - baseline.lecturerBalanceScore
                    ).toFixed(2)
                  : null,
            }
          : null;

      return {
        runId: run.run_id,
        scenarioId: run.scenario_id,
        scenarioName: run.scenario.name,
        baseTimetableId: run.base_timetable_id,
        resultTimetableId: run.result_timetable_id,
        status: run.status,
        semester: run.base_timetable.semester,
        baseline,
        result,
        deltas,
        recommendation: deltas
          ? this._generateRecommendation(run.scenario.name, deltas)
          : 'Run the scenario first to see a recommendation.',
        sectionChanges,
      };
    });

    return {
      mode: dto.mode,
      comparisons,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // APPLY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Promote a scenario result timetable to production by replacing the base
   * timetable's schedule entries and metrics with those from the result.
   *
   * This is the ONLY moment simulation data touches production data.
   * The result timetable is deleted after promotion (it has been merged into
   * the base, making it redundant).
   */
  async applyScenarioRun(runId: number, dto?: ApplyScenarioRunDto) {
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

    if (!run) throw new NotFoundException('Run not found.');
    if (run.status !== 'completed') {
      throw new BadRequestException(
        `Run is not completed (current status: ${run.status}).`,
      );
    }
    if (!run.result_timetable) {
      throw new BadRequestException('Run has no result timetable to apply.');
    }

    await this.timetablesService.ensureHardConflictsAcknowledged(
      run.result_timetable.timetable_id,
      dto?.acknowledgedHardConflicts,
    );

    const resultTimetable = run.result_timetable;
    const baseTimetableId = run.base_timetable_id;

    await this.prisma.$transaction(async (tx) => {
      // 1. Replace schedule entries on the base timetable
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

      // 2. Overwrite base timetable metrics with result metrics
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

      // 3. Delete all conflict records for the base timetable (result is cleaner)
      await tx.timetableConflict.deleteMany({
        where: { timetable_id: baseTimetableId },
      });

      // 4. Delete scenario → result timetable link so cascade doesn't block deletion
      await tx.scenarioProducesTimetable.deleteMany({
        where: { timetable_id: resultTimetable.timetable_id },
      });

      // 5. Null out the result reference on the run before deleting the timetable
      await tx.scenarioRun.update({
        where: { run_id: runId },
        data: { result_timetable_id: null },
      });

      // 6. Delete the result timetable — it has been merged into the base
      await tx.timetable.delete({
        where: { timetable_id: resultTimetable.timetable_id },
      });

      // 7. Mark run as applied
      await tx.scenarioRun.update({
        where: { run_id: runId },
        data: { status: 'applied' },
      });

      // 8. Update base timetable generation_type to mark it was modified by a scenario
      await tx.timetable.update({
        where: { timetable_id: baseTimetableId },
        data: { generation_type: 'what_if_applied' },
      });
    });

    return {
      ok: true,
      appliedToTimetableId: baseTimetableId,
      message:
        'Scenario result has been applied. The base timetable schedule has been replaced.',
    };
  }

  async controlRun(runId: number, action: 'pause' | 'resume') {
    const proc = this.activeProcesses.get(runId);
    if (!proc || !proc.pid) {
      throw new BadRequestException('Run is not currently active.');
    }

    try {
      if (process.platform === 'win32') {
        const psCmd =
          action === 'pause'
            ? `Suspend-Process -Id ${proc.pid} -ErrorAction Stop`
            : `Resume-Process -Id ${proc.pid} -ErrorAction Stop`;
        const ps = spawnSync(
          'powershell',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd],
          { encoding: 'utf8' },
        );
        if (ps.status !== 0) {
          throw new Error((ps.stderr || ps.stdout || '').trim() || 'PowerShell control failed.');
        }
      } else {
        process.kill(proc.pid, action === 'pause' ? 'SIGSTOP' : 'SIGCONT');
      }
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : `Failed to ${action} run.`,
      );
    }

    return { ok: true, action, runId };
  }

  async cancelRun(runId: number) {
    const proc = this.activeProcesses.get(runId);
    if (proc) {
      try {
        proc.kill();
      } catch {
        /* ignore */
      }
    }

    const run = await this.prisma.scenarioRun.findUnique({
      where: { run_id: runId },
      select: { status: true },
    });
    if (run && (run.status === 'running' || run.status === 'pending')) {
      await this.prisma.scenarioRun.update({
        where: { run_id: runId },
        data: {
          status: 'failed',
          completed_at: new Date(),
          error_message: 'Run cancelled by user.',
        },
      });
    }

    this.releaseGlobalOptimizerLockIfIdle();
    return { ok: true, runId };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — child process spawning
  // ══════════════════════════════════════════════════════════════════════════

  private async _spawnRunnerProcess(
    runId: number,
    scenarioId: number,
    timetableId: number,
    conditions: Array<{
      condition_id: number;
      condition_type: string;
      parameters: unknown;
      order_index: number;
    }>,
  ) {
    try {
    // ── 1. Build full timetable config JSON ────────────────────────────────
    const config = await this._buildRunnerConfig(
      runId,
      scenarioId,
      timetableId,
      conditions,
    );

    // Persist baseline metrics from the source timetable at run start so
    // comparison endpoints always read the canonical baseline snapshot.
    await this.prisma.scenarioRun.update({
      where: { run_id: runId },
      data: {
        status: 'running',
        started_at: new Date(),
        baseline_metrics: config.baseline_metrics as object,
      },
    });

    // ── 2. Write config to temp file ───────────────────────────────────────
    const tmpDir = os.tmpdir();
    const configPath = path.join(tmpDir, `whatif_run_${runId}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // ── 3. Resolve paths ───────────────────────────────────────────────────
    // run_scenario.py lives in the `whatif/` directory at the project root.
    // Adjust this path if your project layout is different.
    const scriptPath = path.resolve(
      process.cwd(),
      'whatif',
      'run_scenario.py',
    );

    const python =
      process.env.PYTHON_BIN ??
      process.env.PYTHON ??
      (process.platform === 'win32' ? 'python' : 'python3');

    this.logger.log(
      `Spawning scenario runner: ${python} ${scriptPath} --config ${configPath}`,
    );

    // ── 4. Spawn ───────────────────────────────────────────────────────────
    const proc = spawn(python, [scriptPath, '--config', configPath], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1', // essential for real-time stdout streaming
      },
    });

    this.activeProcesses.set(runId, proc);

    // Buffers for partial lines and stderr details across chunks
    let lineBuffer = '';
    let stderrBuffer = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? ''; // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this._handlePythonLine(runId, trimmed).catch((err) => {
          this.logger.error(`Error handling Python line for run ${runId}: ${err.message}`);
        });
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuffer += text;
      this.logger.warn(`[run ${runId} stderr] ${text.trim()}`);
    });

    proc.on('close', async (code) => {
      this.activeProcesses.delete(runId);

      // Flush any remaining buffered line
      if (lineBuffer.trim()) {
        await this._handlePythonLine(runId, lineBuffer.trim()).catch(() => {});
      }

      // Cleanup temp config file
      try { fs.unlinkSync(configPath); } catch { /* ignore */ }

      if (code !== 0) {
        // Mark as failed if the DB record is still 'running'
        const run = await this.prisma.scenarioRun.findUnique({
          where: { run_id: runId },
          select: { status: true },
        });
        if (run?.status === 'running') {
          const stderrDetail = stderrBuffer.trim();
          await this.prisma.scenarioRun.update({
            where: { run_id: runId },
            data: {
              status: 'failed',
              completed_at: new Date(),
              error_message: stderrDetail
                ? `Process exited with code ${code}. ${stderrDetail.slice(0, 1800)}`
                : `Process exited with code ${code}.`,
            },
          });
        }
      }

      this.logger.log(`Scenario runner for run ${runId} exited with code ${code}.`);
      await this._startNextQueuedRunIfIdle();
      this.releaseGlobalOptimizerLockIfIdle();
    });

    proc.on('error', async (err) => {
      this.activeProcesses.delete(runId);
      await this.prisma.scenarioRun.update({
        where: { run_id: runId },
        data: {
          status: 'failed',
          completed_at: new Date(),
          error_message: err.message,
        },
      });
      this.logger.error(`Scenario runner spawn error for run ${runId}: ${err.message}`);
      await this._startNextQueuedRunIfIdle();
      this.releaseGlobalOptimizerLockIfIdle();
    });
    } finally {
      this.pendingProcessStarts = Math.max(0, this.pendingProcessStarts - 1);
      this.releaseGlobalOptimizerLockIfIdle();
    }
  }

  /**
   * Parse one line of Python stdout and, if it is a result line, persist to DB.
   */
  private async _handlePythonLine(runId: number, line: string) {
    let parsed: GwoProgressLine;
    try {
      parsed = JSON.parse(line) as GwoProgressLine;
    } catch {
      return; // non-JSON line — already forwarded to SSE in streamRunProgress
    }

    if (parsed.type === 'result') {
      // Final result — save to DB
      await this.prisma.scenarioRun.update({
        where: { run_id: runId },
        data: {
          status: 'completed',
          completed_at: new Date(),
          result_timetable_id: parsed.result_timetable_id ?? null,
          result_metrics: (parsed.result_metrics as object) ?? undefined,
          gwo_iterations_run: parsed.gwo_iterations_run ?? null,
          generation_seconds: parsed.generation_seconds ?? null,
        },
      });
    } else if (parsed.type === 'error') {
      const detail = (parsed.detail ?? '').trim();
      const message = (parsed.message ?? '').trim();
      const fallbackPayload = JSON.stringify(parsed);
      const resolvedError =
        detail || message || `Python returned an error event without details: ${fallbackPayload}`;
      this.logger.error(
        `[run ${runId}] Python reported error: ${resolvedError}`,
      );
      await this.prisma.scenarioRun.update({
        where: { run_id: runId },
        data: {
          status: 'failed',
          completed_at: new Date(),
          error_message: resolvedError,
        },
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — build runner config JSON
  // ══════════════════════════════════════════════════════════════════════════

  private async _buildRunnerConfig(
    runId: number,
    scenarioId: number,
    timetableId: number,
    conditions: Array<{
      condition_id: number;
      condition_type: string;
      parameters: unknown;
      order_index: number;
    }>,
  ) {
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
            lecturer: { include: { user: { select: { first_name: true, last_name: true } } } },
          },
        },
      },
    });
    if (!timetable) throw new NotFoundException(`Timetable ${timetableId} not found.`);

    const isSummer = timetable.semester?.semester_type === 3;

    // Load the full pools (conditions can add/remove from these)
    const [lecturers, rooms, courses, timeslots] = await Promise.all([
      this.prisma.lecturer.findMany({
        where: { is_available: true },
        include: {
          user: { select: { user_id: true, first_name: true, last_name: true } },
          lecturer_can_teach_course: { select: { course_id: true } },
        },
      }),
      this.prisma.room.findMany({
        where: { is_available: true },
      }),
      this.prisma.course.findMany({
        where: {
          is_active: true,
          ...(isSummer
            ? { sections_summer: { gt: 0 } }
            : { sections_normal: { gt: 0 } }),
        },
      }),
      this.prisma.timeslot.findMany({
        where: {
          is_active: true,
          is_summer: isSummer,
        },
      }),
    ]);

    // Baseline metrics snapshot
    const lecturerBalanceScore = this._computeLecturerBalanceScore(
      timetable.section_schedule_entries,
      lecturers,
    );

    const baselineMetrics: MetricsSnapshot = timetable.timetable_metrics
      ? {
          conflicts: 0, // computed from conflict table
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

    // Count conflicts for baseline
    const conflictCount = await this.prisma.timetableConflict.count({
      where: { timetable_id: timetableId },
    });
    baselineMetrics.conflicts = conflictCount;

    // Resolve GWO script path with robust fallbacks.
    const configuredGwoPath = process.env.GWO_SCRIPT_PATH;
    const cwd = process.cwd();
    const candidates = [
      configuredGwoPath ? path.resolve(cwd, configuredGwoPath) : null,
      path.resolve(cwd, 'GWO-v6.py'),
      path.resolve(cwd, 'scripts', 'GWO-v6.py'),
      path.resolve(cwd, '..', 'frontend', 'scripts', 'GWO-v6.py'),
      path.resolve(cwd, '..', 'GWO-v6.py'),
    ].filter((p): p is string => Boolean(p));
    const gwoScriptPath =
      candidates.find((p) => fs.existsSync(p)) ??
      path.resolve(cwd, configuredGwoPath ?? 'GWO-v6.py');

    return {
      run_id: runId,
      scenario_id: scenarioId,
      base_timetable_id: timetableId,
      semester_id: timetable.semester_id,
      semester_type: timetable.semester?.semester_type ?? 1,
      is_summer: isSummer,
      gwo_script_path: gwoScriptPath,
      database_url: this.config.get<string>('DATABASE_URL') ?? process.env.DATABASE_URL,
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
        courses: courses.map((c) => ({
          course_id: c.course_id,
          course_code: c.course_code,
          course_name: c.course_name,
          dept_id: c.dept_id,
          academic_level: c.academic_level,
          is_lab: c.is_lab,
          credit_hours: c.credit_hours,
          delivery_mode: c.delivery_mode,
          sections_normal: c.sections_normal,
          sections_summer: c.sections_summer,
        })),
        timeslots: timeslots.map((t) => ({
          slot_id: t.slot_id,
          start_time: t.start_time.toISOString().slice(11, 16),
          end_time: t.end_time.toISOString().slice(11, 16),
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

  /**
   * Computes a 0..100 lecturer workload balance score from already-loaded
   * baseline timetable data. Higher is better (lower dispersion of load).
   */
  private _computeLecturerBalanceScore(
    entries: BaselineEntry[],
    lecturers: BaselineLecturer[],
  ): number {
    if (lecturers.length === 0) return 0;

    const loadByLecturer = new Map<number, number>();
    for (const lecturer of lecturers) {
      loadByLecturer.set(lecturer.user_id, 0);
    }
    for (const entry of entries) {
      if (entry.user_id == null) continue;
      loadByLecturer.set(
        entry.user_id,
        (loadByLecturer.get(entry.user_id) ?? 0) + 1,
      );
    }

    const loads = Array.from(loadByLecturer.values());
    if (loads.length === 0) return 0;

    const mean = loads.reduce((sum, value) => sum + value, 0) / loads.length;
    const variance =
      loads.reduce((sum, value) => sum + (value - mean) ** 2, 0) / loads.length;
    const stdDev = Math.sqrt(variance);

    const maxWorkload = Math.max(
      ...lecturers.map((lecturer) => Number(lecturer.max_workload ?? 0)),
      0,
    );
    if (maxWorkload <= 0) return 0;

    const normalizedDispersion = stdDev / maxWorkload;
    const score = (1 - normalizedDispersion) * 100;
    return +Math.max(0, Math.min(100, score)).toFixed(2);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — serialization helpers
  // ══════════════════════════════════════════════════════════════════════════

  private serializeScenario(row: any) {
    const latestRun = row.runs?.[0] ?? null;

    return {
      id: row.scenario_id,
      name: row.name,
      status: row.status,
      description: row.description,
      conditionCount: row.conditions?.length ?? 0,
      conditions: row.conditions?.map((c: any) => ({
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

  private _generateRecommendation(
    scenarioName: string,
    deltas: {
      conflicts: number;
      roomUtilizationRate: number;
      softConstraintsScore: number;
      fitnessScore: number;
      lecturerBalanceScore: number | null;
    },
  ): string {
    let positives = 0;
    let negatives = 0;

    if (deltas.conflicts < 0) positives++;
    else if (deltas.conflicts > 0) negatives++;

    if (deltas.roomUtilizationRate > 0) positives++;
    else if (deltas.roomUtilizationRate < -2) negatives++;

    if (deltas.softConstraintsScore > 0) positives++;
    else if (deltas.softConstraintsScore < -2) negatives++;

    if (deltas.fitnessScore > 0) positives++;
    else if (deltas.fitnessScore < 0) negatives++;

    if (typeof deltas.lecturerBalanceScore === 'number') {
      if (deltas.lecturerBalanceScore > 0) positives++;
      else if (deltas.lecturerBalanceScore < -0.1) negatives++;
    }

    const total = positives + negatives;

    if (total === 0)
      return `"${scenarioName}" produces no measurable change in key metrics.`;

    const ratio = positives / total;
    if (ratio >= 0.8)
      return `✅ Apply recommended — "${scenarioName}" improves ${positives}/${total} key metrics with no significant downsides.`;
    if (ratio >= 0.6)
      return `⚠️ Apply with caution — "${scenarioName}" improves most metrics but has ${negatives} area(s) of concern.`;
    if (negatives > positives)
      return `❌ Apply not recommended — "${scenarioName}" worsens more metrics than it improves.`;
    return `⚠️ Mixed results — "${scenarioName}" has equal positive and negative effects.`;
  }

  private _computeSectionChangeSummary(
    baselineEntries: Array<{
      course_id: number;
      section_number: string;
      slot_id: number;
      room_id: number;
      user_id: number | null;
    }>,
    resultEntries: Array<{
      course_id: number;
      section_number: string;
      slot_id: number;
      room_id: number;
      user_id: number | null;
    }>,
  ) {
    const keyOf = (e: { course_id: number; section_number: string }) =>
      `${e.course_id}|${String(e.section_number)}`;
    const assignmentOf = (e: {
      slot_id: number;
      room_id: number;
      user_id: number | null;
    }) => `${e.slot_id}|${e.room_id}|${e.user_id ?? 'none'}`;

    const baseline = new Map<string, string>();
    const result = new Map<string, string>();
    for (const e of baselineEntries) baseline.set(keyOf(e), assignmentOf(e));
    for (const e of resultEntries) result.set(keyOf(e), assignmentOf(e));

    let added = 0;
    let removed = 0;
    let changed = 0;
    for (const [key, assignment] of result.entries()) {
      if (!baseline.has(key)) {
        added += 1;
        continue;
      }
      if (baseline.get(key) !== assignment) changed += 1;
    }
    for (const key of baseline.keys()) {
      if (!result.has(key)) removed += 1;
    }
    return {
      added,
      removed,
      changed,
      unchanged: Math.max(0, result.size - added - changed),
      baselineCount: baseline.size,
      resultCount: result.size,
    };
  }
}
