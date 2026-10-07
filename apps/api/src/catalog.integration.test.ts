import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { app } from './app';
import { closeDatabase, getDatabase, migrateDatabase, tenants, procedures, procedureVersions, anamneses, anamnesisVersions, anamnesisProcedures, combos, comboItems, contracts, contractVersions, plans, planVersions, planVersionItems, planVersionContracts } from '@clinicare/db';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';

const tenantIds = [crypto.randomUUID(), crypto.randomUUID()];
let clinics: IntegrationClinic[];
const headers = (clinic: IntegrationClinic) => clinic.headers();
const request = (tenantId: string, path: string, method = 'GET', body?: unknown) => app.request(path, { method, headers: headers(clinics.find((clinic) => clinic.tenantId === tenantId)!), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const schema = { type: 'object', properties: { pain: { type: 'string' } } };

integration('catalog API with PostgreSQL', () => {
  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    clinics = [await provisionIntegrationClinic(app, 'catalog-a', tenantIds[0]!), await provisionIntegrationClinic(app, 'catalog-b', tenantIds[1]!)];
  });
  afterAll(async () => {
    const db = getDatabase();
    for (const table of [planVersionItems, planVersionContracts, planVersions, plans, contractVersions, contracts, comboItems, combos, anamnesisProcedures, anamnesisVersions, anamneses, procedureVersions, procedures]) await db.delete(table).where(inArray((table as any).tenantId, tenantIds));
    await cleanupIntegrationClinics(tenantIds);
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
    const contractResponse = await request(a!, '/api/contracts', 'POST', { title: 'Standard contract', kind: 'standard' });
    expect(contractResponse.status).toBe(201); const contract = await contractResponse.json() as any;
    expect(contract.versions).toHaveLength(0);
    const planResponse = await request(a!, '/api/plans', 'POST', { name: 'Catalog plan', priceCents: 2000, items: [{ offerType: 'procedure', offerId: procedure.id, sessions: 1 }], contractIds: [contract.id] });
    expect(planResponse.status).toBe(201); expect((await planResponse.json()).items[0].offerType).toBe('procedure');
    expect((await request(a!, `/api/anamneses/${anamnesis.id}/versions`, 'POST', { schema: { ...schema, properties: { age: { type: 'number' } } }, expectedVersion: 1 })).status).toBe(201);
    expect((await request(a!, `/api/anamneses/${anamnesis.id}/versions`, 'POST', { schema, expectedVersion: 1 })).status).toBe(409);
  });

  it('supports plans containing combos with combo-kind contracts', async () => {
    const [a] = tenantIds;
    const procedure = await (await request(a!, '/api/procedures', 'POST', { name: 'Plan combo procedure', durationMinutes: 45, priceCents: 800, sessionSchema: schema })).json() as any;
    const combo = await (await request(a!, '/api/combos', 'POST', { name: 'Plan combo', priceCents: 1500, items: [{ procedureId: procedure.id, sessions: 2 }] })).json() as any;
    const comboContract = await (await request(a!, '/api/contracts', 'POST', { title: 'Combo contract', kind: 'combo', comboId: combo.id })).json() as any;
    const planResponse = await request(a!, '/api/plans', 'POST', {
      name: 'Plan with combo', priceCents: 3000,
      items: [
        { offerType: 'procedure', offerId: procedure.id, sessions: 1 },
        { offerType: 'combo', offerId: combo.id },
      ],
      contractIds: [comboContract.id],
    });
    expect(planResponse.status).toBe(201);
    const plan = await planResponse.json() as any;
    expect(plan.items).toHaveLength(2);
    const comboItem = plan.items.find((item: any) => item.offerType === 'combo');
    expect(comboItem.offerId).toBe(combo.id);
    expect(comboItem.comboName).toBe('Plan combo');
    expect(comboItem.items).toHaveLength(1);
    expect(comboItem.items[0].sessions).toBe(2);
    expect((await request(a!, '/api/plans', 'POST', { name: 'Unknown combo plan', priceCents: 100, items: [{ offerType: 'combo', offerId: crypto.randomUUID() }], contractIds: [comboContract.id] })).status).toBe(400);
  });

  it('validates combo plan items: inactive, other tenant, duplicates, unrelated combo contract, base sessions, edits and legacy rows', async () => {
    const [a, b] = tenantIds;
    const standard = await (await request(a!, '/api/contracts', 'POST', { title: 'Std', kind: 'standard' })).json() as any;
    const procedure = await (await request(a!, '/api/procedures', 'POST', { name: 'Neg procedure', durationMinutes: 30, priceCents: 100, baseSessions: 3, sessionSchema: schema })).json() as any;
    const combo = await (await request(a!, '/api/combos', 'POST', { name: 'Neg combo', priceCents: 500, items: [{ procedureId: procedure.id, sessions: 3 }] })).json() as any;
    const otherCombo = await (await request(a!, '/api/combos', 'POST', { name: 'Other combo', priceCents: 500, items: [{ procedureId: procedure.id, sessions: 3 }] })).json() as any;
    const otherComboContract = await (await request(a!, '/api/contracts', 'POST', { title: 'Other combo contract', kind: 'combo', comboId: otherCombo.id })).json() as any;
    const foreignProcedure = await (await request(b!, '/api/procedures', 'POST', { name: 'Foreign procedure', durationMinutes: 30, priceCents: 100, sessionSchema: schema })).json() as any;
    const foreignCombo = await (await request(b!, '/api/combos', 'POST', { name: 'Foreign combo', priceCents: 100, items: [{ procedureId: foreignProcedure.id, sessions: 1 }] })).json() as any;
    const plan = (items: unknown[], contractIds = [standard.id]) => request(a!, '/api/plans', 'POST', { name: 'Neg plan', priceCents: 100, items, contractIds });
    expect((await plan([{ offerType: 'combo', offerId: foreignCombo.id }])).status).toBe(400);
    expect((await plan([{ offerType: 'combo', offerId: combo.id }, { offerType: 'combo', offerId: combo.id }])).status).toBe(400);
    expect((await plan([{ offerType: 'procedure', offerId: procedure.id, sessions: 3 }, { offerType: 'procedure', offerId: procedure.id, sessions: 3 }])).status).toBe(400);
    expect((await plan([{ offerType: 'procedure', offerId: procedure.id, sessions: 1 }])).status).toBe(400);
    expect((await plan([{ offerType: 'combo', offerId: combo.id }], [otherComboContract.id])).status).toBe(400);
    expect((await request(a!, `/api/combos/${combo.id}`, 'PUT', { name: 'Neg combo', priceCents: 500, active: false, items: [{ procedureId: procedure.id, sessions: 3 }] })).status).toBe(200);
    expect((await plan([{ offerType: 'combo', offerId: combo.id }])).status).toBe(400);
    expect((await request(a!, `/api/combos/${combo.id}`, 'PUT', { name: 'Neg combo', priceCents: 500, active: true, items: [{ procedureId: procedure.id, sessions: 3 }] })).status).toBe(200);
    const created = await (await plan([{ offerType: 'procedure', offerId: procedure.id, sessions: 3 }, { offerType: 'combo', offerId: combo.id, sessions: 99 }])).json() as any;
    expect(created.items.map((item: any) => item.offerType).sort()).toEqual(['combo', 'procedure']);
    expect(created.items.find((item: any) => item.offerType === 'combo').items[0].sessions).toBe(3);
    const edited = await request(a!, `/api/plans/${created.id}`, 'PUT', { priceCents: 100, items: [{ offerType: 'combo', offerId: combo.id }], contractIds: [standard.id] });
    expect(edited.status).toBe(200);
    const editedBody = await edited.json() as any;
    expect(editedBody.items).toHaveLength(1);
    expect(editedBody.versions[0].version).toBe(2);
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
    expect((await app.request('/api/procedures', { headers: { 'x-tenant-id': '00000000-0000-0000-0000-000000000099' } })).status).toBe(401);
    const c = await (await request(a!, '/api/contracts', 'POST', { title: 'Restore contract', kind: 'standard' })).json() as any;
    expect(c.versions).toHaveLength(0);
    const patch = await request(a!, `/api/contracts/${c.id}`, 'PATCH', { title: 'Restore contract renomeado' });
    expect(patch.status).toBe(200); expect((await patch.json()).title).toBe('Restore contract renomeado');
    expect((await request(a!, `/api/contracts/${c.id}/versions`, 'POST', { content: 'two' })).status).toBe(410);
    expect((await request(a!, `/api/contracts/${c.id}`, 'PATCH', { content: 'two' })).status).toBe(410);
  });

  it('enforces tenant composite links and plan contract requirement', async () => {
    const [a, b] = tenantIds;
    const p = await (await request(a!, '/api/procedures', 'POST', { name: 'Constraint procedure', durationMinutes: 30, priceCents: 100, sessionSchema: schema })).json() as any;
    const other = await (await request(b!, '/api/procedures', 'POST', { name: 'Other procedure', durationMinutes: 30, priceCents: 100, sessionSchema: schema })).json() as any;
    expect((await request(a!, '/api/anamneses', 'POST', { title: 'Cross tenant form', schema, procedureIds: [other.id] })).status).toBe(400);
    expect((await request(a!, '/api/plans', 'POST', { name: 'No contract', priceCents: 100, items: [{ offerType: 'procedure', offerId: p.id, sessions: 1 }], contractIds: [] })).status).toBe(400);
  });
});
