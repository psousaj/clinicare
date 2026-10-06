import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { app } from './app';
import {
  appliedDocuments, appliedDocumentRevisions, closeDatabase, contracts,
  contractVersions, documentCleanupJobs, followupContracts, followupItems,
  followupSnapshots, followups, getDatabase, migrateDatabase, patients,
  planVersionContracts, planVersionItems, planVersions, plans, procedures,
  signatureEvents, signatureEvidence, signatureExternalAttempts, signatureExternalReceipts,
  signatureOperations, signatureParticipants, signaturePreviewCandidates, signatureProcesses, signatureRevisions,
  signatureTokens, tenants,
} from '@clinicare/db';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, integrationHeaders, provisionIntegrationClinic } from './integration-support';
import { deleteObject, downloadObjectBytes, uploadObjectBytes } from './storage';
import { materializeAppliedDocumentResult, deleteAppliedDocument } from './clinical';
import { createHash, randomUUID } from 'node:crypto';
import { PDF } from '@libpdf/core';

let sessionHeaders: Record<string, string>;
const request = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { ...sessionHeaders, ...(init.headers ?? {}) } });
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { ...sessionHeaders }, body: JSON.stringify(body) });

const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const placement = { pageIndex: 0, x: 0.1, y: 0.2, width: 0.25, height: 0.12 };

integration('Issue #28: Operar histórico e estados do contrato assinado', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  let patientId: string;
  let followupId: string;
  let followupContractId: string;
  let planId2: string;
  let secondFollowupId: string;
  let secondFollowupContractId: string;
  let secondDocumentId: string;
  let secondPatientToken: string;

  let patientToken: string;
  let patientParticipantId: string;
  let professionalParticipantId: string;
  let documentId: string;
  let pdfKeys: string[] = [];
  let otherSessionHeaders: Record<string, string>;

  const setupContract = async (db: ReturnType<typeof getDatabase>, planVersionId: string, title: string, content: string) => {
    const doc = PDF.create();
    doc.addPage({ width: 612, height: 792 });
    const pdfBytes = await doc.save();
    const pdfKey = randomUUID();
    await uploadObjectBytes(pdfKey, pdfBytes);
    pdfKeys.push(pdfKey);
    const contractId = crypto.randomUUID();
    const contractVersionId = crypto.randomUUID();
    await db.insert(contracts).values({ id: contractId, tenantId, title, kind: 'standard' });
    await db.insert(contractVersions).values({
      id: contractVersionId, tenantId, contractId, version: 1, content,
      renderedPdfObjectKey: pdfKey, renderedPdfHash: createHash('sha256').update(pdfBytes).digest('hex'),
      renderedPdfSize: pdfBytes.byteLength, renderedPdfContentType: 'application/pdf',
    });
    await db.insert(planVersionContracts).values({ tenantId, planVersionId, contractId, contractVersion: 1, title });
  };

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    const db = getDatabase();
    await provisionIntegrationClinic(app, 'sig-history', tenantId);
    await provisionIntegrationClinic(app, 'sig-history-other', otherTenantId);
    sessionHeaders = integrationHeaders(tenantId);
    otherSessionHeaders = integrationHeaders(otherTenantId);

    patientId = crypto.randomUUID();
    const patientRes = await request('/api/patients', json({ fullName: 'Paciente Histórico', phone: '11987654321' }));
    expect(patientRes.status).toBe(201);
    patientId = ((await patientRes.json()) as any).id;

    const procedureId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento Histórico', durationMinutes: 30, priceCents: 500, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano Histórico' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 500 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, procedureId, sessions: 1, procedureName: 'Procedimento Histórico', durationMinutes: 30, priceCents: 500, sessionSchema: { type: 'object', properties: {} } });
    await setupContract(db, versionId, 'Contrato Histórico 1', 'Termos históricos 1');

    planId2 = crypto.randomUUID();
    const versionId2 = crypto.randomUUID();
    await db.insert(plans).values({ id: planId2, tenantId, name: 'Plano Histórico 2' });
    await db.insert(planVersions).values({ id: versionId2, tenantId, planId: planId2, version: 1, priceCents: 500 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId2, procedureId, sessions: 1, procedureName: 'Procedimento Histórico', durationMinutes: 30, priceCents: 500, sessionSchema: { type: 'object', properties: {} } });
    await setupContract(db, versionId2, 'Contrato Histórico 2', 'Termos históricos 2');

    const createRes = await request('/api/followups', json({ patientId, offerType: 'plan', offerId: planId }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as any;
    followupId = created.id;
    followupContractId = created.contracts[0].id;
    const group = Object.values(created.signatureTokens)[0] as any;
    patientToken = group.patient.token;
    const mat = await materializeAppliedDocumentResult(tenantId, followupContractId);
    if (!mat.document) throw new Error('Documento aplicado não materializado.');
    documentId = mat.document.id;
    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    patientParticipantId = participants.find((p) => p.role === 'patient')!.id;
    professionalParticipantId = participants.find((p) => p.role === 'professional')!.id;
  });

  afterAll(async () => {
    const db = getDatabase();
    for (const table of [
      signatureEvidence, signatureEvents, signatureRevisions, signatureOperations,
      signatureExternalReceipts, signatureExternalAttempts,
      signaturePreviewCandidates, signatureTokens, signatureParticipants, signatureProcesses,
    ]) {
      await db.delete(table as any).where(eq((table as any).tenantId, tenantId));
      await db.delete(table as any).where(eq((table as any).tenantId, otherTenantId));
    }
    for (const pdfKey of pdfKeys ?? []) {
      await deleteObject(pdfKey).catch(() => null);
    }
    const docs = await db.select().from(appliedDocuments).where(eq(appliedDocuments.tenantId, tenantId));
    for (const doc of docs) {
      await deleteAppliedDocument(tenantId, doc.id).catch(() => null);
    }
    for (const table of [
      documentCleanupJobs, followupContracts, followupItems, followupSnapshots,
      followups, planVersionContracts, planVersionItems, planVersions, plans,
      contractVersions, contracts, procedures, patients,
    ]) {
      await db.delete(table as any).where(eq((table as any).tenantId, tenantId));
      await db.delete(table as any).where(eq((table as any).tenantId, otherTenantId));
    }
    await cleanupIntegrationClinics([tenantId, otherTenantId]);
    await closeDatabase();
  });

  const localConfirm = async (access: { token?: string; participantId?: string }, document: { id: string; revisionId: string }, fingerprintVisitor: string) => {
    const idempotencyKey = randomUUID();
    const base = { documentId: document.id, baseRevisionId: document.revisionId, signaturePng: pngDataUrl, placement, idempotencyKey, fingerprint: { visitorId: fingerprintVisitor, version: 'fingerprintjs-oss-5' } };
    const previewPath = access.token
      ? `/public/signatures/${access.token}/preview`
      : `/api/signature-participants/${access.participantId}/preview`;
    const previewRes = await request(previewPath, json({ ...base, previewOnly: true }));
    expect(previewRes.status).toBe(200);
    const previewHash = previewRes.headers.get('etag')!.replaceAll('"', '');
    const confirmPath = access.token
      ? `/public/signatures/${access.token}/confirm`
      : `/api/signature-participants/${access.participantId}/confirm`;
    const confirmRes = await request(confirmPath, json({ evidence: { ...base, previewHash, confirmed: true, acceptanceText: 'aceito' } }));
    expect(confirmRes.status).toBe(200);
    return confirmRes.json() as any;
  };

  it('records history with actor, role, method, revision, result and time', async () => {
    const verify = await request(`/public/signatures/${patientToken}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(verify.status).toBe(200);
    const read = await request(`/public/signatures/${patientToken}`);
    const document = ((await read.json()) as any).document;
    await localConfirm({ token: patientToken }, document, 'vis-hist-patient');

    // Painel vê o histórico parcial: paciente assinado, representante pendente.
    const panelRes = await request(`/api/signature-history?followupContractId=${followupContractId}`);
    expect(panelRes.status).toBe(200);
    const panel = await panelRes.json() as any;
    expect(panel.process.status).toBe('pending');
    expect(panel.contract.title).toBe('Contrato Histórico 1');
    expect(panel.participants.find((p: any) => p.role === 'patient').status).toBe('signed');
    expect(panel.participants.find((p: any) => p.role === 'professional').status).toBe('pending');
    expect(panel.document.revisions.map((r: any) => r.origin)).toEqual(['initial', 'local_handwritten']);
    expect(panel.operations).toHaveLength(1);
    expect(panel.operations[0].method).toBe('local_handwritten');
    expect(panel.notice).toContain('não constitui certificado ICP-Brasil');

    // Representante confirma e o processo conclui com evento dedicado.
    const repDocRes = await request(`/api/signature-participants/${professionalParticipantId}/pdf`);
    expect(repDocRes.status).toBe(200);
    const db = getDatabase();
    const repDocRow = (await db.select({ document: appliedDocuments, revision: appliedDocumentRevisions }).from(appliedDocuments).innerJoin(appliedDocumentRevisions, and(eq(appliedDocumentRevisions.tenantId, appliedDocuments.tenantId), eq(appliedDocumentRevisions.id, appliedDocuments.currentRevisionId))).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId))))[0]!;
    const repResult = await localConfirm({ participantId: professionalParticipantId }, { id: repDocRow.document.id, revisionId: repDocRow.revision.id }, 'vis-hist-rep');
    expect(repResult.processCompleted).toBe(true);

    const fullRes = await request(`/api/signature-history?followupContractId=${followupContractId}`);
    const full = await fullRes.json() as any;
    expect(full.process.status).toBe('completed');
    const completedEvents = full.events.filter((e: any) => e.type === 'completed');
    expect(completedEvents.length).toBeGreaterThanOrEqual(2);
    for (const event of full.events) {
      expect(event.actor.role).toBeTruthy();
      expect(event.actor.name).toBeTruthy();
      expect(event.label).toBeTruthy();
      expect(new Date(event.occurredAt).getTime()).not.toBeNaN();
    }
    const signedEvents = full.events.filter((e: any) => e.type === 'signed');
    expect(signedEvents).toHaveLength(2);
    expect(signedEvents.every((e: any) => e.method === 'Manuscrita local' && e.revision && e.actor.name)).toBe(true);
  });

  it('masks the other participant identity on the public history', async () => {
    const publicRes = await request(`/public/signatures/${patientToken}/history`);
    expect(publicRes.status).toBe(200);
    const body = await publicRes.json() as any;
    expect(body.process.status).toBe('completed');
    const other = body.participants.find((p: any) => p.role === 'professional');
    expect(JSON.stringify(other)).not.toContain('Integration Administrator');
    expect(JSON.stringify(other)).not.toContain('@example.test');
    const own = body.participants.find((p: any) => p.role === 'patient');
    expect(own.identity.fullName).toBe('Paciente Histórico');
    // Via pública exige token válido do processo.
    expect((await request(`/public/signatures/00000000-0000-4000-8000-000000000000/history`)).status).toBe(404);
  });

  it('serves preserved revisions to authorized readers only', async () => {
    const db = getDatabase();
    const revisions = (await db.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, documentId)))).sort((a, b) => a.version - b.version);
    expect(revisions.length).toBeGreaterThanOrEqual(2);
    const first = revisions[0]!;
    const head = revisions[revisions.length - 1]!;

    // Painel baixa qualquer revisão preservada.
    const panelOld = await request(`/api/signature-participants/${professionalParticipantId}/revisions/${first.id}/pdf`);
    expect(panelOld.status).toBe(200);
    const oldBytes = new Uint8Array(await panelOld.arrayBuffer());
    expect(oldBytes.byteLength).toBe(first.contentSize);
    expect(createHash('sha256').update(oldBytes).digest('hex')).toBe(first.contentHash);

    // Via pública exige token válido do processo e revisão do documento.
    const stranger = await request(`/public/signatures/${patientToken}/revisions/00000000-0000-4000-8000-000000000000/pdf`);
    expect(stranger.status).toBe(404);

    const otherDoc = (await db.select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, otherTenantId))))[0];
    if (otherDoc) {
      const crossDoc = await request(`/api/signature-participants/${professionalParticipantId}/revisions/${otherDoc.currentRevisionId}/pdf`);
      expect(crossDoc.status).toBe(404);
    }
    // Sem sessão, o painel nega.
    expect((await app.request(`/api/signature-participants/${professionalParticipantId}/revisions/${first.id}/pdf`)).status).toBe(401);
    // Outro tenant não enxerga.
    expect((await app.request(`/api/signature-participants/${professionalParticipantId}/revisions/${first.id}/pdf`, { headers: otherSessionHeaders })).status).toBe(404);
    void head;
  });

  it('blocks new confirmations after cancellation while preserving everything', async () => {
    const db = getDatabase();
    const createRes = await request('/api/followups', json({ patientId, offerType: 'plan', offerId: planId2 }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as any;
    secondFollowupId = created.id;
    secondFollowupContractId = created.contracts[0].id;
    const group = Object.values(created.signatureTokens)[0] as any;
    secondPatientToken = group.patient.token;
    const mat = await materializeAppliedDocumentResult(tenantId, secondFollowupContractId);
    secondDocumentId = mat.document!.id;
    expect((await request(`/public/signatures/${secondPatientToken}/history`)).status).toBe(403);
    const verify = await request(`/public/signatures/${secondPatientToken}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(verify.status).toBe(200);
    const read = await request(`/public/signatures/${secondPatientToken}`);
    await localConfirm({ token: secondPatientToken }, ((await read.json()) as any).document, 'vis-cancel-patient');

    const cancelRes = await request(`/api/followups/${secondFollowupId}/cancel`, json({ reason: 'paciente desistiu' }));
    expect(cancelRes.status).toBe(200);

    const historyRes = await request(`/api/signature-history?followupContractId=${secondFollowupContractId}`);
    expect(historyRes.status).toBe(200);
    const history = await historyRes.json() as any;
    expect(history.process.status).toBe('cancelled');
    const cancelledEvents = history.events.filter((e: any) => e.type === 'cancelled');
    expect(cancelledEvents.length).toBeGreaterThanOrEqual(2);
    expect(cancelledEvents.every((e: any) => e.actor.role === 'clinic')).toBe(true);

    // Via pública continua lendo histórico e PDFs após o cancelamento.
    const publicHistory = await request(`/public/signatures/${secondPatientToken}/history`);
    expect(publicHistory.status).toBe(200);
    expect((await publicHistory.json() as any).process.status).toBe('cancelled');

    // Novas confirmações (prévia inclusa) são bloqueadas no processo encerrado.
    const secondProcess = (await db.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.followupContractId, secondFollowupContractId))))[0]!;
    const secondParts = await db.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.processId, secondProcess.id)));
    const rep = secondParts.find((p) => p.role === 'professional')!;
    const headDoc = (await db.select({ document: appliedDocuments, revision: appliedDocumentRevisions }).from(appliedDocuments).innerJoin(appliedDocumentRevisions, and(eq(appliedDocumentRevisions.tenantId, appliedDocuments.tenantId), eq(appliedDocumentRevisions.id, appliedDocuments.currentRevisionId))).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, secondDocumentId))))[0]!;
    const blockedPreview = await request(`/api/signature-participants/${rep.id}/preview`, json({
      documentId: headDoc.document.id, baseRevisionId: headDoc.revision.id, signaturePng: pngDataUrl, placement,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'x', version: 'fingerprintjs-oss-5' }, previewOnly: true,
    }));
    expect(blockedPreview.status).toBe(409);

    // Arquivos, tentativas e eventos preservados.
    const preservedRevision = (await db.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, secondDocumentId))))[0]!;
    const pdfStillThere = await request(`/api/signature-participants/${rep.id}/revisions/${preservedRevision.id}/pdf`);
    expect(pdfStillThere.status).toBe(200);
    expect(createHash('sha256').update(new Uint8Array(await pdfStillThere.arrayBuffer())).digest('hex')).toBe(preservedRevision.contentHash);
    const attemptsKept = await db.select().from(signatureOperations).where(eq(signatureOperations.tenantId, tenantId));
    expect(attemptsKept.length).toBeGreaterThan(0);
    const eventsKept = await db.select().from(signatureEvents).where(eq(signatureEvents.tenantId, tenantId));
    expect(eventsKept.length).toBeGreaterThan(0);
    // Revisão de outro contrato não vaza pela via pública deste token.
    const siblingRevision = (await db.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, secondDocumentId))))[0]!;
    expect((await request(`/public/signatures/${patientToken}/revisions/${siblingRevision.id}/pdf`)).status).toBe(404);
  });
});