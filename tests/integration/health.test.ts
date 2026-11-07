import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@/app';

const app = createApp();

describe('Health', () => {
  it('GET /health reports liveness', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready checks dependencies', async () => {
    const res = await request(app).get('/health/ready').expect(200);
    expect(res.body.checks.database.status).toBe('up');
    expect(res.body.checks.cache.status).toBe('up');
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(res.headers['x-request-id']).toBe(res.body.error.requestId);
  });
});
