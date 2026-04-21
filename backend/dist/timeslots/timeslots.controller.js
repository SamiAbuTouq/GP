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
exports.TimeslotsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const timeslots_service_1 = require("./timeslots.service");
const timeslot_dto_1 = require("./dto/timeslot.dto");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let TimeslotsController = class TimeslotsController {
    constructor(timeslotsService) {
        this.timeslotsService = timeslotsService;
    }
    getLecturerPreferences(user) {
        return this.timeslotsService.getLecturerPreferences(user.user_id);
    }
    updateLecturerPreferences(user, dto) {
        return this.timeslotsService.updateLecturerPreferences(user.user_id, dto.preferences ?? []);
    }
    getLecturerPreferencesForAdmin(userId) {
        return this.timeslotsService.getLecturerPreferencesForAdmin(userId);
    }
    findAll() {
        return this.timeslotsService.findAll();
    }
    findOne(id) {
        return this.timeslotsService.findOne(id);
    }
    create(dto) {
        return this.timeslotsService.create(dto);
    }
    update(id, dto) {
        return this.timeslotsService.update(id, dto);
    }
    remove(id) {
        return this.timeslotsService.remove(id);
    }
};
exports.TimeslotsController = TimeslotsController;
__decorate([
    (0, common_1.Get)('lecturer/preferences'),
    (0, roles_decorator_1.Roles)(client_1.Role.LECTURER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TimeslotsController.prototype, "getLecturerPreferences", null);
__decorate([
    (0, common_1.Put)('lecturer/preferences'),
    (0, roles_decorator_1.Roles)(client_1.Role.LECTURER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, timeslot_dto_1.UpdateLecturerPreferencesDto]),
    __metadata("design:returntype", void 0)
], TimeslotsController.prototype, "updateLecturerPreferences", null);
__decorate([
    (0, common_1.Get)('lecturer/preferences/:userId'),
    __param(0, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TimeslotsController.prototype, "getLecturerPreferencesForAdmin", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TimeslotsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TimeslotsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [timeslot_dto_1.CreateTimeslotDto]),
    __metadata("design:returntype", void 0)
], TimeslotsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, timeslot_dto_1.UpdateTimeslotDto]),
    __metadata("design:returntype", void 0)
], TimeslotsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], TimeslotsController.prototype, "remove", null);
exports.TimeslotsController = TimeslotsController = __decorate([
    (0, common_1.Controller)('timeslots'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [timeslots_service_1.TimeslotsService])
], TimeslotsController);
//# sourceMappingURL=timeslots.controller.js.map