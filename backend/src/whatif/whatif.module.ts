// src/whatif/whatif.module.ts
import { Module } from '@nestjs/common';
import { TimetablesModule } from '../timetables/timetables.module';
import { WhatIfController } from './whatif.controller';
import { WhatIfService } from './whatif.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, TimetablesModule],
  controllers: [WhatIfController],
  providers: [WhatIfService],
})
export class WhatIfModule {}
