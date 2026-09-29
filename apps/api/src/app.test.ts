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
