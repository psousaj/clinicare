import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { app } from './app';
import {
  appliedDocuments, appliedDocumentRevisions, authUsers, closeDatabase, contracts,
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
import {
  buildSignedReturnPdf, buildUnparsableCmsReturn, createTestCa, ensureOpensslAvailable,
  issueTestSigner, tamperAfterExport, type TestCa, type TestSigner,
} from './external-test-fixtures';

let sessionHeaders: Record<string, string>;
const request = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { ...sessionHeaders, ...(init.headers ?? {}) } });
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { ...sessionHeaders }, body: JSON.stringify(body) });

const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const placement = { pageIndex: 0, x: 0.1, y: 0.2, width: 0.25, height: 0.12 };
const patientCpf = '52998224725';

integration('Issue #26: Exportar e importar assinatura externa pelo GOV.BR', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  let patientId: string;
  let followupId: string;
  let tokenByProcess: Record<string, string>;
  let processIds: string[];
  let documentIds: string[];
  let pdfKeys: string[];
  let otherSessionHeaders: Record<string, string>;
  let ca: TestCa;
  let patientSigner: TestSigner;
  let sessionEmail: string;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await ensureOpensslAvailable();
    await migrateDatabase();
    const db = getDatabase();
    await provisionIntegrationClinic(app, 'sig-external', tenantId);
    await provisionIntegrationClinic(app, 'sig-external-other', otherTenantId);
    sessionHeaders = integrationHeaders(tenantId);
    otherSessionHeaders = integrationHeaders(otherTenantId);
    sessionEmail = (await db.select().from(authUsers).where(eq(authUsers.tenantId, tenantId)))[0]!.email;

    const patientRes = await request('/api/patients', json({ fullName: 'Paciente Externo', phone: '11987654321', cpf: patientCpf }));
    expect(patientRes.status).toBe(201);
    patientId = ((await patientRes.json()) as any).id;

    const procedureId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento Externo', durationMinutes: 30, priceCents: 500, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano Externo' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 500 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, procedureId, sessions: 1, procedureName: 'Procedimento Externo', durationMinutes: 30, priceCents: 500, sessionSchema: { type: 'object', properties: {} } });

    pdfKeys = [];
    for (const index of [1, 2]) {
      const doc = PDF.create();
      doc.addPage({ width: 612, height: 792 });
      const pdfBytes = await doc.save();
      const pdfKey = randomUUID();
      await uploadObjectBytes(pdfKey, pdfBytes);
      pdfKeys.push(pdfKey);
      const contractId = crypto.randomUUID();
      const contractVersionId = crypto.randomUUID();
      await db.insert(contracts).values({ id: contractId, tenantId, title: `Contrato Externo ${index}`, kind: 'standard' });
      await db.insert(contractVersions).values({
        id: contractVersionId, tenantId, contractId, version: 1, content: `Termos externos ${index}`,
        renderedPdfObjectKey: pdfKey, renderedPdfHash: createHash('sha256').update(pdfBytes).digest('hex'),
        renderedPdfSize: pdfBytes.byteLength, renderedPdfContentType: 'application/pdf',
      });
      await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId, contractVersion: 1, title: `Contrato Externo ${index}` });
    }

    const createRes = await request('/api/followups', json({ patientId, offerType: 'plan', offerId: planId }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as any;
    followupId = created.id;
    tokenByProcess = {};
    for (const [processId, group] of Object.entries(created.signatureTokens) as Array<[string, any]>) {
      tokenByProcess[processId] = group.patient.token;
    }
    processIds = Object.keys(created.signatureTokens);
    expect(processIds).toHaveLength(2);

    documentIds = [];
    for (const contractRow of created.contracts as any[]) {
      const mat = await materializeAppliedDocumentResult(tenantId, contractRow.id);
      if (!mat.document) throw new Error('Documento aplicado não materializado.');
      documentIds.push(mat.document.id);
    }

    ca = await createTestCa('sig-external-flow');
    patientSigner = await issueTestSigner(ca, { commonName: 'Paciente Externo', cpfDigits: patientCpf, email: 'paciente-externo@example.test' });
    process.env.GOVBR_TRUSTED_ROOTS = ca.caPem;
  });

  afterAll(async () => {
    delete process.env.GOVBR_TRUSTED_ROOTS;
    const db = getDatabase();
    for (const table of [
      signatureEvidence, signatureEvents, signatureRevisions, signatureOperations,
      signatureExternalReceipts, signatureExternalAttempts,
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

  const readDocument = async (token: string) => {
    const verified = await request(`/public/signatures/${token}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(verified.status).toBe(200);
    const current = await request(`/public/signatures/${token}`);
    expect(current.status).toBe(200);
    return ((await current.json()) as any).document as { id: string; revisionId: string; version: number; hash: string };
  };

  it('exports the current revision and serves the exact bytes for download', async () => {
    const token = tokenByProcess[processIds[0]!]!;
    const document = await readDocument(token);
    const exportRes = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-export', version: 'fingerprintjs-oss-5' },
    }));
    expect(exportRes.status).toBe(200);
    const exported = await exportRes.json() as any;
    expect(exported.attemptId).toBeTruthy();
    expect(exported.exportHash).toBe(document.hash);
    expect(new Date(exported.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const fileRes = await request(`/public/signatures/${token}/external/${exported.attemptId}/file`);
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get('content-type')).toBe('application/pdf');
    const downloaded = new Uint8Array(await fileRes.arrayBuffer());
    expect(createHash('sha256').update(downloaded).digest('hex')).toBe(document.hash);

    const db = getDatabase();
    const attempt = (await db.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, tenantId), eq(signatureExternalAttempts.id, exported.attemptId))))[0]!;
    expect(attempt.lifecycleStatus).toBe('reserved');
    expect(attempt.provider).toBe('govbr');
    expect(attempt.exportHash).toBe(document.hash);
    expect(attempt.exportFingerprint).toBeTruthy();
    const evidence = await db.select().from(signatureEvidence).where(and(eq(signatureEvidence.tenantId, tenantId), eq(signatureEvidence.externalAttemptId, attempt.id)));
    expect(evidence.filter((row) => row.eventType === 'external_export')).toHaveLength(1);
    expect(evidence[0]!.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence[0]!.documentRevisionId).toBe(document.revisionId);
  });

  it('imports a genuinely signed return and confirms it as a new revision', async () => {
    const db = getDatabase();
    const token = tokenByProcess[processIds[0]!]!;
    const document = await readDocument(token);
    const exportRes = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-export-2', version: 'fingerprintjs-oss-5' },
    }));
    const { attemptId } = await exportRes.json() as any;
    const fileRes = await request(`/public/signatures/${token}/external/${attemptId}/file`);
    const exportBytes = new Uint8Array(await fileRes.arrayBuffer());

    // Assinatura real fora da aplicação (papel do portal GOV.BR no teste).
    const signedBytes = await buildSignedReturnPdf(exportBytes, patientSigner, ca.dir);
    const importRes = await request(`/public/signatures/${token}/external/import`, json({
      attemptId, pdfBase64: Buffer.from(signedBytes).toString('base64'),
      fingerprint: { visitorId: 'vis-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(importRes.status).toBe(200);
    const imported = await importRes.json() as any;
    expect(imported.validationStatus).toBe('validada');
    expect(imported.signer?.commonName).toBe('Paciente Externo');
    expect(imported.certificateFingerprint).toMatch(/^[0-9a-f]{64}$/);

    const receipt = (await db.select().from(signatureExternalReceipts).where(and(eq(signatureExternalReceipts.tenantId, tenantId), eq(signatureExternalReceipts.id, imported.receiptId))))[0]!;
    expect(receipt.validationStatus).toBe('validated');
    expect((receipt.validationReport as any)?.reason).toBe('ok');
    expect(receipt.signerIdentity).toMatchObject({ serialDigits: patientCpf });
    expect(receipt.coveredRevisionIds).toEqual([document.revisionId]);
    expect(receipt.rejectedReason).toBeNull();

    // Repetição do mesmo retorno é idempotente: devolve o mesmo recebimento.
    const replayRes = await request(`/public/signatures/${token}/external/import`, json({
      attemptId, pdfBase64: Buffer.from(signedBytes).toString('base64'),
      fingerprint: { visitorId: 'vis-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(replayRes.status).toBe(200);
    expect((await replayRes.json() as any).receiptId).toBe(imported.receiptId);

    const confirmRes = await request(`/public/signatures/${token}/external/confirm`, json({
      attemptId, idempotencyKey: randomUUID(),
      fingerprint: { visitorId: 'vis-accept', version: 'fingerprintjs-oss-5' },
      acceptanceText: 'Confirmo a assinatura realizada no GOV.BR', confirmed: true,
    }));
    expect(confirmRes.status).toBe(200);
    const confirmBody = JSON.stringify(await confirmRes.clone().json());
    expect(confirmBody).not.toContain('fingerprint');

    const revision = (await db.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, document.id)))).sort((a, b) => b.version - a.version)[0]!;
    expect(revision.version).toBe(document.version + 1);
    expect(revision.parentRevisionId).toBe(document.revisionId);
    expect(revision.origin).toBe('govbr_external');
    expect(revision.sourceExternalReceiptId).toBe(imported.receiptId);
    // O PDF externo foi incorporado byte-a-byte, sem reserialização (ADR 0004).
    const promotedBytes = await downloadObjectBytes(revision.objectKey);
    expect(Array.from(promotedBytes.subarray(0, exportBytes.byteLength))).toEqual(Array.from(exportBytes));
    expect(createHash('sha256').update(promotedBytes).digest('hex')).toBe(revision.contentHash);

    const updatedReceipt = (await db.select().from(signatureExternalReceipts).where(and(eq(signatureExternalReceipts.tenantId, tenantId), eq(signatureExternalReceipts.id, imported.receiptId))))[0]!;
    expect(updatedReceipt.promotedRevisionId).toBe(revision.id);
    const updatedAttempt = (await db.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, tenantId), eq(signatureExternalAttempts.id, attemptId))))[0]!;
    expect(updatedAttempt.lifecycleStatus).toBe('completed');
    const operation = (await db.select().from(signatureOperations).where(and(eq(signatureOperations.tenantId, tenantId), eq(signatureOperations.documentId, document.id), eq(signatureOperations.method, 'govbr_external'))))[0]!;
    expect(operation.status).toBe('confirmed');
    expect(operation.placement).toBeNull();
    expect(operation.signatureImageHash).toBeNull();
    const participant = (await db.select().from(signatureParticipants).where(eq(signatureParticipants.id, operation.participantId)))[0]!;
    expect(participant.status).toBe('signed');

    // Fingerprints separados por etapa: exportação, importação e aceite.
    const evidence = await db.select().from(signatureEvidence).where(and(eq(signatureEvidence.tenantId, tenantId), eq(signatureEvidence.externalAttemptId, attemptId)));
    const digests = new Set(evidence.map((row) => row.digest));
    expect(evidence.filter((row) => row.eventType === 'external_export')).toHaveLength(1);
    expect(evidence.filter((row) => row.eventType === 'external_import')).toHaveLength(1);
    expect(evidence.filter((row) => row.eventType === 'external_accept')).toHaveLength(1);
    expect(digests.size).toBe(3);
  });

  it('preserves invalid and unsupported returns as history without promoting', async () => {
    const db = getDatabase();
    const token = tokenByProcess[processIds[1]!]!;
    const document = await readDocument(token);

    // Reenvio do PDF anterior sem assinatura nova: inválido, preservado.
    const replayExport = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-replay', version: 'fingerprintjs-oss-5' },
    }));
    const replayAttempt = (await replayExport.json() as any).attemptId;
    const unchanged = await (await request(`/public/signatures/${token}/external/${replayAttempt}/file`)).arrayBuffer();
    const replayImport = await request(`/public/signatures/${token}/external/import`, json({
      attemptId: replayAttempt, pdfBase64: Buffer.from(unchanged).toString('base64'),
      fingerprint: { visitorId: 'vis-replay-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(replayImport.status).toBe(200);
    expect((await replayImport.json() as any).validationStatus).toBe('inválida');
    const replayConfirm = await request(`/public/signatures/${token}/external/confirm`, json({
      attemptId: replayAttempt, idempotencyKey: randomUUID(),
      fingerprint: { visitorId: 'vis-replay-accept', version: 'fingerprintjs-oss-5' },
      acceptanceText: 'aceito', confirmed: true,
    }));
    expect(replayConfirm.status).toBe(409);

    // Lixo que não é PDF: formato não suportado, preservado sem promoção.
    const garbageExport = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-garbage', version: 'fingerprintjs-oss-5' },
    }));
    const garbageAttempt = (await garbageExport.json() as any).attemptId;
    const garbageImport = await request(`/public/signatures/${token}/external/import`, json({
      attemptId: garbageAttempt, pdfBase64: Buffer.from('definitivamente não é um pdf, só texto mais longo').toString('base64'),
      fingerprint: { visitorId: 'vis-garbage-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(garbageImport.status).toBe(200);
    expect((await garbageImport.json() as any).validationStatus).toBe('não suportada');

    // CMS quebrado: inválido, sem promoção.
    const brokenExport = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-broken', version: 'fingerprintjs-oss-5' },
    }));
    const brokenAttempt = (await brokenExport.json() as any).attemptId;
    const brokenBytes = buildUnparsableCmsReturn(new Uint8Array(await (await request(`/public/signatures/${token}/external/${brokenAttempt}/file`)).arrayBuffer()));
    const brokenImport = await request(`/public/signatures/${token}/external/import`, json({
      attemptId: brokenAttempt, pdfBase64: Buffer.from(brokenBytes).toString('base64'),
      fingerprint: { visitorId: 'vis-broken-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(brokenImport.status).toBe(200);
    expect((await brokenImport.json() as any).validationStatus).toBe('inválida');

    // Assinatura nova válida sobre base com assinatura anterior quebrada:
    // anterior não revalidável impede a decisão (indeterminado, sem promoção).
    const stackedExport = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-stacked', version: 'fingerprintjs-oss-5' },
    }));
    const stackedAttempt = (await stackedExport.json() as any).attemptId;
    const stackedBase = new Uint8Array(await (await request(`/public/signatures/${token}/external/${stackedAttempt}/file`)).arrayBuffer());
    const stackedBytes = await buildSignedReturnPdf(buildUnparsableCmsReturn(stackedBase), patientSigner, ca.dir);
    const stackedImport = await request(`/public/signatures/${token}/external/import`, json({
      attemptId: stackedAttempt, pdfBase64: Buffer.from(stackedBytes).toString('base64'),
      fingerprint: { visitorId: 'vis-stacked-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(stackedImport.status).toBe(200);
    const stackedBody = await stackedImport.json() as any;
    expect(stackedBody.validationStatus).toBe('indeterminada');
    expect(stackedBody.reason).toBe('previous_signatures_unverifiable');
    const stackedConfirm = await request(`/public/signatures/${token}/external/confirm`, json({
      attemptId: stackedAttempt, idempotencyKey: randomUUID(),
      fingerprint: { visitorId: 'vis-stacked-accept', version: 'fingerprintjs-oss-5' },
      acceptanceText: 'aceito', confirmed: true,
    }));
    expect(stackedConfirm.status).toBe(409);

    // Conteúdo adulterado após a assinatura: digest não confere.
    const tamperExport = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-tamper', version: 'fingerprintjs-oss-5' },
    }));
    const tamperAttempt = (await tamperExport.json() as any).attemptId;
    const tamperBase = new Uint8Array(await (await request(`/public/signatures/${token}/external/${tamperAttempt}/file`)).arrayBuffer());
    const tampered = tamperAfterExport(await buildSignedReturnPdf(tamperBase, patientSigner, ca.dir), tamperBase.byteLength);
    const tamperImport = await request(`/public/signatures/${token}/external/import`, json({
      attemptId: tamperAttempt, pdfBase64: Buffer.from(tampered).toString('base64'),
      fingerprint: { visitorId: 'vis-tamper-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(tamperImport.status).toBe(200);
    expect((await tamperImport.json() as any).validationStatus).toBe('inválida');

    // Nada foi promovido: HEAD e participante seguem pendentes.
    const head = (await db.select().from(appliedDocuments).where(eq(appliedDocuments.id, document.id)))[0]!;
    expect(head.currentRevisionId).toBe(document.revisionId);
    const receipts = await db.select().from(signatureExternalReceipts).where(eq(signatureExternalReceipts.tenantId, tenantId));
    expect(receipts.filter((r) => r.validationStatus === 'validated')).toHaveLength(1);
    expect(receipts.every((r) => r.promotedRevisionId === null || r.attemptId !== replayAttempt)).toBe(true);
  });

  it('expires reservations and honors cancellation', async () => {
    const db = getDatabase();
    const token = tokenByProcess[processIds[1]!]!;
    const document = await readDocument(token);

    const expiringExport = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-expire', version: 'fingerprintjs-oss-5' },
    }));
    const expiringAttempt = (await expiringExport.json() as any).attemptId;
    const expiringBytes = new Uint8Array(await (await request(`/public/signatures/${token}/external/${expiringAttempt}/file`)).arrayBuffer());
    await db.update(signatureExternalAttempts).set({ exportExpiresAt: new Date(Date.now() - 1000) }).where(eq(signatureExternalAttempts.id, expiringAttempt));
    const expiredImport = await request(`/public/signatures/${token}/external/import`, json({
      attemptId: expiringAttempt, pdfBase64: Buffer.from(expiringBytes).toString('base64'),
      fingerprint: { visitorId: 'vis-expire-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(expiredImport.status).toBe(409);

    const cancelExport = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-cancel', version: 'fingerprintjs-oss-5' },
    }));
    const cancelAttempt = (await cancelExport.json() as any).attemptId;
    const cancelRes = await request(`/public/signatures/${token}/external/cancel`, json({ attemptId: cancelAttempt }));
    expect(cancelRes.status).toBe(200);
    expect((await cancelRes.json() as any).cancelled).toBe(true);
    // Cancelamento repetido é idempotente.
    expect((await (await request(`/public/signatures/${token}/external/cancel`, json({ attemptId: cancelAttempt }))).json() as any).cancelled).toBe(true);
    const cancelledImport = await request(`/public/signatures/${token}/external/import`, json({
      attemptId: cancelAttempt, pdfBase64: Buffer.from('qualquer').toString('base64'),
      fingerprint: { visitorId: 'vis-cancel-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(cancelledImport.status).toBe(409);
    const cancelledConfirm = await request(`/public/signatures/${token}/external/confirm`, json({
      attemptId: cancelAttempt, idempotencyKey: randomUUID(),
      fingerprint: { visitorId: 'vis-cancel-accept', version: 'fingerprintjs-oss-5' },
      acceptanceText: 'aceito', confirmed: true,
    }));
    expect(cancelledConfirm.status).toBe(409);
    const cancelledFile = await request(`/public/signatures/${token}/external/${cancelAttempt}/file`);
    expect(cancelledFile.status).toBe(409);
  });

  it('rejects confirmation when the HEAD advanced after export', async () => {
    const db = getDatabase();
    const token = tokenByProcess[processIds[1]!]!;
    const document = await readDocument(token);
    const exportRes = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-stale', version: 'fingerprintjs-oss-5' },
    }));
    const { attemptId } = await exportRes.json() as any;
    const exportBytes = new Uint8Array(await (await request(`/public/signatures/${token}/external/${attemptId}/file`)).arrayBuffer());

    // Outro participante assina localmente: o HEAD avança para v2.
    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    const allProcesses = await db.select().from(signatureProcesses).where(eq(signatureProcesses.tenantId, tenantId));
    const myProcess = allProcesses.find((p) => tokenByProcess[p.id] === token)!;
    const professional = participants.find((p) => p.processId === myProcess.id && p.role === 'professional')!;
    const proIdempotencyKey = randomUUID();
    const proPreview = await request(`/api/signature-participants/${professional.id}/preview`, json({
      documentId: document.id, baseRevisionId: document.revisionId, signaturePng: pngDataUrl, placement,
      idempotencyKey: proIdempotencyKey, fingerprint: { visitorId: 'vis-local', version: 'fingerprintjs-oss-5' }, previewOnly: true,
    }));
    expect(proPreview.status).toBe(200);
    const proPreviewHash = proPreview.headers.get('etag')!.replaceAll('"', '');
    const proConfirm = await request(`/api/signature-participants/${professional.id}/confirm`, json({ evidence: {
      documentId: document.id, baseRevisionId: document.revisionId, signaturePng: pngDataUrl, placement,
      idempotencyKey: proIdempotencyKey, previewHash: proPreviewHash, fingerprint: { visitorId: 'vis-local', version: 'fingerprintjs-oss-5' },
      confirmed: true, acceptanceText: 'aceito local',
    } }));
    expect(proConfirm.status).toBe(200);

    // O retorno externo (derivado da v1) continua válido contra a exportação,
    // mas a confirmação não faz merge silencioso: 409 STALE_DOCUMENT_REVISION.
    const signedBytes = await buildSignedReturnPdf(exportBytes, patientSigner, ca.dir);
    const importRes = await request(`/public/signatures/${token}/external/import`, json({
      attemptId, pdfBase64: Buffer.from(signedBytes).toString('base64'),
      fingerprint: { visitorId: 'vis-stale-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(importRes.status).toBe(200);
    expect((await importRes.json() as any).validationStatus).toBe('validada');
    const confirmRes = await request(`/public/signatures/${token}/external/confirm`, json({
      attemptId, idempotencyKey: randomUUID(),
      fingerprint: { visitorId: 'vis-stale-accept', version: 'fingerprintjs-oss-5' },
      acceptanceText: 'aceito', confirmed: true,
    }));
    expect(confirmRes.status).toBe(409);
    const staleBody = await confirmRes.json() as any;
    expect(staleBody.code).toBe('STALE_DOCUMENT_REVISION');
    expect(staleBody.currentRevisionId).not.toBe(document.revisionId);
  });

  it('lets the clinic representative sign externally through the panel', async () => {
    const db = getDatabase();
    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    const sessionUser = (await db.select().from(authUsers).where(eq(authUsers.tenantId, tenantId)))[0]!;
    const representative = participants.find((p) => p.role === 'professional' && p.status === 'pending')!;
    expect(representative).toBeDefined();

    const repSigner = await issueTestSigner(ca, { commonName: 'Representante Externo', cpfDigits: '11144477735', email: sessionEmail });
    const docRow = await currentDocumentOf(db, representative.processId);
    const exportRes = await request(`/api/signature-participants/${representative.id}/external/export`, json({
      documentId: docRow.documentId, baseRevisionId: docRow.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-rep-export', version: 'fingerprintjs-oss-5' },
    }));
    expect(exportRes.status).toBe(200);
    const { attemptId } = await exportRes.json() as any;
    const fileRes = await request(`/api/signature-participants/${representative.id}/external/${attemptId}/file`);
    expect(fileRes.status).toBe(200);
    const exportBytes = new Uint8Array(await fileRes.arrayBuffer());
    const signedBytes = await buildSignedReturnPdf(exportBytes, repSigner, ca.dir);
    const importRes = await request(`/api/signature-participants/${representative.id}/external/import`, json({
      attemptId, pdfBase64: Buffer.from(signedBytes).toString('base64'),
      fingerprint: { visitorId: 'vis-rep-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(importRes.status).toBe(200);
    expect((await importRes.json() as any).validationStatus).toBe('validada');
    const confirmRes = await request(`/api/signature-participants/${representative.id}/external/confirm`, json({
      attemptId, idempotencyKey: randomUUID(),
      fingerprint: { visitorId: 'vis-rep-accept', version: 'fingerprintjs-oss-5' },
      acceptanceText: 'aceito pelo representante', confirmed: true,
    }));
    expect(confirmRes.status).toBe(200);
    expect((await confirmRes.json() as any).processCompleted).toBe(true);
    const operation = (await db.select().from(signatureOperations).where(and(eq(signatureOperations.tenantId, tenantId), eq(signatureOperations.participantId, representative.id))))[0]!;
    expect(operation.identitySnapshot).toMatchObject({ role: 'professional', userId: sessionUser.id, tenantId });
  });

  async function currentDocumentOf(db: ReturnType<typeof getDatabase>, processId: string) {
    const process = (await db.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, processId))))[0]!;
    const row = (await db.select({ document: appliedDocuments, revision: appliedDocumentRevisions }).from(appliedDocuments).innerJoin(appliedDocumentRevisions, and(eq(appliedDocumentRevisions.tenantId, appliedDocuments.tenantId), eq(appliedDocumentRevisions.id, appliedDocuments.currentRevisionId))).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, process.followupContractId))))[0]!;
    return { documentId: row.document.id, revisionId: row.revision.id };
  }
});
