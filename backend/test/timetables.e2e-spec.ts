// Integration tests for Timetables module endpoints with real persisted data.
import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { createApp, getAdminToken, getLecturerToken } from './helpers/setup';

jest.setTimeout(120000);

describe('Timetables (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let lecturerToken: string;
  let timetableId: number;

  beforeAll(async () => {
    app = await createApp();
    adminToken = (await getAdminToken(app)).accessToken;
    lecturerToken = (await getLecturerToken(app)).accessToken;

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/timetables')
      .set('Authorization', `Bearer ${adminToken}`);
    timetableId = listRes.body?.[0]?.timetableId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/timetables returns an array', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/timetables')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('GET /api/v1/timetables?draftsOnly=true returns only drafts', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/timetables?draftsOnly=true')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    for (const row of response.body) {
      expect(row.isDraft).toBe(true);
    }
  });

  it('GET /api/v1/timetables?scenarioRunBasesOnly=true returns only allowed base rows', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/timetables?scenarioRunBasesOnly=true')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    for (const row of response.body) {
      expect(row.canUseAsScenarioBase).toBe(true);
    }
  });

  it('GET /api/v1/timetables/:id/conflicts with valid id returns required fields', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/timetables/${timetableId}/conflicts`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('hardConflictCount');
    expect(
      response.body.needsAcknowledgment ?? response.body.requiresConflictAcknowledgment,
    ).toEqual(expect.any(Boolean));
  });

  it('GET /api/v1/timetables/:id/entries returns an array', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/timetables/${timetableId}/entries`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('GET /api/v1/timetables/:id/conflicts for missing id returns 404', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timetables/999999999/conflicts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('GET /api/v1/timetables/:id/entries for missing id returns 404', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timetables/999999999/entries')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
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

  it('POST /api/v1/timetables/:id/publish with admin invalid body returns 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/timetables/${timetableId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });
});
