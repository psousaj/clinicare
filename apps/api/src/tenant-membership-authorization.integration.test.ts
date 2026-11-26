import { afterAll, beforeAll, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { eq, inArray } from 'drizzle-orm';
import {
  authUsers,
  closeDatabase,
  connectPostgresDatabase,
  getDatabase,
  getDatabasePool,
  migrateDatabase,
  patients,
  professionals,
  tenants,
  userTenantMemberships,
} from '@clinicare/db';
import { app } from './app';
import { deactivateTenant } from './admin-commands';
import {
  assertSafeIntegrationDatabase,
  cleanupIntegrationClinics,
  integration,
  provisionIntegrationClinic,
  type IntegrationClinic,
} from './integration-support';

integration('membership-based clinical authorization with PostgreSQL', () => {
  let clinics: IntegrationClinic[] = [];
  const tenantIds = [crypto.randomUUID(), crypto.randomUUID()];
  const clinicIds = () => tenantIds;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    process.env.BETTER_AUTH_SECRET ??= 'clinicare-membership-authorization-secret';
    process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString('base64');
    process.env.SEARCH_HMAC_KEY ??= Buffer.alloc(32, 2).toString('base64');
    await migrateDatabase();
    await connectPostgresDatabase();
    clinics = [
      await provisionIntegrationClinic(app, 'membership-auth-a', tenantIds[0]),
      await provisionIntegrationClinic(app, 'membership-auth-b', tenantIds[1]),
    ];
  });

  afterAll(async () => {
    if (clinicIds().length) {
      await getDatabase().delete(patients).where(inArray(patients.tenantId, clinicIds()));
      await cleanupIntegrationClinics(clinicIds());
    }
    await closeDatabase();
  });

  it('isolates two clinics, rejects unlinked and ambiguous identities, validates professional membership, and blocks inactive clinics', async () => {
    const [clinicA, clinicB] = clinics;
    const patientAResponse = await app.request('/api/patients', {
      method: 'POST',
      headers: clinicA!.headers(),
      body: JSON.stringify({ fullName: 'Membership patient A' }),
    });
    const patientBResponse = await app.request('/api/patients', {
      method: 'POST',
      headers: clinicB!.headers(),
      body: JSON.stringify({ fullName: 'Membership patient B' }),
    });
    expect(patientAResponse.status).toBe(201);
    expect(patientBResponse.status).toBe(201);
    const patientA = await patientAResponse.json() as { id: string };
    const patientB = await patientBResponse.json() as { id: string };

    expect((await app.request(`/api/patients/${patientA.id}`, { headers: clinicB!.headers() })).status).toBe(404);
    expect((await app.request(`/api/patients/${patientA.id}`, {
      method: 'PUT',
      headers: clinicB!.headers(),
      body: JSON.stringify({ fullName: 'Cross-tenant write' }),
    })).status).toBe(404);
    const spoofedTenantWrite = await app.request('/api/patients', {
      method: 'POST',
      headers: clinicA!.headers({ 'x-tenant-id': clinicB!.tenantId }),
      body: JSON.stringify({ fullName: 'Tenant header ignored' }),
    });
    expect(spoofedTenantWrite.status).toBe(201);
    const spoofedPatient = await spoofedTenantWrite.json() as { id: string };
    expect(await getDatabase().select({ tenantId: patients.tenantId }).from(patients).where(eq(patients.id, spoofedPatient.id)))
      .toEqual([{ tenantId: clinicA!.tenantId }]);
    expect((await app.request(`/api/patients/${patientB.id}`, { headers: clinicA!.headers() })).status).toBe(404);

    const [userA] = await getDatabase().select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, clinicA!.email));
    expect(userA).toBeTruthy();
    await getDatabase().delete(userTenantMemberships)
      .where(eq(userTenantMemberships.userId, userA!.id));
    const unlinkedResponse = await app.request('/api/patients', { headers: clinicA!.headers() });
    expect(unlinkedResponse.status).toBe(403);
    expect(await unlinkedResponse.json()).toMatchObject({ code: 'CLINIC_MEMBERSHIP_REQUIRED' });

    await getDatabase().insert(userTenantMemberships).values({
      userId: userA!.id,
      tenantId: clinicA!.tenantId,
      role: 'admin',
    });
    await getDatabase().insert(userTenantMemberships).values({
      userId: userA!.id,
      tenantId: clinicB!.tenantId,
      role: 'admin',
    });
    const ambiguousResponse = await app.request('/api/patients', { headers: clinicA!.headers() });
    expect(ambiguousResponse.status).toBe(409);
    expect(await ambiguousResponse.json()).toMatchObject({ code: 'CLINIC_SELECTION_REQUIRED' });
    await getDatabase().delete(userTenantMemberships)
      .where(eq(userTenantMemberships.userId, userA!.id));
    await getDatabase().insert(userTenantMemberships).values({
      userId: userA!.id,
      tenantId: clinicA!.tenantId,
      role: 'admin',
    });

    expect(await getDatabase().select({ tenantId: userTenantMemberships.tenantId })
      .from(userTenantMemberships)
      .where(eq(userTenantMemberships.userId, userA!.id)))
      .toEqual([{ tenantId: clinicA!.tenantId }]);
    const invalidProfessionalRelation = await getDatabasePool().query(
      `INSERT INTO professionals (tenant_id, user_id, registration_type, registration_number)
       VALUES ($1, $2, 'CRM', '12345')`,
      [clinicB!.tenantId, userA!.id],
    ).then(() => null, (error: { code?: string }) => error);
    expect(invalidProfessionalRelation?.code).toBe('23503');
    const professionalProfile = await app.request('/api/auth/professional-profile', {
      method: 'PUT',
      headers: clinicA!.headers(),
      body: JSON.stringify({
        registrationType: 'CRM',
        registrationNumber: '12345',
        registrationState: 'SP',
      }),
    });
    expect(professionalProfile.status).toBe(200);
    const savedProfessional = await professionalProfile.json() as { id: string };
    const legacyRemovalMigration = await readFile(
      new URL('../../../packages/db/drizzle/0036_remove_legacy_user_tenant.sql', import.meta.url),
      'utf8',
    );
    await getDatabasePool().query(legacyRemovalMigration);
    const updatedProfessionalProfile = await app.request('/api/auth/professional-profile', {
      method: 'PUT',
      headers: clinicA!.headers(),
      body: JSON.stringify({
        registrationType: 'CRM',
        registrationNumber: '54321',
        registrationState: 'SP',
      }),
    });
    expect(updatedProfessionalProfile.status).toBe(200);
    expect(await updatedProfessionalProfile.json()).toMatchObject({
      id: savedProfessional.id,
      registrationNumber: '54321',
    });
    expect(await getDatabase().select({ id: professionals.id, tenantId: professionals.tenantId })
      .from(professionals)
      .where(eq(professionals.id, savedProfessional.id)))
      .toEqual([{ id: savedProfessional.id, tenantId: clinicA!.tenantId }]);

    expect(await getDatabasePool().query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'user' AND column_name = 'tenant_id'`,
    )).toMatchObject({ rowCount: 0 });
    const [membershipUser] = await getDatabase().select({ id: authUsers.id })
      .from(authUsers).where(eq(authUsers.email, clinicA!.email));
    expect(await getDatabase().select({ userId: userTenantMemberships.userId, tenantId: userTenantMemberships.tenantId })
      .from(userTenantMemberships)
      .where(eq(userTenantMemberships.userId, membershipUser!.id)))
      .toContainEqual({ userId: membershipUser!.id, tenantId: clinicA!.tenantId });

    await getDatabase().update(tenants).set({ active: false }).where(eq(tenants.id, clinicB!.tenantId));
    const inactiveSessionResponse = await app.request('/api/patients', { headers: clinicB!.headers() });
    expect(inactiveSessionResponse.status).toBe(403);
    expect(await inactiveSessionResponse.json()).toMatchObject({ code: 'CLINIC_INACTIVE' });
    await deactivateTenant(clinicB!.tenantId);
    const revokedSessionResponse = await app.request('/api/patients', { headers: clinicB!.headers() });
    expect(revokedSessionResponse.status).toBe(401);
    const inactiveLogin = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `192.0.2.${Math.floor(Math.random() * 254) + 1}` },
      body: JSON.stringify({ email: clinicB!.email, password: 'integration-password-123' }),
    });
    expect(inactiveLogin.status).toBe(401);
  });
});
