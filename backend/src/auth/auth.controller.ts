import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

// Response type for login/refresh (only access_token in body)
interface AccessTokenResponse {
  access_token: string;
}

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;
  private readonly refreshTokenMaxAge: number;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = configService.get('NODE_ENV') === 'production';
    // Parse refresh token expiry for cookie maxAge (in milliseconds)
    this.refreshTokenMaxAge = this.parseExpiryToMs(
      configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
  }

  /**
   * POST /auth/login
   * Public — no token required.
   * Sets refresh token in HttpOnly cookie, returns access token in body.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    const tokens = await this.authService.login(dto);

    // Set refresh token in HttpOnly cookie
    this.setRefreshTokenCookie(res, tokens.refresh_token);

    // Only return access token in response body
    return { access_token: tokens.access_token };
  }

  /**
   * POST /auth/refresh
   * Public — reads refresh token from HttpOnly cookie.
   * Returns new access token in body, sets new refresh token in cookie.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponse> {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const tokens = await this.authService.refresh(refreshToken);

    // Set new refresh token in HttpOnly cookie (token rotation)
    this.setRefreshTokenCookie(res, tokens.refresh_token);

    // Only return access token in response body
    return { access_token: tokens.access_token };
  }

  /**
   * POST /auth/logout
   * Protected — requires a valid access token.
   * Revokes all refresh tokens for the authenticated user and clears cookie.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.user_id);

    // Clear the refresh token cookie
    this.clearRefreshTokenCookie(res);
  }

  /**
   * POST /auth/check
   * Protected — validates if current access token is valid.
   * Used by frontend middleware to verify authentication status.
   */
  @UseGuards(JwtAuthGuard)
  @Post('check')
  @HttpCode(HttpStatus.OK)
  async check(@CurrentUser() user: User): Promise<{ valid: boolean; user: { id: number; email: string; role: string } }> {
    return {
      valid: true,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role_name,
      },
    };
  }

  // ─── Cookie Helpers ───────────────────────────────────────────────────────────

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      maxAge: this.refreshTokenMaxAge,
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.cookie('refresh_token', '', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      maxAge: 0,
      path: '/',
    });
  }

  /**
   * Parses a JWT expiry string like "7d", "15m", "1h" into milliseconds.
   */
  private parseExpiryToMs(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000; // default 7 days
    }
  }
}
