import type { User } from "@prisma/client";
import { NotificationsService } from "./notifications.service";
export declare class NotificationsController {
    private readonly notifications;
    constructor(notifications: NotificationsService);
    list(user: User, filterRaw?: string, pageRaw?: string, pageSizeRaw?: string): Promise<{
        items: {
            notificationId: number;
            messageTitle: string;
            message: string;
            isRead: boolean;
            createdAt: string;
        }[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;
    unreadCount(user: User): Promise<{
        count: number;
    }>;
    markAllRead(user: User): Promise<{
        ok: boolean;
    }>;
    markRead(user: User, id: number): Promise<{
        ok: boolean;
    }>;
    markUnread(user: User, id: number): Promise<{
        ok: boolean;
    }>;
    remove(user: User, id: number): Promise<{
        ok: boolean;
    }>;
}
