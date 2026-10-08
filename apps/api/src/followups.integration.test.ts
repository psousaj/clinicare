import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { app } from './app';
import { buildPatientAad, closeDatabase, encryptValue, getDatabase, migrateDatabase, patients, procedures, combos, comboItems, followups, followupItems, followupSnapshots, followupContracts, signatureProcesses, signatureParticipants, signatureRevisions, signatureEvents, signatureTokens, appliedAnamneses, payments, tenants, plans, planVersions, planVersionItems, planVersionContracts, contracts, contractVersions, anamneses, anamnesisVersions, anamnesisProcedures } from '@clinicare/db';

import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';
let tenantId: string;
let clinic: IntegrationClinic;
let otherClinic: IntegrationClinic;
let headers: Record<string, string>;
const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers, body: JSON.stringify(body) });

integration('PostgreSQL followups', () => {
  let otherTenantId: string;
  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    tenantId = crypto.randomUUID();
    otherTenantId = crypto.randomUUID();
    clinic = await provisionIntegrationClinic(app, 'followups-a', tenantId);
    otherClinic = await provisionIntegrationClinic(app, 'followups-b', otherTenantId);
    headers = clinic.headers();
  });
  afterAll(async () => {
    const db = getDatabase();
    for (const table of [signatureEvents, signatureRevisions, signatureTokens, signatureParticipants, payments, appliedAnamneses, signatureProcesses, followupContracts, followupSnapshots, followupItems, followups, planVersionContracts, planVersionItems, planVersions, plans, comboItems, combos, anamnesisProcedures, anamnesisVersions, anamneses, contractVersions, contracts, procedures, patients]) await db.delete(table).where(eq((table as any).tenantId, tenantId));
    await cleanupIntegrationClinics([tenantId, otherTenantId]);
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

  it('keeps cancelled followups visible and allows independent re-enrollment', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const comboId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Recontratação' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento recontratação', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo recontratação', priceCents: 100 }); await db.insert(comboItems).values({ tenantId, comboId, procedureId, sessions: 1 });
    const created = await (await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).json() as any;
    const items = (await (await app.request(`/api/followups/${created.id}`, { headers })).json() as any).items as any[];
    expect(items.length).toBeGreaterThan(0);
    expect((await app.request(`/api/followups/${created.id}/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: 'Solicitado pelo paciente' }) })).status).toBe(200);
    const history = await (await app.request(`/api/followups/${created.id}`, { headers })).json() as any;
    expect(history.status).toBe('cancelled');
    expect(history.cancellationReason).toBe('Solicitado pelo paciente');
    expect(history.items.length).toBe(items.length);
    const start = new Date(Date.now() + 3600000);
    expect((await post('/api/appointments', { patientId, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60000).toISOString(), items: [{ followupItemId: items[0].id }] })).status).toBe(404);
    const renewed = await (await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).json() as any;
    expect(renewed.id).not.toBe(created.id);
    expect(renewed.status).toBe('active');
    expect(((await (await app.request(`/api/followups/${created.id}`, { headers })).json() as any).status)).toBe('cancelled');
  });

  it('revokes signature tokens and cancels processes on plan cancellation', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const planId = crypto.randomUUID(); const versionId = crypto.randomUUID(); const contractId = crypto.randomUUID(); const contractVersionId = crypto.randomUUID();
    const phone = encryptValue('11987654321', buildPatientAad(tenantId, patientId, 'phone', 1));
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Plano revogação', phoneCiphertext: phone.ciphertext, phoneNonce: phone.nonce, phoneKeyVersion: 1 });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento revogação', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano revogação' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 100 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, procedureId, sessions: 1, procedureName: 'Procedimento revogação', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(contracts).values({ id: contractId, tenantId, title: 'Contrato revogação', kind: 'standard' });
    await db.insert(contractVersions).values({ id: contractVersionId, tenantId, contractId, version: 1, content: 'terms', renderedPdfObjectKey: crypto.randomUUID(), renderedPdfHash: 'a'.repeat(64), renderedPdfSize: 123, renderedPdfContentType: 'application/pdf' });
    await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId, title: 'Contrato revogação' });
    const created = await (await post('/api/followups', { patientId, offerType: 'plan', offerId: planId })).json() as any;
    const group = Object.values(created.signatureTokens)[0] as any;
    const token = group.patient.token as string;
    expect((await app.request(`/public/signatures/${token}`, { headers })).status).toBe(200);
    expect((await app.request(`/api/followups/${created.id}/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: 'Solicitado pelo paciente' }) })).status).toBe(200);
    expect((await app.request(`/public/signatures/${token}`, { headers })).status).toBe(404);
    const applied = (await db.select().from(followupContracts).where(eq(followupContracts.followupId, created.id)))[0]!;
    expect(applied.status).toBe('cancelled');
    const events = await db.select().from(signatureEvents).where(eq(signatureEvents.tenantId, tenantId));
    expect(events.length).toBeGreaterThan(0);
    const history = await (await app.request(`/api/signature-history?followupContractId=${applied.id}`, { headers })).json() as any;
    expect(JSON.stringify(history)).toContain('cancelled');
  });

  it('cancels generating contracts without a signature process and rejects retry', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const comboId = crypto.randomUUID(); const contractId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Cancel geração' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento geração', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo geração', priceCents: 100 }); await db.insert(comboItems).values({ tenantId, comboId, procedureId, sessions: 1 });
    const created = await (await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).json() as any;
    await db.insert(contracts).values({ id: contractId, tenantId, title: 'Contrato geração', kind: 'standard' });
    await db.insert(contractVersions).values({ tenantId, contractId, version: 1, content: 'terms' });
    const generatingId = crypto.randomUUID();
    await db.insert(followupContracts).values({ id: generatingId, tenantId, followupId: created.id, contractId, contractVersion: 1, titleSnapshot: 'Contrato geração', status: 'generating' });
    expect((await app.request(`/api/followups/${created.id}/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: 'Solicitado pelo paciente' }) })).status).toBe(200);
    const stored = (await db.select().from(followupContracts).where(eq(followupContracts.id, generatingId)))[0]!;
    expect(stored.status).toBe('cancelled');
    expect(await db.select().from(signatureProcesses).where(eq(signatureProcesses.followupContractId, generatingId))).toHaveLength(0);
    expect((await app.request(`/api/followup-contracts/${generatingId}/retry`, { method: 'POST', headers })).status).toBe(409);
    expect((await app.request(`/api/followup-contracts/${generatingId}/reprocess`, { method: 'POST', headers })).status).toBe(409);
    expect((await app.request(`/api/followup-contracts/${generatingId}/generate`, { method: 'POST', headers })).status).toBe(200);
    expect((await db.select().from(followupContracts).where(eq(followupContracts.id, generatingId)))[0]!.status).toBe('cancelled');
    expect(await db.select().from(signatureProcesses).where(eq(signatureProcesses.followupContractId, generatingId))).toHaveLength(0);
  });

  it('isolates tenant lookups and rejects invalid state transitions', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const comboId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Isolamento' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento isolamento', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo isolamento', priceCents: 100 }); await db.insert(comboItems).values({ tenantId, comboId, procedureId, sessions: 1 });
    const created = await (await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).json() as any;
    expect((await app.request(`/api/followups/${created.id}`, { headers: otherClinic.headers() })).status).toBe(404);
    expect((await app.request(`/api/followups/${created.id}/state`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'completed' }) })).status).toBe(409);
  });

  it('creates plan followups idle and materializes one signature process per contract', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const procedureId = crypto.randomUUID(); const planId = crypto.randomUUID(); const versionId = crypto.randomUUID(); const contractId = crypto.randomUUID(); const contractVersionId = crypto.randomUUID();
    const phone = encryptValue('11987654321', buildPatientAad(tenantId, patientId, 'phone', 1));
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Plano idle', phoneCiphertext: phone.ciphertext, phoneNonce: phone.nonce, phoneKeyVersion: 1 });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento plano', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano teste' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 100 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, procedureId, sessions: 1, procedureName: 'Procedimento plano', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(contracts).values({ id: contractId, tenantId, title: 'Contrato plano', kind: 'standard' });
    await db.insert(contractVersions).values({ id: contractVersionId, tenantId, contractId, version: 1, content: 'terms', renderedPdfObjectKey: crypto.randomUUID(), renderedPdfHash: 'a'.repeat(64), renderedPdfSize: 123, renderedPdfContentType: 'application/pdf' });
    await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId, title: 'Contrato plano' });
    const response = await post('/api/followups', { patientId, offerType: 'plan', offerId: planId });
    expect(response.status).toBe(201);
    const created = await response.json() as any;
    expect(created.status).toBe('idle');
    expect(created.blocked).toBe(true);
    const applied = await db.select().from(followupContracts).where(eq(followupContracts.followupId, created.id));
    expect(applied).toHaveLength(1);
    const processes = await db.select().from(signatureProcesses).where(eq(signatureProcesses.followupContractId, applied[0]!.id));
    expect(processes).toHaveLength(1);
    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.processId, processes[0]!.id));
    expect(participants).toHaveLength(2);
    expect(created.signatureTokens).toBeDefined();
    const patientToken = Object.values(created.signatureTokens)[0] as any;
    expect(patientToken.patient.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect((await db.select().from(signatureTokens).where(eq(signatureTokens.participantId, participants.find((p) => p.role === 'patient')!.id)))[0]!.tokenHash).not.toBe(patientToken.patient.token);
    expect((await db.execute(`select 1 from information_schema.columns where table_name = 'followup_contracts' and column_name = 'content_snapshot'`)).rows).toHaveLength(0);
    expect((await app.request(`/api/followups/${crypto.randomUUID()}`, { headers })).status).toBe(404);
  });

  it('expands combos inside a plan into flat followup items keeping the combo origin in the snapshot', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const soloId = crypto.randomUUID(); const comboProcId = crypto.randomUUID(); const comboId = crypto.randomUUID(); const planId = crypto.randomUUID(); const versionId = crypto.randomUUID(); const contractId = crypto.randomUUID(); const anamnesisId = crypto.randomUUID();
    const schema = { type: 'object', properties: {} };
    const phone = encryptValue('11987654321', buildPatientAad(tenantId, patientId, 'phone', 1));
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Plano com combo', phoneCiphertext: phone.ciphertext, phoneNonce: phone.nonce, phoneKeyVersion: 1 });
    await db.insert(procedures).values([{ id: soloId, tenantId, name: 'Avulso do plano', durationMinutes: 30, priceCents: 100, sessionSchema: schema }, { id: comboProcId, tenantId, name: 'Procedimento do combo', durationMinutes: 45, priceCents: 200, sessionSchema: schema }]);
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo do plano', priceCents: 400 });
    await db.insert(comboItems).values({ tenantId, comboId, procedureId: comboProcId, sessions: 3 });
    await db.insert(anamneses).values({ id: anamnesisId, tenantId, title: 'Anamnese do combo' });
    await db.insert(anamnesisVersions).values({ tenantId, anamnesisId, version: 1, schema });
    await db.insert(anamnesisProcedures).values({ tenantId, anamnesisId, procedureId: comboProcId, required: true });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano com combo' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 900 });
    await db.insert(planVersionItems).values([
      { tenantId, planVersionId: versionId, offerType: 'procedure', procedureId: soloId, sessions: 2, procedureName: 'Avulso do plano', durationMinutes: 30, priceCents: 100, sessionSchema: schema },
      { tenantId, planVersionId: versionId, offerType: 'procedure', procedureId: comboProcId, sessions: 1, procedureName: 'Procedimento do combo', durationMinutes: 45, priceCents: 200, sessionSchema: schema },
      { tenantId, planVersionId: versionId, offerType: 'combo', comboId, comboName: 'Combo do plano', priceCents: 400, comboSnapshot: { items: [{ procedureId: comboProcId, procedureName: 'Procedimento do combo', sessions: 3, durationMinutes: 45, priceCents: 200, sessionSchema: schema }] } },
    ]);
    await db.insert(contracts).values({ id: contractId, tenantId, title: 'Contrato do plano', kind: 'standard' });
    await db.insert(contractVersions).values({ tenantId, contractId, version: 1, content: 'terms', renderedPdfObjectKey: crypto.randomUUID(), renderedPdfHash: 'a'.repeat(64), renderedPdfSize: 123, renderedPdfContentType: 'application/pdf' });
    await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId, title: 'Contrato do plano' });
    const response = await post('/api/followups', { patientId, offerType: 'plan', offerId: planId });
    expect(response.status).toBe(201);
    const created = await response.json() as any;
    expect(created.items.map((item: any) => `${item.procedureName}:${item.sessionsTotal}`).sort()).toEqual(['Avulso do plano:2', 'Procedimento do combo:1', 'Procedimento do combo:3']);
    expect(await db.select().from(followupContracts).where(eq(followupContracts.followupId, created.id))).toHaveLength(1);
    const snapshot = (await db.select().from(followupSnapshots).where(eq(followupSnapshots.followupId, created.id)))[0]!;
    const snapshotItems = (snapshot.payload as any).version.items;
    expect(snapshotItems.find((item: any) => item.offerType === 'combo').comboName).toBe('Combo do plano');
    expect(created.anamneses.map((form: any) => form.title)).toEqual(['Anamnese do combo']);
  });

  it('rejects a plan version whose combo item has an empty snapshot', async () => {
    const db = getDatabase(); const patientId = crypto.randomUUID(); const comboId = crypto.randomUUID(); const planId = crypto.randomUUID(); const versionId = crypto.randomUUID(); const contractId = crypto.randomUUID();
    const phone = encryptValue('11987654321', buildPatientAad(tenantId, patientId, 'phone', 1));
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Plano combo vazio', phoneCiphertext: phone.ciphertext, phoneNonce: phone.nonce, phoneKeyVersion: 1 });
    await db.insert(combos).values({ id: comboId, tenantId, name: 'Combo vazio', priceCents: 100 });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano combo vazio' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 100 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, offerType: 'combo', comboId, comboName: 'Combo vazio', priceCents: 100, comboSnapshot: { items: [] } });
    await db.insert(contracts).values({ id: contractId, tenantId, title: 'Contrato vazio', kind: 'standard' });
    await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId, title: 'Contrato vazio' });
    const response = await post('/api/followups', { patientId, offerType: 'plan', offerId: planId });
    expect(response.status).toBe(400);
    expect(await db.select().from(followups).where(eq(followups.patientId, patientId))).toHaveLength(0);
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
