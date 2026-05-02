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
exports.WhatIfController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const whatif_service_1 = require("./whatif.service");
const whatif_dto_1 = require("./dto/whatif.dto");
let WhatIfController = class WhatIfController {
    constructor(whatIfService) {
        this.whatIfService = whatIfService;
    }
    listScenarios() {
        return this.whatIfService.listScenarios();
    }
    getScenario(id) {
        return this.whatIfService.getScenario(id);
    }
    createScenario(dto) {
        return this.whatIfService.createScenario(dto);
    }
    updateScenario(id, dto) {
        return this.whatIfService.updateScenario(id, dto);
    }
    cloneScenario(id) {
        return this.whatIfService.cloneScenario(id);
    }
    deleteScenario(id, query) {
        return this.whatIfService.deleteScenario(id, query.force);
    }
    listConditions(id) {
        return this.whatIfService.listConditions(id);
    }
    runScenario(id, dto) {
        return this.whatIfService.runScenario(id, dto.timetableIds);
    }
    streamRunProgress(runId, res) {
        return this.whatIfService.streamRunProgress(runId, res);
    }
    getRunStatus(runId) {
        return this.whatIfService.getRunStatus(runId);
    }
    listRuns(id) {
        return this.whatIfService.listRuns(id);
    }
    compare(dto) {
        return this.whatIfService.compare(dto);
    }
    applyScenarioRun(runId, body) {
        return this.whatIfService.applyScenarioRun(runId, body);
    }
    controlScenarioRun(runId, dto) {
        return this.whatIfService.controlRun(runId, dto.action);
    }
    cancelScenarioRun(runId) {
        return this.whatIfService.cancelRun(runId);
    }
};
exports.WhatIfController = WhatIfController;
__decorate([
    (0, common_1.Get)('scenarios'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "listScenarios", null);
__decorate([
    (0, common_1.Get)('scenarios/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "getScenario", null);
__decorate([
    (0, common_1.Post)('scenarios'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [whatif_dto_1.CreateScenarioDto]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "createScenario", null);
__decorate([
    (0, common_1.Patch)('scenarios/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, whatif_dto_1.UpdateScenarioDto]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "updateScenario", null);
__decorate([
    (0, common_1.Post)('scenarios/:id/clone'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "cloneScenario", null);
__decorate([
    (0, common_1.Delete)('scenarios/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, whatif_dto_1.DeleteScenarioQueryDto]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "deleteScenario", null);
__decorate([
    (0, common_1.Get)('scenarios/:id/conditions'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "listConditions", null);
__decorate([
    (0, common_1.Post)('scenarios/:id/run'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, whatif_dto_1.RunScenarioDto]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "runScenario", null);
__decorate([
    (0, common_1.Get)('runs/:runId/stream'),
    __param(0, (0, common_1.Param)('runId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "streamRunProgress", null);
__decorate([
    (0, common_1.Get)('runs/:runId'),
    __param(0, (0, common_1.Param)('runId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "getRunStatus", null);
__decorate([
    (0, common_1.Get)('scenarios/:id/runs'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "listRuns", null);
__decorate([
    (0, common_1.Post)('compare'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [whatif_dto_1.CompareDto]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "compare", null);
__decorate([
    (0, common_1.Post)('runs/:runId/apply'),
    __param(0, (0, common_1.Param)('runId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, whatif_dto_1.ApplyScenarioRunDto]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "applyScenarioRun", null);
__decorate([
    (0, common_1.Post)('runs/:runId/control'),
    __param(0, (0, common_1.Param)('runId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, whatif_dto_1.ControlRunDto]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "controlScenarioRun", null);
__decorate([
    (0, common_1.Post)('runs/:runId/cancel'),
    __param(0, (0, common_1.Param)('runId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], WhatIfController.prototype, "cancelScenarioRun", null);
exports.WhatIfController = WhatIfController = __decorate([
    (0, common_1.Controller)('what-if'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [whatif_service_1.WhatIfService])
], WhatIfController);
//# sourceMappingURL=whatif.controller.js.map