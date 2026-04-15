"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, usersService, jwtService, configService) {
        this.prisma = prisma;
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async login(dto) {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user || !user.password_hash) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
        if (!passwordValid) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const tokens = await this.generateTokens(user);
        await this.storeRefreshToken(user.user_id, tokens.refresh_token);
        this.logger.log(`User ${user.email} logged in`);
        return tokens;
    }
    async refresh(rawRefreshToken) {
        let payload;
        try {
            payload = this.jwtService.verify(rawRefreshToken, {
                secret: this.configService.getOrThrow("JWT_REFRESH_SECRET"),
            });
        }
        catch {
            throw new common_1.UnauthorizedException("Invalid or expired refresh token");
        }
        const storedTokens = await this.prisma.refreshToken.findMany({
            where: {
                user_id: payload.sub,
                revoked_at: null,
                expires_at: { gt: new Date() },
            },
        });
        let matchedToken;
        for (const stored of storedTokens) {
            const isMatch = await bcrypt.compare(rawRefreshToken, stored.token_hash);
            if (isMatch) {
                matchedToken = stored;
                break;
            }
        }
        if (!matchedToken) {
            await this.revokeAllUserTokens(payload.sub);
            throw new common_1.ForbiddenException("Refresh token reuse detected. Please log in again.");
        }
        await this.prisma.refreshToken.update({
            where: { id: matchedToken.id },
            data: { revoked_at: new Date() },
        });
        const user = await this.usersService.findById(payload.sub);
        const tokens = await this.generateTokens(user);
        await this.storeRefreshToken(user.user_id, tokens.refresh_token);
        return tokens;
    }
    async logout(userId) {
        await this.revokeAllUserTokens(userId);
        this.logger.log(`User ${userId} logged out — all tokens revoked`);
    }
    async generateTokens(user) {
        const payload = {
            sub: user.user_id,
            email: user.email,
            role: user.role_name,
            requires_password_change: user.must_change_password,
        };
        const [access_token, refresh_token] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow("JWT_ACCESS_SECRET"),
                expiresIn: this.configService.getOrThrow("JWT_ACCESS_EXPIRES_IN"),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow("JWT_REFRESH_SECRET"),
                expiresIn: this.configService.getOrThrow("JWT_REFRESH_EXPIRES_IN"),
            }),
        ]);
        return {
            access_token,
            refresh_token,
            requires_password_change: user.must_change_password,
        };
    }
    async storeRefreshToken(userId, rawToken) {
        const saltRounds = +this.configService.get("BCRYPT_SALT_ROUNDS", "12");
        const token_hash = await bcrypt.hash(rawToken, saltRounds);
        const expiresIn = this.configService.getOrThrow("JWT_REFRESH_EXPIRES_IN");
        const expires_at = this.parseExpiry(expiresIn);
        await this.prisma.refreshToken.create({
            data: {
                user_id: userId,
                token_hash,
                expires_at,
            },
        });
    }
    async revokeAllUserTokens(userId) {
        await this.prisma.refreshToken.updateMany({
            where: { user_id: userId, revoked_at: null },
            data: { revoked_at: new Date() },
        });
    }
    parseExpiry(expiry) {
        const unit = expiry.slice(-1);
        const value = parseInt(expiry.slice(0, -1), 10);
        const now = new Date();
        switch (unit) {
            case "s":
                now.setSeconds(now.getSeconds() + value);
                break;
            case "m":
                now.setMinutes(now.getMinutes() + value);
                break;
            case "h":
                now.setHours(now.getHours() + value);
                break;
            case "d":
                now.setDate(now.getDate() + value);
                break;
            default:
                throw new Error(`Unsupported JWT expiry format: ${expiry}`);
        }
        return now;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map