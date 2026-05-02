// src/whatif/whatif.controller.ts
// =============================================================================
// What-If Scenario System — NestJS Controller
//
// All routes are admin-only.
// The SSE streaming route uses raw Response so it can pipe the Python
// child-process stdout directly to the HTTP connection.
// =============================================================================

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { WhatIfService } from './whatif.service';
import {
  ApplyScenarioRunDto,
  CompareDto,
  ControlRunDto,
  CreateScenarioDto,
  DeleteScenarioQueryDto,
  RunScenarioDto,
  UpdateScenarioDto,
} from './dto/whatif.dto';

@Controller('what-if')
@Roles(Role.ADMIN)
export class WhatIfController {
  constructor(private readonly whatIfService: WhatIfService) {}

  // ── Scenario CRUD ──────────────────────────────────────────────────────────

  @Get('scenarios')
  listScenarios() {
    return this.whatIfService.listScenarios();
  }

  @Get('scenarios/:id')
  getScenario(@Param('id', ParseIntPipe) id: number) {
    return this.whatIfService.getScenario(id);
  }

  @Post('scenarios')
  createScenario(@Body() dto: CreateScenarioDto) {
    return this.whatIfService.createScenario(dto);
  }

  @Patch('scenarios/:id')
  updateScenario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScenarioDto,
  ) {
    return this.whatIfService.updateScenario(id, dto);
  }

  @Post('scenarios/:id/clone')
  cloneScenario(@Param('id', ParseIntPipe) id: number) {
    return this.whatIfService.cloneScenario(id);
  }

  @Delete('scenarios/:id')
  deleteScenario(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DeleteScenarioQueryDto,
  ) {
    return this.whatIfService.deleteScenario(id, query.force);
  }

  // ── Conditions (nested under scenario) ────────────────────────────────────

  @Get('scenarios/:id/conditions')
  listConditions(@Param('id', ParseIntPipe) id: number) {
    return this.whatIfService.listConditions(id);
  }

  // ── Run lifecycle ──────────────────────────────────────────────────────────

  /**
   * POST /what-if/scenarios/:id/run
   * Starts one ScenarioRun per supplied timetable ID.
   * Spawns the Python runner as a child process.
   * Returns { runs: [{ runId, timetableId }] } immediately.
   */
  @Post('scenarios/:id/run')
  runScenario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RunScenarioDto,
  ) {
    return this.whatIfService.runScenario(id, dto.timetableIds);
  }

  /**
   * GET /what-if/runs/:runId/stream
   * SSE endpoint.  Keeps the connection open and forwards every progress
   * JSON line emitted by run_scenario.py.
   * The frontend uses the same GWO progress components as the normal
   * Timetable Generation page — it just points to this URL instead of /api/run.
   */
  @Get('runs/:runId/stream')
  streamRunProgress(
    @Param('runId', ParseIntPipe) runId: number,
    @Res() res: Response,
  ) {
    // NOTE: @Res() bypasses NestJS response handling — service owns the lifecycle.
    return this.whatIfService.streamRunProgress(runId, res);
  }

  /**
   * GET /what-if/runs/:runId
   * Non-streaming poll endpoint (fallback / for UI reconciliation on reconnect).
   */
  @Get('runs/:runId')
  getRunStatus(@Param('runId', ParseIntPipe) runId: number) {
    return this.whatIfService.getRunStatus(runId);
  }

  /**
   * GET /what-if/scenarios/:id/runs
   * List all runs for a scenario (newest first).
   */
  @Get('scenarios/:id/runs')
  listRuns(@Param('id', ParseIntPipe) id: number) {
    return this.whatIfService.listRuns(id);
  }

  // ── Comparison ─────────────────────────────────────────────────────────────

  /**
   * POST /what-if/compare
   * Compare run results in one of three modes:
   *   before_after     – 1 scenario, 1 timetable (baseline vs result)
   *   cross_timetable  – 1 scenario, N timetables side-by-side
   *   cross_scenario   – N scenarios on the same timetable
   * Body: { mode, runIds }
   */
  @Post('compare')
  compare(@Body() dto: CompareDto) {
    return this.whatIfService.compare(dto);
  }

  // ── Apply ──────────────────────────────────────────────────────────────────

  /**
   * POST /what-if/runs/:runId/apply
   * Promote the scenario result timetable to production.
   * Replaces the base timetable's schedule entries with the result entries.
   * This is the ONLY moment simulation data touches production.
   */
  @Post('runs/:runId/apply')
  applyScenarioRun(
    @Param('runId', ParseIntPipe) runId: number,
    @Body() body: ApplyScenarioRunDto,
  ) {
    return this.whatIfService.applyScenarioRun(runId, body);
  }

  @Post('runs/:runId/control')
  controlScenarioRun(
    @Param('runId', ParseIntPipe) runId: number,
    @Body() dto: ControlRunDto,
  ) {
    return this.whatIfService.controlRun(runId, dto.action);
  }

  @Post('runs/:runId/cancel')
  cancelScenarioRun(@Param('runId', ParseIntPipe) runId: number) {
    return this.whatIfService.cancelRun(runId);
  }
}
