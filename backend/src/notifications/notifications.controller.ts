import {
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService, type NotificationListFilter } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN, Role.LECTURER)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('filter') filterRaw?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    let filter: NotificationListFilter = 'all';
    if (filterRaw === 'unread' || filterRaw === 'read') filter = filterRaw;
    return this.notifications.listForUser(user.user_id, {
      filter,
      page: pageRaw ? Number(pageRaw) : 1,
      pageSize: pageSizeRaw ? Number(pageSizeRaw) : 20,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: User) {
    return this.notifications.unreadCountForUser(user.user_id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user.user_id);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(user.user_id, id);
  }

  @Patch(':id/unread')
  markUnread(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markUnread(user.user_id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.deleteForUser(user.user_id, id);
  }
}
