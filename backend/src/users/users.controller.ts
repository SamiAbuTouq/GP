import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UpdateProfileDto, UpdatePreferencesDto } from "./dto/update-user.dto";
import type { User } from "@prisma/client";
import { UpdatePasswordDto } from "./dto/update-password.dto";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async getProfile(@CurrentUser() user: User) {
    return this.usersService.getProfile(user.user_id);
  }

  @Patch("me/profile")
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.user_id, updateProfileDto);
  }

  @Patch("me/preferences")
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(
      user.user_id,
      updatePreferencesDto,
    );
  }

  @Patch("me/password")
  async updatePassword(
    @CurrentUser() user: User,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePasswordForUser(user.user_id, dto.new_password);
  }
}
