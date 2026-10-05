import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { app } from './app';
import {
  appliedDocuments, appliedDocumentRevisions, closeDatabase, contracts,
  contractVersions, documentCleanupJobs, followupContracts, followupItems,
  followupSnapshots, followups, getDatabase, migrateDatabase, patients,
  planVersionContracts, planVersionItems, planVersions, plans, procedures,
  signatureEvents, signatureEvidence, signatureOperations,
  signatureParticipants, signatureProcesses, signatureRevisions,
  signatureTokens, tenants, encryptValue, buildPatientAad
} from '@clinicare/db';
import {
  assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration,
  integrationHeaders, provisionIntegrationClinic
} from './integration-support';
import { deleteObject, downloadObjectBytes, uploadObjectBytes } from './storage';
import { materializeAppliedDocumentResult, deleteAppliedDocument } from './clinical';
import { createHash, randomUUID } from 'node:crypto';
import { PDF } from '@libpdf/core';

let sessionHeaders: Record<string, string>;
const request = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { ...sessionHeaders, ...(init.headers ?? {}) } });
const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { ...sessionHeaders },
  body: JSON.stringify(body)
});

const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

integration('Issue #23: Entregar assinatura manuscrita local do paciente', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  let patientId: string;
  let followupId: string;
  let followupContractId: string;
  let patientToken: string;
  let patientParticipantId: string;
  let professionalParticipantId: string;
  let documentId: string;
  let baseRevisionId: string;
  let pdfBytes: Uint8Array;
  let pdfKey: string;
  let otherSessionHeaders: Record<string, string>;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    const db = getDatabase();
    await provisionIntegrationClinic(app, 'sig-flow', tenantId);
    await provisionIntegrationClinic(app, 'sig-flow-other', otherTenantId);
    sessionHeaders = integrationHeaders(tenantId);
    otherSessionHeaders = integrationHeaders(otherTenantId);

    patientId = crypto.randomUUID();
    const procedureId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const contractId = crypto.randomUUID();
    const contractVersionId = crypto.randomUUID();

    const phoneEnc = encryptValue('11987654321', buildPatientAad(tenantId, patientId, 'phone', 1));
    await db.insert(patients).values({
      id: patientId,
      tenantId,
      fullName: 'Paciente Teste Fluxo',
      phoneCiphertext: phoneEnc.ciphertext,
      phoneNonce: phoneEnc.nonce,
      phoneKeyVersion: 1
    });

    await db.insert(procedures).values({
      id: procedureId,
      tenantId,
      name: 'Procedimento Assinatura',
      durationMinutes: 30,
      priceCents: 500,
      sessionSchema: { type: 'object', properties: {} }
    });

    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano Assinatura Local' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 500 });
    await db.insert(planVersionItems).values({
      tenantId,
      planVersionId: versionId,
      procedureId,
      sessions: 1,
      procedureName: 'Procedimento Assinatura',
      durationMinutes: 30,
      priceCents: 500,
      sessionSchema: { type: 'object', properties: {} }
    });

    const doc = PDF.create();
    doc.addPage({ width: 612, height: 792 });
    pdfBytes = await doc.save();
    const pdfHash = createHash('sha256').update(pdfBytes).digest('hex');
    pdfKey = randomUUID();
    await uploadObjectBytes(pdfKey, pdfBytes);

    await db.insert(contracts).values({ id: contractId, tenantId, title: 'Contrato Assinatura Local', kind: 'standard' });
    await db.insert(contractVersions).values({
      id: contractVersionId,
      tenantId,
      contractId,
      version: 1,
      content: 'Termos protegidos',
      renderedPdfObjectKey: pdfKey,
      renderedPdfHash: pdfHash,
      renderedPdfSize: pdfBytes.byteLength,
      renderedPdfContentType: 'application/pdf'
    });
    await db.insert(planVersionContracts).values({
      tenantId,
      planVersionId: versionId,
      contractId,
      contractVersion: 1,
      title: 'Contrato Assinatura Local'
    });

    const createRes = await request('/api/followups', json({ patientId, offerType: 'plan', offerId: planId }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as any;
    followupId = created.id;
    followupContractId = created.contracts[0].id;

    // Materializa o documento para o contrato aplicado
    const mat = await materializeAppliedDocumentResult(tenantId, followupContractId);
    if (!mat.document) throw new Error('Documento aplicado não materializado.');
    documentId = mat.document.id;

    const tokenGroup = Object.values(created.signatureTokens)[0] as any;
    patientToken = tokenGroup.patient.token;

    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    patientParticipantId = participants.find((p) => p.role === 'patient')!.id;
    professionalParticipantId = participants.find((p) => p.role === 'professional')!.id;
  });

  afterAll(async () => {
    const db = getDatabase();
    for (const table of [
      signatureEvidence, signatureEvents, signatureRevisions, signatureOperations,
      signatureTokens, signatureParticipants, signatureProcesses
    ]) {
      await db.delete(table as any).where(eq((table as any).tenantId, tenantId));
      await db.delete(table as any).where(eq((table as any).tenantId, otherTenantId));
    }
    if (documentId) {
      await deleteAppliedDocument(tenantId, documentId).catch(() => null);
    }
    if (pdfKey) await deleteObject(pdfKey).catch(() => null);
    for (const table of [
      documentCleanupJobs, followupContracts, followupItems, followupSnapshots,
      followups,
      planVersionContracts, planVersionItems, planVersions, plans,
      contractVersions, contracts, procedures, patients
    ]) {
      await db.delete(table as any).where(eq((table as any).tenantId, tenantId));
      await db.delete(table as any).where(eq((table as any).tenantId, otherTenantId));
    }
    await cleanupIntegrationClinics([tenantId, otherTenantId]);
    await closeDatabase();
  });

  it('exige os 4 últimos dígitos do telefone antes de liberar acesso ao contrato e PDF', async () => {
    // Acesso inicial sem telefone retorna verification_required
    const unverified = await request(`/public/signatures/${patientToken}`);
    expect(unverified.status).toBe(200);
    const unverifiedBody = await unverified.json() as any;
    expect(unverifiedBody.status).toBe('verification_required');
    expect(unverifiedBody.phoneVerificationRequired).toBe(true);

    // Tentativa com dígitos errados falha (403 ou 400)
    const wrongPhone = await request(`/public/signatures/${patientToken}/verify-phone`, json({ phoneLast4: '0000' }));
    expect([400, 403]).toContain(wrongPhone.status);

    // Tentativa com dígitos corretos (4321 de 11987654321) tem sucesso
    const validPhone = await request(`/public/signatures/${patientToken}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(validPhone.status).toBe(200);

    // Agora o contrato e o documento são acessíveis
    const read = await request(`/public/signatures/${patientToken}`);
    expect(read.status).toBe(200);
    const readBody = await read.json() as any;
    expect(readBody.contract.title).toBe('Contrato Assinatura Local');
    expect(readBody.document).toBeDefined();
    expect(readBody.document.id).toBe(documentId);
    baseRevisionId = readBody.document.revisionId;
    expect(baseRevisionId).toBeTruthy();

    // O PDF pode ser baixado pelo link público temporário
    const pdfRes = await request(`/public/signatures/${patientToken}/pdf`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get('content-type')).toBe('application/pdf');
    const downloadedBytes = new Uint8Array(await pdfRes.arrayBuffer());
    expect(downloadedBytes.byteLength).toBe(pdfBytes.byteLength);
    expect(Array.from(downloadedBytes)).toEqual(Array.from(pdfBytes));
  });

  it('confirma assinatura manuscrita, gera incremental update e mantém idempotência', async () => {
    const verified = await request(`/public/signatures/${patientToken}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(verified.status).toBe(200);
    const current = await request(`/public/signatures/${patientToken}`);
    expect(current.status).toBe(200);
    baseRevisionId = ((await current.json()) as any).document.revisionId;

    const otherPending = await app.request('/api/signature-pending', { headers: otherSessionHeaders });
    expect(otherPending.status).toBe(200);
    expect((await otherPending.json() as any[]).some((item) => item.patient?.id === patientId)).toBe(false);

    const idempotencyKey = randomUUID();
    const placement = { pageIndex: 0, x: 0.1, y: 0.2, width: 0.25, height: 0.12 };
    const browserIdentity = await request(`/api/signature-participants/${professionalParticipantId}/confirm`, { method: 'POST', body: JSON.stringify({ userId: 'attacker', evidence: { documentId, baseRevisionId, signaturePng: pngDataUrl, placement, idempotencyKey: randomUUID(), confirmed: true, acceptanceText: 'aceito' } }) });
    expect([403, 404]).toContain(browserIdentity.status);

    const payload = {
      baseRevisionId,
      documentId,
      signaturePng: pngDataUrl,
      idempotencyKey,
      confirmed: true,
      acceptanceText: 'Li e aceito os termos do contrato',
      placement,
      fingerprint: {
        version: 'fingerprintjs-oss-5',
        visitorId: 'vis-123',
        attributes: { userAgent: 'test-agent' },
        unavailableAttributes: []
      }
    };

    // Duas confirmações concorrentes da mesma revisão: uma vence e a outra
    // permanece como tentativa stale sem promover o HEAD.
    const previewResponse = await request(`/public/signatures/${patientToken}/preview`, json({ ...payload, previewOnly: true }));
    expect(previewResponse.status).toBe(200);
    const previewHash = previewResponse.headers.get('etag')!.replaceAll('"', '');
    const concurrentPayloads = [
      { ...payload, previewHash, idempotencyKey: randomUUID() },
      { ...payload, previewHash, idempotencyKey: randomUUID() },
    ];
    const concurrentResponses = await Promise.all(concurrentPayloads.map((evidence) => request(`/public/signatures/${patientToken}/confirm`, json({ evidence }))));
    expect(concurrentResponses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(concurrentResponses.filter((response) => response.status === 409)).toHaveLength(1);
    const winnerIndex = concurrentResponses.findIndex((response) => response.status === 200);
    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    const winnerPayload = concurrentPayloads[winnerIndex]!;

    // Repetição da tentativa vencedora com a mesma chave retorna sucesso idempotente.
    const retryRes = await request(`/public/signatures/${patientToken}/confirm`, json({ evidence: winnerPayload }));
    expect(retryRes.status).toBe(200);

    // Verifica que o participante foi marcado como signed
    const db = getDatabase();
    const participant = (await db.select().from(signatureParticipants).where(eq(signatureParticipants.id, patientParticipantId)))[0]!;
    expect(participant.status).toBe('signed');
    expect(participant.signedAt).not.toBeNull();

    // Verifica que uma nova revisão foi criada (versão 2) tendo como pai a versão 1
    const doc = (await db.select().from(appliedDocuments).where(eq(appliedDocuments.id, documentId)))[0]!;
    expect(doc.currentRevisionId).not.toBe(baseRevisionId);

    const rev2 = (await db.select().from(appliedDocumentRevisions).where(eq(appliedDocumentRevisions.id, doc.currentRevisionId!)))[0]!;
    expect(rev2.version).toBe(2);
    expect(rev2.parentRevisionId).toBe(baseRevisionId);
    expect(rev2.origin).toBe('local_handwritten');
    const baseBytes = await downloadObjectBytes((await db.select().from(appliedDocumentRevisions).where(eq(appliedDocumentRevisions.id, baseRevisionId)))[0]!.objectKey);
    const signedBytes = await downloadObjectBytes(rev2.objectKey);
    expect(Array.from(signedBytes.subarray(0, baseBytes.byteLength))).toEqual(Array.from(baseBytes));
    expect(rev2.contentHash).toBe(createHash('sha256').update(signedBytes).digest('hex'));
    const operations = await db.select().from(signatureOperations).where(eq(signatureOperations.tenantId, tenantId));
    expect(operations.filter((operation) => operation.status === 'confirmed')).toHaveLength(1);
    const staleOperation = operations.find((operation) => operation.status === 'stale')!;
    expect(staleOperation).toBeDefined();
    expect(staleOperation.candidateObjectKey).toBeTruthy();
    expect(staleOperation.candidateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(staleOperation.candidateSize).toBeGreaterThan(0);
    expect(staleOperation.placement).toEqual(placement);
    expect(staleOperation.fingerprint).toBeTruthy();
    expect(operations.find((operation) => operation.status === 'confirmed')!.candidateHash).toBe(rev2.contentHash);

    // Concorrência / conflito: tentativa com baseRevisionId antiga resulta em STALE_DOCUMENT_REVISION (409)
    const stalePayload = {
      ...payload,
      previewHash,
      idempotencyKey: randomUUID()
    };
    const staleRes = await request(`/public/signatures/${patientToken}/confirm`, json({ evidence: stalePayload }));
    expect(staleRes.status).toBe(409);
    expect((await staleRes.json() as any).code).toBe('STALE_DOCUMENT_REVISION');
    const attempts = await db.select().from(signatureOperations).where(eq(signatureOperations.tenantId, tenantId));
    expect(attempts.filter((operation) => operation.status === 'stale')).toHaveLength(1);
  });
});
