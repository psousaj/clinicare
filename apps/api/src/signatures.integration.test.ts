import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { app } from './app';
import {
  appliedDocuments, appliedDocumentRevisions, authUsers, closeDatabase, contracts,
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
  let tokenByProcess: Record<string, { patient: string; professional: string }>;
  let documentByContract: Record<string, string>;
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
    const tokenEntries = Object.entries(created.signatureTokens) as Array<[string, any]>;
    tokenByProcess = {};
    for (const [processId, group] of tokenEntries) {
      tokenByProcess[processId] = { patient: group.patient.token, professional: group.professional.token };
    }
    patientTokens = tokenEntries.map(([, group]) => group.patient.token);

    documentIds = [];
    documentByContract = {};
    for (const contractRow of created.contracts as any[]) {
      const mat = await materializeAppliedDocumentResult(tenantId, contractRow.id);
      if (!mat.document) throw new Error('Documento aplicado não materializado.');
      documentIds.push(mat.document.id);
      documentByContract[contractRow.id] = mat.document.id;
    }

    const processes = await db.select().from(signatureProcesses).where(eq(signatureProcesses.tenantId, tenantId));
    expect(processes).toHaveLength(2);

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
    // Mantém o mapa por processo sincronizado com o token renovado.
    const db = getDatabase();
    const refreshedParticipant = (await db.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.id, patientParticipantIds[0]))))[0]!;
    tokenByProcess[refreshedParticipant.processId]!.patient = refreshed.token;
  });

  it('allows pending professional signatures without blocking, activates after every patient contract, and deduplicates concurrent confirmation', async () => {
    const db = getDatabase();
    const sessionUser = (await db.select().from(authUsers).where(eq(authUsers.tenantId, tenantId)))[0]!;
    const tenantName = (await db.select().from(tenants).where(eq(tenants.id, tenantId)))[0]!.name;
    const processes = await db.select().from(signatureProcesses).where(eq(signatureProcesses.tenantId, tenantId));
    expect(processes).toHaveLength(2);
    const allParticipants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    const participantOf = (processId: string, role: 'patient' | 'professional') =>
      allParticipants.find((p) => p.processId === processId && p.role === role)!;
    const [processA, processB] = processes as [typeof processes[number], typeof processes[number]];
    const proA = participantOf(processA!.id, 'professional');
    const patA = participantOf(processA!.id, 'patient');
    const proB = participantOf(processB!.id, 'professional');
    const patB = participantOf(processB!.id, 'patient');
    expect(new Set([proA.id, patA.id, proB.id, patB.id]).size).toBe(4);

    const pending = await request('/api/signature-pending');
    expect(pending.status).toBe(200);
    const pendingRows = await pending.json() as any[];
    expect(pendingRows.filter((row) => row.role === 'patient' && row.blocking)).toHaveLength(2);
    expect(pendingRows.filter((row) => row.role === 'professional' && !row.blocking)).toHaveLength(2);

    // Isolamento: sessão de outro tenant não enxerga nem opera o participante.
    expect((await app.request(`/api/signature-participants/${proA!.id}/pdf`, { headers: otherSessionHeaders })).status).toBe(404);
    expect((await app.request(`/api/signature-participants/${proA!.id}/confirm`, { method: 'POST', headers: otherSessionHeaders, body: JSON.stringify({ evidence: { documentId: documentByContract[processA!.followupContractId], baseRevisionId: '00000000-0000-4000-8000-000000000000', signaturePng: pngDataUrl, placement, idempotencyKey: randomUUID(), confirmed: true, acceptanceText: 'aceito' } }) })).status).toBe(404);
    // Representante não opera por link público: somente painel autenticado.
    expect((await request(`/public/signatures/${tokenByProcess[processB!.id]!.professional}`)).status).toBe(403);

    const currentDocumentFor = async (participantId: string) => {
      const participant = (await db.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.id, participantId))))[0]!;
      const process = (await db.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, participant.processId))))[0]!;
      const row = (await db.select({ document: appliedDocuments, revision: appliedDocumentRevisions }).from(appliedDocuments).innerJoin(appliedDocumentRevisions, and(eq(appliedDocumentRevisions.tenantId, appliedDocuments.tenantId), eq(appliedDocumentRevisions.id, appliedDocuments.currentRevisionId))).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, process.followupContractId))))[0]!;
      return { documentId: row.document.id, baseRevisionId: row.revision.id };
    };
    const representativeConfirm = async (participantId: string, evidenceExtra: Record<string, unknown> = {}) => {
      const pdfRead = await request(`/api/signature-participants/${participantId}/pdf`);
      expect(pdfRead.status).toBe(200);
      const { documentId, baseRevisionId } = await currentDocumentFor(participantId);
      const idempotencyKey = randomUUID();
      const previewPayload = { documentId, baseRevisionId, signaturePng: pngDataUrl, placement, idempotencyKey, fingerprint: { visitorId: 'vis-clinic', version: 'fingerprintjs-oss-5' }, previewOnly: true };
      const previewResponse = await request(`/api/signature-participants/${participantId}/preview`, json(previewPayload));
      expect(previewResponse.status).toBe(200);
      const previewHash = previewResponse.headers.get('etag')!.replaceAll('"', '');
      return request(`/api/signature-participants/${participantId}/confirm`, json({ evidence: {
        documentId, baseRevisionId, signaturePng: pngDataUrl, placement,
        idempotencyKey, previewHash, fingerprint: { visitorId: 'vis-clinic', version: 'fingerprintjs-oss-5' },
        confirmed: true, acceptanceText: 'aceito pelo representante',
        ...evidenceExtra,
      } }));
    };

    // Ordem livre (Issue #25): o representante do contrato A assina ANTES de
    // qualquer paciente, com um userId falso no corpo que deve ser ignorado.
    // A identidade vem exclusivamente da sessão autenticada.
    const proAConfirm = await representativeConfirm(proA!.id, { userId: 'attacker' });
    expect(proAConfirm.status).toBe(200);
    expect((await proAConfirm.json() as any).processCompleted).toBe(false);
    expect((await (await request(`/api/followups/${followupId}`)).json()).status).toBe('idle');
    const proAOperation = (await db.select().from(signatureOperations).where(and(eq(signatureOperations.tenantId, tenantId), eq(signatureOperations.participantId, proA!.id))))[0]!;
    expect(proAOperation.identitySnapshot).toEqual({
      role: 'professional',
      userId: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      tenantId,
      clinic: tenantName,
    });

    const tokenA = tokenByProcess[processA!.id]!.patient;
    const firstVerify = await request(`/public/signatures/${tokenA}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(firstVerify.status).toBe(200);
    const firstRead = await request(`/public/signatures/${tokenA}`);
    const firstDocument = ((await firstRead.json()) as any).document;

    // Duas tentativas concorrentes de confirmação da mesma revisão: cada uma gera
    // sua própria prévia com sua própria chave de idempotência; uma vence.
    const firstAttempts: Array<{ idempotencyKey: string; previewHash: string }> = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const idempotencyKey = randomUUID();
      const previewPayload = { documentId: firstDocument.id, baseRevisionId: firstDocument.revisionId, signaturePng: pngDataUrl, placement, idempotencyKey, fingerprint: { visitorId: 'vis-1', version: 'fingerprintjs-oss-5' }, previewOnly: true };
      const previewResponse = await request(`/public/signatures/${tokenA}/preview`, json(previewPayload));
      expect(previewResponse.status).toBe(200);
      firstAttempts.push({ idempotencyKey, previewHash: previewResponse.headers.get('etag')!.replaceAll('"', '') });
    }
    const firstConfirmations = await Promise.all(firstAttempts.map(({ idempotencyKey, previewHash }) =>
      request(`/public/signatures/${tokenA}/confirm`, json({ evidence: {
        documentId: firstDocument.id, baseRevisionId: firstDocument.revisionId, signaturePng: pngDataUrl, placement,
        idempotencyKey, previewHash, fingerprint: { visitorId: 'vis-1', version: 'fingerprintjs-oss-5' },
        confirmed: true, acceptanceText: 'aceito',
      } }))));
    expect(firstConfirmations.filter((response) => response.status === 200)).toHaveLength(1);
    expect(firstConfirmations.filter((response) => response.status === 409)).toHaveLength(1);
    expect((await (await request(`/api/followups/${followupId}`)).json()).status).toBe('idle');

    const tokenB = tokenByProcess[processB!.id]!.patient;
    const secondVerify = await request(`/public/signatures/${tokenB}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(secondVerify.status).toBe(200);
    const secondRead = await request(`/public/signatures/${tokenB}`);
    const secondDocument = ((await secondRead.json()) as any).document;
    const secondIdempotencyKey = randomUUID();
    // Sem fingerprint (navegador com coleta bloqueada): a assinatura não pode
    // ser bloqueada por indisponibilidade de atributos (Issue #24).
    const secondPreviewPayload = { documentId: secondDocument.id, baseRevisionId: secondDocument.revisionId, signaturePng: pngDataUrl, placement, idempotencyKey: secondIdempotencyKey, previewOnly: true };
    const secondPreview = await request(`/public/signatures/${tokenB}/preview`, json(secondPreviewPayload));
    expect(secondPreview.status).toBe(200);
    const secondPreviewHash = secondPreview.headers.get('etag')!.replaceAll('"', '');
    const second = await request(`/public/signatures/${tokenB}/confirm`, json({ evidence: {
      documentId: secondDocument.id, baseRevisionId: secondDocument.revisionId, signaturePng: pngDataUrl, placement,
      idempotencyKey: secondIdempotencyKey, previewHash: secondPreviewHash,
      confirmed: true, acceptanceText: 'aceito',
    } }));
    expect(second.status).toBe(200);
    const secondBody = await second.json() as any;
    expect(secondBody.activated).toBe(true);
    // O processo do contrato B só conclui quando o representante também confirmar.
    expect(secondBody.processCompleted).toBe(false);
    const followup = await (await request(`/api/followups/${followupId}`)).json() as any;
    expect(followup.status).toBe('active');

    // Representante do contrato B confirma por último, pelo painel autenticado.
    const professionalConfirmation = await representativeConfirm(proB!.id);
    expect(professionalConfirmation.status).toBe(200);
    expect((await professionalConfirmation.json() as any).processCompleted).toBe(true);

    const revisions = await db.select().from(signatureRevisions).where(eq(signatureRevisions.tenantId, tenantId));
    const events = await db.select().from(signatureEvents).where(eq(signatureEvents.tenantId, tenantId));
    expect(revisions).toHaveLength(4);
    expect(events.filter((event) => event.type === 'signed')).toHaveLength(4);
    expect(revisions.every((revision) => !!revision.evidenceCiphertext)).toBe(true);

    // Issue #24: confirmação sem fingerprint gera evidência marcada como
    // indisponível, vinculada à operação, sem inventar valores.
    const allEvidence = await db.select().from(signatureEvidence).where(eq(signatureEvidence.tenantId, tenantId));
    const unavailableEvidence = allEvidence.find((row) => row.participantId === patB!.id)!;
    expect(unavailableEvidence).toBeDefined();
    expect(unavailableEvidence.collectorVersion).toBe('fingerprintjs-oss-5');
    expect(unavailableEvidence.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(unavailableEvidence.attributes).toEqual({});
    expect(unavailableEvidence.unavailableAttributes).toEqual([]);
    // Nenhum visitorId foi inventado para a coleta ausente.
    expect((unavailableEvidence.normalizedRepresentation as any).visitorId).toBeUndefined();

    // Issue #25: fingerprint do representante persistido com snapshot da sessão.
    const professionalEvidence = allEvidence.filter((row) => row.eventType === 'professional_confirmation');
    expect(professionalEvidence).toHaveLength(2);
    for (const row of professionalEvidence) {
      expect(row.collectorVersion).toBe('fingerprintjs-oss-5');
      expect(row.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(row.observedAt).toBeInstanceOf(Date);
    }
    const proBOperation = (await db.select().from(signatureOperations).where(and(eq(signatureOperations.tenantId, tenantId), eq(signatureOperations.participantId, proB!.id))))[0]!;
    expect(proBOperation.identitySnapshot).toEqual({
      role: 'professional',
      userId: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      tenantId,
      clinic: tenantName,
    });
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
