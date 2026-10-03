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

const integration = process.env.DATABASE_URL ? describe : describe.skip;
const actorId = '00000000-0000-4000-8000-000000000099';

function assertSafeIntegrationDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(url.hostname)) {
    throw new Error('Patient integration tests require a local PostgreSQL DATABASE_URL.');
  }
}

integration('patient API with PostgreSQL', () => {
  const tenantIds = [crypto.randomUUID(), crypto.randomUUID()];
  const headers = (tenantId: string, withActor = true) => ({
    'content-type': 'application/json',
    'x-tenant-id': tenantId,
    ...(withActor ? { 'x-actor-id': actorId } : {}),
  });
  const post = (tenantId: string, body: unknown, withActor = true) => app.request('/api/patients', { method: 'POST', headers: headers(tenantId, withActor), body: JSON.stringify(body) });
  const put = (tenantId: string, id: string, body: unknown, withActor = true) => app.request(`/api/patients/${id}`, { method: 'PUT', headers: headers(tenantId, withActor), body: JSON.stringify(body) });

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString('base64');
    process.env.SEARCH_HMAC_KEY ??= Buffer.alloc(32, 2).toString('base64');
    await migrateDatabase();
    await connectPostgresDatabase();
    await getDatabase().insert(tenants).values(tenantIds.map((id) => ({ id, name: `Patient test ${id}` })));
  });

  afterAll(async () => {
    const database = getDatabase();
    await database.delete(patientPendingOperations).where(inArray(patientPendingOperations.tenantId, tenantIds));
    await database.delete(patients).where(inArray(patients.tenantId, tenantIds));
    await database.delete(tenants).where(inArray(tenants.id, tenantIds));
    await closeDatabase();
  });

  it('supports CRUD/search while returning protected fields only with an actor context', async () => {
    const [tenantId] = tenantIds;
    const created = await post(tenantId!, { fullName: 'Ana Exemplo', email: 'ANA@example.com', phone: '+55 (11) 99999-0000', cpf: '123.456.789-01', notes: 'sensível' }, false);
    expect(created.status).toBe(201);
    const redacted = await created.json() as Record<string, unknown>;
    expect(redacted).toMatchObject({ fullName: 'Ana Exemplo', email: null, phone: null, cpf: null, notes: null });
    expect(JSON.stringify(redacted)).not.toContain('Ciphertext');

    const id = redacted.id as string;
    const detail = await app.request(`/api/patients/${id}`, { headers: headers(tenantId!) });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ email: 'ana@example.com', phone: '5511999990000', cpf: '12345678901', notes: 'sensível' });

    const search = await app.request('/api/patients?query=ana@example.com', { headers: headers(tenantId!) });
    expect(search.status).toBe(200);
    expect(await search.json()).toHaveLength(1);

    const updated = await put(tenantId!, id, { fullName: 'Ana Atualizada', phone: '5511888887777' }, false);
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ fullName: 'Ana Atualizada', phone: null });
    const updatedDetail = await app.request(`/api/patients/${id}`, { headers: headers(tenantId!) });
    expect(await updatedDetail.json()).toMatchObject({ fullName: 'Ana Atualizada', email: 'ana@example.com', phone: '5511888887777' });
  });

  it('rejects active duplicate email, phone, and CPF per tenant', async () => {
    const tenantId = tenantIds[0]!;
    for (const [field, value] of [['email', 'duplicate@example.com'], ['phone', '5511999991111'], ['cpf', '987.654.321-00']] as const) {
      expect((await post(tenantId, { fullName: `Base ${field}`, [field]: value })).status).toBe(201);
      const duplicate = await post(tenantId, { fullName: `Duplicate ${field}`, [field]: value });
      expect(duplicate.status).toBe(409);
    }
  });

  it('isolates tenants, validates tenant headers, and allows reuse after soft delete', async () => {
    const [tenantA, tenantB] = tenantIds;
    const created = await post(tenantA!, { fullName: 'Isolated', email: 'reuse@example.com', phone: '5511999992222', cpf: '111.222.333-44' });
    const id = (await created.json() as { id: string }).id;
    expect((await app.request(`/api/patients/${id}`, { headers: headers(tenantB!) })).status).toBe(404);
    expect((await app.request('/api/patients', { headers: { 'x-tenant-id': 'not-a-uuid' } })).status).toBe(400);

    const deleted = await app.request(`/api/patients/${id}`, { method: 'DELETE', headers: headers(tenantA!) });
    expect(deleted.status).toBe(200);
    expect((await app.request(`/api/patients/${id}`, { headers: headers(tenantA!) })).status).toBe(404);
    expect((await post(tenantA!, { fullName: 'Reused', email: 'REUSE@example.com', phone: '5511999992222', cpf: '11122233344' })).status).toBe(201);
    expect((await post(tenantB!, { fullName: 'Other tenant', email: 'reuse@example.com' })).status).toBe(201);
  });

  it('blocks deactivation when a relational pending operation exists', async () => {
    const tenantId = tenantIds[1]!;
    const created = await post(tenantId, { fullName: 'Pending', email: 'pending@example.com' });
    const id = (await created.json() as { id: string }).id;
    const [pending] = await getDatabase().insert(patientPendingOperations).values({ tenantId, patientId: id, kind: 'followup' }).returning();
    const blocked = await app.request(`/api/patients/${id}`, { method: 'DELETE', headers: headers(tenantId) });
    expect(blocked.status).toBe(409);
    await getDatabase().update(patientPendingOperations).set({ resolvedAt: new Date() }).where(and(eq(patientPendingOperations.id, pending!.id), eq(patientPendingOperations.tenantId, tenantId)));
    expect((await app.request(`/api/patients/${id}`, { method: 'DELETE', headers: headers(tenantId) })).status).toBe(200);
  });
});
