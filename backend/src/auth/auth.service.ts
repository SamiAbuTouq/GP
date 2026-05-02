import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { AuthTokens } from "./interfaces/auth-tokens.interface";
import { JwtPayload } from "./interfaces/jwt-payload.interface";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.usersService.findByEmail(dto.email);

    // Guard: user not found OR has no password hash (e.g. OAuth-only account)
    if (!user || !user.password_hash || !user.is_active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.user_id, tokens.refresh_token);

    this.logger.log(`User ${user.email} logged in`);
    return tokens;
  }
  // ─── Refresh ──────────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(rawRefreshToken, {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // Find all valid (non-revoked, non-expired) tokens for this user
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        user_id: payload.sub,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });

    // Verify the incoming token matches one of the stored hashes
    let matchedToken: (typeof storedTokens)[number] | undefined;

    for (const stored of storedTokens) {
      const isMatch = await bcrypt.compare(rawRefreshToken, stored.token_hash);
      if (isMatch) {
        matchedToken = stored;
        break;
      }
    }

    if (!matchedToken) {
      // Possible token reuse — revoke ALL tokens for this user (security measure)
      await this.revokeAllUserTokens(payload.sub);
      throw new ForbiddenException(
        "Refresh token reuse detected. Please log in again.",
      );
    }

    // Rotate: revoke the used token
    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revoked_at: new Date() },
    });

    const user = await this.usersService.findById(payload.sub);
    if (!user.is_active) {
      await this.revokeAllUserTokens(payload.sub);
      throw new UnauthorizedException("User account is deactivated");
    }
    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.user_id, tokens.refresh_token);

    return tokens;
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  async logout(userId: number): Promise<void> {
    await this.revokeAllUserTokens(userId);
    this.logger.log(`User ${userId} logged out — all tokens revoked`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.user_id,
      email: user.email,
      role: user.role_name,
      requires_password_change: user.must_change_password,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.configService.getOrThrow<string>(
          "JWT_ACCESS_EXPIRES_IN",
        ),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.configService.getOrThrow<string>(
          "JWT_REFRESH_EXPIRES_IN",
        ),
      }),
    ]);

    return {
      access_token,
      refresh_token,
      requires_password_change: user.must_change_password,
    };
  }

  private async storeRefreshToken(
    userId: number,
    rawToken: string,
  ): Promise<void> {
    const saltRounds = +this.configService.get("BCRYPT_SALT_ROUNDS", "12");
    const token_hash = await bcrypt.hash(rawToken, saltRounds);

    const expiresIn = this.configService.getOrThrow<string>(
      "JWT_REFRESH_EXPIRES_IN",
    );
    const expires_at = this.parseExpiry(expiresIn);

    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash,
        expires_at,
      },
    });
  }

  private async revokeAllUserTokens(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  /**
   * Parses a JWT expiry string like "7d", "15m", "1h" into a future Date.
   */
  private parseExpiry(expiry: string): Date {
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
}
