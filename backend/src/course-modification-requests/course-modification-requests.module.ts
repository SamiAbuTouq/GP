import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CourseModificationRequestsController } from "./course-modification-requests.controller";
import { CourseModificationRequestsService } from "./course-modification-requests.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CourseModificationRequestsController],
  providers: [CourseModificationRequestsService],
})
export class CourseModificationRequestsModule {}
