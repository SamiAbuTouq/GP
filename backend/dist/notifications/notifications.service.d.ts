import { PrismaService } from '../prisma/prisma.service';
export type NotificationListFilter = 'all' | 'unread' | 'read';
export declare class NotificationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createForUser(userId: number, messageTitle: string, message: string, options?: {
        preferenceKey?: string;
    }): Promise<{
        user_id: number;
        message: string;
        created_at: Date;
        message_title: string;
        is_read: boolean;
        notification_id: number;
    } | null>;
    createForManyUsers(userIds: number[], messageTitle: string, message: string): Promise<{
        count: number;
    }>;
    notifyAdmins(messageTitle: string, message: string, options?: {
        exceptUserId?: number;
        preferenceKey?: string;
    }): Promise<{
        count: number;
    }>;
    listForUser(userId: number, params: {
        filter?: NotificationListFilter;
        page?: number;
        pageSize?: number;
    }): Promise<{
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
    unreadCountForUser(userId: number): Promise<{
        count: number;
    }>;
    markRead(userId: number, notificationId: number): Promise<{
        ok: boolean;
    }>;
    markUnread(userId: number, notificationId: number): Promise<{
        ok: boolean;
    }>;
    markAllRead(userId: number): Promise<{
        ok: boolean;
    }>;
    deleteForUser(userId: number, notificationId: number): Promise<{
        ok: boolean;
    }>;
    recentForUser(userId: number, take: number): Promise<{
        notificationId: number;
        messageTitle: string;
        message: string;
        isRead: boolean;
        createdAt: string;
    }[]>;
}
