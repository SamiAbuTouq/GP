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
exports.LecturersController = void 0;
const common_1 = require("@nestjs/common");
const lecturers_service_1 = require("./lecturers.service");
const lecturer_dto_1 = require("./dto/lecturer.dto");
const public_decorator_1 = require("../common/decorators/public.decorator");
let LecturersController = class LecturersController {
    constructor(lecturersService) {
        this.lecturersService = lecturersService;
    }
    findAll() {
        return this.lecturersService.findAll();
    }
    findOne(id) {
        return this.lecturersService.findOne(id);
    }
    create(dto) {
        return this.lecturersService.create(dto);
    }
    update(id, dto) {
        return this.lecturersService.update(id, dto);
    }
    remove(id) {
        return this.lecturersService.remove(id);
    }
};
exports.LecturersController = LecturersController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LecturersController.prototype, "findAll", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LecturersController.prototype, "findOne", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [lecturer_dto_1.CreateLecturerDto]),
    __metadata("design:returntype", void 0)
], LecturersController.prototype, "create", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, lecturer_dto_1.UpdateLecturerDto]),
    __metadata("design:returntype", void 0)
], LecturersController.prototype, "update", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LecturersController.prototype, "remove", null);
exports.LecturersController = LecturersController = __decorate([
    (0, common_1.Controller)('lecturers'),
    __metadata("design:paramtypes", [lecturers_service_1.LecturersService])
], LecturersController);
//# sourceMappingURL=lecturers.controller.js.map