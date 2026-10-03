import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { app } from './app';
import { closeDatabase, getDatabase, migrateDatabase, patients, procedures, combos, comboItems, followups, followupItems, followupSnapshots, followupContracts, signatureProcesses, signatureParticipants, signatureRevisions, signatureEvents, signatureTokens, appliedAnamneses, payments, tenants, plans, planVersions, planVersionItems, planVersionContracts, contracts, contractVersions, anamneses, anamnesisVersions, anamnesisProcedures } from '@clinicare/db';

const integration = process.env.DATABASE_URL ? describe : describe.skip;
let tenantId: string;
let headers: Record<string, string>;
const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers, body: JSON.stringify(body) });

integration('PostgreSQL followups', () => {
  let otherTenantId: string;
  beforeAll(async () => {
    await migrateDatabase();
    tenantId = crypto.randomUUID();
    otherTenantId = crypto.randomUUID();
    headers = { 'content-type': 'application/json', 'x-tenant-id': tenantId };
    await getDatabase().insert(tenants).values([
      { id: tenantId, name: `Followup Test ${tenantId}` },
      { id: otherTenantId, name: `Followup Other ${otherTenantId}` },
    ]);
  });
  afterAll(async () => {
    const db = getDatabase();
    for (const table of [signatureEvents, signatureRevisions, signatureTokens, signatureParticipants, payments, appliedAnamneses, signatureProcesses, followupContracts, followupSnapshots, followupItems, followups, planVersionContracts, planVersionItems, planVersions, plans, comboItems, combos, anamnesisProcedures, anamnesisVersions, anamneses, contractVersions, contracts, procedures, patients]) await db.delete(table).where(eq((table as any).tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
    await closeDatabase();
  });

  it('materializes an immutable snapshot and rejects a second live offer', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const comboId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Followup Teste' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento teste', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo teste', priceCents: 100 });
    await db.insert(comboItems).values({ tenantId, comboId, procedureId, sessions: 2 });
    const response = await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId });
    expect(response.status).toBe(201); const created = await response.json() as any;
    await db.update(procedures).set({ name: 'Procedimento alterado', priceCents: 999 }).where(and(eq(procedures.tenantId, tenantId), eq(procedures.id, procedureId)));
    const listed = await (await app.request('/api/followups', { headers })).json() as any[];
    expect(listed[0].items[0]).toMatchObject({ procedureName: 'Procedimento teste', priceCents: 100 });
    expect((await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).status).toBe(409);
    expect((await db.select().from(followupSnapshots).where(eq(followupSnapshots.followupId, created.id))).length).toBe(1);
  });

  it('rejects concurrent duplicate creation at the database boundary', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const comboId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Concorrência' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento concorrente', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo concorrente', priceCents: 100 });
    await db.insert(comboItems).values({ tenantId, comboId, procedureId, sessions: 1 });
    const responses = await Promise.all([
      post('/api/followups', { patientId, offerType: 'combo', offerId: comboId }),
      post('/api/followups', { patientId, offerType: 'combo', offerId: comboId }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await db.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.patientId, patientId)))).toHaveLength(1);
  });

  it('cancels with a reason and permits a new offer', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const comboId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Cancel Teste' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento cancelar', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo cancelar', priceCents: 100 }); await db.insert(comboItems).values({ tenantId, comboId, procedureId, sessions: 1 });
    const created = await (await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).json() as any;
    expect((await app.request(`/api/followups/${created.id}/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: 'Solicitado pelo paciente' }) })).status).toBe(200);
    expect((await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).status).toBe(201);
  });

  it('isolates tenant lookups and rejects invalid state transitions', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const comboId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Isolamento' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento isolamento', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo isolamento', priceCents: 100 }); await db.insert(comboItems).values({ tenantId, comboId, procedureId, sessions: 1 });
    const created = await (await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).json() as any;
    expect((await app.request(`/api/followups/${created.id}`, { headers: { ...headers, 'x-tenant-id': otherTenantId } })).status).toBe(404);
    expect((await app.request(`/api/followups/${created.id}/state`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'completed' }) })).status).toBe(409);
  });

  it('creates plan followups idle and materializes one signature process per contract', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const planId = crypto.randomUUID(); const versionId = crypto.randomUUID(); const contractId = crypto.randomUUID(); const contractVersionId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Plano idle' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento plano', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano teste' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 100 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, procedureId, sessions: 1, procedureName: 'Procedimento plano', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(contracts).values({ id: contractId, tenantId, title: 'Contrato plano', kind: 'standard' });
    await db.insert(contractVersions).values({ id: contractVersionId, tenantId, contractId, version: 1, content: 'terms' });
    await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId, contractVersion: 1, title: 'Contrato plano' });
    const response = await post('/api/followups', { patientId, offerType: 'plan', offerId: planId });
    expect(response.status).toBe(201);
    const created = await response.json() as any;
    expect(created.status).toBe('idle');
    expect(created.blocked).toBe(true);
    const applied = await db.select().from(followupContracts).where(eq(followupContracts.followupId, created.id));
    expect(applied).toHaveLength(1);
    expect(await db.select().from(signatureProcesses).where(eq(signatureProcesses.followupContractId, applied[0]!.id))).toHaveLength(1);
    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    expect(participants).toHaveLength(2);
    expect(created.signatureTokens).toBeDefined();
    const patientToken = Object.values(created.signatureTokens)[0] as any;
    expect(patientToken.patient.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect((await db.select().from(signatureTokens).where(eq(signatureTokens.participantId, participants.find((p) => p.role === 'patient')!.id)))[0]!.tokenHash).not.toBe(patientToken.patient.token);
    expect((await db.execute(`select 1 from information_schema.columns where table_name = 'followup_contracts' and column_name = 'content_snapshot'`)).rows).toHaveLength(0);
    expect((await app.request(`/api/followups/${crypto.randomUUID()}`, { headers })).status).toBe(404);
  });

  it('enforces offer identity, timestamps, and applied patient identity at the database boundary', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const otherPatientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const comboId = crypto.randomUUID(); const otherComboId = crypto.randomUUID(); const anamnesisId = crypto.randomUUID();
    await db.insert(patients).values([{ id: patientId, tenantId, fullName: 'Paciente FK' }, { id: otherPatientId, tenantId, fullName: 'Outro paciente FK' }]);
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento FK', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(combos).values([{ id: comboId, tenantId, name: 'Combo FK', priceCents: 100 }, { id: otherComboId, tenantId, name: 'Outro combo FK', priceCents: 100 }]);
    await db.insert(comboItems).values([{ tenantId, comboId, procedureId, sessions: 1 }, { tenantId, comboId: otherComboId, procedureId, sessions: 1 }]);
    await expect(db.insert(followups).values({ tenantId, patientId, offerType: 'combo', offerId: comboId, comboId: otherComboId, offerNameSnapshot: 'Combo FK', priceCents: 100 }).execute()).rejects.toThrow();
    await expect(db.insert(followups).values({ tenantId, patientId, offerType: 'combo', offerId: comboId, comboId, offerNameSnapshot: 'Combo FK', priceCents: 100, completedAt: new Date() }).execute()).rejects.toThrow();
    const created = await import('./followups').then(({ createFollowup }) => createFollowup(tenantId, patientId, 'combo', comboId));
    if (!created) throw new Error('Followup creation unexpectedly returned null.');
    await db.insert(anamneses).values({ id: anamnesisId, tenantId, title: 'Anamnese FK' });
    await expect(db.insert(appliedAnamneses).values({ tenantId, patientId: otherPatientId, followupId: created.id, anamnesisId, version: 1, titleSnapshot: 'Anamnese FK', schemaSnapshot: { type: 'object', properties: {} } }).execute()).rejects.toThrow();
  });

  it('rolls back all dependencies when materialization fails at the database boundary', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const comboId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Rollback Teste' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento rollback', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo rollback', priceCents: 100 }); await db.insert(comboItems).values({ tenantId, comboId, procedureId, sessions: 1 });
    await expect((await import('./followups')).createFollowup(tenantId, patientId, 'combo', comboId, { failAfter: 'items' })).rejects.toThrow();
    expect(await db.select().from(followups).where(eq(followups.patientId, patientId))).toHaveLength(0);
    expect(await db.select().from(followupItems).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.procedureId, procedureId)))).toHaveLength(0);
  });
});
