import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { closeDatabase, connectPostgresDatabase, migrateDatabase } from '@clinicare/db';
import { app } from './app';

const integration = process.env.DATABASE_URL ? describe : describe.skip;

function assertSafeIntegrationDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  const localHost = ['localhost', '127.0.0.1', '::1', 'postgres'].includes(url.hostname);
  if (!localHost) {
    throw new Error('Integration tests require a local PostgreSQL DATABASE_URL (localhost, 127.0.0.1, ::1, or postgres).');
  }
}

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
