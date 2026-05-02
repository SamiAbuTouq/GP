// src/whatif/dto/whatif.dto.ts
// =============================================================================
// All DTOs for the What-If Scenario system.
// Covers the 11 condition types mandated by the spec.
// =============================================================================

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────
// Condition types enum
// ─────────────────────────────────────────────

export enum ConditionType {
  // Lecturer mutations
  ADD_LECTURER         = 'add_lecturer',
  DELETE_LECTURER      = 'delete_lecturer',
  AMEND_LECTURER       = 'amend_lecturer',
  // Room mutations
  ADD_ROOM             = 'add_room',
  DELETE_ROOM          = 'delete_room',
  ADJUST_ROOM_CAPACITY = 'adjust_room_capacity',
  // Course / section mutations
  ADD_COURSE           = 'add_course',
  CHANGE_SECTION_COUNT = 'change_section_count',
  // Delivery mode
  CHANGE_DELIVERY_MODE = 'change_delivery_mode',
  // Timeslot mutations
  ADD_TIMESLOT         = 'add_timeslot',
  DELETE_TIMESLOT      = 'delete_timeslot',
}

// ─────────────────────────────────────────────
// Per-condition parameter objects
// These are used both for validation at the DTO layer and as typed
// parameters shapes that the Python engine reads from JSON.
// ─────────────────────────────────────────────

/** add_lecturer: inject a brand-new lecturer into the sandbox pool */
export class AddLecturerParams {
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsInt() @Min(1) deptId!: number;
  @IsInt() @Min(1) maxWorkload!: number;
  /** course_ids this lecturer can teach */
  @IsArray() @IsInt({ each: true }) teachableCourseIds!: number[];
}

/** delete_lecturer: remove lecturer; their sections become unassigned for GWO */
export class DeleteLecturerParams {
  @IsInt() @Min(1) lecturerUserId!: number;
}

/** amend_lecturer: change teachable courses or max workload */
export class AmendLecturerParams {
  @IsInt() @Min(1) lecturerUserId!: number;
  @IsArray() @IsInt({ each: true }) @IsOptional() teachableCourseIds?: number[];
  @IsInt() @Min(1) @IsOptional() maxWorkload?: number;
}

/** add_room: add a new room to the pool */
export class AddRoomParams {
  @IsString() @IsNotEmpty() roomNumber!: string;
  @IsInt() @Min(1) roomType!: number;
  @IsInt() @Min(1) capacity!: number;
  @IsBoolean() isAvailable!: boolean;
}

/** delete_room: remove room; sections using it become unassigned */
export class DeleteRoomParams {
  @IsInt() @Min(1) roomId!: number;
}

/** adjust_room_capacity: change capacity of existing room */
export class AdjustRoomCapacityParams {
  @IsInt() @Min(1) roomId!: number;
  @IsInt() @Min(1) newCapacity!: number;
}

/** add_course: add a new course offering to be scheduled */
export class AddCourseParams {
  @IsString() @IsNotEmpty() @MaxLength(20) courseCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) courseName!: string;
  @IsInt() @Min(1) deptId!: number;
  @IsInt() @Min(1) academicLevel!: number;
  @IsBoolean() isLab!: boolean;
  @IsInt() @Min(1) creditHours!: number;
  @IsString() @IsNotEmpty() deliveryMode!: string;
  @IsInt() @Min(0) sectionsNormal!: number;
  @IsInt() @Min(0) sectionsSummer!: number;
  /** user_ids of lecturers who can teach this course */
  @IsArray() @IsInt({ each: true }) assignableLecturerIds!: number[];
}

/** change_section_count: increase or decrease parallel sections for a course */
export class ChangeSectionCountParams {
  @IsInt() @Min(1) courseId!: number;
  @IsInt() newSectionsNormal!: number;
  @IsInt() @IsOptional() newSectionsSummer?: number;
}

/** change_delivery_mode: flip a course online/face-to-face */
export class ChangeDeliveryModeParams {
  @IsInt() @Min(1) courseId!: number;
  @IsString() @IsNotEmpty() newDeliveryMode!: string; // 'ONLINE' | 'FACE_TO_FACE' | 'BLENDED'
}

/** add_timeslot: add a new available timeslot */
export class AddTimeslotParams {
  @IsString() @IsNotEmpty() startTime!: string; // "HH:MM"
  @IsString() @IsNotEmpty() endTime!: string;   // "HH:MM"
  @IsInt() @Min(0) daysMask!: number;
  @IsString() @IsNotEmpty() slotType!: string;
  @IsBoolean() isSummer!: boolean;
}

/** delete_timeslot: remove timeslot; sections using it become unassigned */
export class DeleteTimeslotParams {
  @IsInt() @Min(1) slotId!: number;
}

// ─────────────────────────────────────────────
// ConditionDto — the generic wrapper used in scenario CRUD
// ─────────────────────────────────────────────

export class ConditionDto {
  @IsEnum(ConditionType)
  type!: ConditionType;

  /** Typed object matching the params class for this condition type */
  @IsObject()
  parameters!: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;
}

// ─────────────────────────────────────────────
// Scenario CRUD DTOs
// ─────────────────────────────────────────────

export class CreateScenarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  @IsOptional()
  conditions?: ConditionDto[];
}

export class UpdateScenarioDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  @IsOptional()
  conditions?: ConditionDto[];
}

// ─────────────────────────────────────────────
// Run DTOs
// ─────────────────────────────────────────────

export class RunScenarioDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  timetableIds!: number[];
}

export class ControlRunDto {
  @IsIn(['pause', 'resume'])
  action!: 'pause' | 'resume';
}

// ─────────────────────────────────────────────
// Compare DTOs
// ─────────────────────────────────────────────

export enum CompareMode {
  BEFORE_AFTER     = 'before_after',     // 1 scenario, 1 timetable
  CROSS_TIMETABLE  = 'cross_timetable',  // 1 scenario, many timetables
  CROSS_SCENARIO   = 'cross_scenario',   // many scenarios, 1 timetable
}

export class CompareDto {
  @IsEnum(CompareMode)
  mode!: CompareMode;

  @IsArray()
  @IsInt({ each: true })
  runIds!: number[];
}

// ─────────────────────────────────────────────
// Apply
// ─────────────────────────────────────────────

export class ApplyScenarioRunDto {
  @IsBoolean()
  @IsOptional()
  acknowledgedHardConflicts?: boolean;
}

// ─────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────

export class DeleteScenarioQueryDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  force?: boolean;
}
