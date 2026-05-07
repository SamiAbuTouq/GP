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
import { AccessRequestStatus, Role } from "@prisma/client";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AccessRequestsService } from "./access-requests.service";
import { CreateAccessRequestDto } from "./dto/create-access-request.dto";
import { RejectAccessRequestDto } from "./dto/reject-access-request.dto";

@Controller("access-requests")
export class AccessRequestsController {
  constructor(private readonly service: AccessRequestsService) {}

  @Public()
  @Get("check-email")
  checkEmail(@Query("email") email?: string) {
    if (!email)
      throw new BadRequestException("email query parameter is required.");
    return this.service.checkEmail(email);
  }

  @Public()
  @Post()
  submit(@Body() dto: CreateAccessRequestDto) {
    return this.service.submit(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  list(@Query("status") status?: string) {
    const normalized = String(status ?? "PENDING").toUpperCase();
    if (!["PENDING", "APPROVED", "REJECTED"].includes(normalized)) {
      throw new BadRequestException("Invalid status.");
    }
    return this.service.listByStatus(normalized as AccessRequestStatus);
  }

  @Patch(":id/approve")
  @Roles(Role.ADMIN)
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.service.approve(id);
  }

  @Patch(":id/reject")
  @Roles(Role.ADMIN)
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectAccessRequestDto,
  ) {
    return this.service.reject(id, dto);
  }
}
