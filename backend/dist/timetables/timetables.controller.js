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
const public_decorator_1 = require("../common/decorators/public.decorator");
const timetables_service_1 = require("./timetables.service");
let TimetablesController = class TimetablesController {
    constructor(timetablesService) {
        this.timetablesService = timetablesService;
    }
    list(semesterIdRaw) {
        const semesterId = semesterIdRaw ? Number(semesterIdRaw) : undefined;
        return this.timetablesService.list(Number.isFinite(semesterId) ? semesterId : undefined);
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
};
exports.TimetablesController = TimetablesController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('semesterId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimetablesController.prototype, "list", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id/entries'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('courseId')),
    __param(2, (0, common_1.Query)('lecturerUserId')),
    __param(3, (0, common_1.Query)('roomId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String, String]),
    __metadata("design:returntype", void 0)
], TimetablesController.prototype, "listEntries", null);
exports.TimetablesController = TimetablesController = __decorate([
    (0, common_1.Controller)('timetables'),
    __metadata("design:paramtypes", [timetables_service_1.TimetablesService])
], TimetablesController);
//# sourceMappingURL=timetables.controller.js.map