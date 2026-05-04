import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { notificationPrefsAllow } from './notification-prefs';

export type NotificationListFilter = 'all' | 'unread' | 'read';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param options.preferenceKey When set, the notification is only created if the user has not disabled this category.
   */
  async createForUser(
    userId: number,
    messageTitle: string,
    message: string,
    options?: { preferenceKey?: string },
  ) {
    if (options?.preferenceKey) {
      const u = await this.prisma.user.findUnique({
        where: { user_id: userId },
        select: { notification_prefs: true },
      });
      if (!u || !notificationPrefsAllow(u.notification_prefs, options.preferenceKey)) {
        return null;
      }
    }
    const title = messageTitle.slice(0, 100);
    return this.prisma.notification.create({
      data: {
        user_id: userId,
        message_title: title,
        message,
        is_read: false,
      },
    });
  }

  async createForManyUsers(userIds: number[], messageTitle: string, message: string) {
    const unique = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
    if (unique.length === 0) return { count: 0 };
    const title = messageTitle.slice(0, 100);
    const res = await this.prisma.notification.createMany({
      data: unique.map((user_id) => ({
        user_id,
        message_title: title,
        message,
        is_read: false,
      })),
    });
    return { count: res.count };
  }

  /**
   * Notify all active admins. When `preferenceKey` is set, only admins who enabled that category receive the notification.
   */
  async notifyAdmins(
    messageTitle: string,
    message: string,
    options?: { exceptUserId?: number; preferenceKey?: string },
  ) {
    const admins = await this.prisma.user.findMany({
      where: {
        role_name: Role.ADMIN,
        is_active: true,
        ...(options?.exceptUserId != null
          ? { user_id: { not: options.exceptUserId } }
          : {}),
      },
      select: { user_id: true, notification_prefs: true },
    });
    const ids = options?.preferenceKey
      ? admins
          .filter((a) => notificationPrefsAllow(a.notification_prefs, options.preferenceKey!))
          .map((a) => a.user_id)
      : admins.map((a) => a.user_id);
    return this.createForManyUsers(ids, messageTitle, message);
  }

  async listForUser(
    userId: number,
    params: { filter?: NotificationListFilter; page?: number; pageSize?: number },
  ) {
    const filter: NotificationListFilter = params.filter ?? 'all';
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const where =
      filter === 'unread'
        ? { user_id: userId, is_read: false }
        : filter === 'read'
          ? { user_id: userId, is_read: true }
          : { user_id: userId };

    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          notification_id: true,
          message_title: true,
          message: true,
          is_read: true,
          created_at: true,
        },
      }),
    ]);

    return {
      items: rows.map((r) => ({
        notificationId: r.notification_id,
        messageTitle: r.message_title,
        message: r.message,
        isRead: r.is_read,
        createdAt: r.created_at.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async unreadCountForUser(userId: number) {
    const count = await this.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
    return { count };
  }

  async markRead(userId: number, notificationId: number) {
    const row = await this.prisma.notification.findFirst({
      where: { notification_id: notificationId, user_id: userId },
    });
    if (!row) throw new NotFoundException('Notification not found');
    await this.prisma.notification.update({
      where: { notification_id: notificationId },
      data: { is_read: true },
    });
    return { ok: true };
  }

  async markUnread(userId: number, notificationId: number) {
    const row = await this.prisma.notification.findFirst({
      where: { notification_id: notificationId, user_id: userId },
    });
    if (!row) throw new NotFoundException('Notification not found');
    await this.prisma.notification.update({
      where: { notification_id: notificationId },
      data: { is_read: false },
    });
    return { ok: true };
  }

  async markAllRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
    return { ok: true };
  }

  async deleteForUser(userId: number, notificationId: number) {
    const row = await this.prisma.notification.findFirst({
      where: { notification_id: notificationId, user_id: userId },
    });
    if (!row) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({
      where: { notification_id: notificationId },
    });
    return { ok: true };
  }

  async recentForUser(userId: number, take: number) {
    const rows = await this.prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take,
      select: {
        notification_id: true,
        message_title: true,
        message: true,
        is_read: true,
        created_at: true,
      },
    });
    return rows.map((r) => ({
      notificationId: r.notification_id,
      messageTitle: r.message_title,
      message: r.message,
      isRead: r.is_read,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
