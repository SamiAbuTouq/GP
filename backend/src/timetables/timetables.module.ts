import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SemestersModule } from "../semesters/semesters.module";
import { TimetablesController } from "./timetables.controller";
import { TimetablesService } from "./timetables.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, NotificationsModule, SemestersModule],
  controllers: [TimetablesController],
  providers: [TimetablesService],
  exports: [TimetablesService],
})
export class TimetablesModule {}
