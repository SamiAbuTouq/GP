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
exports.CourseModificationRequestsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const course_modification_requests_service_1 = require("./course-modification-requests.service");
const create_course_modification_request_dto_1 = require("./dto/create-course-modification-request.dto");
const reject_course_modification_request_dto_1 = require("./dto/reject-course-modification-request.dto");
let CourseModificationRequestsController = class CourseModificationRequestsController {
    constructor(service) {
        this.service = service;
    }
    getMyAuthorizedCourses(user) {
        return this.service.getMyAuthorizedCourses(user.user_id);
    }
    getCatalogForLecturer(user) {
        return this.service.getCatalogForLecturer(user.user_id);
    }
    listMine(user) {
        return this.service.listMine(user.user_id);
    }
    submit(user, dto) {
        return this.service.createForLecturer(user.user_id, dto);
    }
    cancelMine(user, id) {
        return this.service.cancelMine(user.user_id, id);
    }
    listForAdmin(status) {
        if (!status)
            return this.service.listForAdmin();
        const normalized = String(status).toUpperCase();
        const valid = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
        if (!valid.includes(normalized)) {
            throw new common_1.BadRequestException("Invalid status.");
        }
        return this.service.listForAdmin(normalized);
    }
    approve(id) {
        return this.service.approveByAdmin(id);
    }
    reject(id, dto) {
        return this.service.rejectByAdmin(id, dto);
    }
};
exports.CourseModificationRequestsController = CourseModificationRequestsController;
__decorate([
    (0, common_1.Get)("me/authorized-courses"),
    (0, roles_decorator_1.Roles)(client_1.Role.LECTURER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CourseModificationRequestsController.prototype, "getMyAuthorizedCourses", null);
__decorate([
    (0, common_1.Get)("me/catalog"),
    (0, roles_decorator_1.Roles)(client_1.Role.LECTURER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CourseModificationRequestsController.prototype, "getCatalogForLecturer", null);
__decorate([
    (0, common_1.Get)("me"),
    (0, roles_decorator_1.Roles)(client_1.Role.LECTURER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CourseModificationRequestsController.prototype, "listMine", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.LECTURER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_course_modification_request_dto_1.CreateCourseModificationRequestDto]),
    __metadata("design:returntype", void 0)
], CourseModificationRequestsController.prototype, "submit", null);
__decorate([
    (0, common_1.Patch)(":id/cancel"),
    (0, roles_decorator_1.Roles)(client_1.Role.LECTURER),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], CourseModificationRequestsController.prototype, "cancelMine", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Query)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CourseModificationRequestsController.prototype, "listForAdmin", null);
__decorate([
    (0, common_1.Patch)(":id/approve"),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CourseModificationRequestsController.prototype, "approve", null);
__decorate([
    (0, common_1.Patch)(":id/reject"),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, reject_course_modification_request_dto_1.RejectCourseModificationRequestDto]),
    __metadata("design:returntype", void 0)
], CourseModificationRequestsController.prototype, "reject", null);
exports.CourseModificationRequestsController = CourseModificationRequestsController = __decorate([
    (0, common_1.Controller)("course-modification-requests"),
    __metadata("design:paramtypes", [course_modification_requests_service_1.CourseModificationRequestsService])
], CourseModificationRequestsController);
//# sourceMappingURL=course-modification-requests.controller.js.map