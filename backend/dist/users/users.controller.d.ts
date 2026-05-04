import { UsersService } from "./users.service";
import { UpdateProfileDto, UpdatePreferencesDto } from "./dto/update-user.dto";
import { UpdateNotificationPrefsDto } from "./dto/update-notification-prefs.dto";
import type { User } from "@prisma/client";
import { UpdatePasswordDto } from "./dto/update-password.dto";
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(user: User): Promise<{
        user_id: number;
        email: string;
        first_name: string;
        last_name: string;
        role: import(".prisma/client").$Enums.Role;
        avatar_url: string | null;
        department: string | null;
        theme_preference: string;
        date_format: string;
        time_format: string;
        notification_preferences: Record<string, boolean>;
    }>;
    updateProfile(user: User, updateProfileDto: UpdateProfileDto): Promise<{
        user_id: number;
        email: string;
        first_name: string;
        last_name: string;
        role: import(".prisma/client").$Enums.Role;
        avatar_url: string | null;
    }>;
    updatePreferences(user: User, updatePreferencesDto: UpdatePreferencesDto): Promise<{
        theme_preference: string;
        date_format: string;
        time_format: string;
    }>;
    updateNotificationPreferences(user: User, dto: UpdateNotificationPrefsDto): Promise<{
        notification_preferences: Record<string, boolean>;
    }>;
    updatePassword(user: User, dto: UpdatePasswordDto): Promise<{
        success: boolean;
    }>;
}
