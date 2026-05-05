// Integration tests for role-based access control across protected modules.
import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, it, jest } from '@jest/globals';
import request from 'supertest';
import { createApp, getAdminToken, getLecturerToken } from './helpers/setup';

jest.setTimeout(120000);

describe('Roles and guards (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let lecturerToken: string;
  let timetableId: number;

  beforeAll(async () => {
    app = await createApp();
    adminToken = (await getAdminToken(app)).accessToken;
    lecturerToken = (await getLecturerToken(app)).accessToken;

    const timetablesRes = await request(app.getHttpServer())
      .get('/api/v1/timetables')
      .set('Authorization', `Bearer ${adminToken}`);
    timetableId = timetablesRes.body?.[0]?.timetableId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/timetables with no token returns 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/timetables').expect(401);
  });

  it('GET /api/v1/timetables with admin token returns 200', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timetables')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /api/v1/timetables with lecturer token returns 200 (current RBAC)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timetables')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .expect(200);
  });

  it('GET /api/v1/what-if/scenarios with lecturer token returns 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/what-if/scenarios')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .expect(403);
  });

  it('GET /api/v1/what-if/scenarios with admin token returns 200', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/what-if/scenarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /api/v1/timeslots/lecturer/preferences with lecturer token returns 200', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timeslots/lecturer/preferences')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .expect(200);
  });

  it('GET /api/v1/timeslots/lecturer/preferences with no token returns 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timeslots/lecturer/preferences')
      .expect(401);
  });

  it('POST /api/v1/timetables/:id/publish with lecturer token returns 403', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/timetables/${timetableId}/publish`)
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({
        academicYear: '2025-2026',
        semesterType: 1,
        acknowledgedHardConflicts: true,
      })
      .expect(403);
  });

  it('POST /api/v1/what-if/scenarios with lecturer token returns 403', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/what-if/scenarios')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({ name: `lecturer-forbidden-${Date.now()}` })
      .expect(403);
  });
});
