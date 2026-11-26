import { afterAll, beforeAll, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { appliedAnamneses, appliedDocumentRevisions, appliedDocuments, anamnesisProcedures, anamnesisVersions, anamneses, appointmentItems, appointments, attendancePhotos, attendances, clinicSubscriptions, closeDatabase, comboItems, combos, contractVersions, contracts, documentCleanupJobs, followupContracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase, patients, payments, planVersionContracts, planVersionItems, planVersions, plans, procedureVersions, procedures, signatureEvents, signatureEvidence, signatureExternalAttempts, signatureExternalReceipts, signatureOperations, signatureParticipants, signaturePreviewCandidates, signatureProcesses, signatureRevisions, signatureTokens } from '@clinicare/db';
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
    for (const table of [appliedAnamneses, signatureEvents, signatureEvidence, signatureRevisions, signaturePreviewCandidates, signatureExternalReceipts, signatureExternalAttempts, signatureOperations, signatureTokens, signatureParticipants, signatureProcesses, appliedDocumentRevisions, appliedDocuments, attendancePhotos, attendances, appointmentItems, appointments, payments, followupSnapshots, followupItems, followupContracts, followups, planVersionContracts, planVersionItems, planVersions, plans, contractVersions, contracts, comboItems, combos, anamnesisProcedures, anamnesisVersions, anamneses, procedureVersions, procedures, patients]) {
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
    expect((await app.request('/api/auth/default-signature', { headers: standardHeaders })).status).toBe(200);
    expect((await app.request('/api/auth/default-signature', {
      method: 'PUT', headers: standardHeaders, body: JSON.stringify({ signaturePng: null }),
    })).status).toBe(200);
    expect((await app.request('/api/signature-pending', { headers: standardHeaders })).status).toBe(200);
    expect(await (await app.request(`/public/signatures/${signatureToken}`)).json()).toMatchObject({ canSign: true, canGovBr: false });
    for (const govBrAction of [
      `/public/signatures/${signatureToken}/external/export`,
      `/public/signatures/${signatureToken}/external/import`,
      `/public/signatures/${signatureToken}/external/confirm`,
      `/public/signatures/${signatureToken}/external/cancel`,
      `/api/signature-participants/${participantId}/external/export`,
      `/api/signature-participants/${participantId}/external/import`,
      `/api/signature-participants/${participantId}/external/confirm`,
      `/api/signature-participants/${participantId}/external/cancel`,
    ]) {
      expect((await app.request(govBrAction, {
        method: 'POST', headers: standardHeaders, body: JSON.stringify({}),
      })).status).toBe(403);
    }
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
      documentRevisions: await getDatabase().select().from(appliedDocumentRevisions).where(eq(appliedDocumentRevisions.documentId, appliedDocumentId)),
      processes: await getDatabase().select().from(signatureProcesses).where(eq(signatureProcesses.id, processId)),
      participants: await getDatabase().select().from(signatureParticipants).where(eq(signatureParticipants.id, participantId)),
      tokens: await getDatabase().select().from(signatureTokens).where(eq(signatureTokens.participantId, participantId)),
      operations: await getDatabase().select().from(signatureOperations).where(eq(signatureOperations.participantId, participantId)),
      revisions: await getDatabase().select().from(signatureRevisions).where(eq(signatureRevisions.participantId, participantId)),
      evidence: await getDatabase().select().from(signatureEvidence).where(eq(signatureEvidence.participantId, participantId)),
      events: await getDatabase().select().from(signatureEvents).where(eq(signatureEvents.participantId, participantId)),
      externalAttempts: await getDatabase().select().from(signatureExternalAttempts).where(eq(signatureExternalAttempts.participantId, participantId)),
      externalReceipts: await getDatabase().select().from(signatureExternalReceipts).where(eq(signatureExternalReceipts.tenantId, standard.tenantId)),
      previews: await getDatabase().select().from(signaturePreviewCandidates).where(eq(signaturePreviewCandidates.participantId, participantId)),
    };
    await getDatabase().update(clinicSubscriptions).set({ status: 'paused' }).where(eq(clinicSubscriptions.tenantId, standard.tenantId));
    expect(await (await app.request('/api/saas/subscription', { headers: standardHeaders })).json()).toMatchObject({ effectivePlan: 'free', subscription: { status: 'paused', planId: 'standard' } });
    expect((await app.request('/api/auth/default-signature', { headers: standardHeaders })).status).toBe(403);
    expect((await app.request('/api/auth/default-signature', {
      method: 'PUT', headers: standardHeaders, body: JSON.stringify({ signaturePng: null }),
    })).status).toBe(403);
    expect((await app.request('/api/signature-pending', { headers: standardHeaders })).status).toBe(403);
    expect(await (await app.request(`/public/signatures/${signatureToken}`)).json()).toMatchObject({ canSign: false });
    expect((await app.request(`/api/signature-history?followupContractId=${appliedContractId}`, { headers: standardHeaders })).status).toBe(200);
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
    expect((await app.request(`/public/signatures/${signatureToken}/preview`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documentRevisionId: 'persisted-revision', fingerprint: 'a'.repeat(64), payload: {} }),
    })).status).toBe(403);
    expect((await app.request(`/public/signatures/${signatureToken}/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ evidence: { documentRevisionId: 'persisted-revision', fingerprint: 'a'.repeat(64), payload: {} } }),
    })).status).toBe(403);
    expect((await app.request(`/public/signatures/${signatureToken}/verify-phone`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    })).status).toBe(400);
    expect((await app.request(`/api/applied-documents/${appliedDocumentId}`, {
      method: 'DELETE', headers: standardHeaders,
    })).status).toBe(403);
    for (const action of [
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
      documentRevisions: await getDatabase().select().from(appliedDocumentRevisions).where(eq(appliedDocumentRevisions.documentId, appliedDocumentId)),
      processes: await getDatabase().select().from(signatureProcesses).where(eq(signatureProcesses.id, processId)),
      participants: await getDatabase().select().from(signatureParticipants).where(eq(signatureParticipants.id, participantId)),
      tokens: await getDatabase().select().from(signatureTokens).where(eq(signatureTokens.participantId, participantId)),
      operations: await getDatabase().select().from(signatureOperations).where(eq(signatureOperations.participantId, participantId)),
      revisions: await getDatabase().select().from(signatureRevisions).where(eq(signatureRevisions.participantId, participantId)),
      evidence: await getDatabase().select().from(signatureEvidence).where(eq(signatureEvidence.participantId, participantId)),
      events: await getDatabase().select().from(signatureEvents).where(eq(signatureEvents.participantId, participantId)),
      externalAttempts: await getDatabase().select().from(signatureExternalAttempts).where(eq(signatureExternalAttempts.participantId, participantId)),
      externalReceipts: await getDatabase().select().from(signatureExternalReceipts).where(eq(signatureExternalReceipts.tenantId, standard.tenantId)),
      previews: await getDatabase().select().from(signaturePreviewCandidates).where(eq(signaturePreviewCandidates.participantId, participantId)),
    }).toEqual(persistedBeforeFreeze);
    await getDatabase().update(clinicSubscriptions).set({ status: 'inactive', endedAt: new Date() }).where(eq(clinicSubscriptions.tenantId, standard.tenantId));
    expect(await (await app.request('/api/saas/subscription', { headers: standardHeaders })).json()).toMatchObject({ effectivePlan: 'free', subscription: { status: 'inactive', planId: 'standard' } });
    await getDatabase().insert(clinicSubscriptions).values({
      tenantId: standard.tenantId, planId: 'standard', status: 'active', startedAt: new Date(),
    });
    expect(await (await app.request('/api/saas/subscription', { headers: standardHeaders })).json()).toMatchObject({ effectivePlan: 'standard', subscription: { status: 'active', planId: 'standard' } });
    expect((await app.request('/api/auth/default-signature', { headers: standardHeaders })).status).toBe(200);
    expect((await app.request('/api/signature-pending', { headers: standardHeaders })).status).toBe(200);
    expect(await (await app.request(`/public/signatures/${signatureToken}`)).json()).toMatchObject({ canSign: true });
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

  it('allows Free in-clinic anamnesis on an avulso and gates public links, custom fields, and photo storage URLs', async () => {
    const freeHeaders = free.headers();
    const form = await app.request('/api/anamneses', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ title: 'Anamnese avulsa', schema: { type: 'object', properties: { allergy: { type: 'string', title: 'Alergias' } } } }),
    });
    expect(form.status).toBe(201);
    const formBody = await form.json() as { id: string };
    const procedure = await (await app.request('/api/procedures', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ name: 'Procedimento anamnéstico', durationMinutes: 30, priceCents: 300 }),
    })).json() as { id: string };
    expect((await app.request('/api/procedures', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ name: 'Procedimento com campos', durationMinutes: 30, priceCents: 300, sessionSchema: { type: 'object', properties: { note: { type: 'string' } } } }),
    })).status).toBe(403);
    expect((await app.request(`/api/procedures/${procedure.id}`, {
      method: 'PUT', headers: freeHeaders,
      body: JSON.stringify({ sessionSchema: { type: 'object', properties: { note: { type: 'string' } } } }),
    })).status).toBe(403);
    expect((await app.request(`/api/procedures/${procedure.id}/anamneses`, {
      method: 'PUT', headers: freeHeaders, body: JSON.stringify({ anamnesisIds: [formBody.id] }),
    })).status).toBe(200);
    const patient = await (await app.request('/api/patients', {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({ fullName: 'Paciente anamnese Free' }),
    })).json() as { id: string };
    const applied = await app.request('/api/patient-anamneses', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ patientId: patient.id, procedureId: procedure.id, anamnesisId: formBody.id }),
    });
    expect(applied.status).toBe(201);
    const appliedBody = await applied.json() as { id: string; followupId: string | null; procedureId: string };
    expect(appliedBody).toMatchObject({ followupId: null, procedureId: procedure.id });
    expect((await app.request(`/api/patient-anamneses/${appliedBody.id}`, { headers: freeHeaders })).status).toBe(200);
    expect((await app.request(`/api/patient-anamneses/${appliedBody.id}/answers`, {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({ answers: { allergy: 'Nenhuma' } }),
    })).status).toBe(201);
    expect((await app.request('/api/anamnesis-requests', {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({ patientAnamnesisId: appliedBody.id }),
    })).status).toBe(403);
    expect((await app.request(`/api/patient-anamneses/${appliedBody.id}`, { headers: standard.headers() })).status).toBe(404);
    expect((await app.request(`/api/patients/${patient.id}/history`, { headers: standard.headers() })).status).toBe(404);

    const start = new Date(Date.now() + 86400000);
    const appointment = await (await app.request('/api/appointments', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ patientId: patient.id, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60000).toISOString(), items: [{ procedureId: procedure.id }] }),
    })).json() as { id: string };
    const customDataAppointment = await (await app.request('/api/appointments', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ patientId: patient.id, startsAt: new Date(start.getTime() + 86400000).toISOString(), endsAt: new Date(start.getTime() + 86400000 + 30 * 60000).toISOString(), items: [{ procedureId: procedure.id }] }),
    })).json() as { id: string };
    expect((await app.request('/api/attendances', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ appointmentId: customDataAppointment.id, data: { allergy: 'Não permitido' } }),
    })).status).toBe(403);
    expect((await app.request(`/api/appointments/${customDataAppointment.id}/attendance`, {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({ data: { allergy: 'Não permitido' } }),
    })).status).toBe(403);
    const attendance = await (await app.request(`/api/appointments/${appointment.id}/attendance`, {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({}),
    })).json() as { id: string };
    await getDatabase().insert(attendancePhotos).values({ tenantId: free.tenantId, attendanceId: attendance.id, objectKey: crypto.randomUUID(), phase: 'before' });
    expect((await app.request(`/api/attendances/${attendance.id}`, {
      method: 'PATCH', headers: freeHeaders, body: JSON.stringify({ data: { allergy: 'Nova informação' } }),
    })).status).toBe(403);
    const freeAttendance = await app.request(`/api/attendances/${attendance.id}`, { headers: freeHeaders });
    expect(freeAttendance.status).toBe(200);
    const freeAttendanceBody = await freeAttendance.json();
    expect(freeAttendanceBody).not.toHaveProperty('data');
    expect(freeAttendanceBody).not.toHaveProperty('schemaSnapshot');
    const freeAttendanceList = await app.request('/api/attendances', { headers: freeHeaders });
    expect(freeAttendanceList.status).toBe(200);
    expect((await freeAttendanceList.json() as unknown[]).every((row: any) => !Object.hasOwn(row, 'data'))).toBe(true);
    expect((await app.request('/api/uploads/presign', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ attendanceId: attendance.id, contentType: 'image/jpeg', size: 128 }),
    })).status).toBe(403);
    expect((await app.request('/api/uploads/presign', {
      method: 'POST', headers: standard.headers(),
      body: JSON.stringify({ attendanceId: attendance.id, contentType: 'image/jpeg', size: 128 }),
    })).status).toBe(404);
    const standardPatient = await (await app.request('/api/patients', {
      method: 'POST', headers: standard.headers(), body: JSON.stringify({ fullName: 'Paciente foto Standard' }),
    })).json() as { id: string };
    const standardProcedure = await (await app.request('/api/procedures', {
      method: 'POST', headers: standard.headers(),
      body: JSON.stringify({ name: 'Procedimento foto Standard', durationMinutes: 30, priceCents: 300, sessionSchema: { type: 'object', properties: { allergy: { type: 'string' } } } }),
    })).json() as { id: string };
    const standardAppointment = await (await app.request('/api/appointments', {
      method: 'POST', headers: standard.headers(),
      body: JSON.stringify({ patientId: standardPatient.id, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60000).toISOString(), items: [{ procedureId: standardProcedure.id }] }),
    })).json() as { id: string };
    const standardAttendance = await (await app.request(`/api/appointments/${standardAppointment.id}/attendance`, {
      method: 'POST', headers: standard.headers(), body: JSON.stringify({ data: { allergy: 'Nenhuma' } }),
    })).json() as { id: string };
    const photoBytes = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==', 'base64');
    const photoHash = createHash('sha256').update(photoBytes).digest('hex');
    const photoIntent = await app.request('/api/uploads/presign', {
      method: 'POST', headers: standard.headers(),
      body: JSON.stringify({ attendanceId: standardAttendance.id, contentType: 'image/jpeg', size: photoBytes.length, contentHash: photoHash }),
    });
    expect(photoIntent.status).toBe(200);
    const intentBody = await photoIntent.json() as { uploadUrl: string; objectKey: string; uploadToken: string };
    const putPhoto = await fetch(intentBody.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: photoBytes });
    expect(putPhoto.ok).toBe(true);
    const savedPhoto = await app.request(`/api/attendances/${standardAttendance.id}/photos`, {
      method: 'POST', headers: standard.headers(),
      body: JSON.stringify({ objectKey: intentBody.objectKey, uploadToken: intentBody.uploadToken, contentHash: photoHash, phase: 'before' }),
    });
    expect(savedPhoto.status).toBe(201);
    const savedPhotoBody = await savedPhoto.json() as { id: string };
    expect(await (await app.request(`/api/attendances/${standardAttendance.id}`, { headers: standard.headers() })).json()).toHaveProperty('data.allergy', 'Nenhuma');
    const standardAttendanceResponse = await (await app.request(`/api/attendances/${standardAttendance.id}`, { headers: standard.headers() })).json() as { photos: Array<{ url: string }> };
    expect(new URL(standardAttendanceResponse.photos[0].url).searchParams.has('X-Amz-Signature')).toBe(true);
    const downloadPhoto = await fetch(standardAttendanceResponse.photos[0].url);
    expect(downloadPhoto.ok).toBe(true);
    expect(Buffer.from(await downloadPhoto.arrayBuffer())).toEqual(photoBytes);
    const upload = await app.request('/api/uploads/presign', {
      method: 'POST', headers: standard.headers(),
      body: JSON.stringify({ attendanceId: standardAttendance.id, contentType: 'image/jpeg', size: 128 }),
    });
    expect(upload.status).toBe(200);
    expect(new URL((await upload.json() as { uploadUrl: string }).uploadUrl).searchParams.has('X-Amz-Signature')).toBe(true);
    const standardForm = await (await app.request('/api/anamneses', {
      method: 'POST', headers: standard.headers(),
      body: JSON.stringify({ title: 'Anamnese por link', schema: { type: 'object', properties: { allergy: { type: 'string' } } } }),
    })).json() as { id: string };
    expect((await app.request(`/api/procedures/${standardProcedure.id}/anamneses`, {
      method: 'PUT', headers: standard.headers(), body: JSON.stringify({ anamnesisIds: [standardForm.id] }),
    })).status).toBe(200);
    const standardApplied = await (await app.request('/api/patient-anamneses', {
      method: 'POST', headers: standard.headers(),
      body: JSON.stringify({ patientId: standardPatient.id, procedureId: standardProcedure.id, anamnesisId: standardForm.id }),
    })).json() as { id: string };
    const answerApplied = await (await app.request('/api/patient-anamneses', {
      method: 'POST', headers: standard.headers(),
      body: JSON.stringify({ patientId: standardPatient.id, procedureId: standardProcedure.id, anamnesisId: standardForm.id }),
    })).json() as { id: string };
    expect((await app.request(`/api/patient-anamneses/${answerApplied.id}/answers`, {
      method: 'POST', headers: standard.headers(), body: JSON.stringify({ answers: { allergy: 'Alergia histórica' } }),
    })).status).toBe(201);
    expect(await (await app.request(`/api/patient-anamneses/${answerApplied.id}`, { headers: standard.headers() })).json()).toHaveProperty('answers.allergy', 'Alergia histórica');
    const link = await app.request('/api/anamnesis-requests', {
      method: 'POST', headers: standard.headers(), body: JSON.stringify({ patientAnamnesisId: standardApplied.id }),
    });
    expect(link.status).toBe(201);
    const token = ((await link.json()) as { url: string }).url.split('/').at(-1)!;
    await getDatabase().update(appliedAnamneses).set({ requestExpiresAt: new Date(Date.now() - 1000) }).where(eq(appliedAnamneses.id, standardApplied.id));
    expect((await app.request(`/public/anamnesis/${token}`)).status).toBe(404);
    const refreshed = await app.request(`/api/anamnesis-requests/${standardApplied.id}/refresh`, { method: 'PUT', headers: standard.headers() });
    expect(refreshed.status).toBe(200);
    const refreshedToken = ((await refreshed.json()) as { url: string }).url.split('/').at(-1)!;
    const standardHistory = await (await app.request(`/api/patients/${standardPatient.id}/history`, { headers: standard.headers() })).json() as { events: Array<{ type: string; details?: Record<string, any> }> };
    const standardHistoryAttendance = standardHistory.events.find((event) => event.type === 'attendance' && event.details?.id === standardAttendance.id)!.details!;
    expect(standardHistoryAttendance).toHaveProperty('data.allergy', 'Nenhuma');
    expect(standardHistoryAttendance).toHaveProperty('schemaSnapshot.properties.allergy');
    expect(standardHistoryAttendance).not.toHaveProperty('dataCiphertext');
    expect(standardHistoryAttendance).not.toHaveProperty('notesCiphertext');
    await getDatabase().update(clinicSubscriptions).set({ status: 'paused' }).where(eq(clinicSubscriptions.tenantId, standard.tenantId));
    expect((await app.request(`/api/procedures/${standardProcedure.id}`, {
      method: 'PUT', headers: standard.headers(),
      body: JSON.stringify({ sessionSchema: { type: 'object', properties: {} } }),
    })).status).toBe(403);
    const preservedProcedure = (await (await app.request('/api/procedures', { headers: standard.headers() })).json() as Array<{ id: string; sessionSchema: { properties: Record<string, unknown> } }>).find((procedure) => procedure.id === standardProcedure.id);
    expect(preservedProcedure?.sessionSchema.properties).toHaveProperty('allergy');
    const downgradedAttendance = await app.request(`/api/attendances/${standardAttendance.id}`, { headers: standard.headers() });
    expect(downgradedAttendance.status).toBe(200);
    expect(await downgradedAttendance.json()).not.toHaveProperty('data');
    const downgradedHistory = await (await app.request(`/api/patients/${standardPatient.id}/history`, { headers: standard.headers() })).json() as { events: Array<{ type: string; details?: { photos?: Array<{ url?: string }> } }> };
    expect(downgradedHistory.events.filter((event) => event.type === 'attendance').every((event) => !(event.details?.photos ?? []).some((photo: { url?: string }) => photo.url))).toBe(true);
    expect(downgradedHistory.events.filter((event) => event.type === 'attendance').every((event) => !Object.hasOwn(event.details ?? {}, 'data') && !Object.hasOwn(event.details ?? {}, 'dataCiphertext'))).toBe(true);
    expect(downgradedHistory.events.filter((event) => event.type === 'attendance').every((event) => !Object.hasOwn(event.details ?? {}, 'schemaSnapshot'))).toBe(true);
    expect((await app.request(`/public/anamnesis/${refreshedToken}`)).status).toBe(403);
    expect((await app.request(`/public/anamnesis/${refreshedToken}/draft`, {
      method: 'PUT', body: JSON.stringify({ draft: { allergy: 'alteração bloqueada' } }),
    })).status).toBe(403);
    expect((await app.request(`/api/anamnesis-requests/${standardApplied.id}/refresh`, {
      method: 'PUT', headers: standard.headers(),
    })).status).toBe(403);
    expect((await getDatabase().select().from(appliedAnamneses).where(eq(appliedAnamneses.id, standardApplied.id)))[0].requestTokenHash).toBeTruthy();
    expect((await getDatabase().select().from(attendancePhotos).where(eq(attendancePhotos.attendanceId, standardAttendance.id)))).toHaveLength(1);
    await getDatabase().update(clinicSubscriptions).set({ status: 'active' }).where(eq(clinicSubscriptions.tenantId, standard.tenantId));
    expect(await (await app.request(`/api/attendances/${standardAttendance.id}`, { headers: standard.headers() })).json()).toHaveProperty('data.allergy', 'Nenhuma');
    expect((await app.request(`/api/attendances/${standardAttendance.id}/photos/${savedPhotoBody.id}`, {
      method: 'DELETE', headers: standard.headers(),
    })).status).toBe(200);
    const historical = await (await app.request(`/api/patients/${patient.id}/history`, { headers: freeHeaders })).json() as { events: Array<{ type: string; details?: Record<string, any> }> };
    expect(historical.events.filter((event) => event.type === 'attendance').every((event) => !(event.details?.photos ?? []).some((photo: { url?: string }) => photo.url))).toBe(true);
    expect(historical.events.filter((event) => event.type === 'attendance').every((event) => !Object.hasOwn(event.details ?? {}, 'data') && !Object.hasOwn(event.details ?? {}, 'dataCiphertext') && !Object.hasOwn(event.details ?? {}, 'notesCiphertext'))).toBe(true);
    expect(historical.events.filter((event) => event.type === 'attendance').every((event) => !Object.hasOwn(event.details ?? {}, 'schemaSnapshot'))).toBe(true);
  });
});
