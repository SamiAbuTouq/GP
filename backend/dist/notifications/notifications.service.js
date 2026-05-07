"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const notification_prefs_1 = require("./notification-prefs");
const MESSAGE_BODY_MAX = 2000;
let NotificationsService = class NotificationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createForUser(userId, messageTitle, message, options) {
        if (options?.preferenceKey) {
            const u = await this.prisma.user.findUnique({
                where: { user_id: userId },
                select: { notification_prefs: true },
            });
            if (!u ||
                !(0, notification_prefs_1.notificationPrefsAllow)(u.notification_prefs, options.preferenceKey)) {
                return null;
            }
        }
        const title = messageTitle.slice(0, 100);
        const body = message.slice(0, MESSAGE_BODY_MAX);
        return this.prisma.notification.create({
            data: {
                user_id: userId,
                message_title: title,
                message: body,
                is_read: false,
            },
        });
    }
    async createForManyUsers(userIds, messageTitle, message) {
        const unique = [
            ...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)),
        ];
        if (unique.length === 0)
            return { count: 0 };
        const title = messageTitle.slice(0, 100);
        const body = message.slice(0, MESSAGE_BODY_MAX);
        const res = await this.prisma.notification.createMany({
            data: unique.map((user_id) => ({
                user_id,
                message_title: title,
                message: body,
                is_read: false,
            })),
        });
        return { count: res.count };
    }
    async notifyAdmins(messageTitle, message, options) {
        const admins = await this.prisma.user.findMany({
            where: {
                role_name: client_1.Role.ADMIN,
                is_active: true,
                ...(options?.exceptUserId != null
                    ? { user_id: { not: options.exceptUserId } }
                    : {}),
            },
            select: { user_id: true, notification_prefs: true },
        });
        const ids = options?.preferenceKey
            ? admins
                .filter((a) => (0, notification_prefs_1.notificationPrefsAllow)(a.notification_prefs, options.preferenceKey))
                .map((a) => a.user_id)
            : admins.map((a) => a.user_id);
        return this.createForManyUsers(ids, messageTitle, message);
    }
    async listForUser(userId, params) {
        const filter = params.filter ?? "all";
        const page = Math.max(1, Number(params.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
        const where = filter === "unread"
            ? { user_id: userId, is_read: false }
            : filter === "read"
                ? { user_id: userId, is_read: true }
                : { user_id: userId };
        const [total, rows] = await Promise.all([
            this.prisma.notification.count({ where }),
            this.prisma.notification.findMany({
                where,
                orderBy: { created_at: "desc" },
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
    async unreadCountForUser(userId) {
        const count = await this.prisma.notification.count({
            where: { user_id: userId, is_read: false },
        });
        return { count };
    }
    async markRead(userId, notificationId) {
        const row = await this.prisma.notification.findFirst({
            where: { notification_id: notificationId, user_id: userId },
        });
        if (!row)
            throw new common_1.NotFoundException("Notification not found");
        await this.prisma.notification.update({
            where: { notification_id: notificationId },
            data: { is_read: true },
        });
        return { ok: true };
    }
    async markUnread(userId, notificationId) {
        const row = await this.prisma.notification.findFirst({
            where: { notification_id: notificationId, user_id: userId },
        });
        if (!row)
            throw new common_1.NotFoundException("Notification not found");
        await this.prisma.notification.update({
            where: { notification_id: notificationId },
            data: { is_read: false },
        });
        return { ok: true };
    }
    async markAllRead(userId) {
        await this.prisma.notification.updateMany({
            where: { user_id: userId, is_read: false },
            data: { is_read: true },
        });
        return { ok: true };
    }
    async deleteForUser(userId, notificationId) {
        const row = await this.prisma.notification.findFirst({
            where: { notification_id: notificationId, user_id: userId },
        });
        if (!row)
            throw new common_1.NotFoundException("Notification not found");
        await this.prisma.notification.delete({
            where: { notification_id: notificationId },
        });
        return { ok: true };
    }
    async recentForUser(userId, take) {
        const rows = await this.prisma.notification.findMany({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
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
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map