import { UsersService } from "./users.service";
import { UpdateProfileDto, UpdatePreferencesDto } from "./dto/update-user.dto";
import type { User } from "@prisma/client";
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
}
