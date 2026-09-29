import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from './app';
import { Combo, Patient, Procedure, Followup, connectDatabase } from '@clinicare/db';

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await connectDatabase(mongo.getUri());
}, 120_000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); }, 20_000);
beforeEach(async () => { await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))); });

const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

// Procedimento avulso não gera acompanhamento; para testar o fluxo contratado, monta um combo com o procedimento.
const comboOf = (procedure: any, sessions?: number) => Combo.create({ name: `Combo ${procedure.name}`, priceCents: procedure.priceCents * (sessions ?? procedure.baseSessions), items: [{ procedureId: procedure._id, sessionsOverride: sessions ?? null }] });
const startFollowup = async (patient: any, combo: any) => (await post('/api/followups', { patientId: String(patient._id), offerType: 'combo', offerId: String(combo._id) })).json() as Promise<any>;

describe('API integration with MongoDB', () => {
  it('reports healthy database connection', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', database: 'connected' });
  });
  it('creates, persists, searches and edits patients', async () => {
    const createdResponse = await post('/api/patients', { fullName: 'Ana Exemplo', phone: '11999999999', email: 'ANA@example.com' });
    expect(createdResponse.status).toBe(201);
    const patient = await createdResponse.json() as { _id: string; email: string };
    expect(patient.email).toBe('ana@example.com');
    expect((await (await app.request('/api/patients?query=exemplo')).json() as any[])).toHaveLength(1);
    const edit = await app.request(`/api/patients/${patient._id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fullName: 'Ana Atualizada', phone: '11888888888' }) });
    expect((await edit.json() as any).fullName).toBe('Ana Atualizada');
    expect(await Patient.countDocuments()).toBe(1);
  });
  it('rejects invalid patient payloads', async () => {
    expect((await post('/api/patients', { fullName: ' ' })).status).toBe(400);
    expect((await post('/api/patients', { fullName: 'Ana', email: 'invalido' })).status).toBe(400);
    expect(await Patient.countDocuments()).toBe(0);
  });
  it('requires duration and a multi-session count for procedures that cannot be standalone', async () => {
    const base = { name: 'Bioestimulador', baseSessions: 3, priceCents: 50000, sessionSchema: { type: 'object', properties: {} } };
    expect((await post('/api/procedures', base)).status).toBe(400);
    expect((await post('/api/procedures', { ...base, durationMinutes: 45, standalone: false, baseSessions: 1 })).status).toBe(400);
    const created = await (await post('/api/procedures', { ...base, durationMinutes: 45, standalone: false })).json() as any;
    expect(created).toMatchObject({ standalone: false, durationMinutes: 45 });
    const combo = { name: 'Combo bio', priceCents: 200000, items: [{ procedureId: created._id, sessionsOverride: 1 }] };
    expect((await post('/api/combos', combo)).status).toBe(400);
    expect((await post('/api/combos', { ...combo, items: [{ procedureId: created._id, sessionsOverride: 2 }] })).status).toBe(201);
  });
  it('fits standalone and contracted procedures, with repeated sessions, in the appointment length', async () => {
    const patient = await Patient.create({ fullName: 'Bia Teste' });
    const schema = { type: 'object', properties: {} };
    const light = await Procedure.create({ name: 'Limpeza', baseSessions: 1, durationMinutes: 30, priceCents: 10000, sessionSchema: schema, versions: [] });
    const course = await Procedure.create({ name: 'Bioestimulador', baseSessions: 3, durationMinutes: 45, standalone: false, priceCents: 20000, sessionSchema: schema, versions: [] });
    const followup = await startFollowup(patient, await comboOf(course));
    const itemId = followup.items[0]._id, patientId = String(patient._id);
    const slot = (minutes: number, items: unknown[]) => post('/api/appointments', { patientId, items, startsAt: '2030-01-01T10:00:00Z', endsAt: new Date(Date.parse('2030-01-01T10:00:00Z') + minutes * 60000).toISOString() });
    expect((await slot(60, [{ procedureId: String(light._id) }, { followupItemId: itemId }])).status).toBe(409);
    const ok = await slot(90, [{ procedureId: String(light._id) }, { followupItemId: itemId, quantity: 1 }]);
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ items: [{ procedureName: 'Limpeza', quantity: 1, minutesEach: 30 }, { procedureName: 'Bioestimulador', quantity: 1, minutesEach: 45 }] });
    expect((await slot(120, [{ followupItemId: itemId, quantity: 2 }])).status).toBe(201);
    expect((await slot(240, [{ followupItemId: itemId, quantity: 4 }])).status).toBe(409);
    expect((await slot(90, [{ procedureId: String(course._id) }])).status).toBe(409);
    expect((await slot(90, [{ procedureId: String(light._id), quantity: 2 }])).status).toBe(409);
    expect((await slot(90, [{ procedureId: String(light._id) }, { procedureId: String(light._id) }])).status).toBe(400);
    expect((await slot(90, [])).status).toBe(400);
    const avulso = await post('/api/attendances', { patientId, procedureId: String(light._id) });
    expect(avulso.status).toBe(201);
    const performed = await avulso.json() as any;
    expect(performed).toMatchObject({ procedureName: 'Limpeza', durationMinutes: 30 });
    expect(await Followup.findById(performed.followupId).lean()).toMatchObject({ offerType: 'procedure', priceCents: 10000 });
    expect((await post('/api/attendances', { patientId, procedureId: String(course._id) })).status).toBe(409);
  });
  it('charges standalone procedures: payments, anamnesis validity and cleanup of unused ones', async () => {
    const patient = await Patient.create({ fullName: 'Lia Teste' }), patientId = String(patient._id);
    const procedure = await Procedure.create({ name: 'Peeling leve', baseSessions: 1, durationMinutes: 30, priceCents: 12000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    const form = await (await post('/api/anamneses', { title: 'Anamnese facial', schema: { type: 'object', properties: { queixa: { type: 'string' } } }, procedureIds: [String(procedure._id)], validityMonths: 6 })).json() as any;
    const slot = () => post('/api/appointments', { patientId, items: [{ procedureId: String(procedure._id) }], startsAt: '2030-01-01T10:00:00Z', endsAt: '2030-01-01T11:00:00Z' });
    const blocked = await slot();
    expect(blocked.status).toBe(409);
    expect((await blocked.json() as any).error).toContain('Anamnese facial');
    expect((await slot()).status).toBe(409);
    expect(await Followup.countDocuments()).toBe(1);
    const [listed] = await (await app.request('/api/followups')).json() as any[];
    expect(listed).toMatchObject({ offerType: 'procedure', priceCents: 12000, blocked: true });
    expect((await post('/api/attendances', { patientId, procedureId: String(procedure._id) })).status).toBe(409);
    expect((await post(`/api/patient-anamneses/${listed.anamneses[0].id}/answers`, { answers: { queixa: 'Sensibilidade' } })).status).toBe(201);
    const created = await slot();
    expect(created.status).toBe(201);
    const appointment = await created.json() as any;
    expect(appointment.items[0]).toMatchObject({ followupId: listed._id, procedureName: 'Peeling leve' });
    expect(await Followup.countDocuments()).toBe(1);
    const deleted = await app.request(`/api/appointments/${appointment._id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(await Followup.countDocuments()).toBe(0);
    const again = await slot();
    expect(again.status).toBe(201);
    const performed = await (await post('/api/attendances', { patientId, procedureId: String(procedure._id), appointmentId: (await again.json() as any)._id })).json() as any;
    expect((await post('/api/payments', { followupId: String(performed.followupId), amountCents: 5000, method: 'pix' })).status).toBe(201);
    const report = await (await app.request(`/api/patients/${patientId}/relationship`)).json() as any;
    expect(report.totals).toMatchObject({ contractedCents: 12000, paidCents: 5000, pendingCents: 7000, attendancesPerformed: 1 });
    expect(form.title).toBe('Anamnese facial');
  });
  it('snapshots procedure duration and counts sessions already booked in other appointments', async () => {
    const patient = await Patient.create({ fullName: 'Nina Teste' }), patientId = String(patient._id);
    const course = await Procedure.create({ name: 'Radiofrequência', baseSessions: 3, durationMinutes: 40, standalone: false, priceCents: 9000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    const followup = await startFollowup(patient, await comboOf(course));
    expect(followup.items[0].durationMinutes).toBe(40);
    await Procedure.updateOne({ _id: course._id }, { durationMinutes: 90 });
    const book = (quantity: number, day: number) => post('/api/appointments', { patientId, items: [{ followupItemId: followup.items[0]._id, quantity }], startsAt: `2030-01-0${day}T10:00:00Z`, endsAt: `2030-01-0${day}T13:00:00Z` });
    const first = await book(2, 1);
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ items: [{ minutesEach: 40 }] });
    expect((await book(2, 2)).status).toBe(409);
    expect((await book(1, 2)).status).toBe(201);
  });
  it('creates a procedure with dynamic schema and keeps schema versions', async () => {
    const response = await post('/api/procedures', { name: 'Limpeza facial', baseSessions: 2, durationMinutes: 45, priceCents: 20000, sessionSchema: { type: 'object', properties: { intensity: { type: 'string' } } } });
    expect(response.status).toBe(201);
    const procedure = await response.json() as any;
    const edit = await app.request(`/api/procedures/${procedure._id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...procedure, sessionSchema: { type: 'object', properties: { intensity: { type: 'string' }, notes: { type: 'string' } } } }) });
    expect((await edit.json() as any).versions).toHaveLength(2);
  });
  it('does not start followups from a procedure, but repeats combos and snapshots the offer', async () => {
    const patient = await Patient.create({ fullName: 'Maria Teste' });
    const procedure = await Procedure.create({ name: 'Peeling', baseSessions: 3, priceCents: 10000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    expect((await post('/api/followups', { patientId: String(patient._id), offerType: 'procedure', offerId: String(procedure._id) })).status).toBe(400);
    const combo = await comboOf(procedure);
    const first = await startFollowup(patient, combo);
    expect(first).toMatchObject({ offerType: 'combo', offerName: 'Combo Peeling', priceCents: 30000 });
    expect((await post('/api/followups', { patientId: String(patient._id), offerType: 'combo', offerId: String(combo._id) })).status).toBe(201);
    expect(await Followup.countDocuments()).toBe(2);
  });
  it('creates catalog plans and starts an followup with plan contracts and validity', async () => {
    const patient = await Patient.create({ fullName: 'Ana Teste' });
    const massage = await Procedure.create({ name: 'Massagem', baseSessions: 1, priceCents: 8000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    const cupping = await Procedure.create({ name: 'Ventosa', baseSessions: 4, priceCents: 5000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    const contract = await (await post('/api/contracts', { title: 'Contrato do plano', kind: 'standard', content: 'texto' })).json() as any;
    const items = [{ offerType: 'procedure', offerId: String(massage._id) }, { offerType: 'procedure', offerId: String(cupping._id) }];
    expect((await post('/api/plans', { name: 'Plano relax', priceCents: 30000, items: [] })).status).toBe(400);
    expect((await post('/api/plans', { name: 'Plano relax', priceCents: 30000, items: [{ offerType: 'procedure', offerId: '000000000000000000000000' }] })).status).toBe(404);
    const plan = await (await post('/api/plans', { name: 'Plano relax', priceCents: 30000, durationDays: 90, validityDays: 120, items, contractIds: [contract._id] })).json() as any;
    const followup = await (await post('/api/followups', { patientId: String(patient._id), offerType: 'plan', offerId: plan._id })).json() as any;
    expect(followup).toMatchObject({ offerType: 'plan', offerName: 'Plano relax', priceCents: 30000 });
    expect(followup.items.map((item: any) => item.procedureName)).toEqual(['Massagem', 'Ventosa']);
    expect(followup.contracts).toHaveLength(1);
    expect(new Date(followup.validUntil).getTime()).toBeGreaterThan(Date.now() + 119 * 86400000);
  });
  it('blocks appointments while a required anamnesis is pending and reuses answers within their validity', async () => {
    const patient = await Patient.create({ fullName: 'Joana Teste' });
    const procedure = await Procedure.create({ name: 'Ventosaterapia', baseSessions: 2, priceCents: 9000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    const form = await (await post('/api/anamneses', { title: 'Anamnese corporal', schema: { type: 'object', properties: { queixa: { type: 'string' } } }, procedureIds: [String(procedure._id)], validityMonths: 6 })).json() as any;
    const combo = await comboOf(procedure);
    const start = () => startFollowup(patient, combo);
    const first = await start();
    const slot = { patientId: String(patient._id), items: [{ followupItemId: first.items[0]._id }], startsAt: '2030-01-01T10:00:00Z', endsAt: '2030-01-01T11:00:00Z' };
    const blocked = await post('/api/appointments', slot);
    expect(blocked.status).toBe(409);
    expect((await blocked.json() as any).error).toContain('Anamnese corporal');
    const [listed] = await (await app.request('/api/followups')).json() as any[];
    expect(listed).toMatchObject({ blocked: true, anamneses: [{ title: 'Anamnese corporal', answered: false }] });

    expect((await post(`/api/patient-anamneses/${listed.anamneses[0].id}/answers`, { answers: 'x' })).status).toBe(400);
    expect((await post(`/api/patient-anamneses/${listed.anamneses[0].id}/answers`, { answers: { queixa: 'Dor lombar' } })).status).toBe(201);
    expect((await post(`/api/patient-anamneses/${listed.anamneses[0].id}/answers`, { answers: {} })).status).toBe(404);
    const [answered] = await (await app.request('/api/followups')).json() as any[];
    expect(answered).toMatchObject({ blocked: false, anamneses: [{ answered: true, answers: { queixa: 'Dor lombar' } }] });
    const months = (new Date(answered.anamneses[0].validUntil).getTime() - Date.now()) / 86400000;
    expect(months).toBeGreaterThan(175);
    expect(months).toBeLessThan(190);
    expect((await post('/api/appointments', slot)).status).toBe(201);

    const second = await start();
    expect((await post('/api/appointments', { ...slot, items: [{ followupItemId: second.items[0]._id }] })).status).toBe(201);
    const forced = await start();
    await Combo.updateOne({ _id: combo._id }, { requireNewAnamnesis: true });
    const again = await start();
    const followups = await (await app.request('/api/followups')).json() as any[];
    expect(followups.find((item) => item._id === again._id)).toMatchObject({ blocked: true });
    expect(followups.find((item) => item._id === forced._id)).toMatchObject({ blocked: false, anamneses: [] });
  });
  it('requires price and validity for promotional combos and applies them to an followup', async () => {
    const patient = await Patient.create({ fullName: 'Ana Teste' });
    const procedure = await Procedure.create({ name: 'Drenagem', baseSessions: 4, priceCents: 20000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    const items = [{ procedureId: String(procedure._id), sessionsOverride: 6 }];
    expect((await post('/api/combos', { name: 'Combo verão', priceCents: 120000, promotionalPriceCents: 70000, items })).status).toBe(400);
    const standard = await post('/api/combos', { name: 'Combo padrão', priceCents: 120000, items });
    expect(standard.status).toBe(201);
    const promo = await (await post('/api/combos', { name: 'Combo verão', priceCents: 120000, promotionalPriceCents: 70000, validUntil: '2999-01-01', items })).json() as any;
    const followup = await post('/api/followups', { patientId: String(patient._id), offerType: 'combo', offerId: promo._id });
    expect(followup.status).toBe(201);
    const created = await followup.json() as any;
    expect(created.priceCents).toBe(70000);
    expect(created.items[0].sessionsTotal).toBe(6);
  });
  it('edits procedures and combos, toggles them inactive and ignores unknown fields', async () => {
    const put = (path: string, body: unknown) => app.request(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const procedure = await (await post('/api/procedures', { name: 'Peeling', baseSessions: 2, durationMinutes: 60, priceCents: 10000, sessionSchema: { type: 'object', properties: {} } })).json() as any;
    const updated = await (await put(`/api/procedures/${procedure._id}`, { priceCents: 12000, active: false, versions: [], _id: '000000000000000000000000' })).json() as any;
    expect(updated).toMatchObject({ _id: procedure._id, name: 'Peeling', priceCents: 12000, active: false });
    expect(updated.versions).toHaveLength(1);
    expect((await put(`/api/procedures/${procedure._id}`, { priceCents: -1 })).status).toBe(400);
    expect((await put(`/api/procedures/${procedure._id}`, { sessionSchema: { type: 'array' } })).status).toBe(400);
    expect((await post('/api/followups', { patientId: String((await Patient.create({ fullName: 'Lia Teste' }))._id), offerType: 'procedure', offerId: procedure._id })).status).toBe(400);

    const items = [{ procedureId: procedure._id, sessionsOverride: 3 }];
    const combo = await (await post('/api/combos', { name: 'Combo A', priceCents: 40000, items })).json() as any;
    const renamed = await (await put(`/api/combos/${combo._id}`, { name: 'Combo B', active: false })).json() as any;
    expect(renamed).toMatchObject({ name: 'Combo B', active: false, priceCents: 40000 });
    expect((await put(`/api/combos/${combo._id}`, { promotionalPriceCents: 20000 })).status).toBe(400);
    const promo = await (await put(`/api/combos/${combo._id}`, { priceCents: 70000, promotionalPriceCents: 20000, validUntil: '2999-01-01', items: [{ procedureId: procedure._id, sessionsOverride: 5 }] })).json() as any;
    expect(promo).toMatchObject({ promotionalPriceCents: 20000 });
    expect(promo.items[0].sessionsOverride).toBe(5);
    expect((await put(`/api/combos/${combo._id}`, { items: [] })).status).toBe(400);
    // integral = 12000 × 5 = 60000: combo não pode ficar abaixo, promoção não pode passar do preço do combo
    expect((await put(`/api/combos/${combo._id}`, { priceCents: 59999 })).status).toBe(400);
    expect((await put(`/api/combos/${combo._id}`, { promotionalPriceCents: 70001, validUntil: '2999-01-01' })).status).toBe(400);
    expect((await post('/api/combos', { name: 'Barato', priceCents: 1000, items })).status).toBe(400);
    expect((await put('/api/combos/000000000000000000000000', { name: 'Nada' })).status).toBe(404);
  });
  it('edits an anamnesis as a new version and records rollbacks with their origin', async () => {
    const schemaOf = (name: string) => ({ type: 'object', properties: { [name]: { type: 'string' } } });
    const created = await (await post('/api/anamneses', { title: 'Facial', schema: schemaOf('a') })).json() as any;
    const edited = await (await post(`/api/anamneses/${created._id}/versions`, { schema: schemaOf('b') })).json() as any;
    expect(edited).toMatchObject({ version: 2, origin: 'edited', restoredFromVersion: null });
    const rollback = await (await post(`/api/anamneses/${created._id}/versions`, { restoreVersion: 1 })).json() as any;
    expect(rollback).toMatchObject({ version: 3, origin: 'restored', restoredFromVersion: 1, schema: schemaOf('a') });
    expect((await post(`/api/anamneses/${created._id}/versions`, { restoreVersion: 9 })).status).toBe(404);
    const renamed = await app.request(`/api/anamneses/${created._id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Facial completo' }) });
    expect(renamed.status).toBe(200);
    const [stored] = await (await app.request('/api/anamneses')).json() as any[];
    expect(stored.title).toBe('Facial completo');
    expect(stored.versions).toHaveLength(3);
  });
  it('deletes appointments and follows up an attendance with notes, data and photos', async () => {
    const patient = await Patient.create({ fullName: 'Maria Teste' });
    const procedure = await Procedure.create({ name: 'Peeling', baseSessions: 3, priceCents: 10000, sessionSchema: { type: 'object', properties: { produto: { type: 'string' } } }, versions: [] });
    const followup = await startFollowup(patient, await comboOf(procedure));
    const itemId = followup.items[0]._id;
    const appointment = await (await post('/api/appointments', { patientId: String(patient._id), items: [{ followupItemId: itemId }], startsAt: '2030-01-01T10:00:00Z', endsAt: '2030-01-01T11:00:00Z' })).json() as any;
    expect((await app.request(`/api/appointments/${appointment._id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await app.request(`/api/appointments/${appointment._id}`, { method: 'DELETE' })).status).toBe(404);

    const attendance = await (await post('/api/attendances', { followupId: followup._id, followupItemId: itemId, data: { produto: 'Ácido' } })).json() as any;
    const patch = (body: unknown) => app.request(`/api/attendances/${attendance._id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await patch({ notes: ' Pele sensível ', data: { produto: 'Ácido mandélico' } })).status).toBe(200);
    expect((await patch({ data: [] })).status).toBe(400);
    expect((await post(`/api/attendances/${attendance._id}/photos`, { objectKey: 'uploads/abc-123', phase: 'before', notes: 'Antes' })).status).toBe(201);
    expect((await post(`/api/attendances/${attendance._id}/photos`, { objectKey: 'uploads/abc-123', phase: 'sideways' })).status).toBe(400);
    const stored = await (await app.request(`/api/attendances/${attendance._id}`)).json() as any;
    expect(stored).toMatchObject({ notes: 'Pele sensível', data: { produto: 'Ácido mandélico' }, patientId: { fullName: 'Maria Teste' } });
    expect(stored.photos).toHaveLength(1);
    expect(stored.photos[0]).toMatchObject({ phase: 'before', notes: 'Antes', objectKey: 'uploads/abc-123' });
    expect((await app.request('/api/attendances/000000000000000000000000')).status).toBe(404);
  });
  it('summarizes the patient relationship: attendances, time, paid and pending values', async () => {
    const patient = await Patient.create({ fullName: 'Rita Teste' });
    const procedure = await Procedure.create({ name: 'Drenagem', baseSessions: 4, priceCents: 10000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    const followup = await startFollowup(patient, await comboOf(procedure));
    const itemId = followup.items[0]._id;
    const appointment = await (await post('/api/appointments', { patientId: String(patient._id), items: [{ followupItemId: itemId }], startsAt: '2030-01-01T10:00:00Z', endsAt: '2030-01-01T11:30:00Z' })).json() as any;
    expect((await post('/api/attendances', { followupId: followup._id, followupItemId: itemId, durationMinutes: -5 })).status).toBe(400);
    const first = await (await post('/api/attendances', { followupId: followup._id, followupItemId: itemId, appointmentId: appointment._id })).json() as any;
    expect(first.durationMinutes).toBe(60);
    await post('/api/attendances', { followupId: followup._id, followupItemId: itemId, durationMinutes: 30 });
    expect((await post('/api/payments', { followupId: followup._id, amountCents: 15000, method: 'pix' })).status).toBe(201);
    const report = await (await app.request(`/api/patients/${patient._id}/relationship`)).json() as any;
    expect(report.totals).toMatchObject({ followups: 1, attendancesPerformed: 2, attendancesContracted: 4, minutesTotal: 90, contractedCents: 40000, paidCents: 15000, pendingCents: 25000, dueForPerformedCents: 5000 });
    expect(report.monthly.at(-1)).toMatchObject({ attendances: 2, minutes: 90, paidCents: 15000 });
    expect(report.procedures).toEqual([{ name: 'Drenagem', attendances: 2, minutes: 90 }]);
    expect(report.nextAppointmentAt).toBe('2030-01-01T10:00:00.000Z');
    expect((await app.request('/api/patients/000000000000000000000000/relationship')).status).toBe(404);
  });
  it('creates an anamnesis request, saves draft and accepts one submission', async () => {
    const patient = await Patient.create({ fullName: 'Joana Teste' });
    const anamnesis = await (await post('/api/anamneses', { title: 'Saúde', schema: { type: 'object', properties: { allergies: { type: 'string' } } } })).json() as any;
    const applied = await (await post('/api/patient-anamneses', { patientId: String(patient._id), anamnesisId: anamnesis._id })).json() as any;
    const request = await (await post('/api/anamnesis-requests', { patientAnamnesisId: applied._id })).json() as any;
    const token = request.url.split('/').at(-1);
    expect((await app.request(`/public/anamnesis/${token}`)).status).toBe(200);
    expect((await app.request(`/public/anamnesis/${token}/draft`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draft: { allergies: 'Pólen' } }) })).status).toBe(200);
    expect((await app.request(`/public/anamnesis/${token}/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers: { allergies: 'Pólen' } }) })).status).toBe(201);
    expect((await app.request(`/public/anamnesis/${token}/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers: {} }) })).status).toBe(409);
  });
});
