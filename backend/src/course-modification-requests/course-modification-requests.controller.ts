import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CourseModificationRequestStatus, Role, User } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CourseModificationRequestsService } from "./course-modification-requests.service";
import { CreateCourseModificationRequestDto } from "./dto/create-course-modification-request.dto";
import { RejectCourseModificationRequestDto } from "./dto/reject-course-modification-request.dto";

@Controller("course-modification-requests")
export class CourseModificationRequestsController {
  constructor(private readonly service: CourseModificationRequestsService) {}

  @Get("me/authorized-courses")
  @Roles(Role.LECTURER)
  getMyAuthorizedCourses(@CurrentUser() user: User) {
    return this.service.getMyAuthorizedCourses(user.user_id);
  }

  @Get("me/catalog")
  @Roles(Role.LECTURER)
  getCatalogForLecturer(@CurrentUser() user: User) {
    return this.service.getCatalogForLecturer(user.user_id);
  }

  @Get("me")
  @Roles(Role.LECTURER)
  listMine(@CurrentUser() user: User) {
    return this.service.listMine(user.user_id);
  }

  @Post()
  @Roles(Role.LECTURER)
  submit(
    @CurrentUser() user: User,
    @Body() dto: CreateCourseModificationRequestDto,
  ) {
    return this.service.createForLecturer(user.user_id, dto);
  }

  @Patch(":id/cancel")
  @Roles(Role.LECTURER)
  cancelMine(@CurrentUser() user: User, @Param("id", ParseIntPipe) id: number) {
    return this.service.cancelMine(user.user_id, id);
  }

  @Get()
  @Roles(Role.ADMIN)
  listForAdmin(@Query("status") status?: string) {
    if (!status) return this.service.listForAdmin();
    const normalized = String(status).toUpperCase();
    const valid = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
    if (!valid.includes(normalized)) {
      throw new BadRequestException("Invalid status.");
    }
    return this.service.listForAdmin(
      normalized as CourseModificationRequestStatus,
    );
  }

  @Patch(":id/approve")
  @Roles(Role.ADMIN)
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.service.approveByAdmin(id);
  }

  @Patch(":id/reject")
  @Roles(Role.ADMIN)
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectCourseModificationRequestDto,
  ) {
    return this.service.rejectByAdmin(id, dto);
  }
}
