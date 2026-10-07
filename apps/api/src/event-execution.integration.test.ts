import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { app } from './app';
import {
  appliedAnamneses, appointmentItems, appointments, attendancePhotos, attendances, buildPatientAad, closeDatabase, comboItems, combos, contractVersions, contracts, encryptValue,
  eventContracts, eventItems, events, followupContracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase, patients, payments, procedures,
  signatureEvents, signatureParticipants, signatureProcesses, signatureRevisions, signatureTokens,
} from '@clinicare/db';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';

const schema = { type: 'object', properties: {} };
const clinicDate = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + offsetDays * 86400000));
let tenantId: string;
let clinic: IntegrationClinic;
const api = (path: string, method = 'GET', body?: unknown) => app.request(path, { method, headers: clinic.headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

integration('PostgreSQL event same-day execution and realized value', () => {
  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    tenantId = crypto.randomUUID();
    clinic = await provisionIntegrationClinic(app, 'event-execution', tenantId);
  });
  afterAll(async () => {
    const db = getDatabase();
    for (const table of [signatureEvents, signatureRevisions, signatureTokens, signatureParticipants, attendancePhotos, attendances, appointmentItems, appointments, payments, appliedAnamneses, signatureProcesses, followupContracts, followupSnapshots, followupItems, followups, eventContracts, eventItems, events, comboItems, combos, contractVersions, contracts, procedures, patients]) await db.delete(table).where(eq((table as any).tenantId, tenantId));
    await cleanupIntegrationClinics([tenantId]);
    await closeDatabase();
  });

  /** Avulso A (R$1,00 ×1), avulso B (R$2,00 ×2) e combo (2×P3 + 1×P4, pacote promocional R$2,50). */
  async function enrolled(options: { eventDate?: string; choice?: 'all' | 'solo' | 'combo' } = {}) {
    const db = getDatabase();
    const ids = { a: crypto.randomUUID(), b: crypto.randomUUID(), p3: crypto.randomUUID(), p4: crypto.randomUUID(), combo: crypto.randomUUID(), contract: crypto.randomUUID(), patient: crypto.randomUUID() };
    const phone = encryptValue('11987654321', buildPatientAad(tenantId, ids.patient, 'phone', 1));
    await db.insert(patients).values({ id: ids.patient, tenantId, fullName: `Paciente ${ids.patient}`, phoneCiphertext: phone.ciphertext, phoneNonce: phone.nonce, phoneKeyVersion: 1 });
    await db.insert(procedures).values([
      { id: ids.a, tenantId, name: `A ${ids.a}`, durationMinutes: 30, priceCents: 100, sessionSchema: schema },
      { id: ids.b, tenantId, name: `B ${ids.b}`, durationMinutes: 20, priceCents: 200, sessionSchema: schema },
      { id: ids.p3, tenantId, name: `P3 ${ids.p3}`, durationMinutes: 15, priceCents: 150, baseSessions: 2, standalone: false, sessionSchema: schema },
      { id: ids.p4, tenantId, name: `P4 ${ids.p4}`, durationMinutes: 10, priceCents: 50, sessionSchema: schema },
    ]);
    await db.insert(combos).values({ id: ids.combo, tenantId, name: `Combo ${ids.combo}`, priceCents: 300, promotionalPriceCents: 250 });
    await db.insert(comboItems).values([{ tenantId, comboId: ids.combo, procedureId: ids.p3, sessions: 2 }, { tenantId, comboId: ids.combo, procedureId: ids.p4, sessions: 1 }]);
    await db.insert(contracts).values({ id: ids.contract, tenantId, title: `Contrato ${ids.contract}`, kind: 'standard' });
    await db.insert(contractVersions).values({ tenantId, contractId: ids.contract, version: 1, content: 'terms', renderedPdfObjectKey: crypto.randomUUID(), renderedPdfHash: 'a'.repeat(64), renderedPdfSize: 123, renderedPdfContentType: 'application/pdf' });
    const event = await (await api('/api/events', 'POST', { name: 'Dia', eventDate: options.eventDate ?? clinicDate(), items: [{ kind: 'procedure', procedureId: ids.a, sessions: 1 }, { kind: 'procedure', procedureId: ids.b, sessions: 2 }, { kind: 'combo', comboId: ids.combo }], contractIds: [ids.contract] })).json() as any;
    const mode = options.choice ?? 'all';
    const choice = [
      ...(mode !== 'combo' ? [{ kind: 'procedure', procedureId: ids.a }, { kind: 'procedure', procedureId: ids.b }] : []),
      ...(mode !== 'solo' ? [{ kind: 'combo', comboId: ids.combo }] : []),
    ];
    const created = await (await api('/api/followups', 'POST', { patientId: ids.patient, offerType: 'event', offerId: event.id, choice })).json() as any;
    // A assinatura do paciente (que ativa o acompanhamento) é exercitada em suas próprias suítes; aqui a execução parte de um evento já ativo.
    await db.update(followups).set({ status: 'active' }).where(eq(followups.id, created.id));
    const item = (procedureId: string) => created.items.find((row: any) => row.procedureId === procedureId).id as string;
    return { ...ids, followupId: created.id as string, item };
  }

  const realized = async (followupId: string) => (await getDatabase().select().from(followups).where(eq(followups.id, followupId)))[0]!.priceCents;
  const book = (patientId: string, items: Array<{ followupItemId: string; quantity?: number }>, startsAt = new Date()) =>
    api('/api/appointments', 'POST', { patientId, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 8 * 3600000).toISOString(), items });

  it('bills only what was confirmed: unconfirmed choices are worth zero and each confirmed session adds its price', async () => {
    const f = await enrolled({ choice: 'solo' });
    expect(await realized(f.followupId)).toBe(0);
    const appointment = await (await book(f.patient, [{ followupItemId: f.item(f.a) }, { followupItemId: f.item(f.b), quantity: 2 }])).json() as any;
    const aItem = appointment.items.find((row: any) => row.procedureId === f.a);
    const confirmed = await api(`/api/appointments/${appointment.id}/confirm`, 'POST', { selectedItemIds: [aItem.id] });
    expect(confirmed.status).toBe(200);
    expect(await realized(f.followupId)).toBe(100);
    const bItem = appointment.items.find((row: any) => row.procedureId === f.b);
    expect(bItem.confirmationStatus).not.toBe('confirmed');
  });

  it('confirms a chosen combo atomically and bills the package price once', async () => {
    const f = await enrolled({ choice: 'combo' });
    const appointment = await (await book(f.patient, [{ followupItemId: f.item(f.p3), quantity: 2 }, { followupItemId: f.item(f.p4) }])).json() as any;
    expect((await api(`/api/appointments/${appointment.id}/confirm`, 'POST', {})).status).toBe(200);
    expect(await realized(f.followupId)).toBe(250);
    const rows = await getDatabase().select().from(followupItems).where(eq(followupItems.followupId, f.followupId));
    expect(rows.every((row) => row.sessionsPerformed === row.sessionsTotal)).toBe(true);
    expect((await getDatabase().select().from(followups).where(eq(followups.id, f.followupId)))[0]!.status).toBe('completed');
  });

  it('refuses a partial combo confirmation and leaves nothing changed', async () => {
    const f = await enrolled({ choice: 'combo' });
    const appointment = await (await book(f.patient, [{ followupItemId: f.item(f.p3), quantity: 2 }, { followupItemId: f.item(f.p4) }])).json() as any;
    const only = appointment.items.find((row: any) => row.procedureId === f.p3);
    expect((await api(`/api/appointments/${appointment.id}/confirm`, 'POST', { selectedItemIds: [only.id] })).status).toBe(409);
    expect(await realized(f.followupId)).toBe(0);
    expect(await getDatabase().select().from(attendances).where(eq(attendances.followupId, f.followupId))).toHaveLength(0);
    expect((await api(`/api/appointments/${appointment.id}`, 'DELETE')).status).toBe(200);
    const partialResponse = await book(f.patient, [{ followupItemId: f.item(f.p3) }, { followupItemId: f.item(f.p4) }], new Date(Date.now() + 60000));
    expect(partialResponse.status).toBe(201);
    const partialQuantity = await partialResponse.json() as any;
    expect((await api(`/api/appointments/${partialQuantity.id}/confirm`, 'POST', {})).status).toBe(409);
    expect(await realized(f.followupId)).toBe(0);
    const direct = await api('/api/attendances', 'POST', { patientId: f.patient, followupItemId: f.item(f.p3) });
    expect(direct.status).toBe(409);
  });

  it('refuses to schedule or perform an event followup outside the event day', async () => {
    const f = await enrolled({ eventDate: clinicDate(3), choice: 'solo' });
    expect((await book(f.patient, [{ followupItemId: f.item(f.a) }])).status).toBe(409);
    expect((await api('/api/attendances', 'POST', { patientId: f.patient, followupItemId: f.item(f.a) })).status).toBe(409);
    const day = await book(f.patient, [{ followupItemId: f.item(f.a) }], new Date(Date.now() + 3 * 86400000));
    expect(day.status).toBe(201);
    expect((await api(`/api/appointments/${(await day.json() as any).id}/confirm`, 'POST', {})).status).toBe(409);
    expect(await realized(f.followupId)).toBe(0);
  });

  it('records a walk-in attendance on the event day and reverts the value when it is cancelled', async () => {
    const f = await enrolled({ choice: 'solo' });
    const created = await api('/api/attendances', 'POST', { patientId: f.patient, followupItemId: f.item(f.a) });
    expect(created.status).toBe(201);
    expect(await realized(f.followupId)).toBe(100);
    const attendance = await created.json() as any;
    expect((await api(`/api/attendances/${attendance.id}/cancel`, 'PATCH', { reason: 'Lançado por engano' })).status).toBe(200);
    expect(await realized(f.followupId)).toBe(0);
  });

  it('closes the event followup with unperformed choices without leaving combo leftovers', async () => {
    const f = await enrolled();
    expect((await api('/api/attendances', 'POST', { patientId: f.patient, followupItemId: f.item(f.a) })).status).toBe(201);
    const closed = await api(`/api/followups/${f.followupId}/state`, 'PATCH', { status: 'completed' });
    expect(closed.status).toBe(200);
    expect(await realized(f.followupId)).toBe(100);
    const rows = await getDatabase().select().from(followups).where(eq(followups.patientId, f.patient));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.offerType).toBe('event');
    expect((await api('/api/attendances', 'POST', { patientId: f.patient, followupItemId: f.item(f.b) })).status).toBe(404);
  });
});
