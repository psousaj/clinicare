import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { app } from './app';
import {
  anamneses, anamnesisProcedures, anamnesisVersions, appliedAnamneses, appointmentItems, appointments, attendancePhotos, attendances, buildPatientAad, closeDatabase, comboItems, combos,
  contractVersions, contracts, encryptValue, eventContracts, eventItems, events, followupContracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase, patients, payments,
  procedures, signatureEvents, signatureParticipants, signatureProcesses, signatureRevisions, signatureTokens,
} from '@clinicare/db';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';

const schema = { type: 'object', properties: {} };
const clinicDate = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + offsetDays * 86400000));
let tenantId: string;
let clinic: IntegrationClinic;
let otherClinic: IntegrationClinic;
const call = (who: IntegrationClinic, path: string, method = 'GET', body?: unknown) => app.request(path, { method, headers: who.headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const api = (path: string, method = 'GET', body?: unknown) => call(clinic, path, method, body);

integration('PostgreSQL event followups', () => {
  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    tenantId = crypto.randomUUID();
    clinic = await provisionIntegrationClinic(app, 'event-followups-a', tenantId);
    otherClinic = await provisionIntegrationClinic(app, 'event-followups-b');
  });
  afterAll(async () => {
    const db = getDatabase();
    for (const table of [signatureEvents, signatureRevisions, signatureTokens, signatureParticipants, attendancePhotos, attendances, appointmentItems, appointments, payments, appliedAnamneses, signatureProcesses, followupContracts, followupSnapshots, followupItems, followups, eventContracts, eventItems, events, comboItems, combos, anamnesisProcedures, anamnesisVersions, anamneses, contractVersions, contracts, procedures, patients]) await db.delete(table).where(eq((table as any).tenantId, tenantId));
    await cleanupIntegrationClinics([tenantId, otherClinic.tenantId]);
    await closeDatabase();
  });

  async function newPatient(name = 'Paciente evento') {
    const id = crypto.randomUUID();
    const phone = encryptValue('11987654321', buildPatientAad(tenantId, id, 'phone', 1));
    await getDatabase().insert(patients).values({ id, tenantId, fullName: `${name} ${id}`, phoneCiphertext: phone.ciphertext, phoneNonce: phone.nonce, phoneKeyVersion: 1 });
    return id;
  }

  /** Cardápio: avulso A (R$1,00/sessão, 1 sessão), avulso B (R$2,00, 2 sessões) e combo C (2×P3 a R$1,50 + 1×P4 a R$0,50; pacote R$2,50 promocional). */
  async function fixture(options: { eventDate?: string; withPublishedContract?: boolean } = {}) {
    const db = getDatabase();
    const ids = { a: crypto.randomUUID(), b: crypto.randomUUID(), p3: crypto.randomUUID(), p4: crypto.randomUUID(), combo: crypto.randomUUID(), contract: crypto.randomUUID() };
    await db.insert(procedures).values([
      { id: ids.a, tenantId, name: `Avulso A ${ids.a}`, durationMinutes: 30, priceCents: 100, sessionSchema: schema },
      { id: ids.b, tenantId, name: `Avulso B ${ids.b}`, durationMinutes: 20, priceCents: 200, sessionSchema: schema },
      { id: ids.p3, tenantId, name: `Do combo 3 ${ids.p3}`, durationMinutes: 15, priceCents: 150, baseSessions: 2, standalone: false, sessionSchema: schema },
      { id: ids.p4, tenantId, name: `Do combo 4 ${ids.p4}`, durationMinutes: 10, priceCents: 50, sessionSchema: schema },
    ]);
    await db.insert(combos).values({ id: ids.combo, tenantId, name: `Combo do evento ${ids.combo}`, priceCents: 300, promotionalPriceCents: 250 });
    await db.insert(comboItems).values([{ tenantId, comboId: ids.combo, procedureId: ids.p3, sessions: 2 }, { tenantId, comboId: ids.combo, procedureId: ids.p4, sessions: 1 }]);
    await db.insert(contracts).values({ id: ids.contract, tenantId, title: `Contrato do evento ${ids.contract}`, kind: 'standard' });
    if (options.withPublishedContract !== false) await db.insert(contractVersions).values({ tenantId, contractId: ids.contract, version: 1, content: 'terms', renderedPdfObjectKey: crypto.randomUUID(), renderedPdfHash: 'a'.repeat(64), renderedPdfSize: 123, renderedPdfContentType: 'application/pdf' });
    const created = await api('/api/events', 'POST', {
      name: 'Dia da clínica', eventDate: options.eventDate ?? clinicDate(),
      items: [{ kind: 'procedure', procedureId: ids.a, sessions: 1 }, { kind: 'procedure', procedureId: ids.b, sessions: 2 }, { kind: 'combo', comboId: ids.combo }],
      contractIds: [ids.contract],
    });
    expect(created.status).toBe(201);
    const event = await created.json() as any;
    return { ...ids, eventId: event.id as string, eventDate: event.eventDate as string };
  }

  const enroll = (patientId: string, f: { eventId: string }) => api('/api/followups', 'POST', { patientId, offerType: 'event', offerId: f.eventId });

  it('enrolls with the whole menu, nasce ocioso, expands combos into flat items and freezes a snapshot', async () => {
    const f = await fixture();
    const patientId = await newPatient();
    const response = await enroll(patientId, f);
    expect(response.status).toBe(201);
    const created = await response.json() as any;
    expect(created).toMatchObject({ offerType: 'event', status: 'idle', blocked: true, priceCents: 0, eventDate: f.eventDate });
    expect(created.items).toHaveLength(4);
    expect(created.items.find((item: any) => item.procedureId === f.a)).toMatchObject({ sessionsTotal: 1, priceCents: 100 });
    expect(created.items.find((item: any) => item.procedureId === f.b)).toMatchObject({ sessionsTotal: 2, priceCents: 200 });
    const packaged = created.items.filter((item: any) => item.comboId === f.combo);
    expect(packaged).toHaveLength(2);
    expect(packaged.every((item: any) => item.packagePriceCents === 250 && item.comboName.startsWith('Combo do evento'))).toBe(true);
    expect(packaged.find((item: any) => item.procedureId === f.p3).sessionsTotal).toBe(2);
    const db = getDatabase();
    const [row] = await db.select().from(followups).where(eq(followups.id, created.id));
    expect(row!.contractApplicationDate).toBe(f.eventDate);
    expect(await db.select().from(followupContracts).where(eq(followupContracts.followupId, created.id))).toHaveLength(1);
    expect(await db.select().from(signatureProcesses).where(eq(signatureProcesses.tenantId, tenantId))).not.toHaveLength(0);
    const [snapshot] = await db.select().from(followupSnapshots).where(and(eq(followupSnapshots.followupId, created.id), eq(followupSnapshots.kind, 'event')));
    expect(snapshot).toBeDefined();
    expect(created.signatureTokens).toBeDefined();
  });

  it('drops a standalone procedure from the menu when the same cardápio also has a combo containing it', async () => {
    const overlap = await fixture();
    expect((await api(`/api/events/${overlap.eventId}`, 'PUT', { items: [{ kind: 'procedure', procedureId: overlap.p4, sessions: 1 }, { kind: 'combo', comboId: overlap.combo }], contractIds: [overlap.contract] })).status).toBe(200);
    const created = await (await enroll(await newPatient(), overlap)).json() as any;
    expect(created.items.filter((item: any) => item.procedureId === overlap.p4)).toHaveLength(1);
    expect(created.items.find((item: any) => item.procedureId === overlap.p4).comboId).toBe(overlap.combo);
  });

  it('keeps the enrollment immune to catalog and menu changes after it was created', async () => {
    const f = await fixture();
    const patientId = await newPatient();
    const created = await (await enroll(patientId, f)).json() as any;
    const db = getDatabase();
    await db.update(procedures).set({ priceCents: 999, name: 'Renomeado' }).where(eq(procedures.id, f.a));
    await db.update(combos).set({ promotionalPriceCents: 1, priceCents: 5 }).where(eq(combos.id, f.combo));
    expect((await api(`/api/events/${f.eventId}`, 'PUT', { items: [{ kind: 'procedure', procedureId: f.b, sessions: 2 }], contractIds: [f.contract] })).status).toBe(200);
    const listed = (await (await api('/api/followups')).json() as any[]).find((row) => row.id === created.id);
    expect(listed.items.find((item: any) => item.procedureId === f.a)).toMatchObject({ priceCents: 100 });
    expect(listed.items.filter((item: any) => item.comboId === f.combo).every((item: any) => item.packagePriceCents === 250)).toBe(true);
    expect(listed.items).toHaveLength(4);
  });

  it('refuses an event with no menu items', async () => {
    const f = await fixture();
    await getDatabase().delete(eventItems).where(eq(eventItems.eventId, f.eventId));
    expect((await enroll(await newPatient(), f)).status).toBe(400);
  });

  it('allows several patients in the same event but only one live enrollment per patient', async () => {
    const f = await fixture();
    const [first, second] = [await newPatient(), await newPatient()];
    expect((await enroll(first, f)).status).toBe(201);
    expect((await enroll(second, f)).status).toBe(201);
    expect((await enroll(first, f)).status).toBe(409);
    const racing = await Promise.all([enroll(await newPatient(), f), enroll(first, f)]);
    expect(racing.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('permits a new enrollment after cancelling the previous one', async () => {
    const f = await fixture();
    const patientId = await newPatient();
    const created = await (await enroll(patientId, f)).json() as any;
    expect((await api(`/api/followups/${created.id}/cancel`, 'POST', { reason: 'Desistência' })).status).toBe(200);
    expect((await enroll(patientId, f)).status).toBe(201);
  });

  it('refuses inactive events, inactive or expired menu items and contracts without a published version', async () => {
    const inactive = await fixture();
    expect((await api(`/api/events/${inactive.eventId}`, 'PUT', { active: false })).status).toBe(200);
    expect((await enroll(await newPatient(), inactive)).status).toBe(404);

    const itemOff = await fixture();
    await getDatabase().update(procedures).set({ active: false }).where(eq(procedures.id, itemOff.a));
    expect((await enroll(await newPatient(), itemOff)).status).toBe(400);

    const comboOff = await fixture();
    await getDatabase().update(combos).set({ active: false }).where(eq(combos.id, comboOff.combo));
    expect((await enroll(await newPatient(), comboOff)).status).toBe(400);

    const expired = await fixture();
    await getDatabase().update(combos).set({ validUntil: new Date(Date.now() - 86400000) }).where(eq(combos.id, expired.combo));
    expect((await enroll(await newPatient(), expired)).status).toBe(400);

    const unpublished = await fixture({ withPublishedContract: false });
    const response = await enroll(await newPatient(), unpublished);
    expect(response.status).toBe(400);
  });

  it('cancels an unused menu item from the followup and treats a combo as one package', async () => {
    const f = await fixture();
    const created = await (await enroll(await newPatient(), f)).json() as any;
    const solo = created.items.find((item: any) => item.procedureId === f.a);
    const comboMember = created.items.find((item: any) => item.procedureId === f.p3);
    expect((await api(`/api/followups/${created.id}/items/${solo.id}/cancel`, 'POST', {})).status).toBe(200);
    const afterSolo = await (await api(`/api/followups/${created.id}`)).json() as any;
    expect(afterSolo.items.find((item: any) => item.procedureId === f.a).cancelledAt).toBeTruthy();
    expect(afterSolo.items.find((item: any) => item.procedureId === f.b).cancelledAt).toBeNull();

    const comboCancel = await api(`/api/followups/${created.id}/items/${comboMember.id}/cancel`, 'POST', {});
    expect(comboCancel.status).toBe(200);
    const afterCombo = await comboCancel.json() as any;
    expect(afterCombo.items.filter((item: any) => item.comboId === f.combo).every((item: any) => item.cancelledAt)).toBe(true);
    expect((await api(`/api/followups/${created.id}/items/${solo.id}/cancel`, 'POST', {})).status).toBe(409);
  });

  it('refuses to cancel a performed item, a reserved item, or an item of a plan', async () => {
    const f = await fixture();
    const patientId = await newPatient();
    const created = await (await enroll(patientId, f)).json() as any;
    const solo = created.items.find((item: any) => item.procedureId === f.a);
    await getDatabase().update(followupItems).set({ sessionsPerformed: 1 }).where(eq(followupItems.id, solo.id));
    expect((await api(`/api/followups/${created.id}/items/${solo.id}/cancel`, 'POST', {})).status).toBe(409);

    const other = created.items.find((item: any) => item.procedureId === f.b);
    await getDatabase().update(followups).set({ status: 'active' }).where(eq(followups.id, created.id));
    const booked = await api('/api/appointments', 'POST', { patientId, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), items: [{ followupItemId: other.id }] });
    expect(booked.status).toBe(201);
    expect((await api(`/api/followups/${created.id}/items/${other.id}/cancel`, 'POST', {})).status).toBe(409);

    const comboFollowup = await (await api('/api/followups', 'POST', { patientId: await newPatient(), offerType: 'combo', offerId: f.combo })).json() as any;
    expect((await api(`/api/followups/${comboFollowup.id}/items/${comboFollowup.items[0].id}/cancel`, 'POST', {})).status).toBe(400);
  });

  it('refuses to schedule or perform a cancelled event item', async () => {
    const f = await fixture();
    const patientId = await newPatient();
    const created = await (await enroll(patientId, f)).json() as any;
    const solo = created.items.find((item: any) => item.procedureId === f.a);
    expect((await api(`/api/followups/${created.id}/items/${solo.id}/cancel`, 'POST', {})).status).toBe(200);
    await getDatabase().update(followups).set({ status: 'active' }).where(eq(followups.id, created.id));
    expect((await api('/api/appointments', 'POST', { patientId, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), items: [{ followupItemId: solo.id }] })).status).toBe(409);
    expect((await api('/api/attendances', 'POST', { patientId, followupItemId: solo.id })).status).toBe(409);
  });

  it('requires the patient to have a phone to sign and isolates tenants', async () => {
    const f = await fixture();
    const noPhone = crypto.randomUUID();
    await getDatabase().insert(patients).values({ id: noPhone, tenantId, fullName: 'Sem telefone' });
    expect((await enroll(noPhone, f)).status).toBe(400);
    const foreign = await call(otherClinic, '/api/followups', 'POST', { patientId: await newPatient(), offerType: 'event', offerId: f.eventId });
    expect([404, 400]).toContain(foreign.status);
    expect((await (await call(otherClinic, '/api/followups')).json() as any[]).length).toBe(0);
  });
});
