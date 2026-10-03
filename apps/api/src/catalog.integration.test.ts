import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { app } from './app';
import { closeDatabase, getDatabase, migrateDatabase, tenants, procedures, procedureVersions, anamneses, anamnesisVersions, anamnesisProcedures, combos, comboItems, contracts, contractVersions, plans, planVersions, planVersionItems, planVersionContracts } from '@clinicare/db';

const integration = process.env.DATABASE_URL ? describe : describe.skip;
const localHosts = ['localhost', '127.0.0.1', '::1', 'postgres'];
const tenantIds = [crypto.randomUUID(), crypto.randomUUID()];
const headers = (tenantId: string) => ({ 'content-type': 'application/json', 'x-tenant-id': tenantId });
const request = (tenantId: string, path: string, method = 'GET', body?: unknown) => app.request(path, { method, headers: headers(tenantId), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const schema = { type: 'object', properties: { pain: { type: 'string' } } };

integration('catalog API with PostgreSQL', () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!localHosts.includes(url.hostname)) throw new Error('Catalog integration tests require local PostgreSQL DATABASE_URL.');
    await migrateDatabase();
    await getDatabase().insert(tenants).values(tenantIds.map((id) => ({ id, name: `Catalog test ${id}` })));
  });
  afterAll(async () => {
    const db = getDatabase();
    for (const table of [planVersionItems, planVersionContracts, planVersions, plans, contractVersions, contracts, comboItems, combos, anamnesisProcedures, anamnesisVersions, anamneses, procedureVersions, procedures]) await db.delete(table).where(inArray((table as any).tenantId, tenantIds));
    await db.delete(tenants).where(inArray(tenants.id, tenantIds));
    await closeDatabase();
  });

  it('supports procedure, anamnesis, combo, contract and procedure-only plan CRUD', async () => {
    const [a, b] = tenantIds;
    const procedureResponse = await request(a!, '/api/procedures', 'POST', { name: 'Catalog procedure', durationMinutes: 60, priceCents: 1000, sessionSchema: schema });
    expect(procedureResponse.status).toBe(201); const procedure = await procedureResponse.json() as any;
    expect(await (await request(b!, '/api/procedures')).json()).toHaveLength(0);
    const procedureUpdate = await request(a!, `/api/procedures/${procedure.id}`, 'PUT', { description: 'updated' });
    expect(procedureUpdate.status).toBe(200);
    const anamnesisResponse = await request(a!, '/api/anamneses', 'POST', { title: 'Catalog form', schema, procedureIds: [procedure.id] });
    expect(anamnesisResponse.status).toBe(201); const anamnesis = await anamnesisResponse.json() as any;
    const comboResponse = await request(a!, '/api/combos', 'POST', { name: 'Catalog combo', priceCents: 1500, items: [{ procedureId: procedure.id, sessions: 1 }] });
    expect(comboResponse.status).toBe(201);
    const contractResponse = await request(a!, '/api/contracts', 'POST', { title: 'Standard contract', kind: 'standard', content: 'terms' });
    expect(contractResponse.status).toBe(201); const contract = await contractResponse.json() as any;
    const planResponse = await request(a!, '/api/plans', 'POST', { name: 'Catalog plan', priceCents: 2000, items: [{ offerType: 'procedure', offerId: procedure.id, sessions: 1 }], contractIds: [contract.id] });
    expect(planResponse.status).toBe(201); expect((await planResponse.json()).items[0].offerType).toBe('procedure');
    expect((await request(a!, `/api/anamneses/${anamnesis.id}/versions`, 'POST', { schema: { ...schema, properties: { age: { type: 'number' } } }, expectedVersion: 1 })).status).toBe(201);
    expect((await request(a!, `/api/anamneses/${anamnesis.id}/versions`, 'POST', { schema, expectedVersion: 1 })).status).toBe(409);
  });

  it('rejects invalid combo validity ranges before creation', async () => {
    const [a] = tenantIds;
    const procedure = await (await request(a!, '/api/procedures', 'POST', { name: 'Validity procedure', durationMinutes: 30, priceCents: 100, sessionSchema: schema })).json() as any;
    const response = await request(a!, '/api/combos', 'POST', { name: 'Invalid validity combo', priceCents: 100, validFrom: '2026-02-01T00:00:00.000Z', validUntil: '2026-01-01T00:00:00.000Z', items: [{ procedureId: procedure.id, sessions: 1 }] });
    expect(response.status).toBe(400);
  });

  it('keeps versions immutable, supports restore, isolates tenants, and rejects invalid tenant', async () => {
    const [a, b] = tenantIds;
    const p = await (await request(a!, '/api/procedures', 'POST', { name: 'Immutable procedure', durationMinutes: 30, priceCents: 100, sessionSchema: schema })).json() as any;
    await request(a!, `/api/procedures/${p.id}`, 'PUT', { sessionSchema: { ...schema, properties: { x: { type: 'boolean' } } }, expectedVersion: 1 });
    const stale = await request(a!, `/api/procedures/${p.id}`, 'PUT', { sessionSchema: schema, expectedVersion: 1 }); expect(stale.status).toBe(409);
    expect((await request(b!, `/api/procedures/${p.id}`)).status).toBe(404);
    expect((await request('00000000-0000-0000-0000-000000000099', '/api/procedures')).status).toBe(400);
    const c = await (await request(a!, '/api/contracts', 'POST', { title: 'Restore contract', kind: 'standard', content: 'one' })).json() as any;
    await request(a!, `/api/contracts/${c.id}/versions`, 'POST', { content: 'two', expectedVersion: 1 });
    expect((await request(a!, `/api/contracts/${c.id}/versions`, 'POST', { restoreVersion: 1, expectedVersion: 2 })).status).toBe(201);
    const versions = await getDatabase().select().from(contractVersions).where(inArray(contractVersions.contractId, [c.id]));
    expect(versions.map((v) => v.content)).toEqual(['one', 'two', 'one']);
  });

  it('enforces tenant composite links and plan contract requirement', async () => {
    const [a, b] = tenantIds;
    const p = await (await request(a!, '/api/procedures', 'POST', { name: 'Constraint procedure', durationMinutes: 30, priceCents: 100, sessionSchema: schema })).json() as any;
    const other = await (await request(b!, '/api/procedures', 'POST', { name: 'Other procedure', durationMinutes: 30, priceCents: 100, sessionSchema: schema })).json() as any;
    expect((await request(a!, '/api/anamneses', 'POST', { title: 'Cross tenant form', schema, procedureIds: [other.id] })).status).toBe(400);
    expect((await request(a!, '/api/plans', 'POST', { name: 'No contract', priceCents: 100, items: [{ offerType: 'procedure', offerId: p.id, sessions: 1 }], contractIds: [] })).status).toBe(400);
  });
});
