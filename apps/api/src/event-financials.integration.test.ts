import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { app } from './app';
import {
  appliedAnamneses, appointmentItems, appointments, attendancePhotos, attendances, buildPatientAad, closeDatabase, contractVersions, contracts, encryptValue, eventContracts, eventItems, events,
  followupContracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase, patients, payments, procedures,
  signatureEvents, signatureParticipants, signatureProcesses, signatureRevisions, signatureTokens,
} from '@clinicare/db';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';
import { contractedNames } from './contract-generation';

const schema = { type: 'object', properties: {} };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
let tenantId: string;
let clinic: IntegrationClinic;
const api = (path: string, method = 'GET', body?: unknown) => app.request(path, { method, headers: clinic.headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

describe('contract context for events', () => {
  it('lists avulso procedures by name and a chosen combo once by package name', () => {
    expect(contractedNames('event', [{ procedureName: 'Botox' }, { procedureName: 'P3', comboName: 'Combo facial' }, { procedureName: 'P4', comboName: 'Combo facial' }])).toEqual(['Botox', 'Combo facial']);
    expect(contractedNames('plan', [{ procedureName: 'Botox' }, { procedureName: 'P3', comboName: 'Combo facial' }])).toEqual(['Botox', 'P3']);
  });
});

integration('PostgreSQL event financials', () => {
  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    tenantId = crypto.randomUUID();
    clinic = await provisionIntegrationClinic(app, 'event-financials', tenantId);
  });
  afterAll(async () => {
    const db = getDatabase();
    for (const table of [signatureEvents, signatureRevisions, signatureTokens, signatureParticipants, attendancePhotos, attendances, appointmentItems, appointments, payments, appliedAnamneses, signatureProcesses, followupContracts, followupSnapshots, followupItems, followups, eventContracts, eventItems, events, contractVersions, contracts, procedures, patients]) await db.delete(table).where(eq((table as any).tenantId, tenantId));
    await cleanupIntegrationClinics([tenantId]);
    await closeDatabase();
  });

  async function enrolled() {
    const db = getDatabase();
    const ids = { a: crypto.randomUUID(), b: crypto.randomUUID(), contract: crypto.randomUUID(), patient: crypto.randomUUID() };
    const phone = encryptValue('11987654321', buildPatientAad(tenantId, ids.patient, 'phone', 1));
    await db.insert(patients).values({ id: ids.patient, tenantId, fullName: `Paciente ${ids.patient}`, phoneCiphertext: phone.ciphertext, phoneNonce: phone.nonce, phoneKeyVersion: 1 });
    await db.insert(procedures).values([{ id: ids.a, tenantId, name: `A ${ids.a}`, durationMinutes: 30, priceCents: 1000, sessionSchema: schema }, { id: ids.b, tenantId, name: `B ${ids.b}`, durationMinutes: 30, priceCents: 3000, sessionSchema: schema }]);
    await db.insert(contracts).values({ id: ids.contract, tenantId, title: `Contrato ${ids.contract}`, kind: 'standard' });
    await db.insert(contractVersions).values({ tenantId, contractId: ids.contract, version: 1, content: 'terms', renderedPdfObjectKey: crypto.randomUUID(), renderedPdfHash: 'a'.repeat(64), renderedPdfSize: 123, renderedPdfContentType: 'application/pdf' });
    const event = await (await api('/api/events', 'POST', { name: 'Dia', eventDate: today(), items: [{ kind: 'procedure', procedureId: ids.a, sessions: 1 }, { kind: 'procedure', procedureId: ids.b, sessions: 1 }], contractIds: [ids.contract] })).json() as any;
    const created = await (await api('/api/followups', 'POST', { patientId: ids.patient, offerType: 'event', offerId: event.id })).json() as any;
    const item = (procedureId: string) => created.items.find((row: any) => row.procedureId === procedureId).id as string;
    return { ...ids, followupId: created.id as string, item };
  }
  const pay = (followupId: string, amountCents: number, idempotencyKey?: string) => api('/api/payments', 'POST', { followupId, amountCents, method: 'pix', idempotencyKey });

  it('refuses payment while nothing was confirmed, even though the choice is worth money', async () => {
    const f = await enrolled();
    expect((await pay(f.followupId, 100)).status).toBe(409);
    await getDatabase().update(followups).set({ status: 'active' }).where(eq(followups.id, f.followupId));
    expect((await pay(f.followupId, 100)).status).toBe(409);
  });

  it('caps payments at the realized value, serializes retries and follows later confirmations', async () => {
    const f = await enrolled();
    await getDatabase().update(followups).set({ status: 'active' }).where(eq(followups.id, f.followupId));
    expect((await api('/api/attendances', 'POST', { patientId: f.patient, followupItemId: f.item(f.a) })).status).toBe(201);
    expect((await pay(f.followupId, 1000, 'k1')).status).toBe(201);
    expect((await pay(f.followupId, 1000, 'k1')).status).toBe(201);
    expect((await pay(f.followupId, 1, 'k2')).status).toBe(409);
    expect((await api('/api/attendances', 'POST', { patientId: f.patient, followupItemId: f.item(f.b) })).status).toBe(201);
    expect((await pay(f.followupId, 3000, 'k3')).status).toBe(201);
    expect((await pay(f.followupId, 1, 'k4')).status).toBe(409);
  });

  it('shows realized, paid and pending without treating the choice as contracted price', async () => {
    const f = await enrolled();
    await getDatabase().update(followups).set({ status: 'active' }).where(eq(followups.id, f.followupId));
    expect((await api('/api/attendances', 'POST', { patientId: f.patient, followupItemId: f.item(f.a) })).status).toBe(201);
    expect((await pay(f.followupId, 400)).status).toBe(201);
    const view = await (await api(`/api/patients/${f.patient}/relationship`)).json() as any;
    expect(view.totals).toMatchObject({ contractedCents: 0, paidCents: 400, pendingCents: 600, dueForPerformedCents: 600 });
    expect(view.followups[0]).toMatchObject({ priceCents: 1000, paidCents: 400, pendingCents: 600 });
  });
});
