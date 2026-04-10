"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemestersModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const semesters_controller_1 = require("./semesters.controller");
const semesters_service_1 = require("./semesters.service");
let SemestersModule = class SemestersModule {
};
exports.SemestersModule = SemestersModule;
exports.SemestersModule = SemestersModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [semesters_controller_1.SemestersController],
        providers: [semesters_service_1.SemestersService],
        exports: [semesters_service_1.SemestersService],
    })
], SemestersModule);
//# sourceMappingURL=semesters.module.js.map