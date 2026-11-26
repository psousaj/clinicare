import { afterAll, beforeAll, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { appliedDocuments, appointmentItems, appointments, attendances, clinicSubscriptions, closeDatabase, comboItems, combos, contractVersions, contracts, documentCleanupJobs, followupContracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase, patients, payments, planVersionContracts, planVersionItems, planVersions, plans, procedureVersions, procedures, signatureParticipants, signatureProcesses, signatureTokens } from '@clinicare/db';
import { app } from './app';
import { deleteAppliedDocument } from './clinical';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';

integration('SaaS offer capabilities through API with PostgreSQL', () => {
  let free: IntegrationClinic;
  let standard: IntegrationClinic;
  const tenantIds: string[] = [];
  const cleanupDocumentIds: Array<[string, string]> = [];

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
    for (const [tenantId, documentId] of cleanupDocumentIds) {
      await deleteAppliedDocument(tenantId, documentId);
    }
    await db.delete(documentCleanupJobs).where(eq(documentCleanupJobs.tenantId, standard.tenantId));
    for (const table of [appliedDocuments, signatureTokens, signatureParticipants, signatureProcesses, attendances, appointmentItems, appointments, payments, followupSnapshots, followupItems, followupContracts, followups, planVersionContracts, planVersionItems, planVersions, plans, contractVersions, contracts, comboItems, combos, procedureVersions, procedures, patients]) {
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
    const appliedContractId = crypto.randomUUID(), contractId = crypto.randomUUID(), processId = crypto.randomUUID(), participantId = crypto.randomUUID();
    await getDatabase().insert(contracts).values({ id: contractId, tenantId: standard.tenantId, title: 'Contrato congelável', kind: 'standard', currentVersion: 1 });
    await getDatabase().insert(contractVersions).values({ tenantId: standard.tenantId, contractId, version: 1, content: 'Conteúdo histórico' });
    await getDatabase().insert(followupContracts).values({
      id: appliedContractId, tenantId: standard.tenantId, followupId: paidFollowup.id,
      contractId, contractVersion: 1, titleSnapshot: 'Contrato congelável',
    });
    const appliedDocumentId = crypto.randomUUID();
    await getDatabase().insert(appliedDocuments).values({ id: appliedDocumentId, tenantId: standard.tenantId, followupContractId: appliedContractId });
    cleanupDocumentIds.push([standard.tenantId, appliedDocumentId]);
    await getDatabase().insert(signatureProcesses).values({ id: processId, tenantId: standard.tenantId, followupContractId: appliedContractId });
    await getDatabase().insert(signatureParticipants).values({ id: participantId, tenantId: standard.tenantId, processId, role: 'patient' });
    const signatureToken = `freeze-token-${crypto.randomUUID()}`;
    await getDatabase().insert(signatureTokens).values({
      tenantId: standard.tenantId, participantId,
      tokenHash: createHash('sha256').update(signatureToken).digest('hex'),
      expiresAt: new Date(Date.now() + 86400000),
    });
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
    const originalValidity = new Date(Date.now() + 30 * 86400000);
    await getDatabase().update(followups).set({ validUntil: originalValidity }).where(eq(followups.id, paidFollowup.id));
    const beforeFreeze = await (await app.request(`/api/followups/${paidFollowup.id}`, { headers: standardHeaders })).json() as { validUntil: string | null };
    expect(beforeFreeze.validUntil).not.toBeNull();
    const persistedBeforeFreeze = {
      followup: await getDatabase().select().from(followups).where(eq(followups.id, paidFollowup.id)),
      items: await getDatabase().select().from(followupItems).where(eq(followupItems.followupId, paidFollowup.id)),
      snapshots: await getDatabase().select().from(followupSnapshots).where(eq(followupSnapshots.followupId, paidFollowup.id)),
      payments: await getDatabase().select().from(payments).where(eq(payments.followupId, paidFollowup.id)),
      contracts: await getDatabase().select().from(followupContracts).where(eq(followupContracts.id, appliedContractId)),
      documents: await getDatabase().select().from(appliedDocuments).where(eq(appliedDocuments.id, appliedDocumentId)),
      processes: await getDatabase().select().from(signatureProcesses).where(eq(signatureProcesses.id, processId)),
      participants: await getDatabase().select().from(signatureParticipants).where(eq(signatureParticipants.id, participantId)),
      tokens: await getDatabase().select().from(signatureTokens).where(eq(signatureTokens.participantId, participantId)),
    };
    await getDatabase().update(clinicSubscriptions).set({ status: 'paused' }).where(eq(clinicSubscriptions.tenantId, standard.tenantId));
    expect(await (await app.request('/api/saas/subscription', { headers: standardHeaders })).json()).toMatchObject({ effectivePlan: 'free', subscription: { status: 'paused', planId: 'standard' } });
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
    for (const action of ['generate', 'retry', 'reprocess']) {
      expect((await app.request(`/api/followup-contracts/${appliedContractId}/${action}`, {
        method: 'POST', headers: standardHeaders,
      })).status).toBe(403);
    }
    expect((await app.request(`/api/followup-contracts/${appliedContractId}/documents/presign`, {
      method: 'POST', headers: standardHeaders, body: JSON.stringify({}),
    })).status).toBe(403);
    expect((await app.request(`/api/followup-contracts/${appliedContractId}/documents`, {
      method: 'POST', headers: standardHeaders, body: JSON.stringify({}),
    })).status).toBe(403);
    expect((await app.request(`/api/signature-participants/${participantId}/refresh`, {
      method: 'POST', headers: standardHeaders,
    })).status).toBe(403);
    expect((await app.request(`/api/applied-documents/${appliedDocumentId}`, {
      method: 'DELETE', headers: standardHeaders,
    })).status).toBe(403);
    for (const action of [
      `/public/signatures/${signatureToken}/verify-phone`,
      `/public/signatures/${signatureToken}/preview`,
      `/public/signatures/${signatureToken}/confirm`,
      `/public/signatures/${signatureToken}/external/export`,
      `/public/signatures/${signatureToken}/external/import`,
      `/public/signatures/${signatureToken}/external/confirm`,
      `/public/signatures/${signatureToken}/external/cancel`,
      `/api/signature-participants/${participantId}/preview`,
      `/api/signature-participants/${participantId}/external/export`,
      `/api/signature-participants/${participantId}/external/import`,
      `/api/signature-participants/${participantId}/external/confirm`,
      `/api/signature-participants/${participantId}/external/cancel`,
      `/api/signature-participants/${participantId}/confirm`,
    ]) {
      expect((await app.request(action, {
        method: 'POST', headers: standardHeaders, body: JSON.stringify({}),
      })).status).toBe(403);
    }
    const afterFreeze = await (await app.request(`/api/followups/${paidFollowup.id}`, { headers: standardHeaders })).json();
    expect(afterFreeze).toEqual(beforeFreeze);
    expect({
      followup: await getDatabase().select().from(followups).where(eq(followups.id, paidFollowup.id)),
      items: await getDatabase().select().from(followupItems).where(eq(followupItems.followupId, paidFollowup.id)),
      snapshots: await getDatabase().select().from(followupSnapshots).where(eq(followupSnapshots.followupId, paidFollowup.id)),
      payments: await getDatabase().select().from(payments).where(eq(payments.followupId, paidFollowup.id)),
      contracts: await getDatabase().select().from(followupContracts).where(eq(followupContracts.id, appliedContractId)),
      documents: await getDatabase().select().from(appliedDocuments).where(eq(appliedDocuments.id, appliedDocumentId)),
      processes: await getDatabase().select().from(signatureProcesses).where(eq(signatureProcesses.id, processId)),
      participants: await getDatabase().select().from(signatureParticipants).where(eq(signatureParticipants.id, participantId)),
      tokens: await getDatabase().select().from(signatureTokens).where(eq(signatureTokens.participantId, participantId)),
    }).toEqual(persistedBeforeFreeze);
    await getDatabase().update(clinicSubscriptions).set({ status: 'inactive', endedAt: new Date() }).where(eq(clinicSubscriptions.tenantId, standard.tenantId));
    expect(await (await app.request('/api/saas/subscription', { headers: standardHeaders })).json()).toMatchObject({ effectivePlan: 'free', subscription: { status: 'inactive', planId: 'standard' } });
    await getDatabase().insert(clinicSubscriptions).values({
      tenantId: standard.tenantId, planId: 'standard', status: 'active', startedAt: new Date(),
    });
    expect(await (await app.request('/api/saas/subscription', { headers: standardHeaders })).json()).toMatchObject({ effectivePlan: 'standard', subscription: { status: 'active', planId: 'standard' } });
    expect((await app.request('/api/payments', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ followupId: paidFollowup.id, amountCents: 100, method: 'cash' }),
    })).status).toBe(201);
    const resumedFollowup = await (await app.request(`/api/followups/${paidFollowup.id}`, { headers: standardHeaders })).json() as { id?: string; _id?: string; validUntil: string | null; payments: Array<{ amountCents: number }> };
    expect(resumedFollowup).toMatchObject({ id: paidFollowup.id, validUntil: beforeFreeze.validUntil });
    expect(resumedFollowup.payments.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(600);
    expect(await getDatabase().select().from(followupItems).where(eq(followupItems.followupId, paidFollowup.id))).toEqual(persistedBeforeFreeze.items);
    expect(await getDatabase().select().from(followupSnapshots).where(eq(followupSnapshots.followupId, paidFollowup.id))).toEqual(persistedBeforeFreeze.snapshots);
    expect(await getDatabase().select().from(followupContracts).where(eq(followupContracts.id, appliedContractId))).toEqual(persistedBeforeFreeze.contracts);
    expect(await getDatabase().select().from(appliedDocuments).where(eq(appliedDocuments.id, appliedDocumentId))).toEqual(persistedBeforeFreeze.documents);
    expect(await getDatabase().select().from(signatureProcesses).where(eq(signatureProcesses.id, processId))).toEqual(persistedBeforeFreeze.processes);
    expect(await getDatabase().select().from(signatureParticipants).where(eq(signatureParticipants.id, participantId))).toEqual(persistedBeforeFreeze.participants);
    expect(await getDatabase().select().from(signatureTokens).where(eq(signatureTokens.participantId, participantId))).toEqual(persistedBeforeFreeze.tokens);
    expect(await getDatabase().select().from(combos).where(eq(combos.tenantId, free.tenantId))).toHaveLength(0);
  });
});
