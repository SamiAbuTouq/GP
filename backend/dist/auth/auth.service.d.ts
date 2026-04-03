import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { AuthTokens } from "./interfaces/auth-tokens.interface";
export declare class AuthService {
    private readonly prisma;
    private readonly usersService;
    private readonly jwtService;
    private readonly configService;
    private readonly logger;
    constructor(prisma: PrismaService, usersService: UsersService, jwtService: JwtService, configService: ConfigService);
    login(dto: LoginDto): Promise<AuthTokens>;
    refresh(rawRefreshToken: string): Promise<AuthTokens>;
    logout(userId: number): Promise<void>;
    private generateTokens;
    private storeRefreshToken;
    private revokeAllUserTokens;
    private parseExpiry;
}
