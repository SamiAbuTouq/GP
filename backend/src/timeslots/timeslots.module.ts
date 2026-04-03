import { Module } from '@nestjs/common';
import { TimeslotsController } from './timeslots.controller';
import { TimeslotsService } from './timeslots.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TimeslotsController],
  providers: [TimeslotsService],
  exports: [TimeslotsService],
})
export class TimeslotsModule {}
