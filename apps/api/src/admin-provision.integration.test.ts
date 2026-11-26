import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { authAccounts, authUsers, closeDatabase, connectPostgresDatabase, getDatabase, migrateDatabase, tenants, userTenantMemberships } from '@clinicare/db';
import { app } from './app';
import { provisionClinic } from './admin-commands';
import { assertSafeIntegrationDatabase, integration } from './integration-support';

integration('clinic administrator provisioning with PostgreSQL', () => {
  const tenantIds: string[] = [];
  const originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    process.env.BETTER_AUTH_SECRET ??= 'clinicare-provision-integration-secret';
    await migrateDatabase();
    await connectPostgresDatabase();
  });

  afterAll(async () => {
    const db = getDatabase();
    if (tenantIds.length) {
      const users = await db.select({ id: userTenantMemberships.userId }).from(userTenantMemberships)
        .where(inArray(userTenantMemberships.tenantId, tenantIds));
      for (const { id } of users) {
        await db.delete(userTenantMemberships).where(eq(userTenantMemberships.userId, id));
        await db.delete(authAccounts).where(eq(authAccounts.userId, id));
        await db.delete(authUsers).where(eq(authUsers.id, id));
      }
      await db.delete(tenants).where(inArray(tenants.id, tenantIds));
    }
    await closeDatabase();
    if (originalBetterAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret;
  });

  it('provisions one active tenant and its administrator, stores only a password hash, and allows login', async () => {
    const email = `provision-${crypto.randomUUID()}@example.test`;
    const password = 'clinic-integration-password';
    const result = await provisionClinic({
      clinicName: 'Clínica de integração',
      administratorName: 'Ana Integração',
      email,
      password,
    });
    tenantIds.push(result.tenant.id);

    expect(result.tenant).toMatchObject({ name: 'Clínica de integração', active: true });
    expect(result.administrator).toMatchObject({ name: 'Ana Integração', email });

    const db = getDatabase();
    const rows = await db.select({ user: authUsers, tenantId: userTenantMemberships.tenantId }).from(authUsers)
      .innerJoin(userTenantMemberships, eq(userTenantMemberships.userId, authUsers.id))
      .where(eq(userTenantMemberships.tenantId, result.tenant.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.user.initialPasswordChoice).toBe('pending');
    const accounts = await db.select().from(authAccounts).where(eq(authAccounts.userId, rows[0]!.user.id));
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.password).toBeTruthy();
    expect(accounts[0]!.password).not.toBe(password);

    const login = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
    expect(login.headers.get('set-cookie')).toContain('better-auth.session_token');
  });

  it('rejects a globally duplicated email without leaving an orphan tenant', async () => {
    const email = `provision-duplicate-${crypto.randomUUID()}@example.test`;
    const first = await provisionClinic({
      clinicName: 'Clínica original',
      administratorName: 'Admin original',
      email,
      password: 'clinic-integration-password',
    });
    tenantIds.push(first.tenant.id);
    const duplicateClinicName = `Clínica duplicada ${crypto.randomUUID()}`;

    await expect(provisionClinic({
      clinicName: duplicateClinicName,
      administratorName: 'Admin duplicado',
      email,
      password: 'another-integration-password',
    })).rejects.toThrow();

    const orphanedTenants = await getDatabase().select({ id: tenants.id }).from(tenants).where(eq(tenants.name, duplicateClinicName));
    expect(orphanedTenants).toHaveLength(0);
    expect(await getDatabase().select().from(authUsers).where(eq(authUsers.email, email))).toHaveLength(1);
  });
});
