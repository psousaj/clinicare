import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { app } from './app';
import { closeDatabase, eventContracts, eventItems, events, getDatabase, migrateDatabase, combos, comboItems, contracts, contractVersions, procedures, procedureVersions, anamneses, anamnesisProcedures, anamnesisVersions } from '@clinicare/db';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';

const tenantIds = [crypto.randomUUID(), crypto.randomUUID()];
let clinics: IntegrationClinic[];
const headers = (clinic: IntegrationClinic) => clinic.headers();
const request = (tenantId: string, path: string, method = 'GET', body?: unknown) => app.request(path, { method, headers: headers(clinics.find((clinic) => clinic.tenantId === tenantId)!), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const schema = { type: 'object', properties: { pain: { type: 'string' } } };
const civilDate = (daysFromNow: number) => {
  const date = new Date(Date.now() + daysFromNow * 86400000);
  return date.toISOString().slice(0, 10);
};

integration('events catalog API with PostgreSQL', () => {
  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    clinics = [await provisionIntegrationClinic(app, 'events-a', tenantIds[0]!), await provisionIntegrationClinic(app, 'events-b', tenantIds[1]!)];
  });
  afterAll(async () => {
    const db = getDatabase();
    for (const table of [eventContracts, eventItems, events, comboItems, combos, anamnesisProcedures, anamnesisVersions, anamneses, contractVersions, contracts, procedureVersions, procedures]) await db.delete(table).where(inArray((table as any).tenantId, tenantIds));
    await cleanupIntegrationClinics(tenantIds);
    await closeDatabase();
  });

  async function fixtures(tenantId: string) {
    const procedure = await (await request(tenantId, '/api/procedures', 'POST', { name: `Evento proc ${crypto.randomUUID()}`, durationMinutes: 30, priceCents: 1000, sessionSchema: schema })).json() as any;
    const comboResponse = await request(tenantId, '/api/combos', 'POST', { name: `Evento combo ${crypto.randomUUID()}`, priceCents: 1500, items: [{ procedureId: procedure.id, sessions: 1 }] });
    expect(comboResponse.status).toBe(201);
    const combo = await comboResponse.json() as any;
    const contract = (await (await request(tenantId, '/api/contracts', 'POST', { title: `Evento contrato ${crypto.randomUUID()}`, kind: 'standard' })).json()) as any;
    return { procedure, combo, contract };
  }

  function eventBody(f: { procedure: any; combo: any; contract: any }, overrides: Record<string, unknown> = {}) {
    return {
      name: 'Dia da clínica',
      eventDate: civilDate(7),
      items: [
        { kind: 'procedure', procedureId: f.procedure.id, sessions: 1 },
        { kind: 'combo', comboId: f.combo.id },
      ],
      contractIds: [f.contract.id],
      ...overrides,
    };
  }

  it('creates, lists, updates and deactivates an event without touching followups', async () => {
    const [a] = tenantIds;
    const f = await fixtures(a!);
    const createdResponse = await request(a!, '/api/events', 'POST', eventBody(f));
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as any;
    expect(created.name).toBe('Dia da clínica');
    expect(created.eventDate).toBe(eventBody(f).eventDate);
    expect(created.items).toHaveLength(2);
    expect(created.contractIds).toEqual([f.contract.id]);

    const listed = await (await request(a!, '/api/events')).json() as any[];
    expect(listed.some((row) => row.id === created.id)).toBe(true);

    const updatedResponse = await request(a!, `/api/events/${created.id}`, 'PUT', { name: 'Dia da clínica renomeado' });
    expect(updatedResponse.status).toBe(200);
    expect((await updatedResponse.json()).name).toBe('Dia da clínica renomeado');

    const deactivated = await request(a!, `/api/events/${created.id}`, 'PUT', { active: false });
    expect(deactivated.status).toBe(200);
    expect((await deactivated.json()).active).toBe(false);
  });

  it('allows date-only correction without resending the menu', async () => {
    const [a] = tenantIds;
    const f = await fixtures(a!);
    const created = await (await request(a!, '/api/events', 'POST', eventBody(f))).json() as any;
    const nextDate = civilDate(14);
    const response = await request(a!, `/api/events/${created.id}`, 'PUT', { eventDate: nextDate });
    expect(response.status).toBe(200);
    const updated = await response.json() as any;
    expect(updated.eventDate).toBe(nextDate);
    expect(updated.items).toHaveLength(2);
    expect(updated.contractIds).toEqual([f.contract.id]);
  });

  it('rejects empty menu, missing contract and invalid civil date', async () => {
    const [a] = tenantIds;
    const f = await fixtures(a!);
    expect((await request(a!, '/api/events', 'POST', eventBody(f, { items: [] }))).status).toBe(400);
    expect((await request(a!, '/api/events', 'POST', eventBody(f, { contractIds: [] }))).status).toBe(400);
    expect((await request(a!, '/api/events', 'POST', eventBody(f, { eventDate: '2026-13-40' }))).status).toBe(400);
    expect((await request(a!, '/api/events', 'POST', eventBody(f, { eventDate: null }))).status).toBe(400);
  });

  it('rejects menu sessions below the procedure minimum with a 400', async () => {
    const [a] = tenantIds;
    const f = await fixtures(a!);
    const base = await (await request(a!, '/api/procedures', 'POST', { name: `Evento base ${crypto.randomUUID()}`, durationMinutes: 30, baseSessions: 2, priceCents: 500, sessionSchema: schema })).json() as any;
    const response = await request(a!, '/api/events', 'POST', eventBody(f, { items: [{ kind: 'procedure', procedureId: base.id, sessions: 1 }] }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Evento/);
  });

  it('rejects unknown menu references and duplicate menu entries', async () => {
    const [a] = tenantIds;
    const f = await fixtures(a!);
    const unknownProcedure = eventBody(f, { items: [{ kind: 'procedure', procedureId: crypto.randomUUID(), sessions: 1 }] });
    expect((await request(a!, '/api/events', 'POST', unknownProcedure)).status).toBe(400);
    const unknownCombo = eventBody(f, { items: [{ kind: 'combo', comboId: crypto.randomUUID() }] });
    expect((await request(a!, '/api/events', 'POST', unknownCombo)).status).toBe(400);
    const duplicate = eventBody(f, { items: [{ kind: 'procedure', procedureId: f.procedure.id, sessions: 1 }, { kind: 'procedure', procedureId: f.procedure.id, sessions: 1 }] });
    expect((await request(a!, '/api/events', 'POST', duplicate)).status).toBe(400);
  });

  it('isolates tenants and returns 404 for unknown events', async () => {
    const [a, b] = tenantIds;
    const f = await fixtures(a!);
    const created = await (await request(a!, '/api/events', 'POST', eventBody(f))).json() as any;
    expect(await (await request(b!, '/api/events')).json()).toHaveLength(0);
    expect((await request(a!, `/api/events/${crypto.randomUUID()}`, 'PUT', { name: 'x' })).status).toBe(404);
    expect(created.id).toBeTruthy();
  });
});
