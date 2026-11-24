import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { authAccounts, authSessions, authUsers, closeDatabase, connectPostgresDatabase, getDatabase, migrateDatabase, patients } from '@clinicare/db';
import { app } from './app';
import { changeClinicAdministratorEmail, provisionClinic, resetClinicAdministratorPassword } from './admin-commands';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration } from './integration-support';

integration('clinic administrator support commands with PostgreSQL', () => {
  const tenantIds: string[] = [];
  const originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET;
  const originalDataEncryptionKey = process.env.DATA_ENCRYPTION_KEY;
  const originalSearchHmacKey = process.env.SEARCH_HMAC_KEY;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    process.env.BETTER_AUTH_SECRET ??= 'clinicare-support-integration-secret';
    process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString('base64');
    process.env.SEARCH_HMAC_KEY ??= Buffer.alloc(32, 2).toString('base64');
    await migrateDatabase();
    await connectPostgresDatabase();
  });

  afterAll(async () => {
    if (tenantIds.length) await getDatabase().delete(patients).where(inArray(patients.tenantId, tenantIds));
    await cleanupIntegrationClinics(tenantIds);
    await closeDatabase();
    if (originalBetterAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret;
    if (originalDataEncryptionKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = originalDataEncryptionKey;
    if (originalSearchHmacKey === undefined) delete process.env.SEARCH_HMAC_KEY;
    else process.env.SEARCH_HMAC_KEY = originalSearchHmacKey;
  });

  async function signIn(email: string, password: string) {
    const response = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return {
      response,
      cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? null,
    };
  }

  it('resets the password, revokes every session, changes email, and rejects a globally used email', async () => {
    const originalEmail = `support-${crypto.randomUUID()}@example.test`;
    const conflictingEmail = `occupied-${crypto.randomUUID()}@example.test`;
    const oldPassword = 'clinic-old-password';
    const resetPassword = 'clinic-reset-password';
    const first = await provisionClinic({
      clinicName: 'Clínica suporte',
      administratorName: 'Admin suporte',
      email: originalEmail,
      password: oldPassword,
    });
    const second = await provisionClinic({
      clinicName: 'Clínica independente',
      administratorName: 'Outro admin',
      email: conflictingEmail,
      password: oldPassword,
    });
    tenantIds.push(first.tenant.id, second.tenant.id);

    const firstDevice = await signIn(originalEmail, oldPassword);
    const secondDevice = await signIn(originalEmail, oldPassword);
    expect(firstDevice.response.status).toBe(200);
    expect(secondDevice.response.status).toBe(200);
    expect(firstDevice.cookie).toBeTruthy();
    expect(secondDevice.cookie).toBeTruthy();
    const patientName = `Paciente reservado ${crypto.randomUUID()}`;
    const patientEmail = `clinical-${crypto.randomUUID()}@example.test`;
    const patientNotes = `Nota clínica ${crypto.randomUUID()}`;
    const patientResponse = await app.request('/api/patients', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: firstDevice.cookie! },
      body: JSON.stringify({ fullName: patientName, email: patientEmail, phone: '5511999991234', notes: patientNotes }),
    });
    expect(patientResponse.status).toBe(201);
    const [user] = await getDatabase().select().from(authUsers).where(eq(authUsers.email, originalEmail));
    expect(await getDatabase().select().from(authSessions).where(eq(authSessions.userId, user!.id))).toHaveLength(2);

    const resetResult = await resetClinicAdministratorPassword(originalEmail, resetPassword);
    expect(JSON.stringify(resetResult)).not.toContain(oldPassword);
    expect(JSON.stringify(resetResult)).not.toContain(resetPassword);
    expect(await getDatabase().select().from(authSessions).where(eq(authSessions.userId, user!.id))).toHaveLength(0);
    for (const cookie of [firstDevice.cookie!, secondDevice.cookie!]) {
      const protectedResponse = await app.request('/api/auth/me', { headers: { cookie } });
      expect(protectedResponse.status).toBe(401);
    }
    expect((await signIn(originalEmail, oldPassword)).response.status).not.toBe(200);
    expect((await signIn(originalEmail, resetPassword)).response.status).toBe(200);

    const [account] = await getDatabase().select().from(authAccounts).where(eq(authAccounts.userId, user!.id));
    expect(account!.password).toBeTruthy();
    expect(account!.password).not.toBe(resetPassword);

    const changedEmail = `  Changed-${crypto.randomUUID()}@example.test `;
    const emailResult = await changeClinicAdministratorEmail(originalEmail, changedEmail);
    const normalizedEmail = changedEmail.trim().toLowerCase();
    expect(emailResult.email).toBe(normalizedEmail);
    const supportOutput = JSON.stringify({ resetResult, emailResult });
    expect(supportOutput).not.toContain(patientName);
    expect(supportOutput).not.toContain(patientEmail);
    expect(supportOutput).not.toContain(patientNotes);
    expect(await getDatabase().select({ id: patients.id }).from(patients).where(eq(patients.tenantId, first.tenant.id))).toHaveLength(1);
    expect(await getDatabase().select().from(authUsers).where(eq(authUsers.email, originalEmail))).toHaveLength(0);
    expect((await signIn(originalEmail, resetPassword)).response.status).not.toBe(200);
    expect((await signIn(normalizedEmail, resetPassword)).response.status).toBe(200);

    await expect(changeClinicAdministratorEmail(normalizedEmail, conflictingEmail)).rejects.toThrow('E-mail já está em uso.');
    expect(await getDatabase().select().from(authUsers).where(eq(authUsers.email, normalizedEmail))).toHaveLength(1);
  });
});
