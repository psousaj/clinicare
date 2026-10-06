import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { app } from './app';
import {
  appliedDocuments, appliedDocumentRevisions, closeDatabase, contracts,
  contractVersions, documentCleanupJobs, followupContracts, followupItems,
  followupSnapshots, followups, getDatabase, migrateDatabase, patients,
  planVersionContracts, planVersionItems, planVersions, plans, procedures,
  signatureEvents, signatureEvidence, signatureOperations,
  signatureParticipants, signaturePreviewCandidates, signatureProcesses, signatureRevisions,
  signatureTokens, tenants, encryptValue, buildPatientAad,
} from '@clinicare/db';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, integrationHeaders, provisionIntegrationClinic } from './integration-support';
import { deleteObject, uploadObjectBytes } from './storage';
import { materializeAppliedDocumentResult, deleteAppliedDocument } from './clinical';
import { createHash, randomUUID } from 'node:crypto';
import { PDF } from '@libpdf/core';

let sessionHeaders: Record<string, string>;
const request = (path: string, init: RequestInit = {}) => app.request(path, { ...init, headers: { ...sessionHeaders, ...(init.headers ?? {}) } });
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { ...sessionHeaders }, body: JSON.stringify(body) });

const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const placement = { pageIndex: 0, x: 0.1, y: 0.2, width: 0.25, height: 0.12 };

integration('PostgreSQL signatures API', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  let patientId: string;
  let followupId: string;
  let patientTokens: string[];
  let patientParticipantIds: string[];
  let professionalParticipantId: string;
  let documentIds: string[];
  let pdfBytesList: Uint8Array[];
  let pdfKeys: string[];
  let otherSessionHeaders: Record<string, string>;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    const db = getDatabase();
    await provisionIntegrationClinic(app, 'signatures', tenantId);
    await provisionIntegrationClinic(app, 'signatures-other', otherTenantId);
    sessionHeaders = integrationHeaders(tenantId);
    otherSessionHeaders = integrationHeaders(otherTenantId);

    patientId = crypto.randomUUID();
    const procedureId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const phoneEnc = encryptValue('11987654321', buildPatientAad(tenantId, patientId, 'phone', 1));
    await db.insert(patients).values({
      id: patientId, tenantId, fullName: 'Paciente assinatura',
      phoneCiphertext: phoneEnc.ciphertext, phoneNonce: phoneEnc.nonce, phoneKeyVersion: 1,
    });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento assinatura', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano assinatura' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 100 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, procedureId, sessions: 1, procedureName: 'Procedimento assinatura', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });

    pdfBytesList = [];
    pdfKeys = [];
    const contractRows = [1, 2].map(() => ({ id: crypto.randomUUID(), versionId: crypto.randomUUID() }));
    for (const [index, row] of contractRows.entries()) {
      const doc = PDF.create();
      doc.addPage({ width: 612, height: 792 });
      const pdfBytes = await doc.save();
      const pdfHash = createHash('sha256').update(pdfBytes).digest('hex');
      const pdfKey = randomUUID();
      await uploadObjectBytes(pdfKey, pdfBytes);
      pdfBytesList.push(pdfBytes);
      pdfKeys.push(pdfKey);
      await db.insert(contracts).values({ id: row.id, tenantId, title: `Contrato obrigatório ${index + 1}`, kind: 'standard' });
      await db.insert(contractVersions).values({ id: row.versionId, tenantId, contractId: row.id, version: 1, content: `Conteúdo protegido ${index + 1}`, renderedPdfObjectKey: pdfKey, renderedPdfHash: pdfHash, renderedPdfSize: pdfBytes.byteLength, renderedPdfContentType: 'application/pdf' });
      await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId: row.id, contractVersion: 1, title: `Contrato obrigatório ${index + 1}` });
    }

    const response = await request('/api/followups', json({ patientId, offerType: 'plan', offerId: planId }));
    expect(response.status).toBe(201);
    const created = await response.json() as any;
    followupId = created.id;
    const tokenGroups = Object.values(created.signatureTokens) as any[];
    patientTokens = tokenGroups.map((group) => group.patient.token);

    documentIds = [];
    for (const contractRow of created.contracts as any[]) {
      const mat = await materializeAppliedDocumentResult(tenantId, contractRow.id);
      if (!mat.document) throw new Error('Documento aplicado não materializado.');
      documentIds.push(mat.document.id);
    }

    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    patientParticipantIds = participants.filter((participant) => participant.role === 'patient').map((participant) => participant.id);
    professionalParticipantId = participants.find((participant) => participant.role === 'professional')!.id;
    expect(patientParticipantIds).toHaveLength(2);
    expect(new Set(patientParticipantIds).size).toBe(2);
    expect(professionalParticipantId).toBeTruthy();
  });

  afterAll(async () => {
    const db = getDatabase();
    for (const table of [
      signatureEvidence, signatureEvents, signatureRevisions, signatureOperations,
      signaturePreviewCandidates, signatureTokens, signatureParticipants, signatureProcesses,
    ]) {
      await db.delete(table as any).where(eq((table as any).tenantId, tenantId));
      await db.delete(table as any).where(eq((table as any).tenantId, otherTenantId));
    }
    for (const documentId of documentIds ?? []) {
      await deleteAppliedDocument(tenantId, documentId).catch(() => null);
    }
    for (const pdfKey of pdfKeys ?? []) {
      await deleteObject(pdfKey).catch(() => null);
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

  it('reads encrypted applied content and keeps plaintext/token hashes out of storage', async () => {
    const verify = await request(`/public/signatures/${patientTokens[0]}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(verify.status).toBe(200);
    const read = await request(`/public/signatures/${patientTokens[0]}`);
    expect(read.status).toBe(200);
    const body = await read.json() as any;
    expect(['Conteúdo protegido 1', 'Conteúdo protegido 2']).toContain(body.contract.content);
    expect(JSON.stringify(body)).not.toContain('content_ciphertext');
    const db = getDatabase();
    const applied = await db.select().from(followupContracts).where(eq(followupContracts.tenantId, tenantId));
    expect(applied).toHaveLength(2);
    expect(applied.every((contract) => !!contract.contentCiphertext && !('contentSnapshot' in contract))).toBe(true);
    const storedTokens = await db.select().from(signatureTokens).where(eq(signatureTokens.tenantId, tenantId));
    expect(storedTokens.every((row) => row.tokenHash.length === 64 && !patientTokens.includes(row.tokenHash))).toBe(true);
    expect(storedTokens.filter((row) => row.participantId === patientParticipantIds[0]).map((row) => row.tokenHash)).toContain(createHash('sha256').update(patientTokens[0]!).digest('hex'));
    const revisions = await db.select().from(signatureRevisions).where(eq(signatureRevisions.tenantId, tenantId));
    expect(revisions).toHaveLength(0);
  });

  it('refreshes atomically and invalidates the old token', async () => {
    const refresh = await request(`/api/signature-participants/${patientParticipantIds[0]}/refresh`, json({}));
    expect(refresh.status).toBe(200);
    const refreshed = await refresh.json() as any;
    expect(refreshed.token).not.toBe(patientTokens[0]);
    expect((await request(`/public/signatures/${patientTokens[0]}`)).status).toBe(404);
    patientTokens[0] = refreshed.token;
  });

  it('allows pending professional signatures without blocking, activates after every patient contract, and deduplicates concurrent confirmation', async () => {
    const pending = await request('/api/signature-pending');
    expect(pending.status).toBe(200);
    const pendingRows = await pending.json() as any[];
    expect(pendingRows.filter((row) => row.role === 'patient' && row.blocking)).toHaveLength(2);
    expect(pendingRows.filter((row) => row.role === 'professional' && !row.blocking)).toHaveLength(2);
    // Representante acessa pelo painel autenticado, não por link público.
    expect((await request(`/api/signature-participants/${professionalParticipantId}/pdf`)).status).toBe(200);

    const firstVerify = await request(`/public/signatures/${patientTokens[0]}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(firstVerify.status).toBe(200);
    const firstRead = await request(`/public/signatures/${patientTokens[0]}`);
    const firstDocument = ((await firstRead.json()) as any).document;

    // Duas tentativas concorrentes de confirmação da mesma revisão: cada uma gera
    // sua própria prévia com sua própria chave de idempotência; uma vence.
    const firstAttempts: Array<{ idempotencyKey: string; previewHash: string }> = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const idempotencyKey = randomUUID();
      const previewPayload = { documentId: firstDocument.id, baseRevisionId: firstDocument.revisionId, signaturePng: pngDataUrl, placement, idempotencyKey, fingerprint: { visitorId: 'vis-1', version: 'fingerprintjs-oss-5' }, previewOnly: true };
      const previewResponse = await request(`/public/signatures/${patientTokens[0]}/preview`, json(previewPayload));
      expect(previewResponse.status).toBe(200);
      firstAttempts.push({ idempotencyKey, previewHash: previewResponse.headers.get('etag')!.replaceAll('"', '') });
    }
    const firstConfirmations = await Promise.all(firstAttempts.map(({ idempotencyKey, previewHash }) =>
      request(`/public/signatures/${patientTokens[0]}/confirm`, json({ evidence: {
        documentId: firstDocument.id, baseRevisionId: firstDocument.revisionId, signaturePng: pngDataUrl, placement,
        idempotencyKey, previewHash, fingerprint: { visitorId: 'vis-1', version: 'fingerprintjs-oss-5' },
        confirmed: true, acceptanceText: 'aceito',
      } }))));
    expect(firstConfirmations.filter((response) => response.status === 200)).toHaveLength(1);
    expect(firstConfirmations.filter((response) => response.status === 409)).toHaveLength(1);
    expect((await (await request(`/api/followups/${followupId}`)).json()).status).toBe('idle');

    const secondVerify = await request(`/public/signatures/${patientTokens[1]}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(secondVerify.status).toBe(200);
    const secondRead = await request(`/public/signatures/${patientTokens[1]}`);
    const secondDocument = ((await secondRead.json()) as any).document;
    const secondIdempotencyKey = randomUUID();
    const secondPreviewPayload = { documentId: secondDocument.id, baseRevisionId: secondDocument.revisionId, signaturePng: pngDataUrl, placement, idempotencyKey: secondIdempotencyKey, fingerprint: { visitorId: 'vis-2', version: 'fingerprintjs-oss-5' }, previewOnly: true };
    const secondPreview = await request(`/public/signatures/${patientTokens[1]}/preview`, json(secondPreviewPayload));
    expect(secondPreview.status).toBe(200);
    const secondPreviewHash = secondPreview.headers.get('etag')!.replaceAll('"', '');
    const second = await request(`/public/signatures/${patientTokens[1]}/confirm`, json({ evidence: {
      documentId: secondDocument.id, baseRevisionId: secondDocument.revisionId, signaturePng: pngDataUrl, placement,
      idempotencyKey: secondIdempotencyKey, previewHash: secondPreviewHash, fingerprint: { visitorId: 'vis-2', version: 'fingerprintjs-oss-5' },
      confirmed: true, acceptanceText: 'aceito',
    } }));
    expect(second.status).toBe(200);
    expect((await second.json() as any).activated).toBe(true);
    const followup = await (await request(`/api/followups/${followupId}`)).json() as any;
    expect(followup.status).toBe('active');

    // Representante confirma pelo painel autenticado.
    const professionalIdempotencyKey = randomUUID();
    const professionalDocumentRead = await request(`/api/signature-participants/${professionalParticipantId}/pdf`);
    expect(professionalDocumentRead.status).toBe(200);
    const db = getDatabase();
    const professionalProcess = (await db.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, (await db.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.id, professionalParticipantId))))[0]!.processId))))[0]!;
    const professionalDocumentRow = (await db.select({ document: appliedDocuments, revision: appliedDocumentRevisions }).from(appliedDocuments).innerJoin(appliedDocumentRevisions, and(eq(appliedDocumentRevisions.tenantId, appliedDocuments.tenantId), eq(appliedDocumentRevisions.id, appliedDocuments.currentRevisionId))).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, professionalProcess.followupContractId))))[0]!;
    const professionalPreviewPayload = { documentId: professionalDocumentRow.document.id, baseRevisionId: professionalDocumentRow.revision.id, signaturePng: pngDataUrl, placement, idempotencyKey: professionalIdempotencyKey, fingerprint: { visitorId: 'vis-clinic', version: 'fingerprintjs-oss-5' }, previewOnly: true };
    const professionalPreview = await request(`/api/signature-participants/${professionalParticipantId}/preview`, json(professionalPreviewPayload));
    expect(professionalPreview.status).toBe(200);
    const professionalPreviewHash = professionalPreview.headers.get('etag')!.replaceAll('"', '');
    const professionalConfirmation = await request(`/api/signature-participants/${professionalParticipantId}/confirm`, json({ evidence: {
      documentId: professionalDocumentRow.document.id, baseRevisionId: professionalDocumentRow.revision.id, signaturePng: pngDataUrl, placement,
      idempotencyKey: professionalIdempotencyKey, previewHash: professionalPreviewHash, fingerprint: { visitorId: 'vis-clinic', version: 'fingerprintjs-oss-5' },
      confirmed: true, acceptanceText: 'aceito',
    } }));
    expect(professionalConfirmation.status).toBe(200);
    expect((await professionalConfirmation.json() as any).processCompleted).toBe(true);

    const revisions = await db.select().from(signatureRevisions).where(eq(signatureRevisions.tenantId, tenantId));
    const events = await db.select().from(signatureEvents).where(eq(signatureEvents.tenantId, tenantId));
    expect(revisions).toHaveLength(3);
    expect(events.filter((event) => event.type === 'signed')).toHaveLength(3);
    expect(revisions.every((revision) => !!revision.evidenceCiphertext)).toBe(true);
  });

  it('rejects expired tokens and isolates tenant-scoped pending data', async () => {
    const db = getDatabase();
    const token = (await db.select().from(signatureTokens).where(and(eq(signatureTokens.tenantId, tenantId), eq(signatureTokens.participantId, patientParticipantIds[1]!))))[0]!;
    await db.update(signatureTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(signatureTokens.id, token.id));
    expect((await request(`/public/signatures/${patientTokens[1]}`)).status).toBe(404);
    const otherPending = await app.request('/api/signature-pending', { headers: otherSessionHeaders });
    expect(otherPending.status).toBe(200);
    expect(await otherPending.json()).toEqual([]);
    expect((await app.request(`/api/followups/${followupId}`, { headers: otherSessionHeaders })).status).toBe(404);
  });
});
