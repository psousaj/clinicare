import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { closeDatabase, connectPostgresDatabase, migrateDatabase } from '@clinicare/db';
import { app } from './app';
import { assertSafeIntegrationDatabase, integration } from './integration-support';

integration('GET /api/health with PostgreSQL', () => {
  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    await connectPostgresDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('reports PostgreSQL as connected', async () => {
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      service: 'clinicare-api',
      database: 'connected',
    });
  });
});
