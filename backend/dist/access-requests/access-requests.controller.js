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
exports.AccessRequestsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const public_decorator_1 = require("../common/decorators/public.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const access_requests_service_1 = require("./access-requests.service");
const create_access_request_dto_1 = require("./dto/create-access-request.dto");
const reject_access_request_dto_1 = require("./dto/reject-access-request.dto");
let AccessRequestsController = class AccessRequestsController {
    constructor(service) {
        this.service = service;
    }
    checkEmail(email) {
        if (!email)
            throw new common_1.BadRequestException("email query parameter is required.");
        return this.service.checkEmail(email);
    }
    submit(dto) {
        return this.service.submit(dto);
    }
    list(status) {
        const normalized = String(status ?? "PENDING").toUpperCase();
        if (!["PENDING", "APPROVED", "REJECTED"].includes(normalized)) {
            throw new common_1.BadRequestException("Invalid status.");
        }
        return this.service.listByStatus(normalized);
    }
    approve(id) {
        return this.service.approve(id);
    }
    reject(id, dto) {
        return this.service.reject(id, dto);
    }
};
exports.AccessRequestsController = AccessRequestsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)("check-email"),
    __param(0, (0, common_1.Query)("email")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AccessRequestsController.prototype, "checkEmail", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_access_request_dto_1.CreateAccessRequestDto]),
    __metadata("design:returntype", void 0)
], AccessRequestsController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Query)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AccessRequestsController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(":id/approve"),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AccessRequestsController.prototype, "approve", null);
__decorate([
    (0, common_1.Patch)(":id/reject"),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, reject_access_request_dto_1.RejectAccessRequestDto]),
    __metadata("design:returntype", void 0)
], AccessRequestsController.prototype, "reject", null);
exports.AccessRequestsController = AccessRequestsController = __decorate([
    (0, common_1.Controller)("access-requests"),
    __metadata("design:paramtypes", [access_requests_service_1.AccessRequestsService])
], AccessRequestsController);
//# sourceMappingURL=access-requests.controller.js.map