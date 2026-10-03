import { describe, expect, it } from 'bun:test';
import { app } from './app';

describe('API contract', () => {
  it('exposes the PostgreSQL health contract', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(process.env.DATABASE_URL ? 200 : 503);
    expect(await response.json()).toMatchObject({ service: 'clinicare-api' });
  });

  it('rejects malformed aggregate identifiers without a database fallback', async () => {
    const response = await app.request('/api/patients/not-a-uuid/history');
    expect(response.status).toBe(404);
  });
});
