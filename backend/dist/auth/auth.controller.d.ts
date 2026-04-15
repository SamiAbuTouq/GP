import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
interface AccessTokenResponse {
    access_token: string;
    requires_password_change: boolean;
}
export declare class AuthController {
    private readonly authService;
    private readonly configService;
    private readonly isProduction;
    private readonly refreshTokenMaxAge;
    constructor(authService: AuthService, configService: ConfigService);
    login(dto: LoginDto, res: Response): Promise<AccessTokenResponse>;
    refresh(req: Request, res: Response): Promise<AccessTokenResponse>;
    logout(user: User, res: Response): Promise<void>;
    check(user: User): Promise<{
        valid: boolean;
        user: {
            id: number;
            email: string;
            role: string;
            requires_password_change: boolean;
        };
    }>;
    private setRefreshTokenCookie;
    private clearRefreshTokenCookie;
    private parseExpiryToMs;
}
export {};
