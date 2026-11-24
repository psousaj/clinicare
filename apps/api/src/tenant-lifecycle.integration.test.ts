import { afterAll, beforeAll, expect, it } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import {
  appointments,
  appointmentItems,
  attendances,
  authSessions,
  authUsers,
  closeDatabase,
  connectPostgresDatabase,
  followupItems,
  followups,
  getDatabase,
  migrateDatabase,
  patients,
  payments,
  procedures,
  tenants,
} from '@clinicare/db';
import { app } from './app';
import { deactivateTenant, provisionClinic, reactivateTenant } from './admin-commands';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration } from './integration-support';

integration('tenant lifecycle with PostgreSQL', () => {
  const tenantIds: string[] = [];
  const originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET;
  const originalDataEncryptionKey = process.env.DATA_ENCRYPTION_KEY;
  const originalSearchHmacKey = process.env.SEARCH_HMAC_KEY;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    process.env.BETTER_AUTH_SECRET ??= 'clinicare-tenant-lifecycle-secret';
    process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString('base64');
    process.env.SEARCH_HMAC_KEY ??= Buffer.alloc(32, 2).toString('base64');
    await migrateDatabase();
    await connectPostgresDatabase();
  });

  afterAll(async () => {
    if (tenantIds.length) {
      const db = getDatabase();
      await db.delete(attendances).where(inArray(attendances.tenantId, tenantIds));
      await db.delete(appointmentItems).where(inArray(appointmentItems.tenantId, tenantIds));
      await db.delete(appointments).where(inArray(appointments.tenantId, tenantIds));
      await db.delete(payments).where(inArray(payments.tenantId, tenantIds));
      await db.delete(followupItems).where(inArray(followupItems.tenantId, tenantIds));
      await db.delete(followups).where(inArray(followups.tenantId, tenantIds));
      await db.delete(procedures).where(inArray(procedures.tenantId, tenantIds));
      await db.delete(patients).where(inArray(patients.tenantId, tenantIds));
    }
    await cleanupIntegrationClinics(tenantIds);
    await closeDatabase();
    if (originalBetterAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret;
    if (originalDataEncryptionKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = originalDataEncryptionKey;
    if (originalSearchHmacKey === undefined) delete process.env.SEARCH_HMAC_KEY;
    else process.env.SEARCH_HMAC_KEY = originalSearchHmacKey;
  });

  it('blocks inactive tenant login, revokes existing sessions, preserves data, and restores access on reactivation', async () => {
    const email = `lifecycle-${crypto.randomUUID()}@example.test`;
    const password = 'clinic-lifecycle-password';
    const provisioned = await provisionClinic({
      clinicName: 'Clínica ciclo de vida',
      administratorName: 'Admin ciclo de vida',
      email,
      password,
    });
    const tenantId = provisioned.tenant.id;
    tenantIds.push(tenantId);
    expect(provisioned.tenant.active).toBe(true);

    const signIn = async (candidatePassword: string) => app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: candidatePassword }),
    });
    const activeLogin = await signIn(password);
    expect(activeLogin.status).toBe(200);
    const oldCookie = activeLogin.headers.get('set-cookie')?.split(';', 1)[0];
    expect(oldCookie).toBeTruthy();
    const otherDeviceLogin = await signIn(password);
    expect(otherDeviceLogin.status).toBe(200);
    const otherDeviceCookie = otherDeviceLogin.headers.get('set-cookie')?.split(';', 1)[0];
    expect(otherDeviceCookie).toBeTruthy();

    const patientResponse = await app.request('/api/patients', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: oldCookie! },
      body: JSON.stringify({
        fullName: `Paciente preservado ${crypto.randomUUID()}`,
        email: `lifecycle-patient-${crypto.randomUUID()}@example.test`,
        phone: `5511${String(Date.now()).slice(-8)}`,
        notes: 'Histórico clínico preservado durante a desativação.',
      }),
    });
    expect(patientResponse.status).toBe(201);
    const patient = await patientResponse.json() as { id: string; fullName: string; notes: string };
    const db = getDatabase();
    const [procedure] = await db.insert(procedures).values({
      tenantId,
      name: 'Procedimento preservado',
      durationMinutes: 30,
      priceCents: 12000,
      sessionSchema: {},
    }).returning();
    const [followup] = await db.insert(followups).values({
      tenantId,
      patientId: patient.id,
      offerType: 'procedure',
      offerId: procedure!.id,
      offerNameSnapshot: procedure!.name,
      priceCents: 12000,
    }).returning();
    const [followupItem] = await db.insert(followupItems).values({
      tenantId,
      followupId: followup!.id,
      procedureId: procedure!.id,
      procedureName: procedure!.name,
      sessionsTotal: 1,
      durationMinutes: 30,
      priceCents: 12000,
      sessionSchema: {},
    }).returning();
    const [payment] = await db.insert(payments).values({
      tenantId,
      followupId: followup!.id,
      amountCents: 12000,
      method: 'pix',
      idempotencyKey: crypto.randomUUID(),
    }).returning();
    const startsAt = new Date(Date.now() + 86_400_000);
    const [appointment] = await db.insert(appointments).values({
      tenantId,
      patientId: patient.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
    }).returning();
    const [appointmentItem] = await db.insert(appointmentItems).values({
      tenantId,
      appointmentId: appointment!.id,
      followupId: followup!.id,
      followupItemId: followupItem!.id,
      procedureId: procedure!.id,
      procedureName: procedure!.name,
      minutesEach: 30,
    }).returning();
    const [attendance] = await db.insert(attendances).values({
      tenantId,
      patientId: patient.id,
      followupId: followup!.id,
      followupItemId: followupItem!.id,
      appointmentId: appointment!.id,
      procedureId: procedure!.id,
      procedureName: procedure!.name,
      schemaSnapshot: {},
    }).returning();

    const wrongPasswordResponse = await signIn('wrong-password');
    const wrongPasswordBody = await wrongPasswordResponse.json();
    expect(await db.select().from(authSessions).where(eq(authSessions.userId, provisioned.administrator.id))).toHaveLength(2);
    await deactivateTenant(tenantId);

    const protectedWithOldSession = await app.request('/api/auth/me', { headers: { cookie: oldCookie! } });
    expect(protectedWithOldSession.status).toBe(401);
    expect((await app.request('/api/auth/me', { headers: { cookie: otherDeviceCookie! } })).status).toBe(401);
    expect(await getDatabase().select().from(authSessions).where(eq(authSessions.userId, provisioned.administrator.id))).toHaveLength(0);

    const inactiveLogin = await signIn(password);
    expect(inactiveLogin.status).toBe(401);
    expect(await inactiveLogin.json()).toEqual(wrongPasswordBody);
    expect(await db.select().from(authSessions).where(eq(authSessions.userId, provisioned.administrator.id))).toHaveLength(0);

    expect(await db.select().from(tenants).where(eq(tenants.id, tenantId))).toMatchObject([{ active: false }]);
    expect(await db.select().from(authUsers).where(eq(authUsers.tenantId, tenantId))).toHaveLength(1);
    expect(await db.select({ id: patients.id }).from(patients).where(eq(patients.id, patient.id))).toHaveLength(1);
    expect(await db.select({ id: followups.id }).from(followups).where(eq(followups.id, followup!.id))).toHaveLength(1);
    expect(await db.select({ id: payments.id }).from(payments).where(eq(payments.id, payment!.id))).toHaveLength(1);
    expect(await db.select({ status: appointments.status }).from(appointments).where(eq(appointments.id, appointment!.id))).toMatchObject([{ status: 'planned' }]);
    expect(await db.select({ id: appointmentItems.id }).from(appointmentItems).where(eq(appointmentItems.id, appointmentItem!.id))).toHaveLength(1);
    expect(await db.select({ status: attendances.status }).from(attendances).where(eq(attendances.id, attendance!.id))).toMatchObject([{ status: 'performed' }]);

    await reactivateTenant(tenantId);
    expect((await app.request('/api/auth/me', { headers: { cookie: oldCookie! } })).status).toBe(401);
    expect((await app.request('/api/auth/me', { headers: { cookie: otherDeviceCookie! } })).status).toBe(401);
    const reactivatedLogin = await signIn(password);
    expect(reactivatedLogin.status).toBe(200);
    const newCookie = reactivatedLogin.headers.get('set-cookie')?.split(';', 1)[0];
    expect(newCookie).toBeTruthy();
    const restoredPatient = await app.request(`/api/patients/${patient.id}`, { headers: { cookie: newCookie! } });
    expect(restoredPatient.status).toBe(200);
    expect(await restoredPatient.json()).toMatchObject({ fullName: patient.fullName, notes: patient.notes });
  });
});
