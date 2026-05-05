// Integration tests for What-If scenario CRUD flow on the full app and database.
import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { createApp, getAdminToken } from './helpers/setup';

jest.setTimeout(120000);

describe('What-If scenarios (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let createdScenarioId: number;
  let baseTimetableId: number;
  const testName = `e2e-scenario-${Date.now()}`;

  beforeAll(async () => {
    app = await createApp();
    adminToken = (await getAdminToken(app)).accessToken;
    const timetablesRes = await request(app.getHttpServer())
      .get('/api/v1/timetables')
      .set('Authorization', `Bearer ${adminToken}`);
    baseTimetableId = timetablesRes.body?.[0]?.timetableId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/what-if/scenarios returns an array for admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/what-if/scenarios')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('GET /api/v1/what-if/scenarios with no token returns 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/what-if/scenarios').expect(401);
  });

  it('POST /api/v1/what-if/scenarios with valid name returns created scenario', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/what-if/scenarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: testName,
        description: 'Created by automated e2e tests',
      });
    expect(response.status).toBe(201);
    expect(response.body?.scenario_id ?? response.body?.id).toEqual(expect.any(Number));
    createdScenarioId = response.body?.scenario_id ?? response.body?.id;
  });

  it('POST /api/v1/what-if/scenarios/:id/run without conditions returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/what-if/scenarios/${createdScenarioId}/run`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ timetableIds: [baseTimetableId] });
    expect(response.status).toBe(400);
  });

  it('POST /api/v1/what-if/scenarios/:id/run with unknown timetable id returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/what-if/scenarios/${createdScenarioId}/run`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ timetableIds: [999999999] });
    expect(response.status).toBe(400);
  });

  it('POST /api/v1/what-if/compare with empty runIds returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/what-if/compare')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'before_after', runIds: [] });
    expect(response.status).toBe(400);
  });

  it('GET /api/v1/what-if/scenarios/:id returns the created scenario', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/what-if/scenarios/${createdScenarioId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body?.scenario_id ?? response.body?.id).toBe(createdScenarioId);
  });

  it('PATCH /api/v1/what-if/scenarios/:id updates the name', async () => {
    const updatedName = `${testName}-updated`;
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/what-if/scenarios/${createdScenarioId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: updatedName });
    expect(response.status).toBe(200);
    expect(response.body?.name).toBe(updatedName);
  });

  it('POST /api/v1/what-if/scenarios/:id/clone returns a new scenario id', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/what-if/scenarios/${createdScenarioId}/clone`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(response.status).toBe(201);
    const clonedId = response.body?.scenario_id ?? response.body?.id;
    expect(clonedId).toEqual(expect.any(Number));
    expect(clonedId).not.toBe(createdScenarioId);
  });

  it('DELETE /api/v1/what-if/scenarios/:id deletes scenario', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/what-if/scenarios/${createdScenarioId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(response.status);
  });

  it('GET /api/v1/what-if/scenarios/:id after delete returns 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/what-if/scenarios/${createdScenarioId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('DELETE /api/v1/what-if/scenarios/:id with invalid id returns 404', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/what-if/scenarios/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
