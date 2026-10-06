import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';
import {
  closeDatabase,
  connectPostgresDatabase,
  getDatabase,
  migrateDatabase,
  patientPendingOperations,
  patients,
  tenants,
} from '@clinicare/db';
import { app } from './app';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';

integration('patient API with PostgreSQL', () => {
  let clinics: IntegrationClinic[];
  const tenantIds = [crypto.randomUUID(), crypto.randomUUID()];
  const clinicIds = () => clinics.map((clinic) => clinic.tenantId);
  const headers = (clinic: IntegrationClinic) => clinic.headers();
  const post = (clinic: IntegrationClinic, body: unknown) => app.request('/api/patients', { method: 'POST', headers: headers(clinic), body: JSON.stringify(body) });
  const put = (clinic: IntegrationClinic, id: string, body: unknown) => app.request(`/api/patients/${id}`, { method: 'PUT', headers: headers(clinic), body: JSON.stringify(body) });

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString('base64');
    process.env.SEARCH_HMAC_KEY ??= Buffer.alloc(32, 2).toString('base64');
    await migrateDatabase();
    await connectPostgresDatabase();
    clinics = [await provisionIntegrationClinic(app, 'patients-a', tenantIds[0]!), await provisionIntegrationClinic(app, 'patients-b', tenantIds[1]!)];
  });

  afterAll(async () => {
    const database = getDatabase();
    await database.delete(patientPendingOperations).where(inArray(patientPendingOperations.tenantId, clinicIds()));
    await database.delete(patients).where(inArray(patients.tenantId, clinicIds()));
    await cleanupIntegrationClinics(clinicIds());
    await closeDatabase();
  });

  it('supports CRUD/search and reveals protected fields to the authenticated clinic session', async () => {
    const [clinic] = clinics;
    const created = await post(clinic!, { fullName: 'Ana Exemplo', email: 'ANA@example.com', phone: '+55 (11) 99999-0000', cpf: '123.456.789-01', notes: 'sensível' });
    expect(created.status).toBe(201);
    const createdPatient = await created.json() as Record<string, unknown>;
    expect(createdPatient).toMatchObject({ fullName: 'Ana Exemplo', email: 'ana@example.com', phone: '5511999990000', cpf: '12345678901', notes: 'sensível' });
    expect(JSON.stringify(createdPatient)).not.toContain('Ciphertext');

    const id = createdPatient.id as string;
    const detail = await app.request(`/api/patients/${id}`, { headers: headers(clinic!) });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ email: 'ana@example.com', phone: '5511999990000', cpf: '12345678901', notes: 'sensível' });

    const history = await app.request(`/api/patients/${id}/history`, { headers: headers(clinic!) });
    expect(history.status).toBe(200);
    expect((await history.json()).patient).toMatchObject({ email: 'ana@example.com', phone: '5511999990000', cpf: '12345678901', notes: 'sensível' });

    const search = await app.request('/api/patients?query=ana@example.com', { headers: headers(clinic!) });
    expect(search.status).toBe(200);
    expect(await search.json()).toHaveLength(1);

    const updated = await put(clinic!, id, { fullName: 'Ana Atualizada', phone: '5511888887777' });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ fullName: 'Ana Atualizada', phone: '5511888887777' });
    const updatedDetail = await app.request(`/api/patients/${id}`, { headers: headers(clinic!) });
    expect(await updatedDetail.json()).toMatchObject({ fullName: 'Ana Atualizada', email: 'ana@example.com', phone: '5511888887777' });
  });

  it('rejects active duplicate email, phone, and CPF per tenant', async () => {
    const clinic = clinics[0]!;
    for (const [field, value] of [['email', 'duplicate@example.com'], ['phone', '5511999991111'], ['cpf', '987.654.321-00']] as const) {
      expect((await post(clinic, { fullName: `Base ${field}`, [field]: value })).status).toBe(201);
      const duplicate = await post(clinic, { fullName: `Duplicate ${field}`, [field]: value });
      expect(duplicate.status).toBe(409);
    }
  });

  it('isolates tenants, validates tenant headers, and allows reuse after soft delete', async () => {
    const [clinicA, clinicB] = clinics;
    const created = await post(clinicA!, { fullName: 'Isolated', email: 'reuse@example.com', phone: '5511999992222', cpf: '111.222.333-44' });
    const id = (await created.json() as { id: string }).id;
    expect((await app.request(`/api/patients/${id}`, { headers: headers(clinicB!) })).status).toBe(404);
    expect((await app.request('/api/patients', { headers: { ...headers(clinicA!), 'x-tenant-id': 'not-a-uuid' } })).status).toBe(200);

    const deleted = await app.request(`/api/patients/${id}`, { method: 'DELETE', headers: headers(clinicA!) });
    expect(deleted.status).toBe(200);
    expect((await app.request(`/api/patients/${id}`, { headers: headers(clinicA!) })).status).toBe(404);
    expect((await post(clinicA!, { fullName: 'Reused', email: 'REUSE@example.com', phone: '5511999992222', cpf: '11122233344' })).status).toBe(201);
    expect((await post(clinicB!, { fullName: 'Other tenant', email: 'reuse@example.com' })).status).toBe(201);
  });

  it('blocks deactivation when a relational pending operation exists', async () => {
    const clinic = clinics[1]!;
    const created = await post(clinic, { fullName: 'Pending', email: 'pending@example.com' });
    const id = (await created.json() as { id: string }).id;
    const [pending] = await getDatabase().insert(patientPendingOperations).values({ tenantId: clinic.tenantId, patientId: id, kind: 'followup' }).returning();
    const blocked = await app.request(`/api/patients/${id}`, { method: 'DELETE', headers: headers(clinic) });
    expect(blocked.status).toBe(409);
    await getDatabase().update(patientPendingOperations).set({ resolvedAt: new Date() }).where(and(eq(patientPendingOperations.id, pending!.id), eq(patientPendingOperations.tenantId, clinic.tenantId)));
    expect((await app.request(`/api/patients/${id}`, { method: 'DELETE', headers: headers(clinic) })).status).toBe(200);
  });
});
