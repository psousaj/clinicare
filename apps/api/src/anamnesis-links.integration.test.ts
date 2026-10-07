import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';
import { app } from './app';
import {
  anamneses, anamnesisProcedures, anamnesisVersions, procedureVersions, appliedAnamneses, buildPatientAad, closeDatabase, comboAnamneses, comboItems, combos, contractVersions, contracts,
  encryptValue, eventAnamneses, eventContracts, eventItems, events, followupContracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase,
  patients, planVersionAnamneses, planVersionContracts, planVersionItems, planVersions, plans, payments, procedures, signatureEvents, signatureParticipants,
  signatureProcesses, signatureRevisions, signatureTokens,
} from '@clinicare/db';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';

const schema = { type: 'object', properties: {} };
const tenantIds = [crypto.randomUUID(), crypto.randomUUID()];
let clinics: IntegrationClinic[];
const headers = (clinic: IntegrationClinic) => clinic.headers();
const request = (tenantId: string, path: string, method = 'GET', body?: unknown) => app.request(path, { method, headers: headers(clinics.find((clinic) => clinic.tenantId === tenantId)!), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

integration('offer-owned anamnesis links with PostgreSQL', () => {
  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    clinics = [await provisionIntegrationClinic(app, 'anamnesis-links-a', tenantIds[0]!), await provisionIntegrationClinic(app, 'anamnesis-links-b', tenantIds[1]!)];
  });
  afterAll(async () => {
    const db = getDatabase();
    for (const table of [signatureEvents, signatureRevisions, signatureTokens, signatureParticipants, payments, appliedAnamneses, signatureProcesses, followupContracts, followupSnapshots, followupItems, followups, planVersionAnamneses, eventAnamneses, comboAnamneses, planVersionContracts, planVersionItems, planVersions, plans, eventContracts, eventItems, events, comboItems, combos, anamnesisProcedures, anamnesisVersions, anamneses, contractVersions, contracts, procedureVersions, procedures, patients]) await db.delete(table).where(inArray((table as any).tenantId, tenantIds));
    await cleanupIntegrationClinics(tenantIds);
    await closeDatabase();
  });

  async function procedure(tenantId: string, name: string) {
    return (await (await request(tenantId, '/api/procedures', 'POST', { name, durationMinutes: 30, priceCents: 100, sessionSchema: schema })).json()) as any;
  }
  async function form(tenantId: string, title: string, procedureIds: string[] = []) {
    const created = await (await request(tenantId, '/api/anamneses', 'POST', { title, schema, procedureIds })).json() as any;
    return created;
  }
  async function contract(tenantId: string) {
    const created = await (await request(tenantId, '/api/contracts', 'POST', { title: `Contrato ${crypto.randomUUID()}`, kind: 'standard' })).json() as any;
    await getDatabase().insert(contractVersions).values({ tenantId, contractId: created.id, version: 1, content: 'terms', renderedPdfObjectKey: crypto.randomUUID(), renderedPdfHash: 'a'.repeat(64), renderedPdfSize: 123, renderedPdfContentType: 'application/pdf' });
    return created;
  }
  async function patient(tenantId: string) {
    const id = crypto.randomUUID();
    const phone = encryptValue('11987654321', buildPatientAad(tenantId, id, 'phone', 1));
    await getDatabase().insert(patients).values({ id, tenantId, fullName: `Paciente ${id}`, phoneCiphertext: phone.ciphertext, phoneNonce: phone.nonce, phoneKeyVersion: 1 });
    return id;
  }

  it('links forms from the procedure side, replacing the previous set', async () => {
    const [a, b] = tenantIds;
    const p = await procedure(a!, 'Proc vínculo');
    const f1 = await form(a!, 'Form 1');
    const f2 = await form(a!, 'Form 2');
    expect((await request(a!, `/api/procedures/${p.id}/anamneses`, 'PUT', { anamnesisIds: [f1.id, f2.id] })).status).toBe(200);
    expect((await (await request(a!, `/api/procedures/${p.id}/anamneses`, 'PUT', { anamnesisIds: [f2.id] })).json())).toMatchObject({ anamnesisIds: [f2.id] });
    expect((await request(a!, `/api/procedures/${p.id}/anamneses`, 'PUT', { anamnesisIds: [crypto.randomUUID()] })).status).toBe(400);
    expect((await request(a!, `/api/procedures/${crypto.randomUUID()}/anamneses`, 'PUT', { anamnesisIds: [f2.id] })).status).toBe(404);
    const foreign = await form(b!, 'Form outro tenant');
    expect((await request(a!, `/api/procedures/${p.id}/anamneses`, 'PUT', { anamnesisIds: [foreign.id] })).status).toBe(400);
    expect((await request(a!, '/api/procedures/not-a-uuid/anamneses', 'PUT', { anamnesisIds: [f2.id] })).status).toBe(404);
    expect((await request(a!, `/api/procedures/${p.id}/anamneses`, 'PUT', { anamnesisIds: 'nope' })).status).toBe(400);
  });

  it('stores combo, plan-version and event links and snapshots plan versions', async () => {
    const [a] = tenantIds;
    const p = await procedure(a!, 'Proc oferta');
    const f1 = await form(a!, 'Form oferta 1');
    const f2 = await form(a!, 'Form oferta 2');
    const combo = await (await request(a!, '/api/combos', 'POST', { name: 'Combo vínculo', priceCents: 100, items: [{ procedureId: p.id, sessions: 1 }], anamnesisIds: [f1.id] })).json() as any;
    expect(combo.anamnesisIds).toEqual([f1.id]);
    const c = await contract(a!);
    const plan = await (await request(a!, '/api/plans', 'POST', { name: 'Plano vínculo', priceCents: 100, items: [{ offerType: 'procedure', offerId: p.id, sessions: 1 }], contractIds: [c.id], anamnesisIds: [f1.id] })).json() as any;
    expect(plan.anamnesisIds).toEqual([f1.id]);
    const v2 = await (await request(a!, `/api/plans/${plan.id}`, 'PUT', { priceCents: 200, items: [{ offerType: 'procedure', offerId: p.id, sessions: 1 }], contractIds: [c.id], anamnesisIds: [f2.id] })).json() as any;
    expect(v2.anamnesisIds).toEqual([f2.id]);
    const v3 = await (await request(a!, `/api/plans/${plan.id}`, 'PUT', { priceCents: 300, items: [{ offerType: 'procedure', offerId: p.id, sessions: 1 }], contractIds: [c.id] })).json() as any;
    expect(v3.anamnesisIds).toEqual([f2.id]);
    const event = await (await request(a!, '/api/events', 'POST', { name: 'Evento vínculo', eventDate: '2026-11-01', items: [{ kind: 'procedure', procedureId: p.id, sessions: 1 }], contractIds: [c.id], anamnesisIds: [f1.id, f2.id] })).json() as any;
    expect(event.anamnesisIds.sort()).toEqual([f1.id, f2.id].sort());
  });

  it('applies the union of offer-owned and procedure-owned forms at enrollment', async () => {
    const [a] = tenantIds;
    const db = getDatabase();
    const p = await procedure(a!, 'Proc união');
    const viaProcedure = await form(a!, 'Form via procedimento');
    expect((await request(a!, `/api/procedures/${p.id}/anamneses`, 'PUT', { anamnesisIds: [viaProcedure.id] })).status).toBe(200);
    const viaOffer = await form(a!, 'Form via oferta');

    // Combo: explícita do combo + herdada do procedimento; sem duplicar a presente nos dois lados.
    const combo = await (await request(a!, '/api/combos', 'POST', { name: 'Combo união', priceCents: 100, items: [{ procedureId: p.id, sessions: 1 }], anamnesisIds: [viaOffer.id, viaProcedure.id] })).json() as any;
    const comboFollowup = await (await request(a!, '/api/followups', 'POST', { patientId: await patient(a!), offerType: 'combo', offerId: combo.id })).json() as any;
    expect(comboFollowup.anamneses.map((row: any) => row.title).sort()).toEqual(['Form via oferta', 'Form via procedimento']);

    // Plano: explícita da versão + herdada do procedimento.
    const c = await contract(a!);
    const plan = await (await request(a!, '/api/plans', 'POST', { name: 'Plano união', priceCents: 100, items: [{ offerType: 'procedure', offerId: p.id, sessions: 1 }], contractIds: [c.id], anamnesisIds: [viaOffer.id] })).json() as any;
    const planFollowup = await (await request(a!, '/api/followups', 'POST', { patientId: await patient(a!), offerType: 'plan', offerId: plan.id })).json() as any;
    expect(planFollowup.anamneses.map((row: any) => row.title).sort()).toEqual(['Form via oferta', 'Form via procedimento']);

    // Evento: explícita do evento + herdada do procedimento.
    const event = await (await request(a!, '/api/events', 'POST', { name: 'Evento união', eventDate: '2026-11-02', items: [{ kind: 'procedure', procedureId: p.id, sessions: 1 }], contractIds: [c.id], anamnesisIds: [viaOffer.id] })).json() as any;
    const eventFollowup = await (await request(a!, '/api/followups', 'POST', { patientId: await patient(a!), offerType: 'event', offerId: event.id })).json() as any;
    expect(eventFollowup.anamneses.map((row: any) => row.title).sort()).toEqual(['Form via oferta', 'Form via procedimento']);
    expect(await db.select().from(appliedAnamneses).where(and(eq(appliedAnamneses.tenantId, a!), eq(appliedAnamneses.followupId, eventFollowup.id)))).toHaveLength(2);
  });
});
