import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { authSessions, authUsers, closeDatabase, connectPostgresDatabase, getDatabase, migrateDatabase } from '@clinicare/db';
import { app } from './app';
import { provisionClinic } from './admin-commands';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration } from './integration-support';

integration('clinic administrator account self-service with PostgreSQL', () => {
  const tenantIds: string[] = [];
  const originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    process.env.BETTER_AUTH_SECRET ??= 'clinicare-account-self-service-integration-secret';
    await migrateDatabase();
    await connectPostgresDatabase();
  });

  afterAll(async () => {
    await cleanupIntegrationClinics(tenantIds);
    await closeDatabase();
    if (originalBetterAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret;
  });

  async function signIn(email: string, password: string) {
    const response = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return { response, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? null };
  }

  it('changes the password, invalidates every session, updates email immediately, and enforces global uniqueness', async () => {
    const originalEmail = `self-service-${crypto.randomUUID()}@example.test`;
    const occupiedEmail = `occupied-${crypto.randomUUID()}@example.test`;
    const initialPassword = 'initial-clinic-password';
    const newPassword = 'replacement-clinic-password';
    const clinic = await provisionClinic({
      clinicName: 'Clínica autosserviço',
      administratorName: 'Admin autosserviço',
      email: originalEmail,
      password: initialPassword,
    });
    const otherClinic = await provisionClinic({
      clinicName: 'Clínica e-mail ocupado',
      administratorName: 'Admin e-mail ocupado',
      email: occupiedEmail,
      password: initialPassword,
    });
    tenantIds.push(clinic.tenant.id, otherClinic.tenant.id);

    const firstDevice = await signIn(originalEmail, initialPassword);
    const secondDevice = await signIn(originalEmail, initialPassword);
    expect(firstDevice.response.status).toBe(200);
    expect(secondDevice.response.status).toBe(200);
    expect(firstDevice.cookie).toBeTruthy();
    expect(secondDevice.cookie).toBeTruthy();
    const [user] = await getDatabase().select().from(authUsers).where(eq(authUsers.tenantId, clinic.tenant.id));
    expect(await getDatabase().select().from(authSessions).where(eq(authSessions.userId, user!.id))).toHaveLength(2);

    const rejectedPasswordChange = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: firstDevice.cookie! },
      body: JSON.stringify({ currentPassword: 'incorrect-current-password', newPassword }),
    });
    expect(rejectedPasswordChange.status).toBe(400);
    expect(await getDatabase().select().from(authSessions).where(eq(authSessions.userId, user!.id))).toHaveLength(2);

    const changedPassword = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: firstDevice.cookie! },
      body: JSON.stringify({ currentPassword: initialPassword, newPassword }),
    });
    expect(changedPassword.status).toBe(200);
    expect(await changedPassword.json()).toEqual({ success: true });
    expect(await getDatabase().select().from(authSessions).where(eq(authSessions.userId, user!.id))).toHaveLength(0);
    expect((await getDatabase().select({ initialPasswordChoice: authUsers.initialPasswordChoice }).from(authUsers).where(eq(authUsers.id, user!.id)))[0]!.initialPasswordChoice).toBe('accepted');
    for (const cookie of [firstDevice.cookie!, secondDevice.cookie!]) {
      expect((await app.request('/api/auth/me', { headers: { cookie } })).status).toBe(401);
    }
    expect((await signIn(originalEmail, initialPassword)).response.status).not.toBe(200);
    const afterPasswordChange = await signIn(originalEmail, newPassword);
    expect(afterPasswordChange.response.status).toBe(200);
    expect(afterPasswordChange.cookie).toBeTruthy();

    const changedEmailValue = `  Changed-${crypto.randomUUID()}@example.test `;
    const changedEmail = await app.request('/api/auth/change-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: afterPasswordChange.cookie! },
      body: JSON.stringify({ newEmail: changedEmailValue }),
    });
    const normalizedEmail = changedEmailValue.trim().toLowerCase();
    expect(changedEmail.status).toBe(200);
    expect(await changedEmail.json()).toEqual({ email: normalizedEmail });
    expect(await getDatabase().select().from(authUsers).where(eq(authUsers.email, normalizedEmail))).toHaveLength(1);
    expect(await getDatabase().select().from(authUsers).where(eq(authUsers.email, originalEmail))).toHaveLength(0);
    expect((await signIn(originalEmail, newPassword)).response.status).not.toBe(200);
    expect((await signIn(normalizedEmail, newPassword)).response.status).toBe(200);

    const duplicate = await app.request('/api/auth/change-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: afterPasswordChange.cookie! },
      body: JSON.stringify({ newEmail: occupiedEmail.toUpperCase() }),
    });
    expect(duplicate.status).toBe(409);
    expect(await getDatabase().select().from(authUsers).where(eq(authUsers.email, normalizedEmail))).toHaveLength(1);
    expect((await getDatabase().select().from(authUsers).where(inArray(authUsers.id, [user!.id, otherClinic.administrator.id])))).toHaveLength(2);
  });

  it('presents a pending initial-password suggestion, persists either choice, and leaves the panel accessible', async () => {
    const email = `initial-choice-${crypto.randomUUID()}@example.test`;
    const clinic = await provisionClinic({
      clinicName: 'Clínica escolha inicial',
      administratorName: 'Admin escolha inicial',
      email,
      password: 'initial-clinic-password',
    });
    tenantIds.push(clinic.tenant.id);
    const login = await signIn(email, 'initial-clinic-password');
    expect(login.response.status).toBe(200);
    const accountBeforeChoice = await app.request('/api/auth/me', { headers: { cookie: login.cookie! } });
    expect((await accountBeforeChoice.json() as any).user.initialPasswordChoice).toBe('pending');

    const declined = await app.request('/api/auth/initial-password-choice', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: login.cookie! },
      body: JSON.stringify({ choice: 'declined' }),
    });
    expect(declined.status).toBe(200);
    expect((await declined.json()).choice).toBe('declined');
    expect((await getDatabase().select({ initialPasswordChoice: authUsers.initialPasswordChoice }).from(authUsers).where(eq(authUsers.tenantId, clinic.tenant.id)))[0]!.initialPasswordChoice).toBe('declined');
    expect((await app.request('/api/auth/me', { headers: { cookie: login.cookie! } })).status).toBe(200);

    const accepted = await app.request('/api/auth/initial-password-choice', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: login.cookie! },
      body: JSON.stringify({ choice: 'accepted' }),
    });
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).choice).toBe('accepted');
    expect((await getDatabase().select({ initialPasswordChoice: authUsers.initialPasswordChoice }).from(authUsers).where(eq(authUsers.tenantId, clinic.tenant.id)))[0]!.initialPasswordChoice).toBe('accepted');
  });
});
