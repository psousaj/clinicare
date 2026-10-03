import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { app } from './app';
import {
  appointments, appointmentItems, attendances, attendancePhotos, closeDatabase, comboItems, combos,
  followupContracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase, patients, procedures, tenants,
} from '@clinicare/db';

const integration = process.env.DATABASE_URL ? describe : describe.skip;
const tenantId = crypto.randomUUID();
const headers = { 'content-type': 'application/json', 'x-tenant-id': tenantId };
const request = (path: string, init: RequestInit = {}) => app.request(path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
const post = (path: string, body: unknown) => request(path, { method: 'POST', body: JSON.stringify(body) });
const patch = (path: string, body: unknown) => request(path, { method: 'PATCH', body: JSON.stringify(body) });

integration('PostgreSQL scheduling and attendance', () => {
  beforeAll(async () => {
    await migrateDatabase();
    await getDatabase().insert(tenants).values({ id: tenantId, name: `Scheduling ${tenantId}` });
  });

  afterAll(async () => {
    const db = getDatabase();
    await db.delete(attendancePhotos).where(eq(attendancePhotos.tenantId, tenantId));
    await db.delete(attendances).where(eq(attendances.tenantId, tenantId));
    await db.delete(appointmentItems).where(eq(appointmentItems.tenantId, tenantId));
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId));
    await db.delete(followupContracts).where(eq(followupContracts.tenantId, tenantId));
    await db.delete(followupSnapshots).where(eq(followupSnapshots.tenantId, tenantId));
    await db.delete(followupItems).where(eq(followupItems.tenantId, tenantId));
    await db.delete(followups).where(eq(followups.tenantId, tenantId));
    await db.delete(comboItems).where(eq(comboItems.tenantId, tenantId));
    await db.delete(combos).where(eq(combos.tenantId, tenantId));
    await db.delete(procedures).where(eq(procedures.tenantId, tenantId));
    await db.delete(patients).where(eq(patients.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await closeDatabase();
  });

  async function fixture(sessions = 2) {
    const patientId = crypto.randomUUID(), procedureId = crypto.randomUUID(), comboId = crypto.randomUUID();
    await getDatabase().insert(patients).values({ id: patientId, tenantId, fullName: `Paciente ${patientId}` });
    await getDatabase().insert(procedures).values({ id: procedureId, tenantId, name: `Procedimento ${procedureId}`, durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await getDatabase().insert(combos).values({ id: comboId, tenantId, name: `Combo ${comboId}`, priceCents: 100 });
    await getDatabase().insert(comboItems).values({ tenantId, comboId, procedureId, sessions });
    const followup = await (await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).json() as any;
    return { patientId, procedureId, followupId: followup.id, itemId: followup.items[0].id };
  }

  async function reserve(patientId: string, itemId: string, start = new Date(Date.now() + 86400000)) {
    return post('/api/appointments', { patientId, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60000).toISOString(), items: [{ followupItemId: itemId }] });
  }

  it('creates an active follow-up reservation and does not consume a session', async () => {
    const f = await fixture(2); const response = await reserve(f.patientId, f.itemId);
    expect(response.status).toBe(201);
    const item = (await getDatabase().select().from(followupItems).where(eq(followupItems.id, f.itemId)))[0]!;
    expect(item.sessionsPerformed).toBe(0);
  });

  it('serializes the last-session reservation as 201 and 409', async () => {
    const f = await fixture(1);
    const responses = await Promise.all([reserve(f.patientId, f.itemId), reserve(f.patientId, f.itemId, new Date(Date.now() + 2 * 86400000))]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  it('rejects generic confirmation updates without mutating the appointment', async () => {
    const f = await fixture(1); const appointment = await (await reserve(f.patientId, f.itemId)).json() as any;
    const response = await patch(`/api/appointments/${appointment.id}`, { status: 'confirmed' });
    expect([400, 409]).toContain(response.status);
    expect((await getDatabase().select().from(appointments).where(eq(appointments.id, appointment.id)))[0]!.status).toBe('planned');
    expect(await getDatabase().select().from(attendances).where(eq(attendances.appointmentId, appointment.id))).toHaveLength(0);
  });

  it('confirms idempotently only by rejecting a repeated confirmation', async () => {
    const f = await fixture(2); const appointment = await (await reserve(f.patientId, f.itemId)).json() as any;
    const first = await post(`/api/appointments/${appointment.id}/confirm`, {});
    expect(first.status).toBe(200);
    expect((await post(`/api/appointments/${appointment.id}/confirm`, {})).status).toBe(409);
    expect((await getDatabase().select().from(attendances).where(eq(attendances.appointmentId, appointment.id)))).toHaveLength(1);
  });

  it('deselects an item and releases its reservation', async () => {
    // Followup with 2 different procedures for the same patient
    const patientId = crypto.randomUUID(), proc1 = crypto.randomUUID(), proc2 = crypto.randomUUID(), comboId = crypto.randomUUID();
    await getDatabase().insert(patients).values({ id: patientId, tenantId, fullName: `Paciente multi ${patientId}` });
    await getDatabase().insert(procedures).values([
      { id: proc1, tenantId, name: `Proc1 ${proc1}`, durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } },
      { id: proc2, tenantId, name: `Proc2 ${proc2}`, durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } },
    ]);
    await getDatabase().insert(combos).values({ id: comboId, tenantId, name: `Combo ${comboId}`, priceCents: 200 });
    await getDatabase().insert(comboItems).values([
      { tenantId, comboId, procedureId: proc1, sessions: 1 },
      { tenantId, comboId, procedureId: proc2, sessions: 1 },
    ]);
    const followup = await (await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId })).json() as any;
    const item1 = followup.items.find((i: any) => i.procedureId === proc1);
    const item2 = followup.items.find((i: any) => i.procedureId === proc2);

    const appointmentRes = await post('/api/appointments', {
      patientId,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 + 60 * 60000).toISOString(),
      items: [{ followupItemId: item1.id }, { followupItemId: item2.id }],
    });
    expect(appointmentRes.status).toBe(201);
    const appointment = await appointmentRes.json() as any;
    const appItem1 = appointment.items.find((i: any) => i.followupItemId === item1.id);
    const appItem2 = appointment.items.find((i: any) => i.followupItemId === item2.id);

    // Confirm appointment selecting ONLY item 1; item 2 is deselected and its reservation is released
    const confirmRes = await post(`/api/appointments/${appointment.id}/confirm`, { selectedItemIds: [appItem1.id] });
    expect(confirmRes.status).toBe(200);

    const updatedAppItems = await getDatabase().select().from(appointmentItems).where(eq(appointmentItems.appointmentId, appointment.id));
    expect(updatedAppItems.find((i) => i.id === appItem2.id)!.confirmationStatus).toBe('deselected');

    // Item 2 reservation was released, so it can now be reserved in another appointment
    const secondReserveRes = await reserve(patientId, item2.id, new Date(Date.now() + 2 * 86400000));
    expect(secondReserveRes.status).toBe(201);
  });

  it('rejects cross-patient direct attendance and rolls back a failed confirmation', async () => {
    const f = await fixture(1), other = await fixture(1);
    expect((await post('/api/attendances', { patientId: other.patientId, followupItemId: f.itemId })).status).toBe(404);
    const appointment = await (await reserve(f.patientId, f.itemId)).json() as any;
    expect((await post(`/api/appointments/${appointment.id}/confirm`, { selectedItemIds: [crypto.randomUUID()] })).status).toBe(404);
    expect(await getDatabase().select().from(attendances).where(eq(attendances.appointmentId, appointment.id))).toHaveLength(0);
  });

  it('serializes concurrent confirmation of the last session', async () => {
    const f = await fixture(1); const appointment = await (await reserve(f.patientId, f.itemId)).json() as any;
    const responses = await Promise.all([post(`/api/appointments/${appointment.id}/confirm`, {}), post(`/api/appointments/${appointment.id}/confirm`, {})]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  });

  it('marks no-show only after the end and hides cancelled appointments', async () => {
    const f = await fixture(1); const appointment = await (await reserve(f.patientId, f.itemId, new Date(Date.now() - 2 * 86400000))).json() as any;
    expect((await post(`/api/appointments/${appointment.id}/no-show`, {})).status).toBe(200);
    expect((await request('/api/appointments')).json()).resolves.not.toContainEqual(expect.objectContaining({ id: appointment.id }));
  });

  it('reads and updates encrypted attendance data and notes', async () => {
    const f = await fixture(1); const appointment = await (await reserve(f.patientId, f.itemId)).json() as any;
    const attendance = await (await post(`/api/appointments/${appointment.id}/attendance`, { data: { pain: 1 }, notes: 'Inicial', durationMinutes: 30 })).json() as any;
    expect(attendance.id).toBeTruthy();
    expect(attendance._id).toBe(attendance.id);
    const read = await request(`/api/attendances/${attendance.id}`);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ id: attendance.id, data: { pain: 1 }, notes: 'Inicial' });
    const updated = await patch(`/api/attendances/${attendance.id}`, { data: { pain: 2 }, notes: 'Atualizado', durationMinutes: 45 });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ id: attendance.id, _id: attendance.id, data: { pain: 2 }, notes: 'Atualizado', durationMinutes: 45 });
    expect((await patch(`/api/attendances/${attendance.id}`, { durationMinutes: 1441 })).status).toBe(400);
    expect((await patch(`/api/attendances/${attendance.id}/cancel`, { reason: 'Correção' })).status).toBe(200);
    expect((await patch(`/api/attendances/${attendance.id}`, { data: { ignored: true } })).status).toBe(409);
  });

  it('restores a cancelled attendance and handles concurrent cancellation', async () => {
    const f = await fixture(1); const appointment = await (await reserve(f.patientId, f.itemId)).json() as any;
    const attendance = await (await post(`/api/appointments/${appointment.id}/attendance`, {})).json() as any;
    const item = (await getDatabase().select().from(followupItems).where(eq(followupItems.id, f.itemId)))[0]!;
    expect(item.sessionsPerformed).toBe(1);
    const responses = await Promise.all([
      request(`/api/attendances/${attendance.id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason: 'Correção' }) }),
      request(`/api/attendances/${attendance.id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason: 'Correção concorrente' }) }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 404]);
    expect((await getDatabase().select().from(followupItems).where(eq(followupItems.id, f.itemId)))[0]!.sessionsPerformed).toBe(0);
  });

  it('automatically completes a follow-up after its final attendance', async () => {
    const f = await fixture(1); const appointment = await (await reserve(f.patientId, f.itemId)).json() as any;
    await post(`/api/appointments/${appointment.id}/attendance`, {});
    expect((await getDatabase().select().from(followups).where(eq(followups.id, f.followupId)))[0]!.status).toBe('completed');
  });
});
