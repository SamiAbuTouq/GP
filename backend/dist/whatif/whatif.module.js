"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatIfModule = void 0;
const common_1 = require("@nestjs/common");
const timetables_module_1 = require("../timetables/timetables.module");
const whatif_controller_1 = require("./whatif.controller");
const whatif_service_1 = require("./whatif.service");
const prisma_module_1 = require("../prisma/prisma.module");
let WhatIfModule = class WhatIfModule {
};
exports.WhatIfModule = WhatIfModule;
exports.WhatIfModule = WhatIfModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, timetables_module_1.TimetablesModule],
        controllers: [whatif_controller_1.WhatIfController],
        providers: [whatif_service_1.WhatIfService],
    })
], WhatIfModule);
//# sourceMappingURL=whatif.module.js.map