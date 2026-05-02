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
exports.DeleteScenarioQueryDto = exports.ApplyScenarioRunDto = exports.CompareDto = exports.CompareMode = exports.ControlRunDto = exports.RunScenarioDto = exports.UpdateScenarioDto = exports.CreateScenarioDto = exports.ConditionDto = exports.DeleteTimeslotParams = exports.AddTimeslotParams = exports.ChangeDeliveryModeParams = exports.ChangeSectionCountParams = exports.AddCourseParams = exports.AdjustRoomCapacityParams = exports.DeleteRoomParams = exports.AddRoomParams = exports.AmendLecturerParams = exports.DeleteLecturerParams = exports.AddLecturerParams = exports.ConditionType = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var ConditionType;
(function (ConditionType) {
    ConditionType["ADD_LECTURER"] = "add_lecturer";
    ConditionType["DELETE_LECTURER"] = "delete_lecturer";
    ConditionType["AMEND_LECTURER"] = "amend_lecturer";
    ConditionType["ADD_ROOM"] = "add_room";
    ConditionType["DELETE_ROOM"] = "delete_room";
    ConditionType["ADJUST_ROOM_CAPACITY"] = "adjust_room_capacity";
    ConditionType["ADD_COURSE"] = "add_course";
    ConditionType["CHANGE_SECTION_COUNT"] = "change_section_count";
    ConditionType["CHANGE_DELIVERY_MODE"] = "change_delivery_mode";
    ConditionType["ADD_TIMESLOT"] = "add_timeslot";
    ConditionType["DELETE_TIMESLOT"] = "delete_timeslot";
})(ConditionType || (exports.ConditionType = ConditionType = {}));
class AddLecturerParams {
}
exports.AddLecturerParams = AddLecturerParams;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AddLecturerParams.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AddLecturerParams.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddLecturerParams.prototype, "deptId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddLecturerParams.prototype, "maxWorkload", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsInt)({ each: true }),
    __metadata("design:type", Array)
], AddLecturerParams.prototype, "teachableCourseIds", void 0);
class DeleteLecturerParams {
}
exports.DeleteLecturerParams = DeleteLecturerParams;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DeleteLecturerParams.prototype, "lecturerUserId", void 0);
class AmendLecturerParams {
}
exports.AmendLecturerParams = AmendLecturerParams;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AmendLecturerParams.prototype, "lecturerUserId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], AmendLecturerParams.prototype, "teachableCourseIds", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], AmendLecturerParams.prototype, "maxWorkload", void 0);
class AddRoomParams {
}
exports.AddRoomParams = AddRoomParams;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AddRoomParams.prototype, "roomNumber", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddRoomParams.prototype, "roomType", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddRoomParams.prototype, "capacity", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AddRoomParams.prototype, "isAvailable", void 0);
class DeleteRoomParams {
}
exports.DeleteRoomParams = DeleteRoomParams;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DeleteRoomParams.prototype, "roomId", void 0);
class AdjustRoomCapacityParams {
}
exports.AdjustRoomCapacityParams = AdjustRoomCapacityParams;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdjustRoomCapacityParams.prototype, "roomId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdjustRoomCapacityParams.prototype, "newCapacity", void 0);
class AddCourseParams {
}
exports.AddCourseParams = AddCourseParams;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], AddCourseParams.prototype, "courseCode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], AddCourseParams.prototype, "courseName", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddCourseParams.prototype, "deptId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddCourseParams.prototype, "academicLevel", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AddCourseParams.prototype, "isLab", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddCourseParams.prototype, "creditHours", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AddCourseParams.prototype, "deliveryMode", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AddCourseParams.prototype, "sectionsNormal", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AddCourseParams.prototype, "sectionsSummer", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsInt)({ each: true }),
    __metadata("design:type", Array)
], AddCourseParams.prototype, "assignableLecturerIds", void 0);
class ChangeSectionCountParams {
}
exports.ChangeSectionCountParams = ChangeSectionCountParams;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ChangeSectionCountParams.prototype, "courseId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], ChangeSectionCountParams.prototype, "newSectionsNormal", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ChangeSectionCountParams.prototype, "newSectionsSummer", void 0);
class ChangeDeliveryModeParams {
}
exports.ChangeDeliveryModeParams = ChangeDeliveryModeParams;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ChangeDeliveryModeParams.prototype, "courseId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ChangeDeliveryModeParams.prototype, "newDeliveryMode", void 0);
class AddTimeslotParams {
}
exports.AddTimeslotParams = AddTimeslotParams;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AddTimeslotParams.prototype, "startTime", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AddTimeslotParams.prototype, "endTime", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AddTimeslotParams.prototype, "daysMask", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AddTimeslotParams.prototype, "slotType", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AddTimeslotParams.prototype, "isSummer", void 0);
class DeleteTimeslotParams {
}
exports.DeleteTimeslotParams = DeleteTimeslotParams;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DeleteTimeslotParams.prototype, "slotId", void 0);
class ConditionDto {
}
exports.ConditionDto = ConditionDto;
__decorate([
    (0, class_validator_1.IsEnum)(ConditionType),
    __metadata("design:type", String)
], ConditionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ConditionDto.prototype, "parameters", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], ConditionDto.prototype, "orderIndex", void 0);
class CreateScenarioDto {
}
exports.CreateScenarioDto = CreateScenarioDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateScenarioDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateScenarioDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConditionDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateScenarioDto.prototype, "conditions", void 0);
class UpdateScenarioDto {
}
exports.UpdateScenarioDto = UpdateScenarioDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpdateScenarioDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateScenarioDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConditionDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateScenarioDto.prototype, "conditions", void 0);
class RunScenarioDto {
}
exports.RunScenarioDto = RunScenarioDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.Min)(1, { each: true }),
    __metadata("design:type", Array)
], RunScenarioDto.prototype, "timetableIds", void 0);
class ControlRunDto {
}
exports.ControlRunDto = ControlRunDto;
__decorate([
    (0, class_validator_1.IsIn)(['pause', 'resume']),
    __metadata("design:type", String)
], ControlRunDto.prototype, "action", void 0);
var CompareMode;
(function (CompareMode) {
    CompareMode["BEFORE_AFTER"] = "before_after";
    CompareMode["CROSS_TIMETABLE"] = "cross_timetable";
    CompareMode["CROSS_SCENARIO"] = "cross_scenario";
})(CompareMode || (exports.CompareMode = CompareMode = {}));
class CompareDto {
}
exports.CompareDto = CompareDto;
__decorate([
    (0, class_validator_1.IsEnum)(CompareMode),
    __metadata("design:type", String)
], CompareDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsInt)({ each: true }),
    __metadata("design:type", Array)
], CompareDto.prototype, "runIds", void 0);
class ApplyScenarioRunDto {
}
exports.ApplyScenarioRunDto = ApplyScenarioRunDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ApplyScenarioRunDto.prototype, "acknowledgedHardConflicts", void 0);
class DeleteScenarioQueryDto {
}
exports.DeleteScenarioQueryDto = DeleteScenarioQueryDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    __metadata("design:type", Boolean)
], DeleteScenarioQueryDto.prototype, "force", void 0);
//# sourceMappingURL=whatif.dto.js.map