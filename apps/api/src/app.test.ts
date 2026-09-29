import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from './app';
import { Patient, Procedure, Plan, connectDatabase } from '@clinicare/db';

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await connectDatabase(mongo.getUri());
}, 120_000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); }, 20_000);
beforeEach(async () => { await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))); });

const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

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
  it('creates a procedure with dynamic schema and keeps schema versions', async () => {
    const response = await post('/api/procedures', { name: 'Limpeza facial', baseSessions: 2, durationMinutes: 45, priceCents: 20000, sessionSchema: { type: 'object', properties: { intensity: { type: 'string' } } } });
    expect(response.status).toBe(201);
    const procedure = await response.json() as any;
    const edit = await app.request(`/api/procedures/${procedure._id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...procedure, sessionSchema: { type: 'object', properties: { intensity: { type: 'string' }, notes: { type: 'string' } } } }) });
    expect((await edit.json() as any).versions).toHaveLength(2);
  });
  it('applies offer snapshots and rejects duplicate patient offer', async () => {
    const patient = await Patient.create({ fullName: 'Maria Teste' });
    const procedure = await Procedure.create({ name: 'Peeling', baseSessions: 3, priceCents: 10000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    const body = { patientId: String(patient._id), offerType: 'procedure', offerId: String(procedure._id), priceCents: 10000 };
    expect((await post('/api/plans', body)).status).toBe(201);
    expect((await post('/api/plans', body)).status).toBe(409);
    expect(await Plan.countDocuments()).toBe(1);
  });
  it('requires price and validity for promotional combos and applies them to a plan', async () => {
    const patient = await Patient.create({ fullName: 'Ana Teste' });
    const procedure = await Procedure.create({ name: 'Drenagem', baseSessions: 4, priceCents: 20000, sessionSchema: { type: 'object', properties: {} }, versions: [] });
    const items = [{ procedureId: String(procedure._id), sessionsOverride: 6 }];
    expect((await post('/api/combos', { name: 'Combo verão', priceCents: 90000, promotionalPriceCents: 70000, items })).status).toBe(400);
    const standard = await post('/api/combos', { name: 'Combo padrão', priceCents: 90000, items });
    expect(standard.status).toBe(201);
    const promo = await (await post('/api/combos', { name: 'Combo verão', priceCents: 90000, promotionalPriceCents: 70000, validUntil: '2999-01-01', items })).json() as any;
    const plan = await post('/api/plans', { patientId: String(patient._id), offerType: 'combo', offerId: promo._id, priceCents: 1 });
    expect(plan.status).toBe(201);
    const created = await plan.json() as any;
    expect(created.priceCents).toBe(70000);
    expect(created.items[0].sessionsTotal).toBe(6);
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
  it('deletes appointments and follows up a session with notes, data and photos', async () => {
    const patient = await Patient.create({ fullName: 'Maria Teste' });
    const procedure = await Procedure.create({ name: 'Peeling', baseSessions: 3, priceCents: 10000, sessionSchema: { type: 'object', properties: { produto: { type: 'string' } } }, versions: [] });
    const plan = await (await post('/api/plans', { patientId: String(patient._id), offerType: 'procedure', offerId: String(procedure._id), priceCents: 10000 })).json() as any;
    const itemId = plan.items[0]._id;
    const appointment = await (await post('/api/appointments', { patientId: String(patient._id), planItemIds: [itemId], startsAt: '2030-01-01T10:00:00Z', endsAt: '2030-01-01T11:00:00Z' })).json() as any;
    expect((await app.request(`/api/appointments/${appointment._id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await app.request(`/api/appointments/${appointment._id}`, { method: 'DELETE' })).status).toBe(404);

    const session = await (await post('/api/sessions', { planId: plan._id, planItemId: itemId, data: { produto: 'Ácido' } })).json() as any;
    const patch = (body: unknown) => app.request(`/api/sessions/${session._id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await patch({ notes: ' Pele sensível ', data: { produto: 'Ácido mandélico' } })).status).toBe(200);
    expect((await patch({ data: [] })).status).toBe(400);
    expect((await post(`/api/sessions/${session._id}/photos`, { objectKey: 'uploads/abc-123', phase: 'before', notes: 'Antes' })).status).toBe(201);
    expect((await post(`/api/sessions/${session._id}/photos`, { objectKey: 'uploads/abc-123', phase: 'sideways' })).status).toBe(400);
    const stored = await (await app.request(`/api/sessions/${session._id}`)).json() as any;
    expect(stored).toMatchObject({ notes: 'Pele sensível', data: { produto: 'Ácido mandélico' }, patientId: { fullName: 'Maria Teste' } });
    expect(stored.photos).toHaveLength(1);
    expect(stored.photos[0]).toMatchObject({ phase: 'before', notes: 'Antes', objectKey: 'uploads/abc-123' });
    expect((await app.request('/api/sessions/000000000000000000000000')).status).toBe(404);
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
