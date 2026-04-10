import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto, UpdatePreferencesDto } from './dto/update-user.dto';
import { ConfigService } from '@nestjs/config';
export declare class UsersService {
    private readonly prisma;
    private readonly configService;
    constructor(prisma: PrismaService, configService: ConfigService);
    private configureCloudinary;
    findById(user_id: number): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    getProfile(userId: number): Promise<{
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
    updateProfile(userId: number, dto: UpdateProfileDto): Promise<{
        user_id: number;
        email: string;
        first_name: string;
        last_name: string;
        role: import(".prisma/client").$Enums.Role;
        avatar_url: string | null;
    }>;
    updatePreferences(userId: number, dto: UpdatePreferencesDto): Promise<{
        theme_preference: string;
        date_format: string;
        time_format: string;
    }>;
}
