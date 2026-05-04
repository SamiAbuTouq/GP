import { Module } from '@nestjs/common';
import { TimeslotsController } from './timeslots.controller';
import { TimeslotsService } from './timeslots.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TimeslotsController],
  providers: [TimeslotsService],
  exports: [TimeslotsService],
})
export class TimeslotsModule {}
