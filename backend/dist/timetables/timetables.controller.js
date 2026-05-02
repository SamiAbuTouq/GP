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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimetablesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const publish_draft_dto_1 = require("./dto/publish-draft.dto");
const timetables_service_1 = require("./timetables.service");
let TimetablesController = class TimetablesController {
    constructor(timetablesService) {
        this.timetablesService = timetablesService;
    }
    list(semesterIdRaw, draftsOnlyRaw, scenarioRunBasesOnlyRaw) {
        const scenarioRunBasesOnly = scenarioRunBasesOnlyRaw === 'true' ||
            scenarioRunBasesOnlyRaw === '1' ||
            scenarioRunBasesOnlyRaw?.toLowerCase() === 'yes';
        const draftsOnly = draftsOnlyRaw === 'true' ||
            draftsOnlyRaw === '1' ||
            draftsOnlyRaw?.toLowerCase() === 'yes';
        const rawTrimmed = typeof semesterIdRaw === 'string' ? semesterIdRaw.trim() : '';
        const parsedSemester = rawTrimmed !== '' &&
            rawTrimmed.toLowerCase() !== 'null' &&
            rawTrimmed.toLowerCase() !== 'undefined'
            ? Number(rawTrimmed)
            : undefined;
        const semesterId = typeof parsedSemester === 'number' &&
            Number.isFinite(parsedSemester) &&
            parsedSemester > 0
            ? parsedSemester
            : undefined;
        return this.timetablesService.list(semesterId, draftsOnly, scenarioRunBasesOnly);
    }
    listEntries(id, courseIdRaw, lecturerUserIdRaw, roomIdRaw) {
        const courseId = courseIdRaw ? Number(courseIdRaw) : undefined;
        const lecturerUserId = lecturerUserIdRaw ? Number(lecturerUserIdRaw) : undefined;
        const roomId = roomIdRaw ? Number(roomIdRaw) : undefined;
        return this.timetablesService.listEntries({
            timetableId: id,
            courseId: Number.isFinite(courseId) ? courseId : undefined,
            lecturerUserId: Number.isFinite(lecturerUserId) ? lecturerUserId : undefined,
            roomId: Number.isFinite(roomId) ? roomId : undefined,
        });
    }
    listConflicts(id) {
        return this.timetablesService.getTimetableConflictSummary(id);
    }
    schedulePayload(id) {
        return this.timetablesService.buildSchedulePayload(id);
    }
    replaceSchedulePayload(id, body) {
        return this.timetablesService.replaceScheduleFromPayload(id, body?.schedule);
    }
    publishDraft(id, body) {
        return this.timetablesService.publishDraftTimetable(id, {
            academicYear: body?.academicYear,
            semesterType: body?.semesterType,
            acknowledgedHardConflicts: body?.acknowledgedHardConflicts,
        });
    }
};
exports.TimetablesController = TimetablesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('semesterId')),
    __param(1, (0, common_1.Query)('draftsOnly')),
    __param(2, (0, common_1.Query)('scenarioRunBasesOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], TimetablesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id/entries'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('courseId')),
    __param(2, (0, common_1.Query)('lecturerUserId')),
    __param(3, (0, common_1.Query)('roomId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String, String]),
    __metadata("design:returntype", void 0)
], TimetablesController.prototype, "listEntries", null);
__decorate([
    (0, common_1.Get)(':id/conflicts'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TimetablesController.prototype, "listConflicts", null);
__decorate([
    (0, common_1.Get)(':id/schedule-payload'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TimetablesController.prototype, "schedulePayload", null);
__decorate([
    (0, common_1.Put)(':id/schedule-payload'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], TimetablesController.prototype, "replaceSchedulePayload", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, publish_draft_dto_1.PublishDraftDto]),
    __metadata("design:returntype", void 0)
], TimetablesController.prototype, "publishDraft", null);
exports.TimetablesController = TimetablesController = __decorate([
    (0, common_1.Controller)('timetables'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.LECTURER),
    __metadata("design:paramtypes", [timetables_service_1.TimetablesService])
], TimetablesController);
//# sourceMappingURL=timetables.controller.js.map