import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { closeDatabase, getDatabase, getDatabasePool } from './index';
import { migrateDatabase } from './migrate';
import { seedDatabase } from './seed';
import { tenantDefaults, tenants } from './relational-schema';

const integration = process.env.DATABASE_URL ? describe : describe.skip;

function assertSafeIntegrationDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  const localHost = ['localhost', '127.0.0.1', '::1', 'postgres'].includes(url.hostname);
  if (!localHost) {
    throw new Error('Integration tests require a local PostgreSQL DATABASE_URL (localhost, 127.0.0.1, ::1, or postgres).');
  }
}

integration('PostgreSQL persistence seam', () => {
  let tenantId: string;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
  });

  afterAll(async () => {
    if (tenantId) {
      await getDatabase().delete(tenants).where(eq(tenants.id, tenantId));
    }
    await closeDatabase();
  });

  it('creates and retrieves a tenant using Drizzle', async () => {
    tenantId = crypto.randomUUID();
    const database = getDatabase();
    const name = `Integration tenant ${tenantId}`;
    await database.insert(tenants).values({ id: tenantId, name });
    const rows = await database.select().from(tenants).where(eq(tenants.id, tenantId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe(name);
  });

  it('rejects blank tenant names at the database boundary', async () => {
    const id = crypto.randomUUID();
    await expect(getDatabasePool().query('insert into tenants (id, name) values ($1, $2)', [id, '   '])).rejects.toThrow();
  });

  it('seeds the default tenant idempotently', async () => {
    await seedDatabase();
    await seedDatabase();
    const rows = await getDatabase().select().from(tenants).where(eq(tenants.id, tenantDefaults.id));
    expect(rows).toHaveLength(1);
  });
});
