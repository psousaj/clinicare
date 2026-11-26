import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { closeDatabase, getDatabasePool } from './index';
import { migrateDatabase } from './migrate';

const requiresIntegration = process.env.REQUIRE_MEMBERSHIP_INTEGRATION === '1';
if (requiresIntegration && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the membership PostgreSQL integration test.');
}
const integration = process.env.DATABASE_URL ? describe : describe.skip;

function assertSafeIntegrationDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(url.hostname)) {
    throw new Error('Membership integration tests require a local PostgreSQL database.');
  }
  if (url.pathname.replace(/^\/+/, '') !== 'clinicare') {
    throw new Error('Membership integration tests require the explicitly named clinicare test database.');
  }
}

async function expectSqlState(operation: Promise<unknown>, expectedCode: string) {
  const error = await operation.then(() => null, (reason: unknown) => reason as { code?: string });
  expect(error?.code).toBe(expectedCode);
}

integration('user–tenant membership PostgreSQL integration', () => {
  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('backfills legacy pairs idempotently and supports many-to-many membership with database constraints', async () => {
    const database = getDatabasePool();
    const legacyTenantA = crypto.randomUUID();
    const legacyTenantB = crypto.randomUUID();
    const sharedTenant = crypto.randomUUID();
    const additionalTenant = crypto.randomUUID();
    const legacyUserA = `membership-a-${crypto.randomUUID()}`;
    const legacyUserB = `membership-b-${crypto.randomUUID()}`;
    const legacyUserC = `membership-legacy-write-${crypto.randomUUID()}`;
    const legacyTenantC = crypto.randomUUID();
    const migration = await readFile(new URL('../drizzle/0034_user_tenant_memberships.sql', import.meta.url), 'utf8');

    try {
      await database.query(
        `INSERT INTO tenants (id, name)
         VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8), ($9, $10)`,
        [
          legacyTenantA, `Membership fixture ${legacyTenantA}`,
          legacyTenantB, `Membership fixture ${legacyTenantB}`,
          sharedTenant, `Membership fixture ${sharedTenant}`,
          additionalTenant, `Membership fixture ${additionalTenant}`,
          legacyTenantC, `Membership fixture ${legacyTenantC}`,
        ],
      );
      await database.query(
        `INSERT INTO "user" (id, name, email, tenant_id)
         VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
        [
          legacyUserA, 'Membership fixture A', `${legacyUserA}@example.test`, legacyTenantA,
          legacyUserB, 'Membership fixture B', `${legacyUserB}@example.test`, legacyTenantB,
        ],
      );

      await database.query(migration);
      await database.query(migration);

      const backfilled = await database.query<{ user_id: string; tenant_id: string; role: string }>(
        `SELECT user_id, tenant_id, role FROM user_tenant_memberships
         WHERE user_id = ANY($1::text[]) ORDER BY user_id, tenant_id`,
        [[legacyUserA, legacyUserB]],
      );
      expect(backfilled.rows).toEqual([
        { user_id: legacyUserA, tenant_id: legacyTenantA, role: 'admin' },
        { user_id: legacyUserB, tenant_id: legacyTenantB, role: 'admin' },
      ]);

      // The prior application contract still writes and reads user.tenant_id.
      await database.query(
        `INSERT INTO "user" (id, name, email, tenant_id)
         VALUES ($1, $2, $3, $4)`,
        [legacyUserC, 'Legacy application fixture', `${legacyUserC}@example.test`, legacyTenantC],
      );
      const legacyRead = await database.query<{ id: string; tenant_id: string }>(
        'SELECT id, tenant_id FROM "user" WHERE id = $1',
        [legacyUserC],
      );
      expect(legacyRead.rows).toEqual([{ id: legacyUserC, tenant_id: legacyTenantC }]);

      await database.query(
        `ALTER TABLE user_tenant_memberships
         DROP CONSTRAINT user_tenant_memberships_role_valid,
         DROP CONSTRAINT user_tenant_memberships_pk`,
      );
      await database.query(migration);
      const restoredConstraints = await database.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint
         WHERE conrelid = 'user_tenant_memberships'::regclass
           AND conname = ANY($1::text[])`,
        [['user_tenant_memberships_pk', 'user_tenant_memberships_role_valid']],
      );
      expect(restoredConstraints.rows.map(({ conname }) => conname).sort()).toEqual([
        'user_tenant_memberships_pk',
        'user_tenant_memberships_role_valid',
      ]);

      await database.query(
        `INSERT INTO user_tenant_memberships (user_id, tenant_id)
         VALUES ($1, $2), ($1, $3), ($4, $2)`,
        [legacyUserA, sharedTenant, additionalTenant, legacyUserB],
      );
      const userMembershipCount = await database.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM user_tenant_memberships WHERE user_id = $1',
        [legacyUserA],
      );
      const tenantMembershipCount = await database.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM user_tenant_memberships WHERE tenant_id = $1',
        [sharedTenant],
      );
      expect(userMembershipCount.rows[0]?.count).toBe('3');
      expect(tenantMembershipCount.rows[0]?.count).toBe('2');

      await expectSqlState(
        database.query(
          'INSERT INTO user_tenant_memberships (user_id, tenant_id) VALUES ($1, $2)',
          [legacyUserA, sharedTenant],
        ),
        '23505',
      );
      await expectSqlState(
        database.query(
          'INSERT INTO user_tenant_memberships (user_id, tenant_id) VALUES ($1, $2)',
          [`missing-${crypto.randomUUID()}`, sharedTenant],
        ),
        '23503',
      );
      await expectSqlState(
        database.query(
          'INSERT INTO user_tenant_memberships (user_id, tenant_id) VALUES ($1, $2)',
          [legacyUserA, crypto.randomUUID()],
        ),
        '23503',
      );
      await expectSqlState(
        database.query(
          'INSERT INTO user_tenant_memberships (user_id, tenant_id, role) VALUES ($1, $2, $3)',
          [legacyUserA, sharedTenant, 'owner'],
        ),
        '23514',
      );

      const legacyConstraint = await database.query(
        `SELECT 1 FROM pg_constraint
         WHERE conrelid = '"user"'::regclass AND conname = 'user_tenant_id_unique'`,
      );
      expect(legacyConstraint.rowCount).toBe(1);
      expect(await database.query('SELECT 1 FROM "user" WHERE id = ANY($1::text[])', [[legacyUserA, legacyUserB]])).toHaveProperty('rowCount', 2);
    } finally {
      await database.query(
        'DELETE FROM user_tenant_memberships WHERE user_id = ANY($1::text[])',
        [[legacyUserA, legacyUserB, legacyUserC]],
      );
      await database.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[legacyUserA, legacyUserB, legacyUserC]]);
      await database.query(
        'DELETE FROM tenants WHERE id = ANY($1::uuid[])',
        [[legacyTenantA, legacyTenantB, sharedTenant, additionalTenant, legacyTenantC]],
      );
    }
  });
});
