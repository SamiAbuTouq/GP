// Unit tests for AuthService expiry parsing behavior in the Auth module.
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

class TestableAuthService extends AuthService {
  public parseExpiryForTest(expiry: string): Date {
    return this.parseExpiry(expiry);
  }
}

describe('AuthService parseExpiry', () => {
  let service: TestableAuthService;

  beforeEach(() => {
    const prisma = { refreshToken: {} } as unknown as PrismaService;
    const users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    } as unknown as UsersService;
    const jwt = {
      verify: jest.fn(),
      signAsync: jest.fn(),
    } as unknown as JwtService;
    const config = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    } as unknown as ConfigService;

    service = new TestableAuthService(prisma, users, jwt, config);
  });

  it('adds 7 days for 7d', () => {
    const now = Date.now();
    const result = service.parseExpiryForTest('7d').getTime();
    expect(result - now).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(result - now).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('adds 15 minutes for 15m', () => {
    const now = Date.now();
    const result = service.parseExpiryForTest('15m').getTime();
    expect(result - now).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);
    expect(result - now).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
  });

  it('adds 1 hour for 1h', () => {
    const now = Date.now();
    const result = service.parseExpiryForTest('1h').getTime();
    expect(result - now).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    expect(result - now).toBeLessThanOrEqual(60 * 60 * 1000 + 1000);
  });

  it('adds 30 seconds for 30s', () => {
    const now = Date.now();
    const result = service.parseExpiryForTest('30s').getTime();
    expect(result - now).toBeGreaterThanOrEqual(30 * 1000 - 1000);
    expect(result - now).toBeLessThanOrEqual(30 * 1000 + 1000);
  });

  it('throws for unsupported format', () => {
    expect(() => service.parseExpiryForTest('2w')).toThrow(
      'Unsupported JWT expiry format: 2w',
    );
  });
});
