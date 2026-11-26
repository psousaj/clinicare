import { afterAll, beforeAll, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { appointmentItems, appointments, attendances, clinicSubscriptions, closeDatabase, comboItems, combos, contractVersions, contracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase, patients, payments, planVersionContracts, planVersionItems, planVersions, plans, procedureVersions, procedures } from '@clinicare/db';
import { app } from './app';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';

integration('SaaS offer capabilities through API with PostgreSQL', () => {
  let free: IntegrationClinic;
  let standard: IntegrationClinic;
  const tenantIds: string[] = [];

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    free = await provisionIntegrationClinic(app, 'entitlement-free');
    standard = await provisionIntegrationClinic(app, 'entitlement-standard');
    tenantIds.push(free.tenantId, standard.tenantId);
    await getDatabase().insert(clinicSubscriptions).values({
      tenantId: standard.tenantId, planId: 'standard', status: 'active', startedAt: new Date(),
    });
  });

  afterAll(async () => {
    const db = getDatabase();
    await db.delete(clinicSubscriptions).where(eq(clinicSubscriptions.tenantId, standard.tenantId));
    for (const table of [attendances, appointmentItems, appointments, payments, followupSnapshots, followupItems, followups, planVersionContracts, planVersionItems, planVersions, plans, contractVersions, contracts, comboItems, combos, procedureVersions, procedures, patients]) {
      for (const tenantId of tenantIds) await db.delete(table).where(eq((table as any).tenantId, tenantId));
    }
    await cleanupIntegrationClinics(tenantIds);
    await closeDatabase();
  });

  it('keeps standalone procedures available on Free and requires Standard to create, edit and apply combos or plans', async () => {
    const freeHeaders = free.headers();
    const standardHeaders = standard.headers();
    const freeProcedure = await app.request('/api/procedures', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ name: 'Free avulso', durationMinutes: 30, priceCents: 500 }),
    });
    expect(freeProcedure.status).toBe(201);
    const freeProcedureId = (await freeProcedure.json() as { id: string }).id;
    const freePatient = await (await app.request('/api/patients', {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({ fullName: 'Paciente avulso Free' }),
    })).json() as { id: string };
    const startsAt = new Date(Date.now() + 86400000);
    const freeAppointment = await app.request('/api/appointments', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({
        patientId: freePatient.id, startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 30 * 60000).toISOString(),
        items: [{ procedureId: freeProcedureId }],
      }),
    });
    expect(freeAppointment.status).toBe(201);
    const appointment = await freeAppointment.json() as { id: string };
    expect((await app.request(`/api/appointments/${appointment.id}/attendance`, {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({ durationMinutes: 30 }),
    })).status).toBe(201);
    const freeCombo = await app.request('/api/combos', {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({ name: 'Bloqueado', priceCents: 100, items: [] }),
    });
    expect(freeCombo.status).toBe(403);
    expect((await app.request(`/api/combos/${crypto.randomUUID()}`, {
      method: 'PUT', headers: freeHeaders, body: JSON.stringify({ name: 'Bloqueado', priceCents: 100, items: [] }),
    })).status).toBe(403);
    expect((await app.request('/api/plans', {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({ name: 'Bloqueado', priceCents: 100, items: [], contractIds: [] }),
    })).status).toBe(403);

    const procedure = await (await app.request('/api/procedures', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ name: 'Standard avulso', durationMinutes: 30, priceCents: 500 }),
    })).json() as { id: string };
    const combo = await app.request('/api/combos', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ name: 'Combo Standard', priceCents: 1000, items: [{ procedureId: procedure.id, sessions: 2 }] }),
    });
    expect(combo.status).toBe(201);
    const comboBody = await combo.json() as { id: string };
    expect((await app.request(`/api/combos/${comboBody.id}`, {
      method: 'PUT', headers: standardHeaders,
      body: JSON.stringify({ name: 'Combo Standard Editado', priceCents: 1000, items: [{ procedureId: procedure.id, sessions: 2 }] }),
    })).status).toBe(200);
    const patient = await (await app.request('/api/patients', {
      method: 'POST', headers: standardHeaders, body: JSON.stringify({ fullName: 'Paciente Standard' }),
    })).json() as { id: string };
    const applyCombo = await app.request('/api/followups', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ patientId: patient.id, offerType: 'combo', offerId: comboBody.id }),
    });
    expect(applyCombo.status).toBe(201);
    const appliedCombo = await applyCombo.json() as { offerType: string; items: Array<{ id: string }> };
    expect(appliedCombo.offerType).toBe('combo');
    expect((await app.request('/api/followups', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ patientId: patient.id, offerType: 'combo', offerId: comboBody.id }),
    })).status).toBe(403);
    const futureStart = new Date(Date.now() + 86400000);
    expect((await app.request('/api/appointments', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({
        patientId: patient.id, startsAt: futureStart.toISOString(),
        endsAt: new Date(futureStart.getTime() + 30 * 60000).toISOString(),
        items: [{ followupItemId: appliedCombo.items[0]!.id }],
      }),
    })).status).toBe(403);
    expect((await app.request('/api/attendances', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ followupItemId: appliedCombo.items[0]!.id }),
    })).status).toBe(403);
    const standardPlanResponse = await app.request('/api/plans', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ name: 'Plano Standard', priceCents: 2000, items: [{ offerType: 'procedure', offerId: procedure.id, sessions: 2 }], contractIds: [] }),
    });
    // Plans require an applicable contract; create one before exercising the successful plan cycle.
    expect(standardPlanResponse.status).toBe(400);
    const contract = await (await app.request('/api/contracts', {
      method: 'POST', headers: standardHeaders, body: JSON.stringify({ title: 'Contrato Standard', kind: 'standard' }),
    })).json() as { id: string };
    const planResponse = await app.request('/api/plans', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ name: 'Plano Standard', priceCents: 2000, items: [{ offerType: 'procedure', offerId: procedure.id, sessions: 2 }], contractIds: [contract.id] }),
    });
    expect(planResponse.status).toBe(201);
    const plan = await planResponse.json() as { id: string };
    expect((await app.request(`/api/plans/${plan.id}`, {
      method: 'PUT', headers: standardHeaders,
      body: JSON.stringify({ name: 'Plano Standard Editado', priceCents: 2000, items: [{ offerType: 'procedure', offerId: procedure.id, sessions: 2 }], contractIds: [contract.id] }),
    })).status).toBe(200);
    expect((await app.request(`/api/plans/${plan.id}`, {
      method: 'PUT', headers: freeHeaders,
      body: JSON.stringify({ name: 'Plano bloqueado', priceCents: 2000, items: [{ offerType: 'procedure', offerId: procedure.id, sessions: 2 }], contractIds: [contract.id] }),
    })).status).toBe(403);
    expect((await app.request('/api/followups', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ patientId: patient.id, offerType: 'plan', offerId: plan.id }),
    })).status).toBe(403);
    const paidPatient = await (await app.request('/api/patients', {
      method: 'POST', headers: standardHeaders, body: JSON.stringify({ fullName: 'Paciente congelado' }),
    })).json() as { id: string };
    const paidFollowupResponse = await app.request('/api/followups', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ patientId: paidPatient.id, offerType: 'combo', offerId: comboBody.id }),
    });
    expect(paidFollowupResponse.status).toBe(201);
    const paidFollowup = await paidFollowupResponse.json() as { id: string };
    const paymentResponse = await app.request('/api/payments', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ followupId: paidFollowup.id, amountCents: 500, method: 'cash' }),
    });
    expect(paymentResponse.status).toBe(201);
    const payment = await paymentResponse.json() as { id: string };
    const paidFollowupBody = await (await app.request(`/api/followups/${paidFollowup.id}`, { headers: standardHeaders })).json() as { items: Array<{ id: string; procedureId: string; procedureName: string }> };
    const paidAttendance = { id: crypto.randomUUID() };
    await getDatabase().insert(attendances).values({
      ...paidAttendance, tenantId: standard.tenantId, patientId: paidPatient.id,
      followupId: paidFollowup.id, followupItemId: paidFollowupBody.items[0]!.id,
      procedureId: paidFollowupBody.items[0]!.procedureId,
      procedureName: paidFollowupBody.items[0]!.procedureName, schemaSnapshot: {},
    });
    await getDatabase().delete(clinicSubscriptions).where(eq(clinicSubscriptions.tenantId, standard.tenantId));
    expect((await (await app.request('/api/combos', { headers: standardHeaders })).json() as Array<{ id: string }>).some((item) => item.id === comboBody.id)).toBe(true);
    expect((await (await app.request('/api/plans', { headers: standardHeaders })).json() as Array<{ id: string }>).some((item) => item.id === plan.id)).toBe(true);
    expect((await app.request(`/api/followups/${paidFollowup.id}/cancel`, {
      method: 'POST', headers: standardHeaders, body: JSON.stringify({ reason: 'Teste de downgrade' }),
    })).status).toBe(403);
    expect((await app.request('/api/payments', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ followupId: paidFollowup.id, amountCents: 500, method: 'cash' }),
    })).status).toBe(403);
    expect((await app.request(`/api/payments/${payment.id}`, {
      method: 'DELETE', headers: standardHeaders, body: JSON.stringify({ reason: 'Teste de downgrade' }),
    })).status).toBe(403);
    expect((await app.request('/api/uploads/presign', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ attendanceId: paidAttendance.id, contentType: 'image/jpeg', size: 100 }),
    })).status).toBe(403);
    expect((await app.request(`/api/attendances/${paidAttendance.id}/photos`, {
      method: 'POST', headers: standardHeaders, body: JSON.stringify({ objectKey: 'key', phase: 'before' }),
    })).status).toBe(403);
    expect((await app.request(`/api/attendances/${paidAttendance.id}/photos/${crypto.randomUUID()}`, {
      method: 'DELETE', headers: standardHeaders,
    })).status).toBe(403);
    expect(await getDatabase().select().from(combos).where(eq(combos.tenantId, free.tenantId))).toHaveLength(0);
  });
});
