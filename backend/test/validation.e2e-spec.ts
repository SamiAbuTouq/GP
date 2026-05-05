// Integration tests for global ValidationPipe and defensive query parsing behavior.
import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { createApp, getAdminToken } from './helpers/setup';

jest.setTimeout(120000);

describe('Validation behavior (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createApp();
    adminToken = (await getAdminToken(app)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/login with unknown field returns 400 forbidden property', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin@university.edu',
      password: 'Admin@123456',
      unknown_field: 'blocked',
    });

    expect(response.status).toBe(400);
    const messageText = JSON.stringify(response.body?.message ?? '');
    expect(messageText.toLowerCase()).toContain('should not exist');
  });

  it('POST /api/v1/auth/login with empty body returns 400', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({}).expect(400);
  });

  it('POST /api/v1/what-if/scenarios with empty body returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/what-if/scenarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('GET /api/v1/timetables?semesterId=not-a-number returns 200', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timetables?semesterId=not-a-number')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /api/v1/timetables?semesterId=-1 returns 200', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timetables?semesterId=-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /api/v1/timetables/abc/conflicts returns 400 (ParseIntPipe)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timetables/abc/conflicts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
