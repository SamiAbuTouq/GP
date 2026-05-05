// Integration tests for the Auth module using the full NestJS app and database.
import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { createApp, getAdminToken } from './helpers/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';

jest.setTimeout(120000);

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let adminEmail: string;
  const adminPasswordCandidates = [
    process.env.TEST_ADMIN_PASSWORD ?? '',
    'Admin@123456',
  ];
  const asCookieList = (header: unknown): string[] => {
    if (Array.isArray(header)) return header.filter((h): h is string => typeof h === 'string');
    if (typeof header === 'string') return [header];
    return [];
  };

  beforeAll(async () => {
    app = await createApp();
    const prisma = app.get(PrismaService);
    const admin = await prisma.user.findFirst({
      where: { role_name: Role.ADMIN, is_active: true },
      orderBy: { user_id: 'asc' },
      select: { email: true },
    });
    adminEmail = admin?.email ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/login with valid credentials returns tokens and refresh cookie', async () => {
    let response: request.Response | undefined;
    for (const password of adminPasswordCandidates) {
      response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password });
      if (response.status === 200) break;
    }

    expect(response?.status).toBe(200);
    expect(response?.body).toHaveProperty('access_token');
    expect(response?.body).toHaveProperty('requires_password_change');
    const setCookie = asCookieList(response?.headers['set-cookie']);
    expect(setCookie.some((c) => c.includes('refresh_token='))).toBe(true);
    expect(setCookie.some((c) => c.toLowerCase().includes('httponly'))).toBe(true);
  });

  it('POST /api/v1/auth/login with wrong password returns 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'DefinitelyWrong@123' });

    expect(response.status).toBe(401);
  });

  it('POST /api/v1/auth/login with missing fields returns 400', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/login').send({});
    expect(response.status).toBe(400);
  });

  it('POST /api/v1/auth/refresh with valid cookie returns a new token and cookie', async () => {
    const tokens = await getAdminToken(app);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', tokens.refreshCookie)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('access_token');
    const setCookie = asCookieList(response.headers['set-cookie']);
    expect(setCookie.some((c) => c.includes('refresh_token='))).toBe(true);
  });

  it('POST /api/v1/auth/refresh with no cookie returns 401 and message', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({});
    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Refresh token not found');
  });

  it('POST /api/v1/auth/check with valid token returns user payload', async () => {
    const tokens = await getAdminToken(app);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/check')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body?.valid).toBe(true);
    expect(response.body?.user).toMatchObject({
      id: expect.any(Number),
      email: expect.any(String),
      role: expect.any(String),
    });
  });

  it('POST /api/v1/auth/check with no token returns 401', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/check').send({});
    expect(response.status).toBe(401);
  });

  it('POST /api/v1/auth/check with malformed token returns 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/check')
      .set('Authorization', 'Bearer definitely-not-a-jwt')
      .send({});
    expect(response.status).toBe(401);
  });

  it('POST /api/v1/auth/refresh with malformed cookie token returns 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=not-a-valid-token')
      .send({});
    expect(response.status).toBe(401);
  });

  it('POST /api/v1/auth/logout with valid token returns 204', async () => {
    const tokens = await getAdminToken(app);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({});
    expect(response.status).toBe(204);
  });

  it('POST /api/v1/auth/refresh after logout with old cookie is rejected', async () => {
    const tokens = await getAdminToken(app);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({})
      .expect(204);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', tokens.refreshCookie)
      .send({});
    expect([401, 403]).toContain(response.status);
  });
});
