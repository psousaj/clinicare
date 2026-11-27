import { afterAll, beforeAll, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { authAccounts, authUsers, closeDatabase, connectPostgresDatabase, getDatabase, migrateDatabase, patients, tenants, userTenantMemberships } from '@clinicare/db';
import { app } from './app';
import { getAuth } from './auth';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration } from './integration-support';

integration('clinic onboarding over PostgreSQL', () => {
  let tenantId: string | undefined;
  let userId: string;
  let cookie: string;
  const originalSecret = process.env.BETTER_AUTH_SECRET;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    process.env.BETTER_AUTH_SECRET ??= 'clinicare-onboarding-integration-secret';
    await migrateDatabase();
    await connectPostgresDatabase();
  });

  afterAll(async () => {
    if (tenantId) {
      await getDatabase().delete(patients).where(eq(patients.tenantId, tenantId));
      await cleanupIntegrationClinics([tenantId]);
    }
    if (userId) {
      await getDatabase().delete(authAccounts).where(eq(authAccounts.userId, userId));
      await getDatabase().delete(authUsers).where(eq(authUsers.id, userId));
    }
    await closeDatabase();
    if (originalSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalSecret;
  });

  it('requires confirmed email, validates required fields, and atomically recovers concurrent and repeated submissions', async () => {
    const email = `onboarding-${crypto.randomUUID()}@example.test`;
    const auth = getAuth();
    const context = await auth.$context;
    const created = await context.internalAdapter.createUser({
      id: crypto.randomUUID(), name: 'Onboarding Admin', email, emailVerified: false, image: null,
    }, { method: 'email-password' });
    userId = created.id;
    await context.internalAdapter.linkAccount({
      accountId: userId, providerId: 'credential', userId,
      password: await context.password.hash('onboarding-password-123'),
    });
    const signIn = await app.request('/api/auth/sign-in/email', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.91' },
      body: JSON.stringify({ email, password: 'onboarding-password-123' }),
    });
    expect(signIn.status).toBe(403);
    // This onboarding integration uses a database fixture for a confirmed identity.
    // Real delivery, token consumption, expiration and reuse are covered by the isolated Resend integration suite.
    await getDatabase().update(authUsers).set({ emailVerified: true }).where(eq(authUsers.id, userId));
    const confirmedLogin = await app.request('/api/auth/sign-in/email', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.92' },
      body: JSON.stringify({ email, password: 'onboarding-password-123' }),
    });
    expect(confirmedLogin.status).toBe(200);
    cookie = confirmedLogin.headers.get('set-cookie')!.split(';', 1)[0]!;
    const headers = { cookie, 'content-type': 'application/json' };
    expect(await (await app.request('/api/account/state', { headers })).json()).toMatchObject({ kind: 'onboarding' });
    expect((await app.request('/api/patients', { headers })).status).toBe(403);
    for (const field of ['name', 'cnpj', 'address', 'phone'] as const) {
      const invalid = { name: 'Clínica Retomada', cnpj: '11222333000181', address: 'Rua Teste 10', phone: '11999999999' };
      delete (invalid as Partial<typeof invalid>)[field];
      expect((await app.request('/api/clinics/onboarding', { method: 'POST', headers, body: JSON.stringify(invalid) })).status).toBe(400);
    }
    const payload = { name: 'Clínica Retomada', cnpj: '11.222.333/0001-81', address: 'Rua Teste, 10', phone: '(11) 99999-9999' };
    expect((await app.request('/api/clinics/onboarding', {
      method: 'POST', headers, body: JSON.stringify({ ...payload, cnpj: '12.345.678/0001-90' }),
    })).status).toBe(400);
    expect((await app.request('/api/clinics/onboarding', { method: 'POST', headers, body: JSON.stringify({ ...payload, tenantId: crypto.randomUUID() }) })).status).toBe(400);
    const [first, concurrent] = await Promise.all([
      app.request('/api/clinics/onboarding', { method: 'POST', headers, body: JSON.stringify(payload) }),
      app.request('/api/clinics/onboarding', { method: 'POST', headers, body: JSON.stringify(payload) }),
    ]);
    expect([first.status, concurrent.status].sort()).toEqual([200, 201]);
    const createdResult = (await first.json()) as { tenant: { id: string } };
    tenantId = createdResult.tenant.id;
    expect((await concurrent.json() as { tenant: { id: string } }).tenant.id).toBe(tenantId);
    expect((await app.request('/api/clinics/onboarding', { method: 'POST', headers, body: JSON.stringify(payload) })).status).toBe(200);
    expect((await app.request('/api/clinics/onboarding', {
      method: 'POST', headers, body: JSON.stringify({ ...payload, name: 'Dados alterados no retry' }),
    })).status).toBe(409);
    expect(await getDatabase().select().from(userTenantMemberships).where(eq(userTenantMemberships.userId, userId))).toHaveLength(1);
    expect(await getDatabase().select().from(tenants).where(eq(tenants.id, tenantId))).toMatchObject([
      { name: payload.name, cnpj: '11222333000181', address: payload.address, phone: '11999999999' },
    ]);
    expect(await (await app.request('/api/account/state', { headers })).json()).toMatchObject({ kind: 'clinic' });
    expect(await (await app.request('/api/saas/subscription', { headers })).json()).toMatchObject({ effectivePlan: 'free', subscription: null });
    const clinicResponse = await app.request('/api/patients', { method: 'POST', headers, body: JSON.stringify({ fullName: 'Isolated patient' }) });
    expect(clinicResponse.status).toBe(201);
    await getDatabase().update(authUsers).set({ emailVerified: false }).where(eq(authUsers.id, userId));
    expect(await (await app.request('/api/patients', { headers })).json()).toMatchObject({ code: 'EMAIL_CONFIRMATION_REQUIRED' });
    await getDatabase().update(authUsers).set({ emailVerified: true }).where(eq(authUsers.id, userId));
    await getDatabase().update(tenants).set({ active: false }).where(eq(tenants.id, tenantId));
    expect((await app.request('/api/clinics/onboarding', { method: 'POST', headers, body: JSON.stringify(payload) })).status).toBe(409);
  });
});
