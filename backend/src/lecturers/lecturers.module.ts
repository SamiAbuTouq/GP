import { Module } from "@nestjs/common";
import { LecturersController } from "./lecturers.controller";
import { LecturersService } from "./lecturers.service";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, MailModule, NotificationsModule],
  controllers: [LecturersController],
  providers: [LecturersService],
  exports: [LecturersService],
})
export class LecturersModule {}
